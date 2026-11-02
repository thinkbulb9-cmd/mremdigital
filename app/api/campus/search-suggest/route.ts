import {NextRequest} from 'next/server';
import {campusMode} from '@/lib/campus-mode';
import {findCourses} from '@/lib/campus-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Only courses already visible through the student's publication-aware catalogue may be suggested. */
export async function GET(req:NextRequest){
 if(!campusMode())return Response.json({items:[]},{status:404});
 const q=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,100);
 try { const results=await findCourses({q,limit:7,page:1});
  return Response.json({items:results.items.map(c=>({code:c.code,title:c.title,department:c.department,deptSlug:c.deptSlug,isWeb:c.isWeb,videos:c.videos}))},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({items:[]},{status:503,headers:{'Cache-Control':'no-store'}})}
}
