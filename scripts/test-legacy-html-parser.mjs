import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCourseRows,extractLectureHints} from '../lib/legacy-html-parser.mjs';
const sample=`<!doctype html><html><body><h1>NPTEL - Web and Video Courses</h1>
<table><tr><th>subjectId</th><th>Discipline Name</th><th>Subject Name</th>
<th>Coordinators</th><th>Type</th><th>Institute</th><th>Content</th></tr>
<tr><td>101104086</td><td>Aerospace Engineering</td><td>Computational Science in Engineering</td>
<td>Prof. Ashoke De</td><td>video</td><td>IIT Kanpur</td>
<td><select><option>Select</option><option value="displayvideo.html?type1=101104086%2Fmod01lec01.mp4">Lecture 01</option></select></td></tr>
<tr><td>101108086</td><td>Aerospace Engineering</td><td>Gasdynamics: Fundamentals and Applications</td>
<td>Prof. Srisha Rao M V</td><td>video</td><td>IISc Bangalore</td><td></td></tr>
</table></body></html>`;
test('Extracts official course rows from observed 2021 HTML table layout',()=>{
 const found=extractCourseRows(sample,'Jan_Apr_2021','101');
 assert.equal(found.length,2);
 assert.deepEqual(found[0],{
  course_code:'101104086',title:'Computational Science in Engineering',
  department:'Aerospace Engineering',instructor:'Prof. Ashoke De',
  institution:'IIT Kanpur',semester:'Jan_Apr_2021',discipline_folder:'101'
 });
});
test('Finds lecture links but does not hallucinate generic titles',()=>{
 const hints=extractLectureHints(sample,'Jan_Apr_2021');
 assert.equal(hints.length,1);
 assert.equal(hints[0].course_code,'101104086');
 assert.equal(hints[0].module_no,1);
 assert.equal(hints[0].lecture_no,1);
 assert.equal(hints[0].title,'');
});
test('Rejects personal-contact text rather than publishing it to a public repo',()=>{
 const p=sample.replace('Computational Science in Engineering','privateperson@example.com');
 const found=extractCourseRows(p,'Jan_Apr_2021','101');
 assert.equal(found.length,1);
});
