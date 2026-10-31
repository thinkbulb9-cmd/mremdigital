/** Offline, metadata-only importer; no media access or online dependencies. */
import fs from 'node:fs/promises';
import pg from 'pg';
const filename=process.argv[2];
if(!filename)throw Error('Usage: npm run campus:metadata -- data/verified-course-metadata.json');
const entries=JSON.parse(await fs.readFile(filename,'utf8'));
if(!Array.isArray(entries)||entries.length>200000)throw Error('Invalid catalog JSON');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
let changed=0,skipped=0;
try{
 for(const r of entries){
  const code=String(r?.course_code||''),title=String(r?.title||'').trim();
  const dept=String(r?.department||'Unclassified').trim(),verified=r?.verified===true;
  if(!/^\d{9}$/.test(code)||!title||title.length>250||dept.length>120){skipped++;continue}
  const sql="INSERT INTO course_catalog(course_code,title,department,instructor,institution,title_source,verified) VALUES($1,$2,$3,$4,$5,$6,$7) "+
   "ON CONFLICT(course_code) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,instructor=EXCLUDED.instructor,"+
   "institution=EXCLUDED.institution,title_source=EXCLUDED.title_source,verified=EXCLUDED.verified,updated_at=now() "+
   "WHERE course_catalog.verified=FALSE OR EXCLUDED.verified=TRUE RETURNING course_code";
  const v=[code,title,dept,String(r.instructor||'').slice(0,160),String(r.institution||'').slice(0,160),
   String(r.title_source||'reviewed metadata').slice(0,160),verified];
  const result=await db.query(sql,v);if(result.rowCount)changed++;else skipped++;
 }
 console.log(JSON.stringify({changed,skipped,total:entries.length}));
}finally{await db.end()}
