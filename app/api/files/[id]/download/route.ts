import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { campusMode } from '@/lib/campus-mode';
import { createRangedFileStream } from '@/lib/range-file-stream';
import { authorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { mimeFor, resolveStoredFile } from '@/lib/storage';
import { previewFiles, demoEnabled, makeDemoPdf } from '@/lib/demo';
import { isMacPilot, getMacPilotFile } from '@/lib/mac-pilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest, context:{params:Promise<{id:string}>}){
 if(!campusMode()&&!(await authorized()))return new Response('Unauthorized',{status:401});
 const {id}=await context.params;
 if(!/^\d+$/.test(id))return new Response('Bad file ID',{status:400});
 if(demoEnabled()){
  const item=previewFiles.find(f=>f.id===id);
  if(!item)return new Response('Not found',{status:404});
  const inline=req.nextUrl.searchParams.get('inline')==='1';
  if(item.kind==='Video'){
   // The synthetic sample is a tiny, original MP4 committed in public/demo.
   return NextResponse.redirect(new URL('/demo/mrem-preview.mp4',req.url),307);
  }
  if(item.ext==='.pdf'){
   const pdf=makeDemoPdf();
   return new Response(pdf.buffer as ArrayBuffer,{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':`${inline?'inline':'attachment'}; filename="MREM-Demo-Notes.pdf"`,
    'Content-Length':String(pdf.byteLength),
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
   }});
  }
  const content='MREM DIGITAL LIBRARY - DEMO RESOURCE ONLY\n\n'+item.name+'\n\n'+item.content+'\n\nNo real NPTEL resources or college files are attached.\n';
  return new Response(content,{headers:{
   'Content-Type':'text/plain; charset=utf-8',
   'Content-Disposition':`${inline?'inline':'attachment'}; filename="${item.name.replace(/[^a-zA-Z0-9_. -]/g,'_')}"`,
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }

 let file: {name:string;ext:string;root_path:string;rel_path:string}|null;
 if(isMacPilot()){
  file=await getMacPilotFile(id);
 }else{
  const q=await db().query(campusMode()?
   `SELECT r.*,s.root_path FROM resources r JOIN storage_sources s ON s.id=r.source_id
    WHERE r.id=$1 AND r.availability='available' AND s.enabled=TRUE`:
   `SELECT r.*,s.root_path FROM resources r JOIN storage_sources s ON s.id=r.source_id
    JOIN resource_assignments a ON a.resource_id=r.id
    WHERE r.id=$1 AND r.availability='available' AND s.enabled=TRUE`,[id]);
  file=q.rows[0]||null;
 }
 if(!file)return new Response('Not found',{status:404});
 if(campusMode()&&!['.mp4','.webm','.mov','.m4v','.avi','.mkv','.pdf','.txt','.md','.html','.htm','.jpg','.jpeg','.png','.webp','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv','.zip','.rar','.7z'].includes(file.ext))return new Response('File type not permitted',{status:415});
 let absolute:string,size:number;
 try{({absolute,size}=await resolveStoredFile(file.root_path,file.rel_path));}
 catch{return new Response('File unavailable on attached storage',{status:404});}
 if(!Number.isSafeInteger(size))return new Response('File too large for pilot file server',{status:501});
 // Legacy HTML may contain active JavaScript; render escaped source, never execute it with campus origin privileges.
 if(campusMode()&&req.nextUrl.searchParams.get('inline')==='1'&&['.html','.htm'].includes(file.ext)){
  if(size>512*1024)return new Response('HTML is too large to preview safely. Use Download.',{status:413});
  const raw=await readFile(absolute,'utf8');
  const escaped=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html='<!doctype html><meta charset="utf-8"><title>Safe HTML source preview</title>'+
   '<style>body{font:13px/1.6 ui-monospace,Consolas,monospace;background:#f8fafc;color:#1e293b;padding:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>'+
   '<h3>Static HTML source preview (scripts disabled)</h3><pre>'+escaped+'</pre>';
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private,no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"}});
 }

 const range=req.headers.get('range');
 let start=0,end=size-1;
 if(range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!m||(!m[1]&&!m[2]))return new Response('Invalid Range',{status:416,headers:{'Content-Range':`bytes */${size}`}});
  if(m[1]){start=Number(m[1]);end=m[2]?Number(m[2]):size-1;}
  else{const suffix=Number(m[2]);start=Math.max(0,size-suffix);end=size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>=size||start>end)
   return new Response('Range Not Satisfiable',{status:416,headers:{'Content-Range':`bytes */${size}`}});
 }
 const inline=req.nextUrl.searchParams.get('inline')==='1' && ['.mp4','.webm','.m4v','.mov','.pdf','.txt','.md','.png','.jpg','.jpeg','.webp'].includes(file.ext);
 const safeFilename=String(file.name).replace(/[\r\n"\\]/g,'_');
 const headers:Record<string,string>={
  'Content-Type':mimeFor(file.ext),
  'Content-Length':String(size===0?0:end-start+1),
  'Content-Disposition':`${inline?'inline':'attachment'}; filename="${safeFilename.replace(/[^\x20-\x7E]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'
 };
 if(range)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 if(!isMacPilot())db().query('INSERT INTO download_events(resource_id,range_request) VALUES($1,$2)',[id,Boolean(range)]).catch(()=>{});
 if(size===0)return new Response(null,{status:200,headers});
 let stream: ReadableStream<Uint8Array>;
 try { stream=await createRangedFileStream(absolute,start,end); }
 catch { return new Response('File unavailable on disk',{status:404}); }
 return new Response(stream,{status:range?206:200,headers});
}
