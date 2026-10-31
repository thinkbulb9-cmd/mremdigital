import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {campusMode} from '@/lib/campus-mode';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,ctx:{params:Promise<{code:string}>}){
 if(!campusMode())return NextResponse.json({error:'Not available'},{status:404});
 const {code}=await ctx.params;
 if(!/^(?:\d{9}|UNCLASSIFIED)$/.test(code))return NextResponse.json({error:'Invalid course'},{status:400});
 const page=Math.min(100000,Math.max(1,parseInt(req.nextUrl.searchParams.get('page')||'1',10)||1)),limit=100;
 const count=await db().query("SELECT count(*)::bigint AS total FROM resources r JOIN storage_sources s ON s.id=r.source_id "+
 "WHERE r.availability='available' AND s.enabled=TRUE AND COALESCE(r.course_code,'UNCLASSIFIED')=$1",[code]);
 const meta=await db().query("SELECT title,department,instructor,institution,verified FROM course_catalog WHERE course_code=$1",[code]);
 const files=await db().query(
  "SELECT r.id::text,r.name,r.ext,r.kind,r.size_bytes::text,r.module_no,r.lecture_no,r.semester_name,l.title AS lecture_title "+
  "FROM resources r JOIN storage_sources s ON s.id=r.source_id "+
  "LEFT JOIN course_lectures l ON l.course_code=r.course_code AND l.module_no=r.module_no AND l.lecture_no=r.lecture_no AND l.verified=TRUE "+
  "WHERE r.availability='available' AND s.enabled=TRUE AND COALESCE(r.course_code,'UNCLASSIFIED')=$1 "+
  "ORDER BY r.module_no NULLS LAST,r.lecture_no NULLS LAST,r.name,r.id LIMIT $2 OFFSET $3",
  [code,limit,(page-1)*limit]);
 return NextResponse.json({code,title:meta.rows[0]?.title||(code==='UNCLASSIFIED'?'Unclassified Materials':'Course '+code),
  department:meta.rows[0]?.department||'Unclassified',instructor:meta.rows[0]?.instructor||'',
  institution:meta.rows[0]?.institution||'',verified:meta.rows[0]?.verified||false,
  total:Number(count.rows[0].total),page,limit,items:files.rows});
}
