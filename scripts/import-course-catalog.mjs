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
  if(Array.isArray(r.lectures))for(const l of r.lectures){
    const m=Number(l?.module_no),n=Number(l?.lecture_no),name=String(l?.title||'').trim();
    if(!Number.isSafeInteger(m)||!Number.isSafeInteger(n)||m<0||n<0||m>500||n>500||!name||name.length>300){skipped++;continue}
    await db.query("INSERT INTO course_lectures(course_code,module_no,lecture_no,title,title_source,verified) VALUES($1,$2,$3,$4,$5,$6) "+
      "ON CONFLICT(course_code,module_no,lecture_no) DO UPDATE SET title=EXCLUDED.title,title_source=EXCLUDED.title_source,verified=EXCLUDED.verified "+
      "WHERE course_lectures.verified=FALSE OR EXCLUDED.verified=TRUE",
      [code,m,n,name,String(l.title_source||'reviewed').slice(0,160),l.verified===true]);
  }

 }
 console.log(JSON.stringify({changed,skipped,total:entries.length}));
}finally{await db.end()}
