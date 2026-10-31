/** Full registered Windows drive metadata scan.
 * npm run campus:scan -- server1
 * Enumerates ENTIRE selected drive: no file/folder limit; media not opened/copied.
 * Batched upserts, handles inaccessible folders, preserves records after partial scans.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const sourceId=process.argv[2]||'server1',BATCH=250;
const kindOf=(ext)=>['.mp4','.m4v','.webm','.mov','.avi','.mkv'].includes(ext)?'Video':
 ['.pdf','.doc','.docx','.txt','.md','.ppt','.pptx','.xls','.xlsx','.csv'].includes(ext)?'Document':
 ['.html','.htm'].includes(ext)?'HTML':['.jpg','.jpeg','.png','.webp'].includes(ext)?'Image':
 ['.zip','.rar','.7z'].includes(ext)?'Archive':'Other';
const folderSQL="INSERT INTO folders(source_id,rel_path,parent_rel_path,name,last_seen_scan) "+
 "SELECT $1,f.rel_path,f.parent_rel_path,f.name,$2 FROM jsonb_to_recordset($3::jsonb) "+
 "AS f(rel_path text,parent_rel_path text,name text) "+
 "ON CONFLICT(source_id,rel_path) DO UPDATE SET parent_rel_path=EXCLUDED.parent_rel_path,"+
 "name=EXCLUDED.name,last_seen_scan=EXCLUDED.last_seen_scan";
const fileSQL="INSERT INTO resources(source_id,rel_path,folder_rel_path,name,ext,kind,size_bytes,modified_at,department,course,last_seen_scan,availability,course_code,semester_name,module_no,lecture_no) "+
 "SELECT $1,f.rel_path,f.folder_rel_path,f.name,f.ext,f.kind,f.size_bytes,f.modified_at,'Unclassified','General',$2,'available',"+
 "f.course_code,f.semester_name,f.module_no,f.lecture_no FROM jsonb_to_recordset($3::jsonb) "+
 "AS f(rel_path text,folder_rel_path text,name text,ext text,kind text,size_bytes bigint,modified_at timestamptz,"+
 "course_code text,semester_name text,module_no integer,lecture_no integer) "+
 "ON CONFLICT(source_id,rel_path) DO UPDATE SET folder_rel_path=EXCLUDED.folder_rel_path,name=EXCLUDED.name,"+
 "ext=EXCLUDED.ext,kind=EXCLUDED.kind,size_bytes=EXCLUDED.size_bytes,modified_at=EXCLUDED.modified_at,"+
 "course_code=EXCLUDED.course_code,semester_name=EXCLUDED.semester_name,module_no=EXCLUDED.module_no,"+
 "lecture_no=EXCLUDED.lecture_no,last_seen_scan=EXCLUDED.last_seen_scan,availability='available'";
function info(relative,filename){
 const segments=relative.split('/');
 const course_code=segments.find(x=>/^\d{9}$/.test(x))||null;
 const semester_name=segments.find(x=>/^(jan[-_]apr|jul[-_]dec)[-_]20\d{2}$/i.test(x))||null;
 const m=/mod0*(\d+)lec0*(\d+)/i.exec(filename);
 return {course_code,semester_name,module_no:m?Number(m[1]):null,lecture_no:m?Number(m[2]):null};
}
await db.connect();
try{
 const selection=await db.query('SELECT id,name,root_path FROM storage_sources WHERE enabled=TRUE AND id=$1',[sourceId]);
 if(!selection.rowCount)throw Error('No registered source named '+sourceId);
 const source=selection.rows[0],root=await fs.realpath(source.root_path),scanId=randomUUID();
 if(!(await fs.stat(root)).isDirectory())throw Error('Source is not a folder');
 await db.query("INSERT INTO scan_jobs(id,source_id,status) VALUES($1,$2,'running')",[scanId,source.id]);
 let filesSeen=0,foldersSeen=0,warnings=0;
 const stack=[''],files=[],folders=[],examples=[];
 function warn(msg){warnings++;if(examples.length<20)examples.push(msg);console.error('[SCAN WARNING] '+msg);}
 async function flush(){
  if(folders.length){await db.query(folderSQL,[source.id,scanId,JSON.stringify(folders)]);folders.length=0}
  if(files.length){await db.query(fileSQL,[source.id,scanId,JSON.stringify(files)]);files.length=0}
 }
 try{
  while(stack.length){
   const rel=stack.pop();
   const abs=path.resolve(root,...rel.split('/').filter(Boolean));
   let real;
   try{real=await fs.realpath(abs)}catch(e){warn('Cannot resolve folder '+rel+': '+String(e));continue}
   const inside=path.relative(root,real);
   if(inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside)){
    warn('Ignored junction outside registered disk: '+rel);continue;
   }
   folders.push({rel_path:rel,parent_rel_path:rel.includes('/')?rel.slice(0,rel.lastIndexOf('/')):'',
     name:rel.split('/').at(-1)||source.name});
   foldersSeen++;
   if(folders.length>=BATCH)await flush();
   let dir;
   try{dir=await fs.opendir(real)}catch(e){warn('Cannot list folder '+rel+': '+String(e));continue}
   try{
    for await(const entry of dir){
     if(entry.isSymbolicLink())continue;
     const childRel=rel?rel+'/'+entry.name:entry.name;
     if(entry.isDirectory()){stack.push(childRel);continue}
     if(!entry.isFile())continue;
     let st;try{st=await fs.lstat(path.join(real,entry.name))}
     catch(e){warn('Cannot stat '+childRel+': '+String(e));continue}
     if(!st.isFile()||st.isSymbolicLink())continue;
     const ext=path.extname(entry.name).toLowerCase();
     files.push({rel_path:childRel,folder_rel_path:rel,name:entry.name,ext,kind:kindOf(ext),
       size_bytes:String(st.size),modified_at:st.mtime.toISOString(),...info(childRel,entry.name)});
     filesSeen++;
     if(files.length>=BATCH)await flush();
     if(filesSeen%10000===0){
      await flush();
      await db.query('UPDATE scan_jobs SET files_seen=$2,folders_seen=$3 WHERE id=$1',[scanId,filesSeen,foldersSeen]);
      console.log('Indexed '+filesSeen+' files; '+foldersSeen+' folders; '+warnings+' warnings');
     }
    }
   }catch(e){warn('Failed during enumeration '+rel+': '+String(e))}
   finally{await dir.close().catch(()=>{})}
  }
  await flush();
  if(warnings===0){
   await db.query('BEGIN');
   try{
    await db.query("UPDATE resources SET availability='missing' WHERE source_id=$1 AND last_seen_scan IS DISTINCT FROM $2",[source.id,scanId]);
    await db.query('UPDATE storage_sources SET last_successful_scan=now() WHERE id=$1',[source.id]);
    await db.query("UPDATE scan_jobs SET status='completed',files_seen=$2,folders_seen=$3,completed_at=now() WHERE id=$1",[scanId,filesSeen,foldersSeen]);
    await db.query('COMMIT');
   }catch(e){await db.query('ROLLBACK');throw e}
  }else{
   await db.query("UPDATE scan_jobs SET status='partial',files_seen=$2,folders_seen=$3,error=$4,completed_at=now() WHERE id=$1",
    [scanId,filesSeen,foldersSeen,String(warnings)+' inaccessible entries. '+examples.join(' | ').slice(0,700)]);
  }
  console.log('Scan finished: '+filesSeen+' files and '+foldersSeen+' folders. Warnings: '+warnings);
  console.log('Original media untouched. '+(warnings?'Partial scan: missing-file reconciliation skipped.':'Complete scan.'));
 }catch(e){
  await db.query("UPDATE scan_jobs SET status='failed',files_seen=$2,folders_seen=$3,error=$4,completed_at=now() WHERE id=$1",
   [scanId,filesSeen,foldersSeen,String(e).slice(0,900)]);throw e;
 }
}finally{await db.end()}
