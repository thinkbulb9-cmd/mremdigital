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
 const terms:string[]=["r.availability='available'","s.enabled=TRUE","d.active=TRUE"];
 const args:unknown[]=[];
 function add(clause:string,value:string){args.push(value);terms.push(clause.replaceAll('?', '$'+args.length));}
 if(q)add("r.name ILIKE ?",'%'+q+'%');
 if(department)add('d.name=?',department);
 if(course)add("COALESCE(c.name,'General')=?",course);
 if(kind)add('r.kind=?',kind);
 const from=' FROM resources r JOIN storage_sources s ON s.id=r.source_id '+
  'JOIN resource_assignments a ON a.resource_id=r.id '+
  'JOIN departments d ON d.id=a.department_id '+
  'LEFT JOIN courses c ON c.id=a.course_id ';
 const where=' WHERE '+terms.join(' AND ');
 const total=await db().query('SELECT count(*) AS total'+from+where,args);
 const result=await db().query(
  'SELECT r.id,r.name,r.ext,r.kind,d.name AS department,COALESCE(c.name,\'General\') AS course,'+
  'r.size_bytes,r.modified_at,r.source_id'+from+where+
  ' ORDER BY d.name,c.name,r.name,r.id LIMIT '+limit+' OFFSET $'+(args.length+1),
  [...args,(page-1)*limit]);
 const departments=await db().query(
  'SELECT d.name AS department,count(*)::text AS total FROM resource_assignments a '+
  'JOIN resources r ON r.id=a.resource_id JOIN departments d ON d.id=a.department_id '+
  "WHERE r.availability='available' AND d.active=TRUE GROUP BY d.name ORDER BY d.name");
 const courses=await db().query(
  'SELECT DISTINCT COALESCE(c.name,\'General\') AS course FROM resource_assignments a '+
  'JOIN resources r ON r.id=a.resource_id JOIN departments d ON d.id=a.department_id '+
  'LEFT JOIN courses c ON c.id=a.course_id '+
  "WHERE d.name=$1 AND r.availability='available' ORDER BY course LIMIT 500",[department||'']);
 return NextResponse.json({items:result.rows,total:Number(total.rows[0].total),page,limit,departments:departments.rows,courses:courses.rows.map((r:{course:string})=>r.course)});

}
