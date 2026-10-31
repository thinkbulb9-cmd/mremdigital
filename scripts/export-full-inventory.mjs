/** Export full local server metadata without reading or exporting media bytes.
 * Usage: npm run campus:export -- server1 C:\MREM\inventory
 * Output: server1-courses.csv (safe aggregated identifiers) and server1-files.csv
 * Review file names for private information before sharing outside campus.
 */
import {mkdir,writeFile,open} from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const id=process.argv[2]||'server1',out=path.resolve(process.argv[3]||'C:/MREM/inventory');
if(!/^[a-z0-9_-]{2,48}$/i.test(id))throw Error('Invalid source ID');
await mkdir(out,{recursive:true});
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
function csv(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
const summary=path.join(out,id+'-courses.csv'),file=path.join(out,id+'-files.csv');
try{
 const totals=await db.query(
  "SELECT COALESCE(course_code,'UNCLASSIFIED') AS course_code,count(*)::bigint AS files,"+
  "count(*) FILTER(WHERE kind='Video')::bigint AS videos,"+
  "count(*) FILTER(WHERE kind='Document')::bigint AS documents,"+
  "count(*) FILTER(WHERE kind='HTML')::bigint AS html,"+
  "string_agg(DISTINCT semester_name,', ') AS semesters "+
  "FROM resources WHERE source_id=$1 AND availability='available' GROUP BY COALESCE(course_code,'UNCLASSIFIED') ORDER BY course_code",[id]);
 const sum=['CourseId,TotalFiles,Videos,Documents,HTML,Semesters',...totals.rows.map(r=>[r.course_code,r.files,r.videos,r.documents,r.html,r.semesters].map(csv).join(','))].join('\n')+'\n';
 await writeFile(summary,sum,'utf8');
 const fh=await open(file,'w');
 try{
  await fh.writeFile('SourceId,RelativePath,CourseId,Semester,Module,Lecture,Name,Extension,Type,SizeBytes\n');
  let cursor='0',count=0;
  while(true){
   const batch=await db.query(
    'SELECT id::text,rel_path,course_code,semester_name,module_no,lecture_no,name,ext,kind,size_bytes::text FROM resources '+
    "WHERE source_id=$1 AND availability='available' AND id>$2 ORDER BY id LIMIT 1500",[id,cursor]);
   if(!batch.rows.length)break;
   const text=batch.rows.map(r=>[id,r.rel_path,r.course_code,r.semester_name,r.module_no,r.lecture_no,r.name,r.ext,r.kind,r.size_bytes].map(csv).join(',')).join('\n')+'\n';
   await fh.writeFile(text);
   cursor=batch.rows.at(-1).id;
   count+=batch.rows.length;
   if(count%15000===0)console.log('Exported '+count+' metadata rows');
  }
  console.log('Exported '+count+' file-metadata rows. NO media bytes included.');
 }finally{await fh.close()}
 console.log('Course summary: '+summary);
 console.log('File inventory: '+file);
}finally{await db.end()}
