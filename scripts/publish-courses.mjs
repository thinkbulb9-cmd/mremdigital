/** Approve (or revoke) many courses for students at once, by an explicit rule the college chooses.
 *   Dry run (default): lists what would change and writes publish-preview.csv
 *     npm run campus:publish:bulk -- --verified-only
 *     npm run campus:publish:bulk -- --department "Computer Science and Engineering" --verified-only
 *     npm run campus:publish:bulk -- --codes C:\MREM\approved-course-ids.txt
 *   Apply: add --reviewer "Name, role" --confirm      Revoke instead: add --revoke
 * Only course IDs with available files are touched; each row records the reviewer and the rule used. Database only:
 * the archive drives are never changed. Takes effect when MREM_CAMPUS_REQUIRE_APPROVAL=enabled.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import pg from 'pg';

const {values:opt}=parseArgs({options:{department:{type:'string'},'verified-only':{type:'boolean',default:false},codes:{type:'string'},
 all:{type:'boolean',default:false},reviewer:{type:'string',default:''},confirm:{type:'boolean',default:false},revoke:{type:'boolean',default:false},
 out:{type:'string',default:'C:/MREM/inventory/unified'}}});
if(!opt.department&&!opt['verified-only']&&!opt.codes&&!opt.all){
 console.error('Choose a rule: --department <name>, --verified-only, --codes <file of course IDs> or --all (combine to narrow).');process.exit(2);
}
if(opt.confirm&&(opt.reviewer.trim().length<3||opt.reviewer.length>120)){console.error('--reviewer "Name, role" is required with --confirm');process.exit(2)}
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const listed=opt.codes?new Set(fs.readFileSync(opt.codes,'utf8').match(/\b\d{9}\b/g)||[]):null;
const rule=[opt.all&&'all courses',opt.department&&'department='+opt.department,opt['verified-only']&&'verified titles only',listed&&'listed in '+path.basename(opt.codes)].filter(Boolean).join('; ');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const rows=(await db.query(`SELECT r.course_code AS code,count(*)::int AS files,c.title,c.department,c.verified,p.approved
   FROM resources r LEFT JOIN course_catalog c ON c.course_code=r.course_code LEFT JOIN campus_publications p ON p.course_code=r.course_code
   WHERE r.availability='available' AND r.course_code ~ '^[0-9]{9}$' GROUP BY r.course_code,c.title,c.department,c.verified,p.approved ORDER BY r.course_code`)).rows;
 const norm=(s)=>String(s??'').replace(/\s+/g,' ').trim().toLowerCase();
 const chosen=rows.filter(r=>(!opt.department||norm(r.department)===norm(opt.department))&&(!opt['verified-only']||(r.verified&&!/^course \d{9}$/i.test(r.title||'')))&&
  (!listed||listed.has(r.code))&&(opt.revoke?r.approved===true:r.approved!==true));
 fs.mkdirSync(opt.out,{recursive:true});
 const cell=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
 fs.writeFileSync(path.join(opt.out,'publish-preview.csv'),'\ufeffcourse_code,title,department,files,action\r\n'+
  chosen.map(r=>[r.code,r.title,r.department,r.files,opt.revoke?'revoke':'approve'].map(cell).join(',')).join('\r\n')+'\r\n');
 if(listed){const missing=[...listed].filter(c=>!rows.some(r=>r.code===c));if(missing.length)console.log('Listed IDs with no available files (skipped): '+missing.join(', '))}
 if(opt.confirm&&chosen.length){
  await db.query('BEGIN');
  try{
   await db.query(`INSERT INTO campus_publications(course_code,approved,reviewed_by,reviewed_at,notes)
     SELECT unnest($1::text[]),$2,$3,now(),$4
     ON CONFLICT(course_code) DO UPDATE SET approved=EXCLUDED.approved,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=now(),notes=EXCLUDED.notes`,
     [chosen.map(r=>r.code),!opt.revoke,opt.reviewer.trim(),'bulk '+(opt.revoke?'revoke':'approval')+': '+rule]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 const approvedNow=(await db.query('SELECT count(*)::int n FROM campus_publications WHERE approved')).rows[0].n;
 console.log(JSON.stringify({rule,[opt.confirm?(opt.revoke?'revoked':'approved'):(opt.revoke?'wouldRevoke':'wouldApprove')]:chosen.length,
  approvedCoursesInTotal:approvedNow,preview:path.join(opt.out,'publish-preview.csv')}));
 if(!opt.confirm)console.log('Dry run only. Review the preview, then add --reviewer "Name, role" --confirm.');
}finally{await db.end()}
