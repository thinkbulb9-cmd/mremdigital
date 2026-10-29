import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
const scryptAsync=promisify(scrypt);
export type StaffRole='hod'|'librarian'|'super_admin';
export type StaffSession={id:string;username:string;display_name:string;role:StaffRole;department_id:string|null;department_code:string|null};
const COOKIE='mrem_staff_session';
const DAY=60*60*8;
export function staffCookieName(){return COOKIE;}
export function staffEnabled(){return Boolean(process.env.DATABASE_URL)&&!(process.env.VERCEL==='1'&&process.env.MREM_DEMO_PREVIEW==='enabled');}
export async function staffSession():Promise<StaffSession|null>{
 if(!staffEnabled())return null;
 const token=(await cookies()).get(COOKIE)?.value;
 if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
 const hash=createHash('sha256').update(token).digest('hex');
 const q=await db().query(
  "SELECT u.id::text,u.username,u.display_name,u.role,u.department_id::text,d.code AS department_code FROM staff_sessions s JOIN staff_users u ON u.id=s.staff_user_id LEFT JOIN departments d ON d.id=u.department_id WHERE s.session_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active=TRUE",
  [hash]);
 return q.rows[0]||null;
}
export function canReview(user:StaffSession){return user.role==='librarian'||user.role==='super_admin';}
export async function sourceAllowed(user:StaffSession,sourceId:string):Promise<boolean>{
 if(canReview(user))return true;
 const r=await db().query(
  "SELECT 1 FROM hod_source_grants WHERE staff_user_id=$1 AND source_id=$2",
  [user.id,sourceId]);
 return Boolean(r.rowCount);
}
export function mutationAllowed(req:NextRequest){
 const origin=req.headers.get('origin');
 const site=req.headers.get('sec-fetch-site');
 if(site==='cross-site')return false;
 if(origin){
  try{
   const url=new URL(origin);
   // Respect the externally visible Host header behind the Windows reverse proxy.
   const host=req.headers.get('x-forwarded-host')||req.headers.get('host');
   if(!host||url.host!==host)return false;
  }catch{return false;}
 }
 return true;
}
export async function verifyStaffPassword(password:string,encoded:string){
 const parts=encoded.split('$');
 if(parts.length!==3||parts[0]!=='scrypt')return false;
 const salt=Buffer.from(parts[1],'hex'),expected=Buffer.from(parts[2],'hex');
 if(salt.length!==16||expected.length!==64)return false;
 const candidate=await scryptAsync(password,salt,64) as Buffer;
 return timingSafeEqual(candidate,expected);
}
export async function createStaffSession(userId:string){
 const token=randomBytes(32).toString('hex');
 const sessionHash=createHash('sha256').update(token).digest('hex');
 await db().query(
 "INSERT INTO staff_sessions(session_hash,staff_user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
 [sessionHash,userId]);
 return token;
}
export async function revokeStaffSession(token:string|undefined){
 if(!token||!/^[0-9a-f]{64}$/.test(token))return;
 const hash=createHash('sha256').update(token).digest('hex');
 await db().query("UPDATE staff_sessions SET revoked_at=now() WHERE session_hash=$1",[hash]);
}
export const staffCookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/',maxAge:DAY};
export function validRelPath(path:string){
 return path.length>0&&path.length<=1800&&!path.includes('\\')&&!path.includes('\0')&&
  !path.startsWith('/')&&!path.endsWith('/')&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p.includes(':'));
}
