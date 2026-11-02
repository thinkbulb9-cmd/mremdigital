/** Storage source identity checks shared by registration, scanning and the availability check.
 * On Windows, fs.stat().dev is the volume serial number, so a source keeps its identity when its drive letter changes,
 * and a different disk mounted at the same letter is recognised instead of being scanned as the old one. */
import fs from 'node:fs/promises';
import path from 'node:path';

export const serialOf=(dev)=>{const h=(Number(dev)>>>0).toString(16).toUpperCase().padStart(8,'0');return h.slice(0,4)+'-'+h.slice(4)};

/** {ok:true, root, serial} when the root is a readable folder; {ok:false, error} otherwise. Never writes anything. */
export async function probeRoot(rootPath){
 try{
  const root=await fs.realpath(path.resolve(rootPath));
  const st=await fs.stat(root);
  if(!st.isDirectory())return {ok:false,error:'not a folder: '+root};
  const dir=await fs.opendir(root);await dir.close();
  return {ok:true,root,serial:serialOf(st.dev)};
 }catch(e){return {ok:false,error:String(e.code||e.message||e)}}
}

/** Decide whether a probed source may be scanned. Pure: callers record the verdict. */
export function verdict(source,probe){
 if(!probe.ok)return {scan:false,availability:'unavailable',reason:'storage not reachable: '+probe.error};
 if(source.volume_serial&&source.volume_serial!==probe.serial)
  return {scan:false,availability:'identity_mismatch',reason:'volume serial '+probe.serial+' does not match registered '+source.volume_serial+'; re-register with --new-volume only if this disk really replaced the old one'};
 return {scan:true,availability:'available',reason:source.volume_serial?'':'volume serial '+probe.serial+' recorded for the first time'};
}

/** True when two roots on the same volume overlap (one contains the other): registering both would index files twice. */
export function overlaps(a,b){
 const n=(p)=>path.resolve(p).toLowerCase().replace(/[\\/]+$/,'')+path.sep;
 return n(a).startsWith(n(b))||n(b).startsWith(n(a));
}

export async function recordAvailability(db,id,{availability,reason},serial){
 await db.query(`UPDATE storage_sources SET availability=$2,last_checked_at=now(),last_error=$3,
  volume_serial=COALESCE(volume_serial,$4) WHERE id=$1`,[id,availability,availability==='available'?null:reason,availability==='available'?serial:null]);
}
