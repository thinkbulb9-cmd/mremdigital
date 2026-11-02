/** Import lecture titles matched to exact indexed files (report 06 of each source) into lecture_titles.
 *   node --env-file=.env.local scripts/nptel-reconciliation/import-lecture-titles.mjs --reports C:\MREM\inventory\server1\nptel-reconciliation,...
 * Add --apply to write (dry run otherwise). HIGH (the official download list names the same file) is shown to students;
 * MEDIUM (module and lecture numbers only) is stored for review and never shown. Rows whose file ID no longer exists are
 * skipped. Idempotent: re-running updates the same rows. Rollback: DELETE FROM lecture_titles WHERE source='nptel-reconciliation'.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {parseCsv} from '../legacy-catalogue/parse.mjs';

const {values:opt}=parseArgs({options:{reports:{type:'string'},apply:{type:'boolean',default:false}}});
if(!opt.reports)throw Error('--reports <comma-separated report folders containing 06_VERIFIED_LECTURE_TITLES_DISCOVERED.csv> required');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const rows=[];
for(const dir of opt.reports.split(',').map(s=>s.trim()).filter(Boolean)){
 const f=path.join(dir,'06_VERIFIED_LECTURE_TITLES_DISCOVERED.csv');
 if(!fs.existsSync(f)){console.error('No lecture-title report in '+dir);continue}
 const t=parseCsv(fs.readFileSync(f,'utf8').replace(/^\ufeff/,'')),h=t[0];
 for(const r of t.slice(1)){if(r.length<h.length)continue;const o=Object.fromEntries(h.map((k,i)=>[k,r[i]]));
  if(/^\d+$/.test(o.Indexed_File_ID)&&/^(HIGH|MEDIUM)$/.test(o.Confidence)&&o.Actual_Lecture_Title)rows.push(o)}
}
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const ids=[...new Set(rows.map(r=>r.Indexed_File_ID))];
 const known=new Map((await db.query('SELECT id::text,course_code FROM resources WHERE id=ANY($1::bigint[])',[ids])).rows.map(r=>[r.id,r.course_code]));
 // A file whose course ID changed since the report is skipped rather than given another course's title.
 const ok=rows.filter(r=>known.get(r.Indexed_File_ID)===r.Course_ID);
 const tally={read:rows.length,importable:ok.length,high:ok.filter(r=>r.Confidence==='HIGH').length,medium:ok.filter(r=>r.Confidence==='MEDIUM').length,skipped:rows.length-ok.length};
 if(opt.apply&&ok.length){
  await db.query('BEGIN');
  try{
   for(let i=0;i<ok.length;i+=2000)await db.query(`INSERT INTO lecture_titles(resource_id,course_code,title,confidence,source,evidence,source_url)
    SELECT r.id::bigint,r.code,r.title,r.conf,'nptel-reconciliation',r.evidence,r.url FROM jsonb_to_recordset($1::jsonb)
     AS r(id text,code text,title text,conf text,evidence text,url text)
    ON CONFLICT(resource_id) DO UPDATE SET course_code=EXCLUDED.course_code,title=EXCLUDED.title,confidence=EXCLUDED.confidence,
     evidence=EXCLUDED.evidence,source_url=EXCLUDED.source_url,imported_at=now() WHERE lecture_titles.source='nptel-reconciliation'`,
    [JSON.stringify(ok.slice(i,i+2000).map(r=>({id:r.Indexed_File_ID,code:r.Course_ID,title:r.Actual_Lecture_Title,conf:r.Confidence,evidence:r.Source_Evidence,url:r.Official_Source_URL})))]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 console.log(JSON.stringify({...tally,applied:Boolean(opt.apply)}));
}finally{await db.end()}
