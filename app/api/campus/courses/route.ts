import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {campusMode} from '@/lib/campus-mode';
import {approvalRequired} from '@/lib/campus-publication';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!campusMode())return NextResponse.json({error:'Campus library is only available on the college server'},{status:404});
 const params=req.nextUrl.searchParams;
 const q=(params.get('q')||'').trim().toLowerCase().slice(0,100);
 const department=(params.get('department')||'').slice(0,120);
 const page=Math.min(100000,Math.max(1,parseInt(params.get('page')||'1',10)||1));
 const limit=24;
 const approved=approvalRequired()?" AND EXISTS(SELECT 1 FROM campus_publications p WHERE p.course_code=r.course_code AND p.approved=TRUE)":"";
 const sql="WITH counts AS ("+
  "SELECT COALESCE(r.course_code,'UNCLASSIFIED') AS code,COUNT(*)::bigint AS files,"+
  "COUNT(*) FILTER (WHERE r.kind='Video')::bigint AS videos "+
  "FROM resources r JOIN storage_sources s ON s.id=r.source_id "+
  "WHERE r.availability='available' AND s.enabled=TRUE"+approved+" GROUP BY COALESCE(r.course_code,'UNCLASSIFIED')),"+
  "catalogue AS (SELECT t.code,t.files,t.videos,COALESCE(c.title,CASE WHEN t.code='UNCLASSIFIED' THEN 'Unclassified Materials' "+
  "ELSE 'Course '||t.code END) AS title,COALESCE(c.department,'Unclassified') AS department,"+
  "COALESCE(c.instructor,'') AS instructor,COALESCE(c.verified,FALSE) AS verified "+
  "FROM counts t LEFT JOIN course_catalog c ON c.course_code=t.code) "+
  "SELECT *,count(*) OVER() AS total FROM catalogue WHERE "+
  "($1='' OR lower(title) LIKE '%'||$1||'%' OR lower(code) LIKE '%'||$1||'%' "+
  "OR lower(department) LIKE '%'||$1||'%') AND ($2='' OR department=$2) "+
  "ORDER BY (department='Unclassified') ASC,department,title LIMIT $3 OFFSET $4";
 const out=await db().query(sql,[q,department,limit,(page-1)*limit]);
 const depts=await db().query("SELECT c.department FROM course_catalog c WHERE c.department NOT IN ('Unclassified','General') "+
  (approvalRequired()?"AND EXISTS(SELECT 1 FROM campus_publications p WHERE p.course_code=c.course_code AND p.approved=TRUE) ":"")+
  "GROUP BY c.department ORDER BY c.department");
 const total=out.rows.length?Number(out.rows[0].total):0;
 return NextResponse.json({items:out.rows.map(({total,...r})=>r),total,page,limit,
  departments:depts.rows.map(x=>x.department)});
}
