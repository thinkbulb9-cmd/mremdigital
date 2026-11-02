/** Register (or update) a storage source: npm run storage:add -- --id server2 --name "Server 2 (F:)" --path "F:\\"
 * Records the volume serial so the source keeps its identity if the drive letter changes. Refuses to register a root that
 * overlaps another source on the same volume (it would index the same files twice), and refuses to point an existing
 * source at a different volume unless --new-volume is given. Reads the root only; never writes to it. */
import pg from 'pg';
import {probeRoot,overlaps} from './storage-identity.mjs';
function flag(name) {const i=process.argv.indexOf('--'+name);return i<0?'':process.argv[i+1]||'';}
const id=flag('id'), name=flag('name'), directory=flag('path'), label=flag('label'), newVolume=process.argv.includes('--new-volume');
if(!/^[a-zA-Z0-9_-]{2,48}$/.test(id)||!name||!directory) {
 console.error('Usage: npm run storage:add -- --id server2 --name "Server 2 (F:)" --path "F:\\" [--label "volume label"] [--new-volume]'); process.exit(1);
}
const probe=await probeRoot(directory);
if(!probe.ok)throw new Error('Storage path is not a readable folder: '+probe.error);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try {
 const others=(await db.query('SELECT id,root_path,volume_serial FROM storage_sources WHERE id<>$1',[id])).rows;
 const clash=others.find(o=>(!o.volume_serial||o.volume_serial===probe.serial)&&overlaps(o.root_path,probe.root));
 if(clash)throw new Error(`${probe.root} overlaps source ${clash.id} (${clash.root_path}); reuse that source instead of registering the same files twice`);
 const current=(await db.query('SELECT root_path,volume_serial FROM storage_sources WHERE id=$1',[id])).rows[0];
 if(current?.volume_serial&&current.volume_serial!==probe.serial&&!newVolume)
  throw new Error(`${id} is registered on volume ${current.volume_serial}; ${probe.root} is volume ${probe.serial}. Use --new-volume only if this disk really replaced the old one.`);
 await db.query(`INSERT INTO storage_sources(id,name,root_path,volume_serial,volume_label,availability,last_checked_at)
  VALUES ($1,$2,$3,$4,NULLIF($5,''),'available',now())
  ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,root_path=EXCLUDED.root_path,volume_serial=EXCLUDED.volume_serial,
   volume_label=COALESCE(EXCLUDED.volume_label,storage_sources.volume_label),availability='available',last_checked_at=now(),last_error=NULL,enabled=TRUE`,
  [id,name,probe.root,probe.serial,label]);
 console.log((current?'Updated ':'Registered ')+id+' -> '+probe.root+' (volume '+probe.serial+')');
} finally {await db.end();}
