import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {campusMode} from '@/lib/campus-mode';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 if(!campusMode())return NextResponse.json({error:'Not available'},{status:404});
 const r=await db().query("SELECT status,files_seen::text,folders_seen::text,started_at,completed_at "+
  "FROM scan_jobs ORDER BY started_at DESC LIMIT 1");
 return NextResponse.json({latestScan:r.rows[0]||null});
}
