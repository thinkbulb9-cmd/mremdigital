import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {campusMode} from '@/lib/campus-mode';
import {uncategorizedTree,visibleSql} from '@/lib/campus-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Files without a course ID, browsed by their original folders and file names. Collections are named, never shown as
 * drive letters; only folders holding visible files (or leading to them) are listed. */
export async function GET(req:NextRequest){
 if(!campusMode())return NextResponse.json({error:'Not available'},{status:404});
 const p=req.nextUrl.searchParams;
 const source=p.get('source')||'',path=(p.get('path')||'').replace(/^\/+|\/+$/g,''),q=(p.get('q')||'').trim().slice(0,100);
 const page=Math.min(100000,Math.max(1,parseInt(p.get('page')||'1',10)||1)),limit=100;
 const {sources,tree}=await uncategorizedTree();
 if(!source){
  if(q.length>=3){
   const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
   const hits=(await db().query(`SELECT r.id::text,r.name,r.ext,r.kind,r.size_bytes::text,r.source_id,r.folder_rel_path FROM resources r
    WHERE r.course_code IS NULL AND r.name ILIKE $1 AND ${visibleSql()} ORDER BY r.name LIMIT 100`,[like])).rows;
   return NextResponse.json({collections:sources.filter(s=>s.files),results:hits.map(h=>({...h,collection:sources.find(s=>s.id===h.source_id)?.name||''}))});
  }
  return NextResponse.json({collections:sources.filter(s=>s.files)});
 }
 const t=tree.get(source),here=t?.get(path);
 if(!t||!here)return NextResponse.json({error:'Folder not available'},{status:404});
 const depth=path?path.split('/').length:0,prefix=path?path+'/':'';
 const folders=[...t].filter(([k])=>k.startsWith(prefix)&&k!==path&&k.split('/').length===depth+1)
  .map(([k,v])=>({name:k.slice(prefix.length),path:k,files:v.below})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 const files=here.files?(await db().query(`SELECT r.id::text,r.name,r.ext,r.kind,r.size_bytes::text FROM resources r
   WHERE r.source_id=$1 AND r.folder_rel_path=$2 AND r.course_code IS NULL AND ${visibleSql()} ORDER BY r.name,r.id LIMIT $3 OFFSET $4`,
   [source,path,limit,(page-1)*limit])).rows:[];
 return NextResponse.json({collection:sources.find(s=>s.id===source)?.name||source,source,path,folders,files,totalFiles:here.files,page,limit});
}
