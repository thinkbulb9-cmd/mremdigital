import { NextRequest, NextResponse } from 'next/server';
import { authorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { demoCatalogue, demoEnabled } from '@/lib/demo';
import { isMacPilot, macPilotCatalogue } from '@/lib/mac-pilot';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!(await authorized()))return NextResponse.json({error:'Unauthorized'},{status:401});
 if(demoEnabled())return NextResponse.json(demoCatalogue(req.nextUrl.searchParams));
 if(isMacPilot())return NextResponse.json(await macPilotCatalogue(req.nextUrl.searchParams));
 const p=req.nextUrl.searchParams;
 const q=(p.get('q')||'').trim().slice(0,120);
 const department=(p.get('department')||'').slice(0,140);
 const course=(p.get('course')||'').slice(0,140);
 const kind=(p.get('kind')||'').slice(0,30);
 const page=Math.max(1,Math.min(100000,Number.parseInt(p.get('page')||'1',10)||1));
 const limit=30;
 const terms:string[]=["r.availability='available'","s.enabled=TRUE"];
 const args:unknown[]=[];
 function add(clause:string,value:string){args.push(value);terms.push(clause.replaceAll('?',`$${args.length}`));}
 if(q)add('r.name ILIKE ?','%'+q.replaceAll(/[\\%_]/g,m=>'\\'+m)+'%');
 if(department)add('r.department=?',department);
 if(course)add('r.course=?',course);
 if(kind)add('r.kind=?',kind);
 const where=terms.join(' AND ');
 const total=await db().query(`SELECT count(*) AS total FROM resources r JOIN storage_sources s ON s.id=r.source_id WHERE ${where}`,args);
 const result=await db().query(`SELECT r.id,r.name,r.ext,r.kind,r.department,r.course,r.size_bytes,r.modified_at,r.source_id
 FROM resources r JOIN storage_sources s ON s.id=r.source_id WHERE ${where}
 ORDER BY r.department,r.course,r.name,r.id LIMIT ${limit} OFFSET $${args.length+1}`,[...args,(page-1)*limit]);
 const departments=await db().query(`SELECT department, count(*) AS total FROM resources WHERE availability='available' GROUP BY department ORDER BY department`);
 const courses=await db().query(`SELECT DISTINCT course FROM resources WHERE department=$1 AND availability='available' ORDER BY course LIMIT 500`,[department||'']);
 return NextResponse.json({items:result.rows,total:Number(total.rows[0].total),page,limit,departments:departments.rows,courses:courses.rows.map((r:{course:string})=>r.course)});
}
