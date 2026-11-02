import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {campusMode} from '@/lib/campus-mode';
import {visibleSql,sortOfferings,offeringLabel,courseSummaries} from '@/lib/campus-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const KINDS:Record<string,string>={video:"r.kind='Video'",document:"r.kind='Document'",html:"r.kind='HTML'",other:"r.kind NOT IN ('Video','Document','HTML')"};
/** One course workspace: its offerings (semesters, on whichever drive) and their files. Physical drives and paths are not
 * returned. A lecture title is shown only when it is tied to this exact file (catalogue page or official file name) or
 * reviewed by staff; otherwise the original file name is the title. */
export async function GET(req:NextRequest,ctx:{params:Promise<{code:string}>}){
 if(!campusMode())return NextResponse.json({error:'Not available'},{status:404});
 const {code}=await ctx.params;
 if(!/^\d{9}$/.test(code))return NextResponse.json({error:'Invalid course'},{status:400});
 const p=req.nextUrl.searchParams;
 const offering=p.get('offering')??'';
 const kind=KINDS[p.get('kind')||'']?p.get('kind')!:'';
 const page=Math.min(100000,Math.max(1,parseInt(p.get('page')||'1',10)||1)),limit=200;
 const summary=(await courseSummaries()).find(c=>c.code===code);
 if(!summary)return NextResponse.json({error:'This course has no files available to students'},{status:404});
 const offerings=(await db().query(`SELECT COALESCE(r.semester_name,'') AS value,count(*)::int AS files,
   count(*) FILTER(WHERE r.kind='Video')::int AS videos,count(*) FILTER(WHERE r.kind='Document')::int AS documents,
   count(*) FILTER(WHERE r.kind='HTML')::int AS html,count(*) FILTER(WHERE r.kind NOT IN ('Video','Document','HTML'))::int AS other
   FROM resources r WHERE r.course_code=$1 AND ${visibleSql()} GROUP BY 1`,[code])).rows;
 const order=sortOfferings(offerings.map(o=>o.value).filter(Boolean));
 offerings.sort((a,b)=>(a.value?order.indexOf(a.value):1e9)-(b.value?order.indexOf(b.value):1e9));
 const chosen=offerings.some(o=>o.value===offering)?offering:(offerings[0]?.value??'');
 const args:unknown[]=[code,chosen,limit,(page-1)*limit];
 const items=(await db().query(`SELECT r.id::text,r.name,r.ext,r.kind,r.size_bytes::text,r.module_no,r.lecture_no,
   COALESCE(llt.title,lt.title,cl.title) AS lecture_title,
   CASE WHEN llt.title IS NOT NULL THEN 'Local course catalogue' WHEN lt.title IS NOT NULL THEN 'NPTEL lecture list (same file name)'
        WHEN cl.title IS NOT NULL THEN 'Reviewed by college staff' END AS title_source
   FROM resources r
   LEFT JOIN legacy_lecture_titles llt ON llt.resource_id=r.id AND llt.confidence='high'
   LEFT JOIN lecture_titles lt ON lt.resource_id=r.id AND lt.confidence='HIGH'
   LEFT JOIN course_lectures cl ON cl.course_code=r.course_code AND cl.module_no=r.module_no AND cl.lecture_no=r.lecture_no AND cl.verified
   WHERE r.course_code=$1 AND COALESCE(r.semester_name,'')=$2 AND ${visibleSql()} ${kind?'AND '+KINDS[kind]:''}
   ORDER BY (r.kind='Video') DESC,r.module_no NULLS LAST,r.lecture_no NULLS LAST,r.name,r.id LIMIT $3 OFFSET $4`,args)).rows;
 const current=offerings.find(o=>o.value===chosen);
 const total=!current?0:kind==='video'?current.videos:kind==='document'?current.documents:kind==='html'?current.html:kind==='other'?current.other:current.files;
 return NextResponse.json({code,title:summary.title,titleVerified:summary.titleVerified,department:summary.department,
  instructor:summary.instructor,institution:summary.institution,videos:summary.videos,documents:summary.documents,
  offerings:offerings.map(o=>({...o,label:offeringLabel(o.value||null)})),offering:chosen,kind,page,limit,total,items},
  {headers:{'Cache-Control':'no-store'}});
}
