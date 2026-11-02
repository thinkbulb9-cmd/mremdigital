import {NextRequest,NextResponse} from 'next/server';
import {campusMode} from '@/lib/campus-mode';
import {courseSummaries,codesMatching,offeringLabel} from '@/lib/campus-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Student course catalogue across every enabled drive: one row per course ID, whichever drives hold its offerings. */
export async function GET(req:NextRequest){
 if(!campusMode())return NextResponse.json({error:'Campus library is only available on the college server'},{status:404});
 const p=req.nextUrl.searchParams;
 const q=(p.get('q')||'').trim().toLowerCase().slice(0,100);
 const department=(p.get('department')||'').slice(0,120);
 const type=p.get('type')||'';
 const offering=(p.get('offering')||'').slice(0,40);
 const page=Math.min(100000,Math.max(1,parseInt(p.get('page')||'1',10)||1)),limit=24;
 const all=await courseSummaries();
 const deep=q?await codesMatching(q):new Set<string>();
 const items=all.filter(c=>
  (!department||c.department===department)&&
  (type!=='video'||c.videos>0)&&(type!=='document'||c.documents>0)&&(type!=='html'||c.html>0)&&
  (!offering||c.offerings.includes(offering))&&
  (!q||deep.has(c.code)||[c.title,c.code,c.department,c.instructor,c.institution,...c.offerings.map(offeringLabel)].some(v=>v.toLowerCase().includes(q))))
  // Named courses first, then those still identified only by course ID.
  .sort((a,b)=>Number(!a.title)-Number(!b.title)||(a.title||a.code).localeCompare(b.title||b.code));
 const offerings=[...new Set(all.flatMap(c=>c.offerings))];
 return NextResponse.json({items:items.slice((page-1)*limit,page*limit).map(c=>({...c,offeringLabels:c.offerings.map(offeringLabel)})),
  total:items.length,page,limit,offerings:offerings.map(o=>({value:o,label:offeringLabel(o)}))},{headers:{'Cache-Control':'no-store'}});
}
