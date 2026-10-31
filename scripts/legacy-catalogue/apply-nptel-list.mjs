/** Fill course_catalog from the "NPTEL Courses List" (parsed to JSON: code,title,discipline,institute,ctype,coordinator).
 * Dry run (default) writes a change report only:
 *   node --env-file=.env.local scripts/legacy-catalogue/apply-nptel-list.mjs --list C:\MREM\inventory\nptel-courses-list.json.gz
 * Import: add --apply (backs up course_catalog to a table first; one transaction).
 * Only course IDs that have indexed files are touched. Reviewed or officially verified rows are never changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {compareKey,text} from './parse.mjs';

const {values:opt}=parseArgs({options:{list:{type:'string'},out:{type:'string',default:'C:/MREM/inventory/html-audit'},
 source:{type:'string',default:'server1'},apply:{type:'boolean',default:false}}});
if(!opt.list)throw Error('--list <nptel-courses-list.json[.gz]> required');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
export const LIST_SOURCE='nptel-courses-list-pdf';
const PLACEHOLDER_SOURCES=new Set(['nptel-discipline-prefix-inferred','unverified']);
const raw=fs.readFileSync(opt.list);
const list=JSON.parse((opt.list.endsWith('.gz')?zlib.gunzipSync(raw):raw).toString('utf8'));
const byCode=new Map(list.filter(r=>/^\d{9}$/.test(r.code)).map(r=>[r.code,r]));

const cleanTitle=(s)=>text(s).replace(/^NOC\s*:\s*/i,'');
const cleanPeople=(s)=>text(String(s??'').replace(/<br\s*\/?>/gi,', ')).replace(/\s*,\s*/g,', ').replace(/(,\s*)+$/,'');
// PDF text extraction garbles non-Latin scripts, and a row whose institute could not be separated may carry it in the title.
const usable=(r)=>r&&cleanTitle(r.title).length>1&&!/[^\x00-\x7f]/.test(r.title)&&Boolean(text(r.institute));

const csv=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const inv=(await db.query("SELECT r.course_code AS code,count(*)::int AS files FROM resources r JOIN storage_sources s ON s.id=r.source_id "+
  "WHERE r.source_id=$1 AND r.availability='available' AND r.course_code ~ '^[0-9]{9}$' GROUP BY 1",[opt.source])).rows;
 const cur=new Map((await db.query('SELECT course_code,title,department,instructor,institution,title_source,verified FROM course_catalog')).rows.map(r=>[r.course_code,r]));
 const changes=[],skipped=[];
 for(const {code,files} of inv){
  const p=byCode.get(code),c=cur.get(code);
  if(!p){skipped.push({code,files,reason:'not-in-list'});continue}
  if(!usable(p)){skipped.push({code,files,reason:'list-row-needs-visual-check',list_title:p.title});continue}
  const title=cleanTitle(p.title),inst=text(p.institute),people=cleanPeople(p.coordinator);
  const placeholder=!c||PLACEHOLDER_SOURCES.has(c.title_source)||(!c.verified&&[ '', 'Course '+code].includes(text(c.title)));
  if(placeholder){
   changes.push({code,files,kind:c?'fill-placeholder':'insert',before_title:c?.title||'',title,
    department:c&&text(c.department)&&c.department!=='Unclassified'?c.department:text(p.discipline)||'Unclassified',
    instructor:people,institution:inst,title_source:LIST_SOURCE});
   continue;
  }
  // Rows from the college HTML catalogues: complete cut-off titles and use the list's actual institute; reviewed/official rows stay as they are.
  if(c.title_source!=='legacy-nptel-html-catalogue'){skipped.push({code,files,reason:'kept-'+c.title_source});continue}
  const a=compareKey(c.title),b=compareKey(title);
  const truncated=b.length>a.length&&b.startsWith(a);
  const newInst=inst&&compareKey(inst)!==compareKey(c.institution)?inst:'';
  if(!truncated&&!newInst){skipped.push({code,files,reason:a===b?'already-matches':'title-differs-kept-for-review',list_title:title});continue}
  changes.push({code,files,kind:[truncated&&'complete-truncated-title',newInst&&'institute-from-list'].filter(Boolean).join('+'),
   before_title:c.title,title:truncated?title:c.title,department:c.department,instructor:c.instructor||people,
   institution:newInst||c.institution,before_institution:c.institution,title_source:truncated?LIST_SOURCE:c.title_source});
 }
 fs.mkdirSync(opt.out,{recursive:true});
 const cols=['code','files','kind','before_title','title','department','instructor','before_institution','institution','title_source'];
 fs.writeFileSync(path.join(opt.out,'nptel_list_changes.csv'),'\ufeff'+[cols.join(','),...changes.map(r=>cols.map(k=>csv(r[k])).join(','))].join('\r\n')+'\r\n');
 fs.writeFileSync(path.join(opt.out,'nptel_list_skipped.csv'),'\ufeff'+['code,files,reason,list_title',...skipped.map(r=>[r.code,r.files,r.reason,r.list_title].map(csv).join(','))].join('\r\n')+'\r\n');
 const tally=(rows,k)=>rows.reduce((o,r)=>(o[r[k]]=(o[r[k]]||0)+1,o),{});
 const summary={mode:opt.apply?'apply':'dry-run',list_rows:list.length,inventory_course_ids:inv.length,changes:tally(changes,'kind'),skipped:tally(skipped,'reason')};
 if(opt.apply&&changes.length){
  const suffix=new Date().toISOString().replace(/\D/g,'').slice(0,14);
  await db.query('BEGIN');
  try{
   await db.query(`CREATE TABLE nptel_list_backup_${suffix}_course_catalog AS TABLE course_catalog`);
   // The SQL guard repeats the rule above so a row reviewed since the dry run is still left alone.
   await db.query("INSERT INTO course_catalog(course_code,title,department,instructor,institution,title_source,verified) "+
    "SELECT c.code,c.title,c.department,c.instructor,c.institution,c.title_source,TRUE FROM jsonb_to_recordset($1::jsonb) AS "+
    "c(code text,title text,department text,instructor text,institution text,title_source text) "+
    "ON CONFLICT(course_code) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,instructor=EXCLUDED.instructor,"+
    "institution=EXCLUDED.institution,title_source=EXCLUDED.title_source,verified=TRUE,updated_at=now() "+
    "WHERE course_catalog.title_source IN ('nptel-discipline-prefix-inferred','unverified','legacy-nptel-html-catalogue',$2) "+
    "OR (course_catalog.verified=FALSE AND course_catalog.title IN ('','Course '||course_catalog.course_code))",[JSON.stringify(changes),LIST_SOURCE]);
   await db.query('COMMIT');
   summary.backup_table=`nptel_list_backup_${suffix}_course_catalog`;
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 fs.writeFileSync(path.join(opt.out,'nptel_list_summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary));
}finally{await db.end()}
