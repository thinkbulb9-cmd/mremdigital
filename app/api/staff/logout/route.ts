import { NextRequest,NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeStaffSession,staffCookieName,mutationAllowed,staffEnabled } from '@/lib/staff-auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!mutationAllowed(req))return NextResponse.json({error:'Forbidden'},{status:403});
 if(staffEnabled())await revokeStaffSession((await cookies()).get(staffCookieName())?.value);
 const response=NextResponse.json({ok:true});
 response.cookies.set(staffCookieName(),'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:0,path:'/'});
 return response;
}
