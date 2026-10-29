import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function resolveStoredFile(root:string, relative:string){
 if(!relative||relative.includes('\\')||relative.includes('\0'))throw new Error('Invalid relative path');
 const pieces=relative.split('/');
 if(pieces.some(p=>!p||p==='.'||p==='..'||p.includes(':')))throw new Error('Invalid path segment');
 const realRoot=await fs.realpath(root);
 const absolute=path.resolve(realRoot,...pieces);
 const realFile=await fs.realpath(absolute);
 const within=path.relative(realRoot,realFile);
 if(!within||within==='..'||within.startsWith(`..${path.sep}`)||path.isAbsolute(within))throw new Error('Outside storage root');
 const stat=await fs.stat(realFile);
 if(!stat.isFile())throw new Error('Resource not a file');
 return {absolute:realFile,size:stat.size};
}
export const mimeFor=(ext:string):string=>({
 '.pdf':'application/pdf','.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mov':'video/quicktime',
 '.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8',
 '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.zip':'application/zip'
} as Record<string,string>)[ext]||'application/octet-stream';
