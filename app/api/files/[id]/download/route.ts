import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { campusMode } from '@/lib/campus-mode';
import { visibleSql } from '@/lib/campus-catalog';
import { renderSafeHtml, safeHtmlHeaders } from '@/lib/safe-html';
import { decodeHtmlBytes } from '@/scripts/legacy-catalogue/parse.mjs';
import { createRangedFileStream } from '@/lib/range-file-stream';
import { db } from '@/lib/db';
import { mimeFor, resolveStoredFile } from '@/lib/storage';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** File types students may receive at all, and those shown inline (others are offered as downloads). */
const PERMITTED=['.mp4','.webm','.mov','.m4v','.avi','.mkv','.pdf','.txt','.md','.html','.htm','.jpg','.jpeg','.png','.gif','.webp','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv','.zip','.rar','.7z'];
const INLINE=['.mp4','.webm','.m4v','.mov','.pdf','.txt','.md','.png','.jpg','.jpeg','.gif','.webp'];

/** Streams one file by its database ID: only files visible to students (see visibleSql), only permitted types, only inside
 * the registered storage root, with HTTP range support for video seeking. HTML is rebuilt as a static sandboxed page. */
export async function GET(req:NextRequest, context:{params:Promise<{id:string}>}){
 if(!campusMode())return new Response('Not available',{status:404});
 const {id}=await context.params;
 if(!/^\d{1,18}$/.test(id))return new Response('Bad file ID',{status:400});
 const file=(await db().query(`SELECT r.source_id,r.rel_path,r.name,lower(r.ext) AS ext,s.root_path FROM resources r JOIN storage_sources s ON s.id=r.source_id
  WHERE r.id=$1 AND ${visibleSql()}`,[id])).rows[0] as {source_id:string;rel_path:string;name:string;ext:string;root_path:string}|undefined;
 if(!file)return new Response('Not found',{status:404});
 if(!PERMITTED.includes(file.ext))return new Response('File type not permitted',{status:415});
 let absolute:string,size:number;
 try{({absolute,size}=await resolveStoredFile(file.root_path,file.rel_path));}
 catch{return new Response('File unavailable on attached storage',{status:404});}
 if(!Number.isSafeInteger(size))return new Response('File too large to stream',{status:501});
 const inlineRequested=req.nextUrl.searchParams.get('inline')==='1';
 // Legacy HTML may contain active JavaScript: rebuild it as a static sandboxed page, never run it on the campus origin.
 if(inlineRequested&&['.html','.htm'].includes(file.ext)){
  if(size>2*1024*1024)return new Response('HTML is too large to preview safely. Use Download.',{status:413});
  // The origin the browser used (a reverse proxy passes it on), so images in the page are allowed from the library only.
  const origin=(req.headers.get('x-forwarded-proto')||req.nextUrl.protocol.replace(':',''))+'://'+(req.headers.get('x-forwarded-host')||req.headers.get('host')||req.nextUrl.host);
  return new Response(await renderSafeHtml(decodeHtmlBytes(await readFile(absolute)),file),{headers:safeHtmlHeaders(origin)});
 }
 const range=req.headers.get('range');
 let start=0,end=size-1;
 if(range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!m||(!m[1]&&!m[2]))return new Response('Invalid Range',{status:416,headers:{'Content-Range':`bytes */${size}`}});
  // A last-byte position past the end means "to the end" (RFC 9110 14.1.2), not an error.
  if(m[1]){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
  else{const suffix=Number(m[2]);start=Math.max(0,size-suffix);end=size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>=size||start>end)
   return new Response('Range Not Satisfiable',{status:416,headers:{'Content-Range':`bytes */${size}`}});
 }
 const inline=inlineRequested&&INLINE.includes(file.ext);
 const safeFilename=String(file.name).replace(/[\r\n"\\]/g,'_');
 const headers:Record<string,string>={
  'Content-Type':mimeFor(file.ext),
  'Content-Length':String(size===0?0:end-start+1),
  'Content-Disposition':`${inline?'inline':'attachment'}; filename="${safeFilename.replace(/[^\x20-\x7E]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'
 };
 if(range)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 db().query('INSERT INTO download_events(resource_id,range_request) VALUES($1,$2)',[id,Boolean(range)]).catch(()=>{});
 if(size===0)return new Response(null,{status:200,headers});
 let stream: ReadableStream<Uint8Array>;
 try { stream=await createRangedFileStream(absolute,start,end); }
 catch { return new Response('File unavailable on disk',{status:404}); }
 return new Response(stream,{status:range?206:200,headers});
}
