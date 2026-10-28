import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
const COOKIE='mrem_session';
const LIFETIME=60*60*8;
function secret(){
 const s=process.env.SESSION_SECRET;
 if(!s||s.length<32||s.startsWith('CHANGE_'))throw new Error('Set SESSION_SECRET to at least 32 random characters');
 return s;
}
function sign(payload:string){return createHmac('sha256',secret()).update(payload).digest('hex');}
export function secureEqual(a:string,b:string){
 const ah=createHmac('sha256','mrem-compare').update(a).digest();
 const bh=createHmac('sha256','mrem-compare').update(b).digest();
 return timingSafeEqual(ah,bh);
}
export function createSession(){const exp=String(Math.floor(Date.now()/1000)+LIFETIME);return `${exp}.${sign(exp)}`;}
export function checkSession(token:string|undefined){
 if(!token)return false;
 const parts=token.split('.');
 if(parts.length!==2||!/^\d{10,12}$/.test(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]))return false;
 if(Number(parts[0])<Date.now()/1000)return false;
 return secureEqual(parts[1],sign(parts[0]));
}
export async function authorized(){
 // Vercel team authentication protects all demo deployments; never bypass login on the local storage server.
 if(process.env.MREM_DEMO_PREVIEW==='enabled'&&process.env.VERCEL==='1')return true;
 return checkSession((await cookies()).get(COOKIE)?.value);
}
export function cookieName(){return COOKIE;}
