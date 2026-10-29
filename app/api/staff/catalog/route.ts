import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { staffSession,sourceAllowed } from '@/lib/staff-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const staff=await staffSession();
 if(!staff)return NextResponse.json({error:'Staff login required'},{status:401});
 const sources=await db().query(
  staff.role==='hod'?
  'SELECT s.id,s.name,s.enabled FROM storage_sources s JOIN hod_source_grants g ON g.source_id=s.id WHERE g.staff_user_id=$1 ORDER BY s.name':
  'SELECT id,name,enabled FROM storage_sources ORDER BY name',
  staff.role==='hod'?[staff.id]:[]);
 const departments=await db().query(
  staff.role==='hod'?'SELECT id::text,code,name FROM departments WHERE id=$1 AND active=TRUE':
   'SELECT id::text,code,name FROM departments WHERE active=TRUE ORDER BY name',
  staff.role==='hod'?[staff.department_id]:[]);
 const courses=await db().query(
  staff.role==='hod'?'SELECT id::text,department_id::text,code,name FROM courses WHERE department_id=$1 AND active=TRUE ORDER BY name':
   'SELECT id::text,department_id::text,code,name FROM courses WHERE active=TRUE ORDER BY name',
  staff.role==='hod'?[staff.department_id]:[]);
 const sourceId=(req.nextUrl.searchParams.get('source')||'').slice(0,100);
 const search=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,100);
 let folders:unknown[]=[];
 let files:unknown[]=[];
 if(sourceId){
  if(!sources.rows.some(x=>x.id===sourceId)||!(await sourceAllowed(staff,sourceId)))
   return NextResponse.json({error:'Storage access denied'},{status:403});
  const filter=search?'AND f.rel_path ILIKE $2':'';
  const args=search?[sourceId,'%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%']:[sourceId];
  const result=await db().query(
   'SELECT f.rel_path,f.name,f.parent_rel_path FROM folders f WHERE f.source_id=$1 AND f.rel_path<>\'\' '+
   filter+' ORDER BY f.rel_path LIMIT 100',
   args); 
  folders=result.rows;
  const items=await db().query(
   'SELECT r.id::text,r.rel_path,r.name,r.kind,r.size_bytes::text,a.department_id::text AS mapped_department '+
   'FROM resources r LEFT JOIN resource_assignments a ON a.resource_id=r.id WHERE r.source_id=$1 '+
   (search?'AND r.name ILIKE $2 ':'')+
   (staff.role==='hod'?'AND (a.department_id=$'+(search?'3':'2')+' OR a.department_id IS NULL) ':'')+
   'ORDER BY r.id DESC LIMIT 35',
   staff.role==='hod'?(search?[sourceId,'%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%',staff.department_id]:[sourceId,staff.department_id]):
   (search?[sourceId,'%'+search.replace(/[\\%_]/g,c=>'\\'+c)+'%']:[sourceId]));
  files=items.rows;
 }
 return NextResponse.json({staff,sources:sources.rows,departments:departments.rows,courses:courses.rows,folders,files});
}
