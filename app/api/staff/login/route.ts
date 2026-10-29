import { NextRequest,NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStaffSession,verifyStaffPassword,mutationAllowed,staffCookieName,staffCookieOptions,staffEnabled } from '@/lib/staff-auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!staffEnabled())return NextResponse.json({error:'Staff authentication is not configured on this server'},{status:503});
 if(!mutationAllowed(req))return NextResponse.json({error:'Forbidden'},{status:403});
 const body=await req.json().catch(()=>null);
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
 const password=typeof body?.password==='string'?body.password:'';
 if(!/^[a-z0-9._-]{3,60}$/.test(username)||password.length<1||password.length>512)
  return NextResponse.json({error:'Invalid credentials'},{status:401});
 const q=await db().query('SELECT id::text,password_hash,active,locked_until FROM staff_users WHERE username=$1',[username]);
 const user=q.rows[0];
 if(!user||!user.active||user.locked_until&&new Date(user.locked_until)>new Date())
  return NextResponse.json({error:'Invalid credentials or temporarily locked'},{status:401});
 const valid=await verifyStaffPassword(password,user.password_hash);
 if(!valid){
  await db().query("UPDATE staff_users SET failed_logins=failed_logins+1,locked_until=CASE WHEN failed_logins+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1",[user.id]);
  return NextResponse.json({error:'Invalid credentials or temporarily locked'},{status:401});
 }
 await db().query('UPDATE staff_users SET failed_logins=0,locked_until=NULL WHERE id=$1',[user.id]);
 const token=await createStaffSession(user.id);
 await db().query("INSERT INTO staff_audit_logs(actor_id,action,entity_type,entity_id) VALUES($1,'staff.login','staff_user',$2)",[user.id,user.id]);
 const response=NextResponse.json({ok:true});
 response.cookies.set(staffCookieName(),token,staffCookieOptions);
 return response;
}
