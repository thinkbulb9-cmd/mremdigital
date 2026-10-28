import { NextRequest, NextResponse } from 'next/server';
import { secureEqual, createSession, cookieName } from '@/lib/auth';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({}));
 const expected=process.env.LOGIN_PASSWORD;
 if(!expected||expected.length<16||expected.startsWith('CHANGE_'))return NextResponse.json({error:'Login not configured'}, {status:503});
 if(typeof body.password!=='string'||!secureEqual(body.password,expected))return NextResponse.json({error:'Incorrect password'}, {status:401});
 const res=NextResponse.json({ok:true});
 res.cookies.set(cookieName(),createSession(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800});
 return res;
}
