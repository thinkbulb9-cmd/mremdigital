/** Unit tests for the legacy catalogue engine: npm run test:legacy
 * Fixtures are SYNTHETIC pages modelled on the confirmed Jan_Apr_2021/101 layout (subjectId table,
 * Content dropdown, displayvideo.html?type1=...). They are not copies of archive files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalogueHtml,parseCatalogueCsv,viewerPrefixes,meaningfulLabel,displayCase,decodeHtmlBytes} from './parse.mjs';
import {resourceRefs,normalizeRef,candidatePaths,chooseMatch,rootInfo,lectureOf,handlerViewer} from './resolve.mjs';
import {planCourses,planLectures,LEGACY_SOURCE} from './consolidate.mjs';

const DISCIPLINE_PAGE=`<html><head><title>Aerospace</title><script>function go(s){location='displayvideo.html?type1='+s.value}</script></head><body>
<table border=1><tr><th>subjectId</th><th>Discipline Name</th><th>Subject Name</th><th>Coordinators</th><th>Type</th><th>Institute</th><th>Content</th></tr>
<tr><td>101104086</td><td>Aerospace Engineering</td><td>Computational Science in Engineering</td><td>Prof. Ashoke De</td><td>Video</td><td>IIT Kanpur</td>
<td><form action="displayvideo.html" method="get"><select name="type1"><option value="">-- Select --</option>
<option value="101104086/mod01lec01.mp4">mod01lec01</option><option value="101104086/mod01lec02.mp4">Lecture 2</option></select></form></td></tr>
<tr><td>101101086</td><td>Aerospace Engineering</td><td>Introduction to Launch Vehicle Analysis and Design</td><td>Prof. Ashok Joshi</td><td>Video</td><td>IIT Bombay</td>
<td><select onchange="go(this)"><option value="101101086/mod01lec01.mp4">Introduction to Launch Vehicles</option></select>
<a href="displayvideo.html?type1=101101086%2Fmod02lec03.mp4">Staging and Trajectory</a></td></tr>
<tr><td colspan=7>Total: 2 courses</td></tr></table></body></html>`;
/** Markup quirks seen in the real Jan_Apr_2021/101/index.html (read 2026-10-31): unquoted option values,
 * a "#" placeholder, <br> inside options, a commented-out option for another course, lowercase type and
 * </form> closing after </tr>. Row data is synthetic beyond the course row itself. */
const OBSERVED_ROW=(id)=>`<tr>
 <td>${id}</td>
 <td>Aerospace Engineering</td>
 <td>Lighter than Air Systems</td>
 <td>Prof. Rajkumar Pant</td>
 <td>video</td>
 <td>IIT Bombay</td>
 <td>
  <form name="jk123" action="displayvideo.html" method="get" target="_blank">
<select name="type1" id="type1" onchange='this.form.submit();'>
   <option  value="#">Select</option>
   <option value=${id}/mod01lec01.mp4>Lecture 1<br></option><option value=${id}/mod01lec02.mp4>Lecture 2<br></option><!-- <option
value='103103162/mod01lec01.mp4'>Lecture 01</option>
 --></select></td></tr></form>
`;
const OBSERVED_PAGE=`<html><head><title>Aerospace</title><script>
function goToPage( id ) { var node = document.getElementById( id ); if( node && node.tagName == "SELECT" ) {
 window.location.href = node.options[node.selectedIndex].value; } }
</script></head><body><div><div id="top"><img src="images/12345.png" /></div>
<table width=100%>
  <tr style=text-align:center;>
    <th>subjectId</th><th>Discipline Name</th><th>Subject Name</th><th>Coordinators</th><th>Type</th><th>Institute</th><th>Content</th>
  </tr>
${OBSERVED_ROW('101101087')}${OBSERVED_ROW('101101086')}
</table></div></body></html>`;
const VARIANT_PAGE=`<table><thead><tr><td>S.No</td><td>Course ID</td><td>COURSE NAME</td><td colspan=2>Faculty</td><td>Institution</td></tr></thead>
<tbody><tr><td>1</td><td>101108086</td><td>GASDYNAMICS: FUNDAMENTALS &amp;amp; APPLICATIONS</td><td colspan=2>Prof. Srisha Rao M V</td><td>IISc Bangalore</td></tr></tbody></table>`;

