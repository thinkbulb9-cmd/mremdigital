import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { staffSession,sourceAllowed,mutationAllowed,validRelPath } from '@/lib/staff-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const staff=await staffSession();
 if(!staff)return NextResponse.json({error:'Staff login required'},{status:401});
 const q=await db().query(
  'SELECT r.id::text,r.source_id,r.scope,r.rel_path,r.department_id::text,r.course_id::text,'+
  'd.code AS department_code,d.name AS department_name,c.name AS course_name,r.status,'+
  'r.note,r.submitted_at,r.reviewed_at,r.review_note,u.username AS submitted_by,'+
  'j.status AS indexing_status,j.processed_count::text AS indexed_count '+
  'FROM mapping_requests r JOIN departments d ON d.id=r.department_id '+
  'LEFT JOIN courses c ON c.id=r.course_id JOIN staff_users u ON u.id=r.submitted_by '+
  'LEFT JOIN LATERAL (SELECT status,processed_count FROM mapping_jobs WHERE mapping_request_id=r.id ORDER BY id DESC LIMIT 1) j ON true '+
  (staff.role==='hod'?'WHERE r.department_id=$1 ':'')+
  'ORDER BY r.submitted_at DESC,r.id DESC LIMIT 120',
  staff.role==='hod'?[staff.department_id]:[]);
 return NextResponse.json({items:q.rows});
}
export async function POST(req:NextRequest){
 if(!mutationAllowed(req))return NextResponse.json({error:'Forbidden'},{status:403});
 const staff=await staffSession();
 if(!staff)return NextResponse.json({error:'Staff login required'},{status:401});
 const input=await req.json().catch(()=>null);
 const sourceId=typeof input?.source_id==='string'?input.source_id.trim():'';
 const scope=input?.scope==='file'?'file':'folder';
 const path=typeof input?.rel_path==='string'?input.rel_path.trim():'';
 const departmentId=String(input?.department_id||'');
 const courseId=input?.course_id?String(input.course_id):null;
 const note=typeof input?.note==='string'?input.note.slice(0,700):'';
 if(!/^[A-Za-z0-9_-]{2,48}$/.test(sourceId)||!validRelPath(path)||!/^\d+$/.test(departmentId)||courseId&&!/^\d+$/.test(courseId))
  return NextResponse.json({error:'Invalid mapping source, folder, or category'},{status:400});
 if(staff.role==='hod'&&departmentId!==staff.department_id)
  return NextResponse.json({error:'Cannot map content to another department'},{status:403});
 if(!(await sourceAllowed(staff,sourceId)))return NextResponse.json({error:'Storage source access denied'},{status:403});
 const dep=await db().query('SELECT id FROM departments WHERE id=$1 AND active=TRUE',[departmentId]);
 if(!dep.rowCount)return NextResponse.json({error:'Unknown department'},{status:400});
 if(courseId){
  const course=await db().query('SELECT id FROM courses WHERE id=$1 AND department_id=$2 AND active=TRUE',[courseId,departmentId]);
  if(!course.rowCount)return NextResponse.json({error:'Course does not belong to this department'},{status:400});
 }
 const exists=await db().query(
  scope==='file'?'SELECT id FROM resources WHERE source_id=$1 AND rel_path=$2 LIMIT 1':
  'SELECT id FROM folders WHERE source_id=$1 AND rel_path=$2 LIMIT 1',[sourceId,path]);
 if(!exists.rowCount)return NextResponse.json({error:'Folder or file not found in indexed storage'},{status:404});
 if(staff.role==='hod'){
  // A HOD may assign unclassified material or reclassify its own department, never content already mapped elsewhere.
  const conflict=await db().query(
   'SELECT 1 FROM resources r JOIN resource_assignments a ON a.resource_id=r.id '+
   'WHERE r.source_id=$1 AND a.department_id<>$2 AND '+
   (scope==='file'?'r.rel_path=$3':"left(r.rel_path,length($3)+1)=$3||'/'")+' LIMIT 1',
   [sourceId,departmentId,path]);
  if(conflict.rowCount)return NextResponse.json({error:'Contains published material belonging to another department. Ask the librarian to review.'},{status:409});
 }
 const previous=await db().query(
  "SELECT id FROM mapping_requests WHERE source_id=$1 AND scope=$2 AND rel_path=$3 AND status='pending' LIMIT 1",
  [sourceId,scope,path]);
 if(previous.rowCount)return NextResponse.json({error:'A request for this folder or file is already pending review'},{status:409});
 const client=await db().connect();
 try{
  await client.query('BEGIN');
  const r=await client.query(
   'INSERT INTO mapping_requests(source_id,scope,rel_path,department_id,course_id,note,submitted_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text',
   [sourceId,scope,path,departmentId,courseId,note,staff.id]);
  const id=r.rows[0].id;
  await client.query(
   "INSERT INTO staff_audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,'mapping.proposed','mapping_request',$2,$3::jsonb)",
   [staff.id,id,JSON.stringify({source_id:sourceId,scope,rel_path:path,department_id:departmentId,course_id:courseId})]);
  await client.query('COMMIT');
  return NextResponse.json({ok:true,id,status:'pending'},{status:201});
 }catch(e){await client.query('ROLLBACK');throw e;}
 finally{client.release();}
}
