/** Resumable metadata-only mapping worker for Windows Server. No media files are opened. */
import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const BATCH=700,lockKey=20910261;
await db.connect();
try{
 const {rows:lockRows}=await db.query('SELECT pg_try_advisory_lock($1) AS locked',[lockKey]);
 if(!lockRows[0].locked)throw new Error('Another mapping worker is running');
 try{
  while(true){
   const pending=await db.query("SELECT * FROM mapping_jobs WHERE status IN ('queued','running') ORDER BY id LIMIT 1");
   const job=pending.rows[0];if(!job)break;
   await db.query("UPDATE mapping_jobs SET status='running',started_at=COALESCE(started_at,now()) WHERE id=$1",[job.id]);
   let cursor=job.last_resource_id;
   try{
    while(true){
     const target=await db.query(
      'SELECT id FROM resources WHERE source_id=$1 AND id>$2 AND ('+
       (job.scope==='file'?'rel_path=$3':job.rel_path===''?'TRUE':"left(rel_path,length($3)+1)=$3||'/'")+
      ') ORDER BY id LIMIT $4',[job.source_id,cursor,job.rel_path,BATCH]);
     if(!target.rows.length)break;
     const ids=target.rows.map(r=>r.id),last=ids[ids.length-1];
     await db.query('BEGIN');
     try{
      await db.query(
       'WITH batch AS (SELECT id,source_id,rel_path FROM resources WHERE id=ANY($1::bigint[])), '+
       'ranked AS (SELECT b.id AS resource_id,m.id AS mapping_id,m.department_id,m.course_id,'+
       "row_number() OVER(PARTITION BY b.id ORDER BY CASE WHEN m.scope='file' THEN 1 ELSE 0 END DESC,length(m.rel_path) DESC,m.id DESC) AS rn "+
       'FROM batch b JOIN published_mappings m ON m.source_id=b.source_id AND m.active=TRUE '+
       "WHERE (m.scope='file' AND b.rel_path=m.rel_path) OR "+
       "(m.scope='folder' AND left(b.rel_path,length(m.rel_path)+1)=m.rel_path||'/')), "+
       'chosen AS (SELECT resource_id,mapping_id,department_id,course_id FROM ranked WHERE rn=1) '+
       'INSERT INTO resource_assignments(resource_id,mapping_id,department_id,course_id) '+
       'SELECT resource_id,mapping_id,department_id,course_id FROM chosen '+
       'ON CONFLICT(resource_id) DO UPDATE SET mapping_id=EXCLUDED.mapping_id,department_id=EXCLUDED.department_id,'+
       'course_id=EXCLUDED.course_id,updated_at=now()',[ids]);
      await db.query(
       'DELETE FROM resource_assignments a WHERE a.resource_id=ANY($1::bigint[]) AND NOT EXISTS ('+
       'SELECT 1 FROM published_mappings m JOIN resources r ON r.id=a.resource_id '+
       'WHERE m.source_id=r.source_id AND m.active AND ('+
       "(m.scope='file' AND r.rel_path=m.rel_path) OR "+
       "(m.scope='folder' AND left(r.rel_path,length(m.rel_path)+1)=m.rel_path||'/')))",[ids]);
      await db.query(
       'UPDATE mapping_jobs SET last_resource_id=$2,processed_count=processed_count+$3 WHERE id=$1',
       [job.id,last,ids.length]);
      await db.query('COMMIT');
     }catch(err){await db.query('ROLLBACK');throw err;}
     cursor=last;
     if(Number(cursor)%10000<700)console.log('Mapping job '+job.id+' processed through file ID '+cursor);
    }
    await db.query("UPDATE mapping_jobs SET status='completed',completed_at=now() WHERE id=$1",[job.id]);
    await db.query(
     "INSERT INTO staff_audit_logs(action,entity_type,entity_id,details) VALUES('mapping.job.completed','mapping_job',$1,jsonb_build_object('status','completed'))",
     [String(job.id)]);
    console.log('Mapping job '+job.id+' completed');
   }catch(err){
    await db.query("UPDATE mapping_jobs SET status='failed',error=$2,completed_at=now() WHERE id=$1",
     [job.id,String(err).slice(0,850)]);
    console.error('Mapping job '+job.id+' failed: '+String(err));
   }
  }
 }finally{await db.query('SELECT pg_advisory_unlock($1)',[lockKey]);}
}finally{await db.end();}
