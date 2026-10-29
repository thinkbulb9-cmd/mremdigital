/** Read-only metadata scan. No content is opened or modified. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const sourceId=process.argv[2]||'';
const kindOf=(ext)=> ['.mp4','.webm','.m4v','.mov'].includes(ext)?'Video':
 ['.pdf','.doc','.docx','.txt','.md','.ppt','.pptx'].includes(ext)?'Document':
 ['.zip','.rar','.7z'].includes(ext)?'Archive':'Other';
const sqlUpsert=`INSERT INTO resources(source_id,rel_path,folder_rel_path,name,ext,kind,size_bytes,modified_at,department,course,last_seen_scan,availability)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'available')
 ON CONFLICT(source_id,rel_path) DO UPDATE SET
 name=EXCLUDED.name,folder_rel_path=EXCLUDED.folder_rel_path,ext=EXCLUDED.ext,
 kind=EXCLUDED.kind,size_bytes=EXCLUDED.size_bytes,modified_at=EXCLUDED.modified_at,
 department=EXCLUDED.department,course=EXCLUDED.course,last_seen_scan=EXCLUDED.last_seen_scan,
 availability='available'`;
const cleanPath=(p)=>p.split(path.sep).join('/');
async function scan(source){
 const scanId=crypto.randomUUID();
 await db.query('INSERT INTO scan_jobs(id,source_id,status) VALUES ($1,$2,$3)',[scanId,source.id,'running']);
 let files=0, folders=0;
 try {
  const root=await fs.realpath(source.root_path);
  if(!(await fs.stat(root)).isDirectory())throw new Error('Storage root not a directory');
  const stack=[''];
  while(stack.length){
   const rel=stack.pop();
   const absolute=path.resolve(root, ...rel.split('/').filter(Boolean));
   const actual=await fs.realpath(absolute);
   const within=path.relative(root,actual);
   if(within.startsWith('..'+path.sep)||within==='..'||path.isAbsolute(within))throw new Error('Symlink escape');
   const parent=rel.includes('/')?rel.slice(0,rel.lastIndexOf('/')):'';
   await db.query(`INSERT INTO folders(source_id,rel_path,parent_rel_path,name,last_seen_scan) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(source_id,rel_path) DO UPDATE SET last_seen_scan=EXCLUDED.last_seen_scan`,
     [source.id,rel,parent,rel.split('/').pop()||source.name,scanId]);
   folders++;
   const dir=await fs.opendir(absolute);
   for await(const item of dir){
    if(item.isSymbolicLink())continue;
    const childRel=rel?`${rel}/${item.name}`:item.name;
    const childAbs=path.join(absolute,item.name);
    if(item.isDirectory()){stack.push(childRel);continue;}
    if(!item.isFile())continue;
    let meta;
    try {meta=await fs.lstat(childAbs);} catch(error){if(error.code==='ENOENT'){continue;}throw error;}
    if(!meta.isFile())continue;
    const segments=childRel.split('/');
    const dept=segments.length>=2?segments[0]:'Unclassified';
    const course=segments.length>=3?segments[1]:'General';
    const ext=path.extname(item.name).toLowerCase();
    await db.query(sqlUpsert,[source.id,childRel,rel,item.name,ext,kindOf(ext),meta.size,meta.mtime,dept,course,scanId]);
    files++;
    if(files%250===0){
     await db.query('UPDATE scan_jobs SET files_seen=$2,folders_seen=$3 WHERE id=$1',[scanId,files,folders]);
     if(files%2500===0)console.log(`[${source.id}] ${files} files | ${folders} folders`);
    }
   }
  }
  await db.query('BEGIN');
  try{
   await db.query(`UPDATE resources SET availability='missing' WHERE source_id=$1 AND last_seen_scan IS DISTINCT FROM $2`,[source.id,scanId]);
   await db.query('UPDATE storage_sources SET last_successful_scan=now() WHERE id=$1',[source.id]);
   await db.query(`UPDATE scan_jobs SET status='completed',files_seen=$2,folders_seen=$3,completed_at=now() WHERE id=$1`,[scanId,files,folders]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
  try {
    // Reconcile new or moved file metadata with already approved academic mappings.
    await db.query("INSERT INTO mapping_jobs(mapping_request_id,source_id,scope,rel_path) "+
      "SELECT m.approval_request_id,$1,'folder','' FROM published_mappings m "+
      "WHERE m.source_id=$1 AND m.active=TRUE ORDER BY m.id LIMIT 1",[source.id]);
  }catch(error){console.warn('Scan complete; mapping reconciliation queue failed:',String(error));}
  console.log(`Completed ${source.id}: ${files} files and ${folders} folders. Source files unchanged.`);

 }catch(error){
  await db.query('UPDATE scan_jobs SET status=$2,error=$3,files_seen=$4,folders_seen=$5,completed_at=now() WHERE id=$1',
   [scanId,'failed',String(error).slice(0,1000),files,folders]);
  console.error(`Scan failed for ${source.id}:`,String(error));
 }
}
await db.connect();
try{
 const {rows}=await db.query(`SELECT id,name,root_path FROM storage_sources WHERE enabled=true ${sourceId?'AND id=$1':''} ORDER BY id`,sourceId?[sourceId]:[]);
 if(!rows.length)console.log('No storage sources. Add a source with npm run storage:add.');
 for(const source of rows)await scan(source);
}finally{await db.end();}
