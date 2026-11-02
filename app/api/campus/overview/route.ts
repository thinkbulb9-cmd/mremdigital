import {NextResponse} from 'next/server';
import {campusMode} from '@/lib/campus-mode';
import {overview} from '@/lib/campus-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 if(!campusMode())return NextResponse.json({error:'Campus library is only available on the college server'},{status:404});
 return NextResponse.json(await overview(),{headers:{'Cache-Control':'no-store'}});
}
