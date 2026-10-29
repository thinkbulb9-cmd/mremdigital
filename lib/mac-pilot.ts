/** Local-only macOS folder preview: never enabled on deployed builds. */
import 'server-only';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type MacFile = {
 id:string;name:string;ext:string;kind:string;department:string;course:string;
 size_bytes:string;modified_at:string;source_id:string;rel_path:string;root_path:string;
};
const VIDEO=new Set(['.mp4','.m4v','.webm','.mov','.mkv','.avi']);
const DOC=new Set(['.pdf','.txt','.md','.doc','.docx','.ppt','.pptx','.csv','.xlsx','.xls']);
const IMG=new Set(['.png','.jpeg','.jpg','.webp']);
const ARCHIVE=new Set(['.zip','.rar','.7z']);
const MAX_FILES=1500,MAX_VISITED=12000,MAX_DEPTH=7;
let cache: {root:string;at:number;files:MacFile[];truncated:boolean}|null=null;
export function isMacPilot():boolean {
 return process.env.NODE_ENV==='development'&&process.env.VERCEL!=='1'&&Boolean(process.env.MREM_MAC_PILOT_ROOT);
}
export async function scanMacPilot(){
 if(!isMacPilot())throw new Error('Local Mac pilot disabled');
 const root=await fs.realpath(process.env.MREM_MAC_PILOT_ROOT!);
 if(cache&&cache.root===root&&Date.now()-cache.at<3000)return cache;
 if(!(await fs.stat(root)).isDirectory())throw new Error('Mac pilot folder is not a directory');
 const files:MacFile[]=[];
 const stack:[string,number][]=[['',0]];
 let visited=0,truncated=false;
 while(stack.length>0){
  const [relative,depth]=stack.pop()!;
  const absolute=path.join(root,...relative.split('/').filter(Boolean));
  const dir=await fs.opendir(absolute);
  try{
   for await (const entry of dir){
    if(++visited>MAX_VISITED||files.length>=MAX_FILES){truncated=true;break;}
    if(entry.name.startsWith('.')||entry.isSymbolicLink())continue;
    const rel=relative?relative+'/'+entry.name:entry.name;
    if(entry.isDirectory()){
     if(depth<MAX_DEPTH)stack.push([rel,depth+1]);
     continue;
    }
    if(!entry.isFile())continue;
    const ext=path.extname(entry.name).toLowerCase();
    if(!VIDEO.has(ext)&&!DOC.has(ext)&&!IMG.has(ext)&&!ARCHIVE.has(ext))continue;
    let meta;
    try{meta=await fs.lstat(path.join(absolute,entry.name));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
    if(!meta.isFile())continue;
    const id=BigInt('0x'+createHash('sha256').update(rel).digest('hex').slice(0,13)).toString();
    files.push({
     id,name:entry.name,ext,
     kind:VIDEO.has(ext)?'Video':DOC.has(ext)?'Document':ARCHIVE.has(ext)?'Archive':'Image',
     department:'Mac Local Disk',course:relative.split('/').filter(Boolean).at(-1)||path.basename(root),
     size_bytes:String(meta.size),modified_at:meta.mtime.toISOString(),
     source_id:'macpilot',rel_path:rel,root_path:root
    });
   }
  }finally{await dir.close().catch(()=>{});}
  if(truncated)break;
 }
 files.sort((a,b)=>a.course.localeCompare(b.course)||a.name.localeCompare(b.name));
 cache={root,at:Date.now(),files,truncated};
 return cache;
}
export async function macPilotCatalogue(params:URLSearchParams){
 const {files,truncated}=await scanMacPilot();
 const q=(params.get('q')||'').toLowerCase().trim(),kind=params.get('kind')||'';
 const department=params.get('department')||'',course=params.get('course')||'';
 const page=Math.max(1,Number.parseInt(params.get('page')||'1',10)||1);
 const filtered=files.filter(f=>(!q||[f.name,f.course].some(x=>x.toLowerCase().includes(q)))&&(!kind||f.kind===kind)&&(!department||f.department===department)&&(!course||f.course===course));
 return {items:filtered.slice((page-1)*30,page*30).map(({root_path,rel_path,...publicEntry})=>publicEntry),
 total:filtered.length,page,limit:30,
 departments:[{department:'Mac Local Disk',total:String(files.length)}],
 courses:department==='Mac Local Disk'?[...new Set(files.map(f=>f.course))].sort():[],
 truncated
 };
}
export async function getMacPilotFile(id:string){
 const {files}=await scanMacPilot();
 return files.find(f=>f.id===id)||null;
}
