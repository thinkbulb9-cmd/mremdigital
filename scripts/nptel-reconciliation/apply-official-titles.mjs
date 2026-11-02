/** Fill course titles from the official nptel.ac.in catalogue for course IDs that no local catalogue or PDF names.
 *   node --env-file=.env.local scripts/nptel-reconciliation/apply-official-titles.mjs            (dry run: report only)
 *   node --env-file=.env.local scripts/nptel-reconciliation/apply-official-titles.mjs --apply    (backup table, one transaction)
 * Same guard as the PDF fill: only placeholder rows (prefix-inferred, unverified or "Course <ID>") change; reviewed,
 * catalogue- or PDF-verified titles are never replaced. The title is the official one for that exact course ID.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {stripNoc} from './compare.mjs';

const {values:opt}=parseArgs({options:{web:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation/web-cache'},
 out:{type:'string',default:'C:/MREM/inventory/unified'},apply:{type:'boolean',default:false}}});
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
export const OFFICIAL_SOURCE='nptel-official-catalogue';
const PLACEHOLDER_SOURCES=['nptel-discipline-prefix-inferred','unverified'];
const catalogue=JSON.parse(fs.readFileSync(path.join(opt.web,'_official-catalogue.json'),'utf8'));
const clean=(s)=>String(s??'').replace(/\s+/g,' ').trim();
/** Official facts for one ID: the course page (outline) when fetched, else the catalogue listing. */
function official(id){
 const f=path.join(opt.web,id+'.json'),c=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null,o=c?.outline?.state==='ok'?c.outline:null,l=catalogue.courses[id];
 if(!o&&!l)return null;
 return {title:clean(stripNoc(o?.title||l?.title)),professor:clean(o?.professor||l?.professor),institute:clean(o?.institute||l?.institute),
  discipline:clean(l?.discipline||catalogue.disciplines?.[id.slice(0,3)]||''),url:o?c.course_url:'https://nptel.ac.in/courses/'+id};
}
const csv=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const ids=(await db.query("SELECT DISTINCT course_code FROM resources WHERE availability='available' AND course_code ~ '^[0-9]{9}$'")).rows.map(r=>r.course_code);
 const cur=new Map((await db.query('SELECT course_code,title,department,instructor,institution,title_source,verified FROM course_catalog')).rows.map(r=>[r.course_code,r]));
 const changes=[],skipped={kept:0,notOfficial:0};
 for(const id of ids){
  const c=cur.get(id),placeholder=!c||PLACEHOLDER_SOURCES.includes(c.title_source)||(!c.verified&&['','Course '+id].includes(clean(c.title)));
  if(!placeholder){skipped.kept++;continue}
  const o=official(id);
  if(!o||!o.title){skipped.notOfficial++;continue}
  changes.push({code:id,before_title:c?.title||'',title:o.title,department:c&&clean(c.department)&&!/^(unclassified|general)$/i.test(c.department)?c.department:o.discipline||'Unclassified',
   instructor:o.professor,institution:o.institute,evidence:o.url});
 }
 fs.mkdirSync(opt.out,{recursive:true});
 const cols=['code','before_title','title','department','instructor','institution','evidence'];
 fs.writeFileSync(path.join(opt.out,'official-title-fill'+(opt.apply?'':'-dry-run')+'.csv'),'\ufeff'+[cols.join(','),...changes.map(r=>cols.map(k=>csv(r[k])).join(','))].join('\r\n')+'\r\n');
 if(opt.apply&&changes.length){
  const backup='official_titles_backup_'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'_course_catalog';
  await db.query('BEGIN');
  try{
   await db.query(`CREATE TABLE ${backup} AS SELECT * FROM course_catalog`);
   await db.query(`INSERT INTO course_catalog(course_code,title,department,instructor,institution,title_source,verified)
    SELECT c.code,c.title,c.department,c.instructor,c.institution,$2,TRUE FROM jsonb_to_recordset($1::jsonb) AS c(code text,title text,department text,instructor text,institution text)
    ON CONFLICT(course_code) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,instructor=EXCLUDED.instructor,
     institution=EXCLUDED.institution,title_source=EXCLUDED.title_source,verified=TRUE,updated_at=now()
    WHERE course_catalog.title_source=ANY($3) OR (course_catalog.verified=FALSE AND course_catalog.title IN ('','Course '||course_catalog.course_code))`,
    [JSON.stringify(changes),OFFICIAL_SOURCE,PLACEHOLDER_SOURCES]);
   await db.query('COMMIT');
   console.log('Backup table: '+backup);
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 console.log(JSON.stringify({courseIds:ids.length,[opt.apply?'filled':'wouldFill']:changes.length,keptExisting:skipped.kept,notOnNptel:skipped.notOfficial}));
}finally{await db.end()}
