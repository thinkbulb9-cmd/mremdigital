import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { staffSession,canReview,mutationAllowed } from '@/lib/staff-auth';
export const runtime='nodejs';
export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){
 if(!mutationAllowed(req))return NextResponse.json({error:'Forbidden'},{status:403});
 const staff=await staffSession();
 if(!staff)return NextResponse.json({error:'Staff login required'},{status:401});
 if(!canReview(staff))return NextResponse.json({error:'Librarian or super admin approval required'},{status:403});
 const {id}=await context.params;
 if(!/^\d+$/.test(id))return NextResponse.json({error:'Invalid request ID'},{status:400});
 const body=await req.json().catch(()=>null);
 const decision=body?.decision;
 if(decision!=='approve'&&decision!=='reject')return NextResponse.json({error:'Invalid decision'},{status:400});
 const note=typeof body?.note==='string'?body.note.slice(0,700):'';
 const client=await db().connect();
 try{
  await client.query('BEGIN');
  const q=await client.query('SELECT * FROM mapping_requests WHERE id=$1 FOR UPDATE',[id]);
  const r=q.rows[0];
  if(!r||r.status!=='pending'){
   await client.query('ROLLBACK');
   return NextResponse.json({error:'Request already processed or not found'},{status:409});
  }
  if(decision==='approve'){
   const check=await client.query('SELECT 1 FROM courses WHERE id=$1 AND department_id=$2 AND active=TRUE',[r.course_id||null,r.department_id]);
   if(r.course_id&&!check.rowCount){
    await client.query('ROLLBACK');
    return NextResponse.json({error:'Course is no longer valid for this department'},{status:409});
   }
   await client.query(
    'UPDATE published_mappings SET active=FALSE WHERE source_id=$1 AND scope=$2 AND rel_path=$3 AND active=TRUE',
    [r.source_id,r.scope,r.rel_path]);
   await client.query(
    'INSERT INTO published_mappings(source_id,scope,rel_path,department_id,course_id,approval_request_id) VALUES($1,$2,$3,$4,$5,$6)',
    [r.source_id,r.scope,r.rel_path,r.department_id,r.course_id,r.id]);
   await client.query(
    'INSERT INTO mapping_jobs(mapping_request_id,source_id,scope,rel_path) VALUES($1,$2,$3,$4)',
    [r.id,r.source_id,r.scope,r.rel_path]);
  }
  await client.query(
   'UPDATE mapping_requests SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 WHERE id=$1',
   [id,decision==='approve'?'approved':'rejected',staff.id,note]);
  await client.query(
   'INSERT INTO staff_audit_logs(actor_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',
   [staff.id,decision==='approve'?'mapping.approved':'mapping.rejected','mapping_request',id,
    JSON.stringify({source_id:r.source_id,scope:r.scope,rel_path:r.rel_path,department_id:String(r.department_id),course_id:r.course_id?String(r.course_id):null,review_note:note})]);
  await client.query('COMMIT');
  return NextResponse.json({ok:true,status:decision==='approve'?'approved':'rejected',
   indexing:decision==='approve'?'queued':'not_required'});
 }catch(e){await client.query('ROLLBACK');throw e;}
 finally{client.release();}
}
