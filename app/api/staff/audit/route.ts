import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { staffSession } from '@/lib/staff-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const staff=await staffSession();
 if(!staff)return NextResponse.json({error:'Staff login required'},{status:401});
 const r=await db().query(
  'SELECT a.id::text,a.created_at,a.action,a.entity_type,a.entity_id,a.details,u.username '+
  'FROM staff_audit_logs a LEFT JOIN staff_users u ON u.id=a.actor_id '+
  (staff.role==='hod'?"WHERE (a.actor_id=$1 OR a.details->>'department_id'=$2) ":'')+
  'ORDER BY a.id DESC LIMIT 150',
  staff.role==='hod'?[staff.id,staff.department_id]:[]);
 return NextResponse.json({items:r.rows});
}
