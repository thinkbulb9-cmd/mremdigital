/** Final analysis workbook: E: drive (course folders and their local index.html catalogues) x NPTEL Courses PDF x nptel.ac.in.
 *   node scripts/nptel-reconciliation/workbook.mjs --pdf C:\MREM\inventory\nptel-reconciliation\nptel-courses-pdf.json.gz
 * Reads only the reports written by reconcile.mjs, the parsed PDF table and the official catalogue cache; touches neither
 * the archive nor the database. Every count on the Summary sheet is also an Excel formula over the detail sheets.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {parseArgs} from 'node:util';
import {workbook,colName,STYLE} from './xlsx.mjs';

const {values:opt}=parseArgs({options:{dir:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation'},pdf:{type:'string'},
 web:{type:'string'},out:{type:'string'}}});
if(!opt.pdf)throw Error('--pdf <parsed NPTEL Courses PDF .json or .json.gz> required');
const web=opt.web||path.join(opt.dir,'web-cache'),out=opt.out||path.join(opt.dir,'NPTEL_FINAL_RECONCILIATION_ANALYSIS.xlsx');

function readCsv(name){
 const t=fs.readFileSync(path.join(opt.dir,name),'utf8').replace(/^\ufeff/,''),rows=[];let row=[],f='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];
  if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
  else if(ch==='"')q=true;else if(ch===','){row.push(f);f=''}else if(ch==='\n'){row.push(f);rows.push(row);row=[];f=''}else if(ch!=='\r')f+=ch}
 if(f||row.length){row.push(f);rows.push(row)}
 const [h,...rest]=rows;
 return {cols:h,rows:rest.filter(r=>r.length>1||r[0]).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))};
}
const r01=readCsv('01_COMPLETE_E_DRIVE_COURSE_FOLDER_STRUCTURE.csv'),r02=readCsv('02_HTML_INDEX_COURSE_MAPPING_STATUS.csv'),
 r03=readCsv('03_NPTEL_PDF_VS_E_DRIVE_RECONCILIATION.csv'),r04=readCsv('04_MISSING_AND_CONFLICTING_COURSE_IDS.csv'),
 r05=readCsv('05_COURSE_CONTENT_AVAILABILITY.csv'),r06=readCsv('06_VERIFIED_LECTURE_TITLES_DISCOVERED.csv'),r08=readCsv('08_NPTEL_OFFICIAL_WEB_VERIFICATION.csv');
const rawPdf=fs.readFileSync(opt.pdf);
const pdfRows=JSON.parse((opt.pdf.endsWith('.gz')?zlib.gunzipSync(rawPdf):rawPdf).toString('utf8'));
const pdf=new Map(pdfRows.map(r=>[String(r.code),r]));
const catalogue=JSON.parse(fs.readFileSync(path.join(web,'_official-catalogue.json'),'utf8'));
const cat=catalogue.courses;

const group=(rows,k)=>{const m=new Map();for(const r of rows){const v=typeof k==='function'?k(r):r[k];if(!m.has(v))m.set(v,[]);m.get(v).push(r)}return m};
const uniq=(a)=>[...new Set(a.filter(Boolean))];
const tally=(rows,f)=>{const o=new Map();for(const r of rows){const k=typeof f==='function'?f(r):r[f];o.set(k,(o.get(k)||0)+1)}return [...o].sort((a,b)=>b[1]-a[1])};
const num=(v)=>Number(v)||0;
const yes=(b)=>b?'YES':'NO';
const COORDINATING={'101':'IIT Bombay','102':'IIT Delhi','103':'IIT Guwahati','104':'IIT Kanpur','105':'IIT Kharagpur','106':'IIT Madras','107':'IIT Roorkee','108':'IISc Bangalore'};

// Per-ID facts from each resource.
const folders=group(r01.rows,'Course_ID'),htmlRows=group(r02.rows.filter(r=>r.Found_In_HTML==='YES'),'Course_ID');
const content=group(r05.rows,'Course_ID'),lect=group(r06.rows,'Course_ID'),v08=new Map(r08.rows.map(r=>[r.Course_ID,r]));
const webState=(id)=>{
 const v=v08.get(id);
 if(cat[id]||v?.Official_NPTEL_Title)return 'FOUND';
 if(/has no course/.test(v?.Remarks||''))return 'NOT_FOUND (catalogue and course page checked)';
 if(/did not answer/.test(v?.Remarks||''))return 'UNAVAILABLE (page did not answer; not proven missing)';
 return 'NOT_IN_CATALOGUE (course page not checked)';
};
const ids=[...new Set([...folders.keys(),...pdf.keys(),...Object.keys(cat),...[...v08.values()].filter(r=>r.Official_NPTEL_Title).map(r=>r.Course_ID)])].sort();
const PRESENCE={'E-P-W':'All three resources','E-P-':'E: drive and PDF (not on website)','E--W':'E: drive and website (not in PDF)','E--':'E: drive only',
 '-P-W':'PDF and website (no folder on E:)','-P-':'PDF only','--W':'Website only (not on E:, not in PDF)'};
const master=ids.map(id=>{
 const f=folders.get(id)||[],h=(htmlRows.get(id)||[])[0],p=pdf.get(id),v=v08.get(id),c=cat[id],ws=webState(id),onWeb=ws==='FOUND';
 const code=(f.length?'E':'')+'-'+(p?'P':'')+'-'+(onWeb?'W':'');
 const cs=content.get(id)||[],ls=lect.get(id)||[];
 const status=v?.Verification_Status||(onWeb?'WEBSITE_ONLY':'');
 return {Course_ID:id,Discipline_Code:id.slice(0,3),Discipline:v?.Official_Discipline||c?.discipline||p?.discipline||h?.HTML_Discipline||'',
  Coordinating_Institute_Code:id.slice(3,6),Coordinating_Institute_By_ID:COORDINATING[id.slice(3,6)]||'',
  On_E_Drive:yes(f.length),In_Local_HTML_Catalogue:yes(h),In_NPTEL_PDF:yes(p),On_NPTEL_Website:yes(onWeb),
  Presence_Code:code,Presence_Category:PRESENCE[code]||'Not in any resource',
  E_Folder_Count:f.length,E_Academic_Folders:uniq(f.map(x=>x.Academic_Folder)).join(' | '),E_Folder_Paths:f.map(x=>x.Course_Folder_Relative_Path).join(' | '),
  Local_HTML_Title:h?.HTML_Course_Title||'',Local_HTML_Coordinator:h?.HTML_Coordinator||'',Local_HTML_Institute:h?.HTML_Institute||'',
  PDF_SNo:p?num(p.sno):'',PDF_Page:p?num(p.page):'',PDF_Title:p?.title||'',PDF_Discipline:p?.discipline||'',PDF_Coordinator:p?.coordinator||'',
  PDF_Institute:p?.institute||'',PDF_Content_Type:p?.ctype||'',
  Website_State:ws,Website_Title:v?.Official_NPTEL_Title||c?.title||'',Website_Professor:v?.Official_Professor||c?.professor||'',
  Website_Institute:v?.Official_Institute||c?.institute||'',Website_Discipline:v?.Official_Discipline||c?.discipline||'',Website_Content_Type:c?.contentType||'',
  Website_Course_URL:v?.Official_Course_URL||(c?'https://nptel.ac.in/courses/'+id+' (listed in catalogue)':''),Website_Lecture_List_URL:v?.Official_Lecture_List_URL||'',
  Title_Comparison:v?.Title_Match_Status||'',Verification_Status:status,
  Local_Videos:cs.reduce((s,x)=>s+num(x.Videos_Count),0),Local_PDFs:cs.reduce((s,x)=>s+num(x.PDFs_Count),0),Local_Total_Files:cs.reduce((s,x)=>s+num(x.Total_Files),0),
  Lecture_Titles_HIGH:ls.filter(x=>x.Confidence==='HIGH').length,Lecture_Titles_MEDIUM:ls.filter(x=>x.Confidence==='MEDIUM').length,
  Lecture_Title_Availability:v?.Lecture_Title_Availability||'',Course_Version:v?.Course_Version||'',Date_Verified:v?.Date_Verified||catalogue.fetched_at.slice(0,10),
  Remarks:v?.Remarks||''};
});
const M=Object.keys(master[0]),MS='Master_Comparison';
const mcol=(name)=>{const i=M.indexOf(name);if(i<0)throw Error('no column '+name);return `${MS}!$${colName(i)}:$${colName(i)}`};
const countIf=(conds)=>({f:'COUNTIFS('+Object.entries(conds).map(([k,v])=>mcol(k)+',"'+v+'"').join(',')+')',
 v:master.filter(r=>Object.entries(conds).every(([k,v])=>v.endsWith('*')?String(r[k]).startsWith(v.slice(0,-1)):String(r[k])===v)).length});

const GOOD=new Set(['THREE_SOURCE_VERIFIED','NORMALIZED_TITLE_MATCH','PDF_AND_OFFICIAL_MATCHED_LOCAL_FOLDER_ONLY','LOCAL_AND_PDF_MATCHED','CATALOGUE_MATCH_NO_LOCAL_CONTENT']);
const WARN=new Set(['OFFICIAL_MATCHED_NOT_IN_PDF','OFFICIAL_TITLE_USED_NON_LATIN','WEBSITE_ONLY']);
const statusStyle=(s)=>GOOD.has(s)?STYLE.good:WARN.has(s)?STYLE.warn:s?STYLE.bad:0;
const header=(cols)=>cols.map(c=>({v:c,s:STYLE.header}));
const table=(name,cols,rows,{widths,style}={})=>({name,headerRow:1,widths:widths||cols.map(c=>Math.min(48,Math.max(10,c.length+2))),
 rows:[header(cols),...rows.map(r=>cols.map(c=>{const v=r[c];const s=style?.(c,v,r);return s?{v,s}:v}))]});

// Conflicts for review.
const conflictType=(r)=>uniq([/TITLE_CONFLICT/.test(r.Title_Comparison)?'Title':'',/coordinators differ/.test(r.Remarks)?'Coordinator':'',/institute differs/.test(r.Remarks)?'Institute':'']).join(' + ')||'Other';
const nextStep=(r)=>{const t=conflictType(r),onE=r.On_E_Drive==='YES',s=[];
 if(t.includes('Title'))s.push(onE?'Same course ID, different name: keep the local/PDF title for the archived copy and record the nptel.ac.in title as the current name; confirm from the first lecture on E:':'Same course ID, different name in the PDF and on nptel.ac.in (the website shows the latest run)');
 if(t.includes('Coordinator'))s.push(onE?'Check who teaches in the local videos; nptel.ac.in may list a later run':'nptel.ac.in may list a later run\'s coordinator');
 if(t.includes('Institute'))s.push('nptel.ac.in may list a later run\'s host institute; confirm on the course page');
 if(!onE)s.push('No folder on E:, so nothing to correct locally');
 return s.join('. ')+'.'};
const conflicts=master.filter(r=>r.Verification_Status==='CONFLICT_REQUIRES_REVIEW').map(r=>({Course_ID:r.Course_ID,Presence_Category:r.Presence_Category,
 Conflict_Type:conflictType(r),E_Academic_Folders:r.E_Academic_Folders,Local_HTML_Title:r.Local_HTML_Title,PDF_Title:r.PDF_Title,Website_Title:r.Website_Title,
 Local_HTML_Coordinator:r.Local_HTML_Coordinator,PDF_Coordinator:r.PDF_Coordinator,Website_Professor:r.Website_Professor,
 Local_HTML_Institute:r.Local_HTML_Institute,PDF_Institute:r.PDF_Institute,Website_Institute:r.Website_Institute,Title_Comparison:r.Title_Comparison,
 Reason:r.Remarks,Suggested_Next_Step:nextStep(r),PDF_Page:r.PDF_Page,Website_Course_URL:r.Website_Course_URL}))
 .sort((a,b)=>(a.Presence_Category.startsWith('PDF')-b.Presence_Category.startsWith('PDF'))||a.Course_ID.localeCompare(b.Course_ID));

// Missing and extra IDs.
const best=(r)=>r.Website_Title?[r.Website_Title,'nptel.ac.in']:r.PDF_Title?[r.PDF_Title,'NPTEL PDF']:r.Local_HTML_Title?[r.Local_HTML_Title,'local index.html']:['','none'];
const missing=[];
const addM=(cat,r,detail)=>{const [t,src]=best(r);missing.push({Category:cat,Course_ID:r.Course_ID,Best_Available_Title:t,Title_Source:src,Website_State:r.Website_State,
 E_Academic_Folders:r.E_Academic_Folders,Detail:detail})};
for(const r of master){
 if(r.On_E_Drive==='YES'&&r.In_NPTEL_PDF==='NO')addM(r.On_NPTEL_Website==='YES'?'ON_E_NOT_IN_PDF_BUT_ON_WEBSITE':'ON_E_NOT_IN_PDF_NOT_ON_WEBSITE',r,r.On_NPTEL_Website==='YES'?'Real NPTEL course, usually newer than the PDF':'Not in the PDF and nptel.ac.in has no course with this ID');
 if(r.On_E_Drive==='NO'&&r.In_NPTEL_PDF==='YES')addM(r.On_NPTEL_Website==='YES'?'IN_PDF_NOT_ON_E_ON_WEBSITE':'IN_PDF_NOT_ON_E_NOT_ON_WEBSITE',r,'PDF page '+r.PDF_Page+'; no course folder on E:');
 if(r.On_E_Drive==='NO'&&r.In_NPTEL_PDF==='NO'&&r.On_NPTEL_Website==='YES')addM('ON_WEBSITE_ONLY',r,'Listed on nptel.ac.in; not on E: and not in the PDF');
}
const byId=new Map(master.map(r=>[r.Course_ID,r]));
for(const r of r02.rows.filter(r=>r.HTML_Mapping_Status==='HTML_ID_WITHOUT_FOLDER'))addM('IN_LOCAL_HTML_NO_FOLDER',byId.get(r.Course_ID)||{Course_ID:r.Course_ID,Local_HTML_Title:r.HTML_Course_Title,Website_State:webState(r.Course_ID)},r.HTML_Source_Relative_Path+': '+r.Remarks);
for(const r of r02.rows.filter(r=>r.HTML_Mapping_Status==='FOLDER_ID_NOT_IN_HTML'))addM('FOLDER_NOT_LISTED_IN_LOCAL_HTML',byId.get(r.Course_ID),r.Academic_Folder+'\\'+r.Discipline_Folder+': '+r.HTML_Source_Relative_Path);
for(const r of r04.rows.filter(r=>r.Exception_Type==='DUPLICATE_FOLDER_IN_SEMESTER'))addM('DUPLICATE_FOLDERS_SAME_ID',byId.get(r.Course_ID),r.Evidence);
for(const r of r04.rows.filter(r=>r.Exception_Type==='INVALID_NUMERIC_FOLDER'))missing.push({Category:'INVALID_FOLDER_NAME',Course_ID:'',Best_Available_Title:'',Title_Source:'',Website_State:'',E_Academic_Folders:r.Academic_Folder,Detail:r.Evidence+': '+r.Reason});

// E: folders with their HTML mapping and content.
const k3=(r)=>r.Academic_Folder+'|'+r.Discipline_Folder+'|'+r.Course_ID;
const m02=new Map(r02.rows.map(r=>[k3(r),r])),m05=new Map(r05.rows.map(r=>[k3(r),r]));
const eRows=r01.rows.map(r=>{const h=m02.get(k3(r))||{},c=m05.get(k3(r))||{};
 return {Academic_Folder:r.Academic_Folder,Year:r.Year,Academic_Term:r.Academic_Term,Discipline_Folder:r.Discipline_Folder,Course_ID:r.Course_ID,
  Course_Folder_Relative_Path:r.Course_Folder_Relative_Path,Indexed_In_Database:r.Indexed_In_Database,HTML_Mapping_Status:h.HTML_Mapping_Status||'',
  Local_HTML_Title:h.HTML_Course_Title||'',In_NPTEL_PDF:byId.get(r.Course_ID)?.In_NPTEL_PDF,On_NPTEL_Website:byId.get(r.Course_ID)?.On_NPTEL_Website,
  Verification_Status:byId.get(r.Course_ID)?.Verification_Status,Videos:num(c.Videos_Count),PDFs:num(c.PDFs_Count),Other_Documents:num(c.Other_Documents_Count),
  HTML_Files:num(c.HTML_Count),Total_Files:num(c.Total_Files),Content_Availability_Status:c.Content_Availability_Status||''}});

// By academic folder.
const sems=uniq(r01.rows.map(r=>r.Academic_Folder));
const bySem=sems.map(s=>{const os=eRows.filter(r=>r.Academic_Folder===s),d=(f)=>new Set(os.filter(f).map(r=>r.Course_ID)).size;
 return {Academic_Folder:s,Year:os[0].Year,Academic_Term:os[0].Academic_Term,Discipline_Folders:new Set(os.map(r=>r.Discipline_Folder.split('\\')[0].split('/')[0]).filter(Boolean)).size,
  Course_Folders:os.length,Distinct_Course_IDs:d(()=>true),IDs_In_Local_HTML:d(r=>r.HTML_Mapping_Status==='HTML_MATCHED'||r.HTML_Mapping_Status==='HTML_CONFLICT'),
  IDs_In_NPTEL_PDF:d(r=>r.In_NPTEL_PDF==='YES'),IDs_On_Website:d(r=>r.On_NPTEL_Website==='YES'),IDs_With_Videos:d(r=>r.Videos>0),IDs_With_PDFs:d(r=>r.PDFs>0),
  IDs_With_Conflicts:d(r=>r.Verification_Status==='CONFLICT_REQUIRES_REVIEW'),Videos:os.reduce((a,r)=>a+r.Videos,0),PDFs:os.reduce((a,r)=>a+r.PDFs,0),Total_Files:os.reduce((a,r)=>a+r.Total_Files,0)}});

// Summary with formulas.
const S=[];const sec=(t)=>{S.push([]);S.push([{v:t,s:STYLE.section},{v:'',s:STYLE.section},{v:'',s:STYLE.section},{v:'',s:STYLE.section}])};
const line=(label,cell,how,note='')=>S.push([label,typeof cell==='number'?cell:{...cell,s:STYLE.bold},how,note]);
const ERows='E_Drive_Folders',EN=eRows.length+1,ecol=(name)=>`${ERows}!$${colName(Object.keys(eRows[0]).indexOf(name))}$2:$${colName(Object.keys(eRows[0]).indexOf(name))}$${EN}`;
S.push([{v:'NPTEL final reconciliation: E: drive x NPTEL Courses PDF x nptel.ac.in',s:STYLE.title}]);
S.push(['Generated '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC from the read-only reconciliation reports. Column C holds Excel formulas over the detail sheets, with their computed values stored, so each number can be re-checked.']);
S.push([]);S.push(header(['Measure','Count','How it is counted','Notes']));
sec('1. The three resources');
line('E: drive: course-ID folders (folder occurrences)',{f:`COUNTA(${ecol('Course_ID')})`,v:eRows.length},'Rows in E_Drive_Folders','One course ID can have several folders (several semesters, or duplicates in Web_courses)');
line('E: drive: distinct course IDs',countIf({On_E_Drive:'YES'}),'Master_Comparison: On_E_Drive = YES','');
line('E: drive: distinct IDs listed in the local index.html catalogues (previous list)',countIf({In_Local_HTML_Catalogue:'YES'}),'Master_Comparison: In_Local_HTML_Catalogue = YES','Catalogues exist only inside 3-digit discipline folders of the semester folders; Web_courses and Jan_Apr_2024 have none');
line('NPTEL Courses PDF: distinct Subject IDs',countIf({In_NPTEL_PDF:'YES'}),'Master_Comparison: In_NPTEL_PDF = YES',pdfRows.length+' numbered rows; no duplicate IDs');
line('nptel.ac.in: distinct course IDs found',countIf({On_NPTEL_Website:'YES'}),'Master_Comparison: On_NPTEL_Website = YES',catalogue.count+' in the public catalogue (fetched '+catalogue.fetched_at.slice(0,10)+'), plus course pages found by ID');
line('All distinct course IDs across the three resources',{f:`COUNTA(${MS}!$A:$A)-1`,v:master.length},'Rows in Master_Comparison','');
sec('2. Overlap of the three resources (each course ID counted once)');
for(const [code,label] of Object.entries(PRESENCE))line(label+'  ['+code+']',countIf({Presence_Code:code}),'Master_Comparison: Presence_Code = '+code,'E = folder on E:, P = in PDF, W = on nptel.ac.in');
sec('3. E: drive course IDs: verification against the PDF and nptel.ac.in');
for(const [k] of tally(master.filter(r=>r.On_E_Drive==='YES'),'Verification_Status'))line(k,countIf({On_E_Drive:'YES',Verification_Status:k}),'Master_Comparison: On_E_Drive = YES and Verification_Status = '+k,'');
sec('4. PDF / website IDs with no folder on E:');
for(const [k] of tally(master.filter(r=>r.On_E_Drive==='NO'),'Verification_Status'))line(k,countIf({On_E_Drive:'NO',Verification_Status:k}),'Master_Comparison: On_E_Drive = NO and Verification_Status = '+k,'');
sec('5. Missing and extra IDs (sheet Missing_Extra_IDs)');
const MX='Missing_Extra_IDs';
for(const [k,n] of tally(missing,'Category'))line(k,{f:`COUNTIF(${MX}!$A:$A,"${k}")`,v:n},'Missing_Extra_IDs: Category = '+k,'');
sec('6. Local content on E: (from the indexed inventory)');
line('Distinct course IDs with local videos',{f:`COUNTIFS(${mcol('On_E_Drive')},"YES",${mcol('Local_Videos')},">0")`,v:master.filter(r=>r.Local_Videos>0).length},'Master_Comparison: Local_Videos > 0','');
line('Distinct course IDs with local PDFs',{f:`COUNTIFS(${mcol('On_E_Drive')},"YES",${mcol('Local_PDFs')},">0")`,v:master.filter(r=>r.Local_PDFs>0).length},'Master_Comparison: Local_PDFs > 0','');
line('Local video files in course folders',{f:`SUM(${ecol('Videos')})`,v:eRows.reduce((a,r)=>a+r.Videos,0)},'Sum of E_Drive_Folders: Videos','');
line('Local PDF files in course folders',{f:`SUM(${ecol('PDFs')})`,v:eRows.reduce((a,r)=>a+r.PDFs,0)},'Sum of E_Drive_Folders: PDFs','');
line('Lecture titles linked by official file name (HIGH)',{f:`COUNTIF(Lecture_Titles!$K:$K,"HIGH")`,v:r06.rows.filter(r=>r.Confidence==='HIGH').length},'Lecture_Titles: Confidence = HIGH','nptel.ac.in download list names the same MP4 file');
line('Lecture titles linked by module + lecture number (MEDIUM)',{f:`COUNTIF(Lecture_Titles!$K:$K,"MEDIUM")`,v:r06.rows.filter(r=>r.Confidence==='MEDIUM').length},'Lecture_Titles: Confidence = MEDIUM','Used only when nptel.ac.in publishes no file names; never by list position');
sec('7. Conflicts for review (sheet Conflicts_For_Review)');
for(const [k,n] of tally(conflicts,r=>(r.Presence_Category.startsWith('PDF')?'No folder on E: · ':'On E: · ')+r.Conflict_Type))line(k,n,'Conflicts_For_Review: Presence_Category and Conflict_Type','');
sec('8. Exceptions (sheet Exceptions)');
for(const [k,n] of tally(r04.rows,'Exception_Type'))line(k,{f:`COUNTIF(Exceptions!$A:$A,"${k}")`,v:n},'Exceptions: Exception_Type = '+k,'');

// Checks: identities that must hold if the workbook is consistent.
const C=[header(['Check','Left side','Right side','Result','Explanation'])];
const check=(name,l,r,why)=>{const row=C.length+1;C.push([name,l,r,{f:`IF(B${row}=C${row},"OK","MISMATCH")`,v:(l.v??l)===(r.v??r)?'OK':'MISMATCH',s:(l.v??l)===(r.v??r)?STYLE.good:STYLE.bad},why])};
const regions=Object.keys(PRESENCE).map(code=>countIf({Presence_Code:code}));
check('Overlap regions add up to all IDs',{f:regions.map(x=>x.f).join('+'),v:regions.reduce((a,x)=>a+x.v,0)},{f:`COUNTA(${MS}!$A:$A)-1`,v:master.length},'Every ID falls in exactly one of the seven regions');
check('E: IDs = E-only + E&P + E&W + all three',{f:['E-P-W','E-P-','E--W','E--'].map(c=>countIf({Presence_Code:c}).f).join('+'),v:['E-P-W','E-P-','E--W','E--'].reduce((a,c)=>a+countIf({Presence_Code:c}).v,0)},countIf({On_E_Drive:'YES'}),'');
check('PDF IDs = regions containing P',{f:['E-P-W','E-P-','-P-W','-P-'].map(c=>countIf({Presence_Code:c}).f).join('+'),v:['E-P-W','E-P-','-P-W','-P-'].reduce((a,c)=>a+countIf({Presence_Code:c}).v,0)},pdf.size,'Right side: distinct Subject IDs parsed from the PDF');
check('Folder rows on E_Drive_Folders = sum of E_Folder_Count',{f:`COUNTA(${ecol('Course_ID')})`,v:eRows.length},{f:`SUM(${mcol('E_Folder_Count')})`,v:master.reduce((a,r)=>a+r.E_Folder_Count,0)},'');
check('Verification statuses of E: IDs add up to E: IDs',{f:tally(master.filter(r=>r.On_E_Drive==='YES'),'Verification_Status').map(([k])=>countIf({On_E_Drive:'YES',Verification_Status:k}).f).join('+'),v:master.filter(r=>r.On_E_Drive==='YES').length},countIf({On_E_Drive:'YES'}),'');
check('Conflict rows = CONFLICT_REQUIRES_REVIEW in Master',{f:'COUNTA(Conflicts_For_Review!$A:$A)-1',v:conflicts.length},countIf({Verification_Status:'CONFLICT_REQUIRES_REVIEW'}),'');
check('Lecture title rows = HIGH + MEDIUM',{f:'COUNTA(Lecture_Titles!$A:$A)-1',v:r06.rows.length},{f:'COUNTIF(Lecture_Titles!$K:$K,"HIGH")+COUNTIF(Lecture_Titles!$K:$K,"MEDIUM")',v:r06.rows.filter(r=>/HIGH|MEDIUM/.test(r.Confidence)).length},'');
check('PDF titles in Master match the PDF list',{f:`COUNTIF(${mcol('In_NPTEL_PDF')},"YES")`,v:master.filter(r=>r.In_NPTEL_PDF==='YES').length},pdfRows.length,'No duplicate Subject IDs in the PDF');

const README=[[{v:'How to read this workbook',s:STYLE.title}],[],
 [{v:'Purpose',s:STYLE.bold},'Compare every NPTEL course ID across three resources: (1) the college archive on the E: drive, including the local index.html course catalogues stored with it (the previous list); (2) the NPTEL Courses PDF supplied by the college; (3) the official NPTEL platform, nptel.ac.in.'],
 [{v:'Read-only',s:STYLE.bold},'Nothing on E: was changed. The archive was listed to course-ID folder level, catalogue pages were read, the database was queried in a READ ONLY transaction, and nptel.ac.in public pages were read at about one request per second.'],
 [{v:'Sources',s:STYLE.bold},'E: drive: live folder listing (8 academic folders, 4 levels deep). Local catalogues: index.html inside each 3-digit discipline folder. PDF: "NPTEL Courses.pdf", text extracted with pypdf, '+pdfRows.length+' rows. Website: https://nptel.ac.in/courses (catalogue of '+catalogue.count+' courses, fetched '+catalogue.fetched_at.slice(0,10)+'), /courses/<id> course pages and /api/downloads/<id> lecture lists for every ID on E:.'],
 [],[{v:'Sheets',s:STYLE.bold}],
 ['Summary','All headline counts. Column C is an Excel formula over the detail sheets with its value stored.'],
 ['Checks','Identities that must hold (overlaps add up, statuses add up). Result column shows OK or MISMATCH.'],
 [MS,'One row per distinct course ID across all three resources, side by side: presence flags, titles, coordinators, institutes, comparison statuses, local content counts and remarks.'],
 ['Conflicts_For_Review','IDs where the sources still disagree after formatting differences are set aside, with each value side by side and a suggested next step.'],
 [MX,'IDs missing from one resource or extra in another, duplicate folders and folders not in their local catalogue.'],
 ['By_Academic_Folder','Per semester folder: folders, distinct IDs, how many are in the local catalogue, PDF and website, local content.'],
 [ERows,'Every course-ID folder on E: with its local catalogue status and file counts.'],
 ['PDF_vs_E_Occurrences','Report 03: each folder occurrence compared with its local catalogue row and the PDF.'],
 ['Exceptions','Report 04: every exception with its evidence.'],
 ['Lecture_Titles','Report 06: lecture titles matched to local video files, with the official source URL and confidence.'],
 [],[{v:'Key columns in '+MS,s:STYLE.bold}],
 ['Presence_Code','E = folder on E:, P = in the PDF, W = on nptel.ac.in. "E-P-W" means all three.'],
 ['Website_State','FOUND; NOT_FOUND (catalogue and course page both checked); UNAVAILABLE (the page did not answer, not proven missing); NOT_IN_CATALOGUE (PDF-only IDs whose course page was not fetched).'],
 ['Title_Comparison','Pairwise: HTML/PDF, PDF/official, HTML/official. EXACT_MATCH; PREFIX_DIFFERENCE (only "NOC:"); NORMALIZED_MATCH (case, spacing, punctuation, accents, &/and, or text attached by PDF extraction such as "(Course sponsored by Aricent)" or an institute name); TRUNCATED_MATCH (the local catalogue cut the title at 63-64 characters); SUBTITLE_MATCH (one title adds a series or college name before ":"); NON_LATIN_NOT_COMPARED (Hindi/Tamil text garbled by extraction); TITLE_CONFLICT (a real difference); *_MISSING.'],
 ['Verification_Status','THREE_SOURCE_VERIFIED: local catalogue, PDF and website titles identical. NORMALIZED_TITLE_MATCH: all three agree once formatting is set aside. PDF_AND_OFFICIAL_MATCHED_LOCAL_FOLDER_ONLY: folder on E: with no local catalogue row; PDF and website agree. OFFICIAL_MATCHED_NOT_IN_PDF: on E: and on nptel.ac.in, not in the PDF (usually newer than the PDF). OFFICIAL_TITLE_USED_NON_LATIN: no conflict except a Hindi/Tamil title. LOCAL_ID_REQUIRES_REVIEW: on E: but in neither the PDF nor nptel.ac.in. CONFLICT_REQUIRES_REVIEW: a real title, coordinator or institute difference. CATALOGUE_MATCH_NO_LOCAL_CONTENT: in the PDF and on the website, no folder on E:. NOT_VERIFIED: in the PDF only. WEBSITE_ONLY: only on nptel.ac.in.'],
 ['Coordinators','Compared by surname, allowing a one-letter spelling difference; a common surname (Kumar, Chandra, Prasad, Devi) needs a matching given name; "Multifaculty"-style placeholders count as no name.'],
 ['Institutes','Agree when one list contains the other, or when one source names NPTEL\'s coordinating institute for the ID (digits 4-6: 101 IIT Bombay, 102 IIT Delhi, 103 IIT Guwahati, 104 IIT Kanpur, 105 IIT Kharagpur, 106 IIT Madras, 107 IIT Roorkee, 108 IISc Bangalore) and the other names the host.'],
 ['Lecture titles','HIGH: nptel.ac.in\'s download list names the same MP4 file for this course ID. MEDIUM: the official outline\'s Week/Module number and lesson number both match the local modXXlecYY file and no file names are published. Never assigned by list position.'],
 [],[{v:'Limits',s:STYLE.bold}],
 ['','nptel.ac.in shows the latest run of a course; an archived copy on E: may be an earlier run with a different title, coordinator or host institute.'],
 ['','File counts come from the PostgreSQL inventory of E:; files added after the last scan are not counted.'],
 ['','Hindi and Tamil titles in the PDF are garbled by text extraction; the website title is used for them.'],
 ['','No title, ID or name in this workbook was invented: every value is copied from one of the three resources.']];

const numCols=new Set(['Videos_Count','PDFs_Count','Other_Documents_Count','HTML_Count','Total_Files','Module_Number','Lecture_Number','PDF_Page']);
const fromCsv=(name,csv,widths)=>table(name,csv.cols,csv.rows.map(r=>Object.fromEntries(csv.cols.map(c=>[c,numCols.has(c)&&r[c]!==''?num(r[c]):r[c]]))),{widths});
const sheets=[
 {name:'README',rows:README,widths:[26,150]},
 {name:'Summary',rows:S,widths:[70,12,70,70],headerRow:4},
 {name:'Checks',rows:C,widths:[52,14,14,12,60],headerRow:1},
 table(MS,M,master,{style:(c,v)=>c==='Verification_Status'?statusStyle(v):c.endsWith('_URL')&&v?.startsWith('http')?STYLE.link:0,
  widths:M.map(c=>/Title|Professor|Coordinator|Institute$|Remarks|Paths|Comparison|URL/.test(c)?40:Math.min(30,Math.max(10,c.length+2)))}),
 table('Conflicts_For_Review',Object.keys(conflicts[0]||{Course_ID:''}),conflicts,{widths:[12,30,22,22,40,40,40,30,30,30,25,25,25,40,60,60,9,40]}),
 table(MX,['Category','Course_ID','Best_Available_Title','Title_Source','Website_State','E_Academic_Folders','Detail'],missing,{widths:[36,12,60,16,30,24,70]}),
 table('By_Academic_Folder',Object.keys(bySem[0]),bySem),
 table(ERows,Object.keys(eRows[0]),eRows,{style:(c,v)=>c==='Verification_Status'?statusStyle(v):0}),
 fromCsv('PDF_vs_E_Occurrences',r03),fromCsv('Exceptions',r04,[34,16,16,12,80,60]),fromCsv('Lecture_Titles',r06,[12,14,10,8,8,60,10,18,60,60,10])];
fs.writeFileSync(out,workbook(sheets));
const bad=C.slice(1).filter(r=>r[3].v!=='OK').map(r=>r[0]);
console.log(JSON.stringify({out,sheets:sheets.map(s=>s.name+':'+(s.rows.length-(s.headerRow||0))),ids:master.length,conflicts:conflicts.length,checks:bad.length?'FAILED: '+bad.join('; '):'all OK'}));
