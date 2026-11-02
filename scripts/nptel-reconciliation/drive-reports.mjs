/** Per-drive and unified processing reports for every registered storage source.
 *   node --env-file=.env.local scripts/nptel-reconciliation/drive-reports.mjs [--inventory C:\MREM\inventory]
 * Reads PostgreSQL in a READ ONLY transaction plus each source's reconciliation output
 * (<inventory>\<source>\nptel-reconciliation\01..08). Writes:
 *   <source>\course-inventory.csv, html-index-mapping.csv, content-availability.csv, mapping-conflicts.csv, processing-summary.json
 *   unified\all-course-catalogue.csv, course-offerings.csv, verified-lesson-mappings.csv, unresolved-metadata.csv, drive-coverage-summary.json
 * Reports stay on the server: they contain archive paths and must not be committed to GitHub.
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {parseCsv} from '../legacy-catalogue/parse.mjs';

const {values:opt}=parseArgs({options:{inventory:{type:'string',default:'C:/MREM/inventory'}}});
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const csvCell=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
const write=(file,cols,rows)=>{fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,'\ufeff'+[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\r\n')+'\r\n');return rows.length};
const read=(file)=>{if(!fs.existsSync(file))return null;const t=parseCsv(fs.readFileSync(file,'utf8').replace(/^\ufeff/,''));const h=t[0];
 return {cols:h,rows:t.slice(1).filter(r=>r.length>=h.length).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))}};
const PLACEHOLDER=/^course\s+\d{9}$/i;
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
const started=Date.now(),summaries={};
try{
 await db.query('BEGIN READ ONLY');
 const sources=(await db.query('SELECT id,name,root_path,volume_serial,volume_label,availability,last_checked_at,last_successful_scan,enabled FROM storage_sources ORDER BY id')).rows;
 const catalog=new Map((await db.query('SELECT course_code,title,department,instructor,institution,title_source,verified FROM course_catalog')).rows.map(r=>[r.course_code,r]));
 const offerings=(await db.query(`SELECT r.source_id,r.course_code,COALESCE(r.semester_name,'') AS semester,
   substring(r.rel_path from '^((?:[^/]+/)*?[0-9]{9})(?:/|$)') AS course_folder,count(*)::int AS files,
   count(*) FILTER(WHERE r.kind='Video')::int AS videos,count(*) FILTER(WHERE lower(r.ext)='.pdf')::int AS pdfs,
   count(*) FILTER(WHERE r.kind='HTML')::int AS html,count(*) FILTER(WHERE r.availability='missing')::int AS missing
   FROM resources r WHERE r.course_code ~ '^[0-9]{9}$' GROUP BY 1,2,3,4 ORDER BY 2,1,3`)).rows;
 const lessons=(await db.query(`SELECT r.source_id,r.course_code,COALESCE(r.semester_name,'') AS semester,r.id::text AS resource_id,r.name,
   COALESCE(llt.title,lt.title) AS title,CASE WHEN llt.title IS NOT NULL THEN 'local catalogue (high)' ELSE 'NPTEL download list (HIGH)' END AS evidence_source,
   COALESCE(lt.evidence,llt.source_rel_path) AS evidence,COALESCE(lt.source_url,'') AS source_url
   FROM resources r LEFT JOIN legacy_lecture_titles llt ON llt.resource_id=r.id AND llt.confidence='high'
   LEFT JOIN lecture_titles lt ON lt.resource_id=r.id AND lt.confidence='HIGH'
   WHERE r.availability='available' AND (llt.title IS NOT NULL OR lt.title IS NOT NULL) ORDER BY r.course_code,r.source_id,r.rel_path`)).rows;
 const medium=(await db.query("SELECT count(*)::int n FROM lecture_titles WHERE confidence='MEDIUM'")).rows[0].n;
 const unified={generated_at:new Date().toISOString(),drives:[],read_only:'Archive files were only listed and read; nothing on the drives was changed.'};
 const verificationById=new Map();
 for(const s of sources){
  const dir=path.join(opt.inventory,s.id),rec=path.join(dir,'nptel-reconciliation');
  const stats=(await db.query(`SELECT count(*)::int AS files,count(*) FILTER(WHERE availability='available')::int AS available,
    count(*) FILTER(WHERE availability='missing')::int AS missing,count(*) FILTER(WHERE availability='available' AND course_code IS NOT NULL)::int AS course_files,
    count(*) FILTER(WHERE availability='available' AND course_code IS NOT NULL AND kind='Video')::int AS mapped_videos,
    count(*) FILTER(WHERE availability='available' AND course_code IS NOT NULL AND lower(ext)='.pdf')::int AS mapped_pdfs,
    count(*) FILTER(WHERE availability='available' AND course_code IS NULL)::int AS uncategorized,
    count(DISTINCT course_code) FILTER(WHERE availability='available')::int AS course_ids FROM resources WHERE source_id=$1`,[s.id])).rows[0];
  const folders=(await db.query('SELECT count(*)::int n FROM folders WHERE source_id=$1',[s.id])).rows[0].n;
  const scans=(await db.query('SELECT id,status,files_seen::int,folders_seen::int,error,started_at,completed_at FROM scan_jobs WHERE source_id=$1 ORDER BY started_at DESC LIMIT 2',[s.id])).rows;
  const last=scans[0],newFiles=last?(await db.query('SELECT count(*)::int n FROM resources WHERE source_id=$1 AND created_at>=$2',[s.id,last.started_at])).rows[0].n:0;
  const r01=read(path.join(rec,'01_COMPLETE_E_DRIVE_COURSE_FOLDER_STRUCTURE.csv')),r02=read(path.join(rec,'02_HTML_INDEX_COURSE_MAPPING_STATUS.csv')),
   r04=read(path.join(rec,'04_MISSING_AND_CONFLICTING_COURSE_IDS.csv')),r05=read(path.join(rec,'05_COURSE_CONTENT_AVAILABILITY.csv')),
   r08=read(path.join(rec,'08_NPTEL_OFFICIAL_WEB_VERIFICATION.csv'));
  for(const r of r08?.rows||[])if(r.Local_Semester){const v=verificationById.get(r.Course_ID)||[];v.push(s.id+': '+r.Verification_Status);verificationById.set(r.Course_ID,v)}
  const ids=new Set(offerings.filter(o=>o.source_id===s.id).map(o=>o.course_code));
  const verifiedTitles=[...ids].filter(id=>{const c=catalog.get(id);return c&&c.verified&&!PLACEHOLDER.test(c.title)}).length;
  const verifiedLessons=lessons.filter(l=>l.source_id===s.id).length;
  if(r01)write(path.join(dir,'course-inventory.csv'),[...r01.cols,'Course_Title','Title_Verified','Title_Source','Department','Professor','Institute'],
   r01.rows.map(r=>{const c=catalog.get(r.Course_ID)||{};return {...r,Course_Title:c.title&&!PLACEHOLDER.test(c.title)?c.title:'',Title_Verified:c.verified&&!PLACEHOLDER.test(c.title||'')?'YES':'NO',
    Title_Source:c.title_source||'',Department:c.department||'',Professor:c.instructor||'',Institute:c.institution||''}}));
  if(r02)write(path.join(dir,'html-index-mapping.csv'),r02.cols,r02.rows);
  if(r05)write(path.join(dir,'content-availability.csv'),r05.cols,r05.rows);
  if(r04)write(path.join(dir,'mapping-conflicts.csv'),r04.cols,r04.rows);
  const tally=(rows,k)=>rows?Object.fromEntries([...rows.reduce((m,r)=>m.set(r[k],(m.get(r[k])||0)+1),new Map())].sort((a,b)=>b[1]-a[1])):null;
  const summary={source_id:s.id,name:s.name,root_path:s.root_path,volume_serial:s.volume_serial,volume_label:s.volume_label,enabled:s.enabled,
   availability:s.availability,last_checked_at:s.last_checked_at,last_successful_scan:s.last_successful_scan,
   latest_scan:last?{status:last.status,files_seen:last.files_seen,folders_seen:last.folders_seen,started_at:last.started_at,completed_at:last.completed_at,error:last.error}:null,
   total_indexed_files:stats.files,available_files:stats.available,missing_or_unavailable_files:stats.missing,indexed_folders:folders,
   course_folder_occurrences:r01?r01.rows.length:null,unique_course_ids:stats.course_ids,files_in_course_folders:stats.course_files,
   uncategorized_files:stats.uncategorized,mapped_video_resources:stats.mapped_videos,mapped_pdfs:stats.mapped_pdfs,
   verified_course_titles:verifiedTitles,course_ids_without_verified_title:ids.size-verifiedTitles,verified_lecture_titles:verifiedLessons,
   html_catalogue_status:tally(r02?.rows,'HTML_Mapping_Status'),exceptions:tally(r04?.rows,'Exception_Type'),
   web_verification:tally(r08?.rows.filter(r=>r.Local_Semester),'Verification_Status'),
   scan_and_html_errors:{scan_error:last?.error||null,html_index_unreadable:r04?r04.rows.filter(r=>r.Exception_Type==='HTML_INDEX_UNREADABLE').length:null},
   incremental_changes:{files_first_seen_in_latest_scan:newFiles,missing_after_latest_scan:stats.missing},
   reconciliation_reports:r01?rec:'not generated yet: run nptel:reconcile for this source'};
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'processing-summary.json'),JSON.stringify(summary,null,2));
  summaries[s.id]=summary;unified.drives.push(summary);
 }
 // Unified catalogue: one row per course ID across every drive.
 const byId=new Map();for(const o of offerings){if(!byId.has(o.course_code))byId.set(o.course_code,[]);byId.get(o.course_code).push(o)}
 const all=[...byId].map(([id,os])=>{const c=catalog.get(id)||{},named=c.title&&!PLACEHOLDER.test(c.title);
  return {Course_ID:id,Course_Title:named?c.title:'',Title_Verified:named&&c.verified?'YES':'NO',Title_Source:c.title_source||'',Department:c.department||'',
   Professor:c.instructor||'',Institute:c.institution||'',Drives:[...new Set(os.map(o=>o.source_id))].join(' | '),Drive_Count:new Set(os.map(o=>o.source_id)).size,
   Offerings:[...new Set(os.map(o=>o.semester||'Web course'))].join(' | '),Files:os.reduce((a,o)=>a+o.files,0),Videos:os.reduce((a,o)=>a+o.videos,0),
   PDFs:os.reduce((a,o)=>a+o.pdfs,0),Verified_Lecture_Titles:lessons.filter(l=>l.course_code===id).length,Web_Verification:(verificationById.get(id)||[]).join(' | ')}});
 const U=path.join(opt.inventory,'unified');
 write(path.join(U,'all-course-catalogue.csv'),Object.keys(all[0]||{Course_ID:''}),all);
 write(path.join(U,'course-offerings.csv'),['course_code','source_id','semester','course_folder','files','videos','pdfs','html','missing'],offerings);
 write(path.join(U,'verified-lesson-mappings.csv'),['course_code','source_id','semester','resource_id','name','title','evidence_source','evidence','source_url'],lessons);
 const unresolved=[...all.filter(r=>!r.Course_Title).map(r=>({Course_ID:r.Course_ID,Issue:'NO_VERIFIED_TITLE',Detail:'Shown by course ID; not named by a local catalogue, the NPTEL PDF or nptel.ac.in',Drives:r.Drives})),
  ...all.filter(r=>/CONFLICT_REQUIRES_REVIEW/.test(r.Web_Verification)).map(r=>({Course_ID:r.Course_ID,Issue:'SOURCES_DISAGREE',Detail:r.Web_Verification,Drives:r.Drives})),
  ...all.filter(r=>/LOCAL_ID_REQUIRES_REVIEW/.test(r.Web_Verification)).map(r=>({Course_ID:r.Course_ID,Issue:'NOT_IN_PDF_OR_ON_NPTEL',Detail:r.Web_Verification,Drives:r.Drives}))];
 write(path.join(U,'unresolved-metadata.csv'),['Course_ID','Issue','Detail','Drives'],unresolved);
 Object.assign(unified,{unique_course_ids_all_drives:all.length,courses_on_more_than_one_drive:all.filter(r=>r.Drive_Count>1).length,
  verified_course_titles:all.filter(r=>r.Title_Verified==='YES').length,verified_lecture_titles_shown:lessons.length,medium_lecture_titles_held_for_review:medium,
  total_indexed_files:unified.drives.reduce((a,d)=>a+d.total_indexed_files,0),unresolved:unresolved.reduce((m,r)=>(m[r.Issue]=(m[r.Issue]||0)+1,m),{}),
  seconds:Math.round((Date.now()-started)/1000)});
 fs.writeFileSync(path.join(U,'drive-coverage-summary.json'),JSON.stringify(unified,null,2));
 await db.query('COMMIT');
 console.log(JSON.stringify({drives:Object.fromEntries(Object.entries(summaries).map(([k,v])=>[k,{files:v.total_indexed_files,course_ids:v.unique_course_ids,verified_titles:v.verified_course_titles,lessons:v.verified_lecture_titles}])),
  unique_course_ids:all.length,on_several_drives:unified.courses_on_more_than_one_drive}));
}finally{await db.end()}
