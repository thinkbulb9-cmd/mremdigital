/** Export repeated filename+size candidates for human review.
 * THIS DOES NOT PROVE DUPLICATE FILE BYTES and NEVER deletes anything.
 * Usage: npm run campus:repeats -- server1 C:/MREM/inventory
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const source=process.argv[2]||'server1';
const dir=path.resolve(process.argv[3]||'C:/MREM/inventory');
if(!/^[a-z0-9_-]{2,48}$/i.test(source))throw Error('Invalid source ID');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
await fs.mkdir(dir,{recursive:true});
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await db.connect();
try{
 const report=await db.query(
  "SELECT coalesce(course_code,'UNCLASSIFIED') course_code,name,size_bytes::text,"+
  "count(*)::bigint AS possible_copies,count(DISTINCT coalesce(semester_name,'unknown'))::bigint AS semesters "+
  "FROM resources WHERE source_id=$1 AND availability='available' "+
  "GROUP BY coalesce(course_code,'UNCLASSIFIED'),name,size_bytes HAVING count(*)>1 "+
  "ORDER BY possible_copies DESC,course_code,name LIMIT 1000",[source]);
 const target=path.join(dir,source+'-possible-repeats.csv');
 const lines=['course_code,filename,size_bytes,possible_copies,semesters',...report.rows.map(r=>[
  r.course_code,r.name,r.size_bytes,r.possible_copies,r.semesters].map(csv).join(','))];
 await fs.writeFile(target,lines.join('\r\n')+'\r\n','utf8');
 console.log('Saved '+report.rowCount+' possible repeat groups: '+target);
 console.log('Filename and size are NOT sufficient to identify byte-identical duplicates.');
 console.log('Do not delete, rename, merge or hide any original file based on this report.');
}finally{await db.end()}
