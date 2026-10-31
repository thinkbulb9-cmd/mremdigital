/** Read-only campus inventory health check. Never opens original files. */
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const id=process.argv[2]||'server1';
if(!/^[a-z0-9_-]{2,48}$/i.test(id))throw Error('Invalid storage source');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const total=await db.query(
  "SELECT count(*)::bigint AS files, count(*) FILTER(WHERE kind='Video')::bigint AS videos, "+
  "count(*) FILTER(WHERE kind='Document')::bigint AS documents, "+
  "count(DISTINCT course_code)::bigint AS identified_course_codes, "+
  "count(*) FILTER(WHERE course_code IS NULL)::bigint AS ungrouped_files "+
  "FROM resources WHERE source_id=$1 AND availability='available'",[id]);
 const classes=await db.query(
  "SELECT coalesce(c.department,'Unclassified') department, "+
  "count(DISTINCT r.course_code)::bigint AS courses,count(*)::bigint AS files "+
  "FROM resources r LEFT JOIN course_catalog c ON c.course_code=r.course_code "+
  "WHERE r.source_id=$1 AND r.availability='available' "+
  "GROUP BY coalesce(c.department,'Unclassified') ORDER BY files DESC",[id]);
 const scan=await db.query(
  "SELECT status,files_seen::text,folders_seen::text,error,completed_at FROM scan_jobs "+
  "WHERE source_id=$1 ORDER BY started_at DESC LIMIT 1",[id]);
 console.log('SCAN:',JSON.stringify(scan.rows[0]||null));
 console.log('TOTALS:',JSON.stringify(total.rows[0]||null));
 console.log('DEPARTMENTS:',JSON.stringify(classes.rows));
 console.log('Note: identical filenames can be separate semester copies; do not delete or hide them by filename.');
 console.log('For a detailed course-only report: npm run campus:export -- '+id+' C:\\MREM\\inventory');
} finally{await db.end()}
