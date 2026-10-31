/** Read ONLY archived academic index.html, export sanitized catalogue JSON for GitHub.
 * Does not copy original HTML, media, filesystem paths, secrets or private records.
 * Run: npm run campus:html:extract -- server1
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import {extractCourseRows,extractLectureHints} from '../lib/legacy-html-parser.mjs';

const sourceId=process.argv[2]||'server1';
if(!/^[a-zA-Z0-9_-]{2,48}$/.test(sourceId))throw Error('Invalid storage source');
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL in .env.local');
const outDir=path.resolve('data/legacy-course-index');
const archivePattern=/^(?:jan[-_]apr|jul[-_]dec)[-_]20\d{2}$|^web_courses$/i;
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const summary={source_id:sourceId,index_files_discovered:0,index_files_opened:0,
  index_files_unreadable:0,index_files_oversize:0,index_files_unrecognized_roots:0,
  tables_with_course_rows:0,course_rows_extracted:0,distinct_course_ids:0,
  lecture_link_hints:0,lecture_hints_with_title:0,course_title_conflicts:0,files_created:[]};
const courses=new Map(),hints=new Map(),conflicts=new Map();
const isInside=(base,target)=>{const rel=path.relative(base,target);return rel!== '..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel)};
function saveCourse(c){
 const key=[c.course_code,c.title,c.department,c.instructor,c.institution,c.semester].join('\u001f');
 if(!courses.has(key))courses.set(key,c);
 const list=conflicts.get(c.course_code)||new Set();
 list.add(c.title);conflicts.set(c.course_code,list);
}
function writeChunks(rows,prefix,chunkSize){
 return (async()=>{
  const filenames=[];
  for(let i=0;i<rows.length;i+=chunkSize){
   const name=prefix+'-'+String(i/chunkSize+1).padStart(4,'0')+'.json';
   await fs.writeFile(path.join(outDir,name),JSON.stringify(rows.slice(i,i+chunkSize),null,2)+'\n','utf8');
   filenames.push(name);
  }
  return filenames;
 })();
}
await db.connect();
try{
 const q=await db.query("SELECT root_path FROM storage_sources WHERE id=$1 AND enabled=TRUE",[sourceId]);
 if(!q.rowCount)throw Error('Registered storage source was not found: '+sourceId);
 const root=await fs.realpath(q.rows[0].root_path);
 const result=await db.query(
  "SELECT rel_path FROM resources WHERE source_id=$1 AND availability='available' "+
  "AND lower(name) IN ('index.html','index.htm') ORDER BY rel_path",[sourceId]);
 summary.index_files_discovered=result.rowCount;
 for(const {rel_path:rel} of result.rows){
  const segments=String(rel).split('/');
  const semester=segments[0]||'';
  if(!archivePattern.test(semester)){summary.index_files_unrecognized_roots++;continue;}
  const disciplineFolder=/^\d{3}$/.test(segments[1]||'')?segments[1]:'';
  if(segments.some(seg=>seg===''||seg==='.'||seg==='..'||seg.includes(':'))){summary.index_files_unreadable++;continue}
  const expected=path.resolve(root,...segments);
  try{
   const real=await fs.realpath(expected);
   if(!isInside(root,real)){summary.index_files_unreadable++;continue}
   const st=await fs.stat(real);
   if(!st.isFile()){summary.index_files_unreadable++;continue}
   if(st.size>3*1024*1024){summary.index_files_oversize++;continue}
   const html=await fs.readFile(real,'utf8');
   summary.index_files_opened++;
   const rows=extractCourseRows(html,semester,disciplineFolder);
   if(rows.length)summary.tables_with_course_rows++;
   summary.course_rows_extracted+=rows.length;
   for(const row of rows)saveCourse(row);
   const extracted=extractLectureHints(html,semester);
   for(const link of extracted){
    if(!link.title)continue; // Generic lecture-number labels are NOT real lecture titles.
    const key=[link.course_code,semester,link.filename,link.title].join('\u001f');
    if(!hints.has(key))hints.set(key,link);
   }
  }catch(e){
   summary.index_files_unreadable++;
   if(summary.index_files_unreadable<=5)console.error('Unreadable academic index (redacted location): '+e.code);
  }
  if(summary.index_files_opened%1000===0&&summary.index_files_opened>0){
   console.log('Inspected '+summary.index_files_opened+' academic HTML indexes');
  }
 }
 summary.distinct_course_ids=new Set([...courses.values()].map(x=>x.course_code)).size;
 summary.lecture_link_hints=hints.size;
 summary.lecture_hints_with_title=hints.size;
 summary.course_title_conflicts=[...conflicts.values()].filter(x=>x.size>1).length;
 if(!summary.course_rows_extracted)throw Error('No course catalogues found. Nothing published; inspect example HTML layout locally.');
 await fs.mkdir(outDir,{recursive:true});
 // Remove ONLY this export's previous generated JSON files, never any file from E:.
 for(const name of await fs.readdir(outDir)){
  if(/^(courses|lecture-titles)-\d{4}\.json$|^summary\.json$/.test(name))
   await fs.unlink(path.join(outDir,name));
 }
 const courseRows=[...courses.values()].sort((a,b)=>
  a.course_code.localeCompare(b.course_code)||a.semester.localeCompare(b.semester)||a.title.localeCompare(b.title));
 const linkRows=[...hints.values()].sort((a,b)=>a.course_code.localeCompare(b.course_code)||a.filename.localeCompare(b.filename));
 summary.files_created.push(...await writeChunks(courseRows,'courses',100));
 summary.files_created.push(...await writeChunks(linkRows,'lecture-titles',100));
 summary.created_utc=new Date().toISOString();
 // The public summary contains counts and safe academic labels ONLY.
 await fs.writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');
 console.log('HTML EXTRACTION SUMMARY: '+JSON.stringify(summary));
 console.log('Public GitHub export prepared at: '+outDir);
 console.log('This export intentionally contains NO original HTML, full file paths, student records, media, or secrets.');
}finally{await db.end()}