test('finds the catalogue table by header names and extracts every field',()=>{
 const p=parseCatalogueHtml(DISCIPLINE_PAGE);
 assert.equal(p.courses.length,2);
 assert.equal(p.skippedRows,1);
 const [a,b]=p.courses;
 assert.deepEqual({...a,links:undefined},{course_code:'101104086',title:'Computational Science in Engineering',
  raw_title:'Computational Science in Engineering',discipline:'Aerospace Engineering',
  coordinators:'Prof. Ashoke De',course_type:'Video',institution:'IIT Kanpur',links:undefined});
 assert.equal(a.links.filter(l=>l.via==='option').length,2,'empty placeholder option is dropped');
 assert.equal(a.links[0].viewer,'displayvideo.html');
 assert.equal(b.links.find(l=>l.via==='href').value,'displayvideo.html?type1=101101086%2Fmod02lec03.mp4');
});
test('observed 101 markup: every row keeps its own form viewer; placeholder and commented options are dropped',()=>{
 const p=parseCatalogueHtml(OBSERVED_PAGE);
 assert.deepEqual(p.courses.map(c=>c.course_code),['101101087','101101086']);
 assert.equal(p.skippedRows,0);
 for(const c of p.courses){
  assert.equal(c.course_type,'video');
  assert.deepEqual(c.links.map(l=>[l.value,l.label,l.viewer,l.param]),
   [[c.course_code+'/mod01lec01.mp4','Lecture 1','displayvideo.html','type1'],[c.course_code+'/mod01lec02.mp4','Lecture 2','displayvideo.html','type1']]);
 }
 assert.ok(!JSON.stringify(p).includes('103103162'),'commented-out option is ignored');
 // Jul-Dec-2021/102 writes some titles as "NOC:Environmental Biotechnology".
 const noc=parseCatalogueHtml(OBSERVED_PAGE.replace('Lighter than Air Systems','NOC:Lighter than Air Systems'));
 assert.equal(noc.courses[0].title,'Lighter than Air Systems');
 assert.equal(noc.courses[0].raw_title,'NOC:Lighter than Air Systems','original wording is kept for reconciliation');
});
test('observed displayvideo.html embeds type1 as-is, so no folder prefix is inferred',()=>{
 const viewer=`<script LANGUAGE="JavaScript">
function getParams(){ var idx = document.URL.indexOf('?'); var params = new Array();
if (idx != -1) { var pairs = document.URL.substring(idx+1, document.URL.length).split('&');
for (var i=0; i<pairs.length; i++){ nameVal = pairs[i].split('='); params[nameVal[0]] = nameVal[1]; } } return params; }
params = getParams();
type2 = unescape(params["type1"]);
//document.writeln('<a href="www.google.co.in">'+ex+' google</a>');
//document.writeln('<iframe src='+type2+' width="1000" height="900px" id="ifram">');
document.writeln('<EMBED SRC='+type2+' WIDTH="750" HEIGHT="550" autostart="true" LOOP="true"></EMBED>');
</script>`;
 assert.deepEqual(viewerPrefixes(viewer),[]);
 const c=candidatePaths({ref:'101104086/mod01lec01.mp4',viewer:'displayvideo.html'},'Jan_Apr_2021/101/index.html','E:\\',
  new Map([['Jan_Apr_2021/101/displayvideo.html',viewerPrefixes(viewer)]]));
 assert.deepEqual(c.paths,['Jan_Apr_2021/101/101104086/mod01lec01.mp4']);
});
test('tolerates other column orders, colspans, td headers, caps and double-escaped entities',()=>{
 const [c]=parseCatalogueHtml(VARIANT_PAGE).courses;
 assert.equal(c.course_code,'101108086');
 assert.equal(c.coordinators,'Prof. Srisha Rao M V');
 assert.equal(c.institution,'IISc Bangalore');
 assert.equal(c.title,'GASDYNAMICS: FUNDAMENTALS & APPLICATIONS');
 assert.equal(displayCase(c.title),'Gasdynamics: Fundamentals & Applications');
 assert.equal(displayCase('Computational Science in Engineering'),'Computational Science in Engineering');
});
test('scripts are never run; a page without a subject table yields no courses',()=>{
 const p=parseCatalogueHtml('<script>document.write("<table><tr><td>subjectId</td><td>Subject Name</td></tr><tr><td>101104086</td><td>X</td></tr></table>")</script>');
 assert.equal(p.courses.length,0);
});
test('CSV catalogue exports use the same header detection',()=>{
 const p=parseCatalogueCsv('\uFEFFsubjectId,Subject Name,Discipline Name\r\n101104086,"Computational Science, in Engineering",Aerospace Engineering\r\n');
 assert.equal(p.courses[0].title,'Computational Science, in Engineering');
});
test('decodes legacy Windows-1252 pages',()=>{
 const buf=Buffer.from([...Buffer.from('<meta charset="iso-8859-1">Caf'),0xe9]);
 assert.match(decodeHtmlBytes(buf),/Café$/);
});
test('decodes the displayvideo query value to the resource path',()=>{
 assert.deepEqual(resourceRefs('displayvideo.html?type1=101104086%2Fmod01lec01.mp4'),
  [{ref:'101104086/mod01lec01.mp4',viewer:'displayvideo.html',param:'type1'}]);
 assert.deepEqual(resourceRefs('displayvideo.html?type1=101104086%252Fmod01lec01.mp4')[0].ref,'101104086/mod01lec01.mp4');
 assert.deepEqual(resourceRefs("javascript:play('101104086/mod01lec01.mp4')")[0].ref,'101104086/mod01lec01.mp4');
 assert.deepEqual(resourceRefs('https://nptel.ac.in/x.mp4'),[{external:'https://nptel.ac.in/x.mp4'}]);
 assert.deepEqual(resourceRefs('../index.html'),[]);
 assert.equal(handlerViewer("location='displayvideo.html?type1='+this.value"),'displayvideo.html');
});
test('paths cannot leave the archive root',()=>{
 assert.deepEqual(normalizeRef('101104086/mod01lec01.mp4','Jan_Apr_2021/101','E:\\'),{rel:'Jan_Apr_2021/101/101104086/mod01lec01.mp4'});
 assert.equal(normalizeRef('../../../Windows/win.ini','Jan_Apr_2021/101','E:\\').error,'escapes-archive-root');
 assert.deepEqual(normalizeRef('E:\\Jan_Apr_2021\\101\\a.mp4','x','E:\\'),{rel:'Jan_Apr_2021/101/a.mp4'});
 assert.equal(normalizeRef('C:\\Users\\a.mp4','x','E:\\').error,'absolute-path-outside-archive');
 assert.equal(normalizeRef('a:b/c.mp4','x','E:\\').error,'invalid-segment');
});
test('viewer prefixes from displayvideo.html become candidate folders',()=>{
 const prefixes=viewerPrefixes('<script>var f=getParam("type1");document.getElementById("v").src="videos/"+f;</script>');
 assert.deepEqual(prefixes,['videos/']);
 const c=candidatePaths({ref:'101104086/mod01lec01.mp4',viewer:'displayvideo.html'},'Jan_Apr_2021/101/index.html','E:\\',
  new Map([['Jan_Apr_2021/101/displayvideo.html',prefixes]]));
 assert.deepEqual(c.paths,['Jan_Apr_2021/101/101104086/mod01lec01.mp4','Jan_Apr_2021/101/videos/101104086/mod01lec01.mp4']);
});
const file=(id,rel,code)=>({id,rel_path:rel,course_code:code,module_no:1,lecture_no:1,kind:'Video',ext:'.mp4'});
test('matches exact paths, then course-scoped suffixes, never filename alone',()=>{
 const a=file('1','Jan_Apr_2021/101/101104086/mod01lec01.mp4','101104086');
 assert.equal(chooseMatch({ref:'101104086/mod01lec01.mp4',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[a]}).method,'exact-path');
 const moved=file('2','Jan_Apr_2021/101/101104086/videos/mod01lec01.mp4','101104086');
 const m=chooseMatch({ref:'101104086/mod01lec01.mp4',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[],courseFiles:[moved]});
 assert.equal(m.status,'unresolved','folder structure of the reference must be preserved');
 const s=chooseMatch({ref:'mod01lec01.mp4',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[],courseFiles:[moved]});
 assert.deepEqual([s.status,s.method,s.confidence],['matched','semester-course-suffix','medium']);
 const other=file('3','Jul_Dec_2021/101/101104086/mod01lec01.mp4','101104086');
 assert.equal(chooseMatch({ref:'mod01lec01.mp4',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[other],courseFiles:[other]}).status,'unresolved');
 const twin=file('4','Jan_Apr_2021/101/101104086/old/mod01lec01.mp4','101104086');
 assert.equal(chooseMatch({ref:'mod01lec01.mp4',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[],courseFiles:[moved,twin]}).status,'conflict');
 const wrong=file('5','Jan_Apr_2021/101/101101086/mod01lec01.mp4','101101086');
 assert.equal(chooseMatch({ref:'x',courseCode:'101104086',semesterRoot:'Jan_Apr_2021',exactHits:[wrong]}).status,'conflict');
});
test('semester roots: known patterns are recognized, others go to review',()=>{
 // The eight top-level folders on E: as listed 2026-10-31 (note the hyphenated Jan-Apr-2022 and Jul-Dec-2021).
 for(const r of ['Jan_Apr_2021','Jan_Apr_2023','Jan_Apr_2024','Jan-Apr-2022','Jul_Dec_2022','Jul_Dec_2023','Jul-Dec-2021','Web_courses'])assert.equal(rootInfo(r).recognized,true,r);
 assert.equal(rootInfo('Backup_Old').recognized,false);
 assert.equal(rootInfo('Backup_Old',['backup_old']).recognized,true);
 assert.ok(rootInfo('Jul_Dec_2021').order>rootInfo('Jan_Apr_2021').order);
 assert.deepEqual(lectureOf('mod01lec02.mp4'),{module_no:1,lecture_no:2});
});
test('only meaningful labels become lecture titles',()=>{
 assert.equal(meaningfulLabel('mod01lec01','mod01lec01.mp4'),false);
 assert.equal(meaningfulLabel('Lecture 2','mod01lec02.mp4'),false);
 assert.equal(meaningfulLabel('-- Select --',''),false);
 assert.equal(meaningfulLabel('Module 1 Lecture 1','x.mp4'),false);
 assert.equal(meaningfulLabel('Introduction to Launch Vehicles','mod01lec01.mp4'),true);
 // Labels seen on the real Web_courses pages that name material, figures or actions rather than a lecture.
 for(const l of ['Lesson 21','Teacher Slides','Lesson 3 Slides','Sample Questions','Course Objectives','Glossary','Fig. 10.18 (b)',
  'eqn (6.37)','Table 7.1','click here to enlarge','Download this lecture as pdf','Hyperlink-2','Application 14','Schematic3','Case Study II','5.ppt'])
  assert.equal(meaningfulLabel(l,'m111.pdf'),false,l);
 assert.equal(meaningfulLabel('Image Sampling','m111.pdf'),true);
});
const rec=(o)=>({course_code:'101104086',title:'Computational Science in Engineering',discipline:'Aerospace Engineering',coordinators:'Prof. Ashoke De',
 institution:'IIT Kanpur',semester_root:'Jan_Apr_2021',source_rel_path:'Jan_Apr_2021/101/index.html',order:20211,inventory_files:40,...o});
