/** Resolves legacy catalogue links to indexed inventory paths. Pure functions; no file or database access.
 * A link is accepted only when it lands on an indexed file inside the registered archive root,
 * in the same semester root and for the same nine-digit course. Filename-only matching is never used.
 */
import path from 'node:path';

export const RESOURCE_EXT=new Set(['.mp4','.m4v','.webm','.mov','.avi','.mkv','.flv','.wmv','.mp3',
 '.pdf','.doc','.docx','.ppt','.pptx','.pps','.ppsx','.txt','.rtf','.xls','.xlsx','.csv','.srt','.vtt',
 '.zip','.rar','.7z','.jpg','.jpeg','.png']);
const SEMESTER=/^(jan|jul)[-_ ]?(apr|dec)[-_ ]?(20\d{2})$/i;
export const hasResourceExt=(p)=>RESOURCE_EXT.has(path.posix.extname(String(p).split(/[?#]/)[0]).toLowerCase());

export function rootInfo(name,accepted=[]){
 const m=SEMESTER.exec(name);
 if(m)return {recognized:true,order:Number(m[3])*10+(m[1].toLowerCase()==='jul'?2:1)};
 if(/^web[-_ ]?courses?$/i.test(name))return {recognized:true,order:0};
 return {recognized:accepted.some(a=>a.toLowerCase()===String(name).toLowerCase()),order:-1};
}
export function lectureOf(filename){
 const m=/mod(?:ule)?[-_ ]?0*(\d{1,3})[-_ ]?lec(?:ture)?[-_ ]?0*(\d{1,3})/i.exec(String(filename));
 return m?{module_no:Number(m[1]),lecture_no:Number(m[2])}:{module_no:null,lecture_no:null};
}
export const courseInPath=(p)=>String(p).split('/').find(s=>/^\d{9}$/.test(s))||null;

function safeDecode(v){
 let out=String(v);
 for(let i=0;i<3&&/%[0-9a-f]{2}/i.test(out);i++){try{out=decodeURIComponent(out)}catch{break}}
 return out;
}
/** Turns one raw href/option value into resource references: {ref, viewer}, or {external}. */
export function resourceRefs(raw){
 let v=String(raw??'').trim();
 if(!v||v.startsWith('#'))return [];
 if(/^javascript:/i.test(v)){
  return [...v.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)].flatMap(m=>resourceRefs(m[2]));
 }
 if(/^(https?|ftp):\/\//i.test(v))return hasResourceExt(v)?[{external:v}]:[];
 if(/^(mailto|data|vbscript|about|tel|blob):/i.test(v))return [];
 v=v.replace(/^file:\/*/i,'');
 const hash=v.indexOf('#');if(hash>=0)v=v.slice(0,hash);
 const q=v.indexOf('?'),page=q>=0?v.slice(0,q):v,query=q>=0?v.slice(q+1):'';
 const refs=[];
 for(const pair of query.split('&')){
  const eq=pair.indexOf('=');if(eq<0)continue;
  const value=safeDecode(pair.slice(eq+1).replace(/\+/g,' ')).trim();
  if(value&&hasResourceExt(value))refs.push({ref:value,viewer:safeDecode(page)||null,param:safeDecode(pair.slice(0,eq))});
 }
 if(!refs.length&&hasResourceExt(safeDecode(page)))refs.push({ref:safeDecode(page).trim(),viewer:null});
 return refs;
}
/** Viewer page named in a dropdown handler, e.g. onchange="location='displayvideo.html?type1='+this.value". */
export function handlerViewer(js){
 for(const m of String(js||'').matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)){
  const page=/^([^?#'"]+\.html?)(?:[?#]|$)/i.exec(m[2].trim());
  if(page&&!/^[a-z]+:/i.test(page[1]))return page[1];
 }
 return null;
}
/** Joins a legacy reference onto a base folder; refuses anything that would leave the archive root. */
export function normalizeRef(ref,baseDir,rootPath){
 let r=String(ref).replace(/\\/g,'/');
 let base=baseDir;
 if(r.includes('\0'))return {error:'invalid-character'};
 if(/^[a-z]:\//i.test(r)||r.startsWith('//')){
  const root=String(rootPath||'').replace(/\\/g,'/').replace(/\/+$/,'');
  if(!root||!r.toLowerCase().startsWith(root.toLowerCase()+'/'))return {error:'absolute-path-outside-archive'};
  r=r.slice(root.length+1);base='';
 }else if(r.startsWith('/')){r=r.slice(1);base=''}
 const parts=[];
 for(const seg of (base?base+'/'+r:r).split('/')){
  if(!seg||seg==='.')continue;
  if(seg==='..'){if(!parts.length)return {error:'escapes-archive-root'};parts.pop();continue}
  if(seg.includes(':'))return {error:'invalid-segment'};
  parts.push(seg);
 }
 return parts.length?{rel:parts.join('/')}:{error:'empty-path'};
}
export const dirOf=(rel)=>rel.includes('/')?rel.slice(0,rel.lastIndexOf('/')):'';

/** Candidate inventory paths for a reference found in sourceRel. A viewer link (displayvideo.html?type1=x)
 * resolves x against the viewer's folder and any path prefix that viewer's script prepends. */
export function candidatePaths({ref,viewer},sourceRel,rootPath,viewerPrefixes=new Map()){
 const here=dirOf(sourceRel),bases=new Set([here]);
 if(viewer){
  const v=normalizeRef(viewer,here,rootPath);
  if(v.rel){
   bases.add(dirOf(v.rel));
   for(const p of viewerPrefixes.get(v.rel)||[]){const b=normalizeRef(p,dirOf(v.rel),rootPath);if(b.rel)bases.add(b.rel)}
  }
 }
 const out=[],errors=[];
 for(const b of bases){const n=normalizeRef(ref,b,rootPath);if(n.rel)out.push(n.rel);else errors.push(n.error)}
 return {paths:[...new Set(out)],errors};
}

/** Decide which indexed file a reference means.
 * exactHits: inventory rows whose rel_path equals one of the candidate paths.
 * courseFiles: inventory rows for this course inside this semester root (fallback only).
 */
export function chooseMatch({ref,courseCode,semesterRoot,exactHits,courseFiles}){
 const inScope=(r)=>r.rel_path.split('/')[0]===semesterRoot;
 const exact=exactHits.filter(inScope);
 const check=(r,method,confidence)=>{
  if(courseCode&&r.course_code!==courseCode)
   return {status:'conflict',reason:'indexed-file-belongs-to-course-'+(r.course_code||'none'),resource:r,method};
  return {status:'matched',resource:r,method,confidence};
 };
 if(exact.length===1)return check(exact[0],'exact-path','high');
 if(exact.length>1)return {status:'conflict',reason:'several-exact-candidates',candidates:exact};
 if(!courseCode)return {status:'unresolved',reason:'no-course-id-for-link'};
 const tail=String(ref).replace(/\\/g,'/').split('/').filter(s=>s&&s!=='.'&&s!=='..').join('/');
 if(!tail)return {status:'unresolved',reason:'empty-reference'};
 const lowerTail='/'+tail.toLowerCase();
 // The tail must keep its folder structure; a bare filename only matches inside this course's own files.
 const hits=(courseFiles||[]).filter(r=>inScope(r)&&('/'+r.rel_path.toLowerCase()).endsWith(lowerTail));
 if(hits.length===1)return check(hits[0],'semester-course-suffix','medium');
 if(hits.length>1)return {status:'conflict',reason:'several-files-in-course-share-this-path-ending',candidates:hits};
 return {status:'unresolved',reason:'not-in-indexed-inventory'};
}
