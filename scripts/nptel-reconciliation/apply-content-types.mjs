/** Record each course's NPTEL content type (Video or Web) in course_catalog.
 *   node --env-file=.env.local scripts/nptel-reconciliation/apply-content-types.mjs --pdf <nptel-courses-pdf.json.gz> [--apply]
 * Priority: local HTML catalogue "Type" column, then the NPTEL Courses PDF, then the official nptel.ac.in catalogue.
 * A value set by staff (content_type_source='reviewed') is never changed. Dry run by default; --apply backs up first.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {parseArgs} from 'node:util';
import pg from 'pg';

const {values:opt}=parseArgs({options:{pdf:{type:'string'},web:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation/web-cache'},apply:{type:'boolean',default:false}}});
if(!opt.pdf)throw Error('--pdf <parsed NPTEL Courses PDF .json(.gz)> required');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const kind=(s)=>/web/i.test(String(s??''))?'Web':/video/i.test(String(s??''))?'Video':null;
const raw=fs.readFileSync(opt.pdf);
const pdf=new Map(JSON.parse((opt.pdf.endsWith('.gz')?zlib.gunzipSync(raw):raw).toString('utf8')).map(r=>[String(r.code),kind(r.ctype)]));
const catFile=path.join(opt.web,'_official-catalogue.json');
const official=fs.existsSync(catFile)?JSON.parse(fs.readFileSync(catFile,'utf8')).courses:{};
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const ids=(await db.query("SELECT DISTINCT course_code FROM resources WHERE availability='available' AND course_code ~ '^[0-9]{9}$'")).rows.map(r=>r.course_code);
 const local=new Map();
 for(const r of (await db.query("SELECT course_code,course_type FROM legacy_course_records WHERE course_type<>''")).rows){
  const k=kind(r.course_type);if(!k)continue;const s=local.get(r.course_code)||new Set();s.add(k);local.set(r.course_code,s);
 }
 const current=new Map((await db.query('SELECT course_code,content_type,content_type_source FROM course_catalog')).rows.map(r=>[r.course_code,r]));
 const changes=[],tally={local:0,pdf:0,official:0,unknown:0,reviewedKept:0,localDisagrees:0};
 for(const id of ids){
  if(current.get(id)?.content_type_source==='reviewed'){tally.reviewedKept++;continue}
  const l=local.get(id);
  // Local catalogues of different semesters must agree; otherwise fall through to the PDF.
  let type=null,source='';
  if(l&&l.size===1){type=[...l][0];source='local-html-catalogue'}else if(l)tally.localDisagrees++;
  if(!type&&pdf.get(id)){type=pdf.get(id);source='nptel-courses-list-pdf'}
  if(!type&&kind(official[id]?.contentType)){type=kind(official[id].contentType);source='nptel-official-catalogue'}
  if(!type){tally.unknown++;continue}
  tally[source==='local-html-catalogue'?'local':source==='nptel-courses-list-pdf'?'pdf':'official']++;
  const c=current.get(id);
  if(!c||c.content_type!==type||c.content_type_source!==source)changes.push({code:id,type,source});
 }
 if(opt.apply&&changes.length){
  const backup='content_type_backup_'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'_course_catalog';
  await db.query('BEGIN');
  try{
   await db.query(`CREATE TABLE ${backup} AS SELECT course_code,content_type,content_type_source FROM course_catalog`);
   // Courses without a catalogue row get one with a placeholder title, which the title fills treat as unverified.
   await db.query(`INSERT INTO course_catalog(course_code,title,department,title_source,verified,content_type,content_type_source)
    SELECT c.code,'Course '||c.code,'Unclassified','unverified',FALSE,c.type,c.source FROM jsonb_to_recordset($1::jsonb) AS c(code text,type text,source text)
    ON CONFLICT(course_code) DO UPDATE SET content_type=EXCLUDED.content_type,content_type_source=EXCLUDED.content_type_source
    WHERE course_catalog.content_type_source IS DISTINCT FROM 'reviewed'`,[JSON.stringify(changes)]);
   await db.query('COMMIT');console.log('Backup table: '+backup);
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 console.log(JSON.stringify({courseIds:ids.length,[opt.apply?'updated':'wouldUpdate']:changes.length,web:changes.filter(c=>c.type==='Web').length,...tally}));
}finally{await db.end()}