test('verified metadata is preserved and every disagreement is reported',()=>{
 const existing=new Map([['101104086',{course_code:'101104086',title:'Computational Science in Engineering',department:'Aerospace Engineering',
  instructor:'Prof. Ashok De',institution:'IIT Kanpur',title_source:'Official NPTEL catalogue',verified:true}]]);
 const {courses,conflicts}=planCourses([rec({})],existing);
 assert.equal(courses[0].action,'preserve-existing-conflict');
 assert.deepEqual(conflicts.map(c=>[c.field,c.existing_value,c.extracted_value,c.resolution]),[['instructor','Prof. Ashok De','Prof. Ashoke De','existing-preserved']]);
});
test('placeholder and prefix-inferred rows are upgraded; courses without files are skipped',()=>{
 const existing=new Map([['101108086',{title:'Course 101108086',department:'Aerospace Engineering',title_source:'nptel-discipline-prefix-inferred',verified:false}]]);
 const {courses}=planCourses([rec({course_code:'101108086',title:'Gasdynamics: Fundamentals and Applications'}),rec({course_code:'101999999',inventory_files:0})],existing);
 assert.deepEqual(courses.map(c=>[c.course_code,c.action,c.confidence]),[['101108086','update','high'],['101999999','skip-no-indexed-files','high']]);
});
test('title differences between semesters are kept per semester and lower confidence',()=>{
 const {courses,conflicts}=planCourses([rec({}),rec({semester_root:'Jul_Dec_2021',order:20212,title:'Computational Science in Engg.',source_rel_path:'Jul_Dec_2021/101/index.html'})],new Map());
 assert.equal(courses[0].confidence,'medium');
 assert.equal(courses[0].title,'Computational Science in Engg.');
 assert.equal(conflicts[0].conflict_type,'title-differs-between-semesters');
});
test('lecture titles stay attached to their own file when semesters disagree',()=>{
 const l=(id,sem,title)=>({resource_id:id,course_code:'101101086',semester_root:sem,module_no:1,lecture_no:1,title,confidence:'high',source_rel_path:sem+'/101/index.html'});
 const same=planLectures([l('1','Jan_Apr_2021','Intro'),l('2','Jul_Dec_2021','Intro')],new Map());
 assert.equal(same.fileTitles.length,2);assert.equal(same.lectures.length,1);
 const diff=planLectures([l('1','Jan_Apr_2021','Intro'),l('2','Jul_Dec_2021','Overview')],new Map());
 assert.equal(diff.fileTitles.length,2);assert.equal(diff.lectures.length,0);
 const reviewed=planLectures([l('1','Jan_Apr_2021','Intro')],new Map([['101101086|1|1',{title:'Reviewed title',title_source:'reviewed'}]]));
 assert.equal(reviewed.lectures.length,0);assert.equal(reviewed.conflicts[0].resolution,'existing-preserved');
 assert.equal(LEGACY_SOURCE,'legacy-nptel-html-catalogue');
});
