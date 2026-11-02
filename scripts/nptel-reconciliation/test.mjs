/** Unit tests for the NPTEL reconciliation rules: npm run test:nptel
 * Fixtures copy the shapes observed on nptel.ac.in on 2026-11-02 (course outline, downloads list, catalogue literal).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {titleStatus,peopleStatus,instNorm,matchLectures} from './compare.mjs';
import {unflatten,parseOutline,parseCatalogue} from './official.mjs';

test('title statuses separate NOC prefixes, formatting and real differences',()=>{
 assert.equal(titleStatus('Lighter than Air Systems','NOC:Lighter than Air Systems').status,'PREFIX_DIFFERENCE');
 assert.equal(titleStatus('NOC:Basics of Biology','NOC:Basics of Biology').status,'EXACT_MATCH');
 assert.equal(titleStatus('Material & Energy Balance','NOC:material and energy balance').status,'NORMALIZED_MATCH');
 const cut=titleStatus('Evolutionary Computation for Single and Multi-Objective Optimiza','NOC:Evolutionary Computation for Single and Multi-Objective Optimization');
 assert.equal(cut.status,'TITLE_CONFLICT');assert.match(cut.note,/truncation/);
 assert.equal(titleStatus('','x').status,'HTML_TITLE_MISSING');
 assert.equal(titleStatus('x','').status,'PDF_TITLE_MISSING');
});
test('coordinators agree by surname; unrelated people differ',()=>{
 assert.equal(peopleStatus('Prof. P. K. Garg','Prof. Pradeep Kumar Garg').status,'MATCH');
 assert.equal(peopleStatus('Prof. Pinaki Sar Prof. Amit Ghosh','Prof. Pinaki Sar,Prof. Amit Ghosh').note,'');
 assert.equal(peopleStatus('Prof. Anjali PalProf. Sudha Goel','Prof. Anjali Pal,Prof. Sudha Goel').status,'MATCH');
 assert.equal(peopleStatus('Prof. Ashok Joshi','Prof. Rajkumar Pant').status,'DIFFERS');
 assert.equal(instNorm('IIT (BHU) Varanasi'),instNorm('IIT(BHU) Varanasi'));
});
const official={downloads:{lessons:[{lesson_id:'1',title:'Lecture 1: Introduction',url:'https://media.dev.nptel.ac.in/content/mp4/101/101/101101086/MP4/mod01lec01.mp4'}]},
 outline:{units:[{id:1,name:'Week 1',lessons:[{id:1,name:'Lecture 1: Introduction'}]}]}};
test('lecture titles need the same file name, never a list position',()=>{
 const hits=matchLectures([{id:'9',name:'mod01lec01.mp4',module_no:1,lecture_no:1},{id:'10',name:'mod01lec02.mp4',module_no:1,lecture_no:2}],official);
 assert.deepEqual(hits.map(h=>[h.id,h.confidence,h.title]),[['9','HIGH','Lecture 1: Introduction']]);
});
test('without published file names, module and lecture numbers must both match',()=>{
 const noUrls={downloads:{lessons:[{lesson_id:'6',title:'Lecture 06 : Microbial Ecology',url:''}]},
  outline:{units:[{id:2,name:'Week 2',lessons:[{id:6,name:'Lecture 06 : Microbial Ecology'}]},{id:1,name:'Live Session 28-03-2022',lessons:[{id:1,name:'Live'}]}]}};
 const files=[{id:'1',name:'mod02lec06.mp4',module_no:2,lecture_no:6},{id:'2',name:'mod03lec06.mp4',module_no:3,lecture_no:6},{id:'3',name:'mod01lec01.mp4',module_no:1,lecture_no:1}];
 assert.deepEqual(matchLectures(files,noUrls).map(h=>[h.id,h.confidence]),[['1','MEDIUM']],'live-session units and wrong modules are ignored');
 const mismatch={downloads:{lessons:[]},outline:{units:[{id:2,name:'Week 2',lessons:[{id:6,name:'Lecture 7: Something'}]}]}};
 assert.equal(matchLectures([files[0]],mismatch).length,0,'a lesson whose own number disagrees is not used');
});
test('course outline (__data.json) decodes; missing courses are reported as errors',()=>{
 const body=JSON.stringify({type:'data',nodes:[null,{type:'data',data:[{courseOutline:1},{nocCourse:2,title:3,professor:4,instituteName:5,
  nocCoordinatingInstitute:5,contentType:6,units:7},true,'Introduction to Launch Vehicle Analysis and Design','Prof. Ashok Joshi','IIT Bombay','Video',[8],
  {id:9,name:10,lessons:11},1,'Week 1',[12],{id:9,name:13},'Lecture 1: Introduction']}]});
 const o=parseOutline(body);
 assert.equal(o.title,'Introduction to Launch Vehicle Analysis and Design');
 assert.deepEqual(o.units,[{id:1,name:'Week 1',lessons:[{id:1,name:'Lecture 1: Introduction'}]}]);
 assert.equal(parseOutline(JSON.stringify({type:'data',nodes:[null,{type:'error',error:{message:'Failed to load course data'},status:500}]})).state,'error');
 assert.deepEqual(unflatten([[1,2],'a','b']),['a','b']);
});
test('catalogue literals are parsed by pattern',()=>{
 const html='data: [null,{type:"data",data:{courses:[{id:101101086,title:"NOC:Introduction to Launch Vehicle Analysis and Design",instituteName:"IIT Bombay",'+
  'professor:"Prof. Ashok Joshi",instituteLogo:"",contentType:"Video",noccourse:false,currentRun:false,selfPaced:false,disciplineId:101,instituteId:"1"}],'+
  'disciplines:[{id:"101",name:"Aerospace Engineering"}],institutes:[{id:"1",name:"IIT Bombay"}]}}]';
 const c=parseCatalogue(html);
 assert.equal(c.count,1);
 assert.deepEqual(c.courses['101101086'],{id:'101101086',title:'NOC:Introduction to Launch Vehicle Analysis and Design',institute:'IIT Bombay',
  professor:'Prof. Ashok Joshi',contentType:'Video',disciplineId:'101',discipline:'Aerospace Engineering'});
});
