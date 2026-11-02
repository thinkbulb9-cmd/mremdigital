/** Check every registered storage source: npm run storage:check
 * Probes each root (read only), records availability and the volume serial, and prints one line per source.
 * Exit code 0 when every enabled source is available, 2 otherwise. */
import pg from 'pg';
import {probeRoot,verdict,recordAvailability} from './storage-identity.mjs';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
let bad=0;
try{
 for(const s of (await db.query('SELECT id,name,root_path,volume_serial,enabled FROM storage_sources ORDER BY id')).rows){
  const p=await probeRoot(s.root_path),v=verdict(s,p);
  if(s.enabled){await recordAvailability(db,s.id,v,p.serial);if(!v.scan)bad++}
  const files=(await db.query("SELECT count(*)::int n FROM resources WHERE source_id=$1 AND availability='available'",[s.id])).rows[0].n;
  console.log([s.id,s.enabled?v.availability:'disabled',s.root_path,'volume '+(p.serial||s.volume_serial||'?'),files+' indexed files',v.reason].filter(Boolean).join(' | '));
 }
}finally{await db.end()}
process.exitCode=bad?2:0;
