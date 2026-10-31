/** Legacy NPTEL HTML catalogue + indexed PostgreSQL inventory -> verified course/lecture metadata.
 * Dry run (default, writes reports only):
 *   npm run campus:legacy -- --source server1 --out C:\MREM\inventory\html-audit --pilot Jan_Apr_2021/101
 * Import (backs up course_catalog/course_lectures first, batched transactions, resumable):
 *   npm run campus:legacy -- --source server1 --out C:\MREM\inventory\html-audit --apply
 * Catalogue pages are discovered from the existing inventory and only read; the archive is never modified,
 * media bytes are never opened, and nothing here grants student publication approval.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {decodeHtmlBytes,parseCatalogueHtml,parseCatalogueCsv,viewerPrefixes,meaningfulLabel,compareKey,text} from './parse.mjs';
import {resourceRefs,candidatePaths,chooseMatch,normalizeRef,rootInfo,lectureOf,courseInPath,dirOf,handlerViewer} from './resolve.mjs';
import {planCourses,planLectures,LEGACY_SOURCE} from './consolidate.mjs';

const {values:opt}=parseArgs({options:{
 source:{type:'string',default:'server1'},out:{type:'string',default:'C:/MREM/inventory/html-audit'},
 pilot:{type:'string',multiple:true,default:[]},'accept-root':{type:'string',multiple:true,default:[]},
 apply:{type:'boolean',default:false},'max-depth':{type:'string',default:'4'},'max-kb':{type:'string',default:'4096'},
 batch:{type:'string',default:'200'},'test-courses':{type:'string',default:'101101086,101104086'}}});
if(!/^[a-z0-9_-]{2,48}$/i.test(opt.source))throw Error('Invalid source ID');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const MAX_DEPTH=Math.max(1,Number(opt['max-depth'])||4),MAX_BYTES=(Number(opt['max-kb'])||4096)*1024,BATCH=Math.max(1,Number(opt.batch)||200);
const VIDEO_EXT=new Set(['.mp4','.m4v','.webm','.mov','.avi','.mkv','.flv','.wmv']);
const DOC_EXT=['.pdf','.doc','.docx','.ppt','.pptx','.pps','.ppsx','.txt','.rtf','.xls','.xlsx'];
const out=path.resolve(opt.out),started=Date.now();
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const csv=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
async function writeCsv(name,cols,rows){
 await fs.writeFile(path.join(out,name),[cols.join(','),...rows.map(r=>cols.map(c=>csv(r[c])).join(','))].join('\n')+'\n','utf8');
}
const likePrefix=(p)=>p.replace(/^\/+|\/+$/g,'').replace(/[\\%_]/g,'\\$&');
async function readArchiveFile(rootReal,rel){
 const pieces=rel.split('/');
 if(rel.includes('\\')||rel.includes('\0')||pieces.some(p=>!p||p==='.'||p==='..'||p.includes(':')))return {error:'invalid-path'};
 let real;try{real=await fs.realpath(path.resolve(rootReal,...pieces))}catch(e){return {error:'unreadable: '+e.code}}
 const within=path.relative(rootReal,real);
 if(!within||within==='..'||within.startsWith('..'+path.sep)||path.isAbsolute(within))return {error:'outside-archive-root'};
 const st=await fs.stat(real);
 if(!st.isFile())return {error:'not-a-file'};
 if(st.size>MAX_BYTES)return {error:'skipped-too-large'};
 const fh=await fs.open(real,'r');
 try{return {buf:await fh.readFile()}}finally{await fh.close()}
}
const levelOf=(rel)=>{const d=rel.split('/').length;return courseInPath(dirOf(rel))?'course':['archive','semester','discipline'][d-1]||'nested'};

await fs.mkdir(out,{recursive:true});
await db.connect();
try{
 const src=(await db.query('SELECT id,root_path FROM storage_sources WHERE id=$1 AND enabled=TRUE',[opt.source])).rows[0];
 if(!src)throw Error('No enabled storage source '+opt.source);
 const rootReal=await fs.realpath(src.root_path);
 const pilots=opt.pilot.map(likePrefix).filter(Boolean);
 const scope=pilots.length?pilots.flatMap(p=>[p,p+'/%']):null;

 // 1. Discover catalogue documents from the existing inventory (no drive rescan).
 const discovered=(await db.query(
  "SELECT rel_path,name,ext,size_bytes::text,modified_at FROM resources WHERE source_id=$1 AND availability='available' AND ("+
  "(ext IN ('.html','.htm') AND (cardinality(string_to_array(rel_path,'/'))<=$2 OR name ~* '^(index|list|catalog|course|subject)')) OR "+
  "(ext IN ('.csv','.xls','.xlsx','.xml','.json') AND name ~* '(list|catalog|course|subject|index)')) "+
  "AND ($3::text[] IS NULL OR rel_path LIKE ANY($3::text[])) ORDER BY cardinality(string_to_array(rel_path,'/')),rel_path",
  [src.id,MAX_DEPTH,scope])).rows;
 const roots=(await db.query("SELECT DISTINCT split_part(rel_path,'/',1) AS root FROM folders WHERE source_id=$1 AND rel_path<>'' AND parent_rel_path=''",[src.id])).rows
  .map(r=>({root:r.root,...rootInfo(r.root,opt['accept-root'])}));
 console.log('Catalogue candidates from inventory: '+discovered.length);

 // 2. Read and parse each document; collect course rows and resource links.
 const sources=[],records=[],links=[],seen=new Set();
 for(const d of discovered){
  const semester_root=d.rel_path.includes('/')?d.rel_path.split('/')[0]:'',ri=rootInfo(semester_root,opt['accept-root']);
  const row={rel_path:d.rel_path,semester_root,root_recognized:ri.recognized,level:levelOf(d.rel_path),size_bytes:d.size_bytes,
   modified_at:d.modified_at,layout:'',status:'',course_rows:0,content_links:0,note:''};
  sources.push(row);
  if(['.xls','.xlsx','.xml','.json'].includes(d.ext)){row.layout='not-parsed-format';row.status='needs-review';continue}
  const file=await readArchiveFile(rootReal,d.rel_path);
  if(file.error){row.status=file.error;continue}
  let parsed;
  try{parsed=d.ext==='.csv'?parseCatalogueCsv(decodeHtmlBytes(file.buf)):parseCatalogueHtml(decodeHtmlBytes(file.buf))}
  catch(e){row.status='parse-error';row.note=String(e).slice(0,200);continue}
  const pageCourse=courseInPath(dirOf(d.rel_path)),before=links.length;
  const addLink=(l,course_code,course_title)=>{
   for(const r of resourceRefs(l.value)){
    const ref=r.external||r.ref,key=d.rel_path+'\n'+ref;
    if(seen.has(key))continue;seen.add(key);
    const viewer=r.viewer||l.viewer||handlerViewer(l.handler);
    links.push({source_rel_path:d.rel_path,semester_root,root_recognized:ri.recognized,order:ri.order,
     course_code:course_code||null,course_title:course_title||'',ref,external:Boolean(r.external),viewer,label:l.label,via:l.via});
   }
  };
  for(const c of parsed.courses){
   records.push({...c,links:undefined,semester_root,discipline_folder:dirOf(d.rel_path),source_rel_path:d.rel_path,order:ri.order,
    root_recognized:ri.recognized});
   for(const l of c.links)addLink(l,c.course_code,c.title);
  }
  for(const l of parsed.pageLinks)addLink(l,pageCourse,'');
  row.course_rows=parsed.courses.length;row.content_links=links.length-before;
  row.layout=parsed.courses.length?'subject-table':pageCourse&&row.content_links?'course-page':row.content_links?'link-list':
   parsed.pageLinks.some(l=>l.via==='href'&&/\.html?(?:[?#]|$)/i.test(l.value))?'navigation':'no-catalogue';
  row.status=ri.recognized?'parsed':'parsed-unrecognized-root-needs-review';
  if(parsed.skippedRows)row.note=parsed.skippedRows+' table rows without a nine-digit subject id';
 }

 // 3. Viewer pages (displayvideo.html etc.) may prepend a folder to their query value.
 const viewers=new Map();
 for(const l of links)if(l.viewer){const v=normalizeRef(l.viewer,dirOf(l.source_rel_path),src.root_path);if(v.rel)viewers.set(v.rel,[])}
 for(const rel of viewers.keys()){
  if(!/\.html?$/i.test(rel))continue;
  const f=await readArchiveFile(rootReal,rel);
  if(f.buf)viewers.set(rel,viewerPrefixes(decodeHtmlBytes(f.buf)));
 }
 for(const s of sources)if(viewers.has(s.rel_path)&&s.layout==='no-catalogue')s.layout='viewer';

 // 4. Match every link to the indexed inventory.
 const exactByPath=new Map(),courseFiles=new Map();
 const local=links.filter(l=>!l.external).map(l=>({...l,...candidatePaths({ref:l.ref,viewer:l.viewer},l.source_rel_path,src.root_path,viewers)}));
 const allPaths=[...new Set(local.flatMap(l=>l.paths))];
 for(let i=0;i<allPaths.length;i+=2000){
  const q=await db.query("SELECT id::text,rel_path,course_code,module_no,lecture_no,kind,ext FROM resources "+
   "WHERE source_id=$1 AND availability='available' AND rel_path=ANY($2::text[])",[src.id,allPaths.slice(i,i+2000)]);
  for(const r of q.rows)exactByPath.set(r.rel_path,r);
 }
 const matches=[];
 for(const l of local){
  const code=l.course_code||courseInPath(l.paths[0]||'');
  if(!l.paths.length){matches.push({...l,course_code:code,status:'rejected-unsafe-path',reason:l.errors.join(',')});continue}
  const exactHits=l.paths.map(p=>exactByPath.get(p)).filter(Boolean);
  let files=[];
  if(!exactHits.length&&code){
   const k=l.semester_root+'|'+code;
   if(!courseFiles.has(k))courseFiles.set(k,(await db.query("SELECT id::text,rel_path,course_code,module_no,lecture_no,kind,ext FROM resources "+
    "WHERE source_id=$1 AND availability='available' AND course_code=$2 AND rel_path LIKE $3",[src.id,code,likePrefix(l.semester_root)+'/%'])).rows);
   files=courseFiles.get(k);
  }
  const m=chooseMatch({ref:l.ref,courseCode:code,semesterRoot:l.semester_root,exactHits,courseFiles:files});
  const r=m.resource,fromRef=lectureOf(path.posix.basename(l.ref));
  const module_no=r?.module_no??fromRef.module_no,lecture_no=r?.lecture_no??fromRef.lecture_no;
  const note=r&&fromRef.module_no!==null&&(r.module_no!==fromRef.module_no||r.lecture_no!==fromRef.lecture_no)?'link and file lecture numbers differ':'';
  matches.push({...l,course_code:code,status:m.status,reason:m.reason||'',method:m.method||'',confidence:m.confidence||'',
   resource_id:m.status==='matched'?r.id:'',resolved_rel_path:r?.rel_path||(m.candidates||[]).map(c=>c.rel_path).join(' | '),
   kind:r?.kind||'',module_no,lecture_no,note});
 }
 for(const l of links.filter(l=>l.external))matches.push({...l,status:'external-online-url',reason:'not on archive'});
 // Labels repeated for different files of one course on one page ("Download", the course title) are not lecture titles.
 const labelUse=new Map();
 for(const m of matches)if(m.status==='matched'&&m.label){
  const k=m.source_rel_path+'|'+m.course_code+'|'+compareKey(m.label);labelUse.set(k,(labelUse.get(k)||new Set()).add(m.resource_id));
 }
 for(const m of matches){
  const k=m.source_rel_path+'|'+m.course_code+'|'+compareKey(m.label);
  m.title=m.status==='matched'&&m.root_recognized&&meaningfulLabel(m.label,path.posix.basename(m.ref))&&labelUse.get(k).size===1&&
   compareKey(m.label)!==compareKey(m.course_title)?text(m.label):'';
 }

 // 5. Validate catalogue rows against inventory file counts, then plan catalogue changes.
 const counts=new Map(),inventoryCodes=new Map();
 for(const r of (await db.query("SELECT course_code,split_part(rel_path,'/',1) AS root,count(*)::int AS files,count(*) FILTER(WHERE kind='Video')::int AS videos "+
  "FROM resources WHERE source_id=$1 AND availability='available' AND course_code ~ '^[0-9]{9}$' AND ($2::text[] IS NULL OR rel_path LIKE ANY($2::text[])) GROUP BY 1,2",
  [src.id,scope])).rows){counts.set(r.course_code+'|'+r.root,r);inventoryCodes.set(r.course_code,(inventoryCodes.get(r.course_code)||0)+r.files)}
 for(const r of records){r.inventory_files=counts.get(r.course_code+'|'+r.semester_root)?.files||0;
  r.confidence=!r.root_recognized?'review':r.inventory_files?'high':'no-indexed-files'}
 const usable=records.filter(r=>r.root_recognized),codes=[...new Set(records.map(r=>r.course_code))];
 const existing=new Map((await db.query('SELECT course_code,title,department,instructor,institution,title_source,verified FROM course_catalog WHERE course_code=ANY($1)',[codes])).rows.map(r=>[r.course_code,r]));
 const existingLectures=new Map((await db.query('SELECT course_code,module_no,lecture_no,title,title_source FROM course_lectures WHERE course_code=ANY($1)',[codes])).rows
  .map(r=>[r.course_code+'|'+r.module_no+'|'+r.lecture_no,r]));
 const coursePlan=planCourses(usable,existing);
 const planConfidence=new Map(coursePlan.courses.map(c=>[c.course_code,c.confidence]));
 for(const r of records)if(r.confidence==='high'&&planConfidence.get(r.course_code)==='medium')r.confidence='medium';
 const matched=matches.filter(m=>m.status==='matched');
 const lecturePlan=planLectures(matched,existingLectures);
 const linkConflicts=matches.filter(m=>['conflict','rejected-unsafe-path'].includes(m.status)).map(m=>({conflict_type:'link-'+m.status,
  course_code:m.course_code||'',semester_root:m.semester_root,field:'resource-link',existing_value:String(m.resolved_rel_path||'').slice(0,500),
  extracted_value:String(m.ref).slice(0,500),source_rel_path:m.source_rel_path,resolution:m.reason||'not-linked'}));
 const conflicts=[...coursePlan.conflicts,...lecturePlan.conflicts,...linkConflicts];

 // 6. Reports.
 const catalogued=new Set(records.map(r=>r.course_code)),mappedActions=new Set(['insert','update','confirm-existing','preserve-existing-conflict']);
 const unresolved=[
  ...records.filter(r=>!r.root_recognized).map(r=>({course_code:r.course_code,semester_root:r.semester_root,reason:'unrecognized-semester-root-needs-review',
   inventory_files_in_semester:r.inventory_files,inventory_files_all_semesters:inventoryCodes.get(r.course_code)||0,source_rel_path:r.source_rel_path})),
  ...records.filter(r=>r.root_recognized&&!r.inventory_files).map(r=>({course_code:r.course_code,semester_root:r.semester_root,
   reason:inventoryCodes.get(r.course_code)?'catalogued-here-but-files-indexed-only-in-other-semesters':'catalogued-but-no-indexed-files',
   inventory_files_in_semester:0,inventory_files_all_semesters:inventoryCodes.get(r.course_code)||0,source_rel_path:r.source_rel_path})),
  ...[...counts.values()].filter(c=>!catalogued.has(c.course_code)).map(c=>({course_code:c.course_code,semester_root:c.root,
   reason:'indexed-files-but-no-catalogue-record',inventory_files_in_semester:c.files,inventory_files_all_semesters:inventoryCodes.get(c.course_code),source_rel_path:''}))];
 const joinList=(a)=>(a||[]).join(' | ');
 const plannedCourses=coursePlan.courses.map(c=>({...c,semesters:joinList(c.semesters),sources:joinList(c.sources)}));
 await writeCsv('html_index_inventory.csv',['rel_path','semester_root','root_recognized','level','layout','status','course_rows','content_links','size_bytes','note'],sources);
 await writeCsv('master_course_catalogue.csv',['course_code','title','department','instructor','institution','semesters','inventory_files',
  'action','confidence','note','sources'],plannedCourses);
 // Every catalogue row as found, one per course per semester page, so semester differences stay visible.
 await writeCsv('course_offerings_by_semester.csv',['course_code','title','discipline','coordinators','course_type','institution','semester_root',
  'discipline_folder','inventory_files','confidence','source_rel_path'],records);
 await writeCsv('department_course_mapping.csv',['department','course_code','title','semesters','action','confidence','sources'],
  [...plannedCourses].sort((a,b)=>a.department.localeCompare(b.department)||a.title.localeCompare(b.title)));
 await writeCsv('course_lecture_titles.csv',['course_code','semester_root','module_no','lecture_no','title','resource_id','confidence',
  'resolved_rel_path','source_rel_path'],lecturePlan.fileTitles);
 const linkCols=['course_code','semester_root','status','method','confidence','resource_id','module_no','lecture_no',
  'kind','ref','viewer','resolved_rel_path','label','title','via','reason','note','source_rel_path'];
 const isVideoLink=(m)=>m.kind?m.kind==='Video':VIDEO_EXT.has(path.posix.extname(String(m.ref).split(/[?#]/)[0]).toLowerCase());
 await writeCsv('video_resource_mapping.csv',linkCols,matches.filter(isVideoLink));
 await writeCsv('pdf_document_mapping.csv',linkCols,matches.filter(m=>!isVideoLink(m)));
 await writeCsv('missing_conflicting_metadata.csv',['category','type','course_code','semester_root','field','existing_value','extracted_value',
  'resolution','inventory_files_in_semester','inventory_files_all_semesters','source_rel_path'],[
  ...conflicts.map(c=>({category:'conflict',type:c.conflict_type,...c})),
  ...unresolved.map(u=>({category:'missing',type:u.reason,resolution:'needs-review',...u}))]);
 const tally=(rows,key)=>rows.reduce((o,r)=>(o[r[key]||'none']=(o[r[key]||'none']||0)+1,o),{});
 const mappedCourses=coursePlan.courses.filter(c=>mappedActions.has(c.action));
 // Inventory-wide media totals; "mapped" means the file's course ID now has a catalogue title from this extraction.
 const media=(await db.query("SELECT count(*) FILTER(WHERE kind='Video')::int AS videos,"+
  "count(*) FILTER(WHERE kind='Video' AND course_code=ANY($3))::int AS videos_mapped,"+
  "count(*) FILTER(WHERE ext=ANY($4))::int AS documents,count(*) FILTER(WHERE ext=ANY($4) AND course_code=ANY($3))::int AS documents_mapped "+
  "FROM resources WHERE source_id=$1 AND availability='available' AND ($2::text[] IS NULL OR rel_path LIKE ANY($2::text[]))",
  [src.id,scope,mappedCourses.map(c=>c.course_code),DOC_EXT])).rows[0];
 const tests={};
 for(const code of opt['test-courses'].split(',').map(s=>s.trim()).filter(c=>/^\d{9}$/.test(c))){
  const mods=(await db.query("SELECT module_no,count(*)::int AS files FROM resources WHERE source_id=$1 AND availability='available' AND course_code=$2 GROUP BY 1 ORDER BY 1 NULLS LAST",[src.id,code])).rows;
  const c=coursePlan.courses.find(x=>x.course_code===code),ms=matches.filter(m=>m.course_code===code);
  tests[code]={catalogue_plan:c?{title:c.title,department:c.department,coordinators:c.instructor,institution:c.institution,semesters:c.semesters,
   action:c.action,confidence:c.confidence,sources:c.sources}:null,existing_catalogue:existing.get(code)||null,
   links:tally(ms,'status'),lecture_titles:lecturePlan.fileTitles.filter(t=>t.course_code===code).length,
   indexed_files_by_module:mods,conflicts:conflicts.filter(x=>x.course_code===code).map(x=>x.conflict_type+':'+x.field)};
 }
 const runKey=createHash('sha256').update(JSON.stringify([src.id,pilots,sources,records,matched.map(m=>[m.source_rel_path,m.ref,m.resource_id,m.title]),
  // Actions are left out: they change from insert to confirm-existing once this same run has been applied.
  coursePlan.courses.map(c=>[c.course_code,c.title,c.department,c.instructor,c.institution]),lecturePlan.lectures])).digest('hex').slice(0,24);
 const summary={mode:opt.apply?'apply':'dry-run',run_key:runKey,source_id:src.id,pilot_scope:pilots,generated_at:new Date().toISOString(),
  archive_roots:{recognized:roots.filter(r=>r.recognized).map(r=>r.root),unrecognized_for_review:roots.filter(r=>!r.recognized).map(r=>r.root)},
  catalogue_sources:{discovered:sources.length,by_layout:tally(sources,'layout'),by_status:tally(sources,'status'),by_level:tally(sources,'level')},
  extracted:{course_rows:records.length,distinct_course_ids:catalogued.size,rows_by_semester:tally(records,'semester_root'),rows_by_confidence:tally(records,'confidence')},
  inventory:{distinct_course_ids:inventoryCodes.size,files_with_course_id:[...inventoryCodes.values()].reduce((a,b)=>a+b,0)},
  courses:{mapped_to_inventory:mappedCourses.length,high_confidence:mappedCourses.filter(c=>c.confidence==='high').length,
   inventory_files_in_mapped_courses:mappedCourses.reduce((n,c)=>n+c.inventory_files,0),actions:tally(coursePlan.courses,'action'),
   inventory_course_ids_without_catalogue:[...inventoryCodes.keys()].filter(c=>!catalogued.has(c)).length},
  links:{total:matches.length,by_status:tally(matches,'status'),matched_by_method:tally(matched,'method'),matched_by_kind:tally(matched,'kind'),
   distinct_matched_files:new Set(matched.map(m=>m.resource_id)).size},
  lecture_titles:{files_with_catalogue_title:lecturePlan.fileTitles.length,course_lecture_rows:lecturePlan.lectures.length},
  conflicts:{total:conflicts.length,by_type:tally(conflicts,'conflict_type')},unresolved:{total:unresolved.length,by_reason:tally(unresolved,'reason')},
  coverage:{html_index_files_discovered:sources.length,html_files_parsed:sources.filter(s=>s.status.startsWith('parsed')).length,
   html_files_with_course_tables:sources.filter(s=>s.course_rows>0).length,unique_course_ids_in_catalogues:catalogued.size,
   course_titles_extracted:new Set(records.filter(r=>r.title).map(r=>r.course_code)).size,
   courses_mapped_to_indexed_files:mappedCourses.length,courses_with_faculty:mappedCourses.filter(c=>c.instructor).length,
   departments_identified:new Set(mappedCourses.map(c=>c.department).filter(d=>d&&d!=='Unclassified')).size,
   total_video_files:media.videos,videos_in_mapped_courses:media.videos_mapped,
   videos_linked_by_catalogue:new Set(matched.filter(isVideoLink).map(m=>m.resource_id)).size,
   lectures_with_genuine_titles:lecturePlan.fileTitles.length,total_document_files:media.documents,
   documents_in_mapped_courses:media.documents_mapped,unresolved_records:unresolved.length,conflicting_records:conflicts.length},
  test_courses:tests,elapsed_seconds:Math.round((Date.now()-started)/1000),
  notes:['Catalogue titles are metadata only; student visibility still requires campus_publications approval when MREM_CAMPUS_REQUIRE_APPROVAL=enabled.',
   'Archive files were read only. No media bytes were opened or exported.']};

 // 7. Import (only with --apply): backup, then course-code batches with a checkpoint per batch.
 if(opt.apply){
  const prior=(await db.query('SELECT status,batches_done,backup_suffix FROM legacy_import_runs WHERE run_key=$1',[runKey])).rows[0];
  const byCode=new Map();
  const slot=(code)=>{if(!byCode.has(code))byCode.set(code,{records:[],links:[],titles:[],plan:null,lectures:[],conflicts:[]});return byCode.get(code)};
  for(const r of records)slot(r.course_code).records.push(r);
  for(const m of matched)slot(m.course_code).links.push(m);
  for(const t of lecturePlan.fileTitles)slot(t.course_code).titles.push(t);
  for(const l of lecturePlan.lectures)slot(l.course_code).lectures.push(l);
  for(const c of conflicts)slot(c.course_code||'').conflicts.push(c);
  for(const c of coursePlan.courses)slot(c.course_code).plan=c;
  const batches=[];const keys=[...byCode.keys()].sort();
  for(let i=0;i<keys.length;i+=BATCH)batches.push(keys.slice(i,i+BATCH));
  if(prior?.status==='completed'){summary.apply={status:'already-applied',run_key:runKey}}
  else{
   let suffix=prior?.backup_suffix;
   if(!suffix){
    suffix=new Date().toISOString().replace(/\D/g,'').slice(0,14);
    await db.query('BEGIN');
    try{
     await db.query(`CREATE TABLE legacy_backup_${suffix}_course_catalog AS TABLE course_catalog`);
     await db.query(`CREATE TABLE legacy_backup_${suffix}_course_lectures AS TABLE course_lectures`);
     await db.query("INSERT INTO legacy_import_runs(run_key,source_id,status,batches_total,backup_suffix,summary) VALUES($1,$2,'running',$3,$4,$5)",
      [runKey,src.id,batches.length,suffix,JSON.stringify({pilot_scope:pilots})]);
     await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e}
    await fs.mkdir(path.join(out,'backups'),{recursive:true});
    for(const t of ['course_catalog','course_lectures']){
     const rows=(await db.query(`SELECT * FROM legacy_backup_${suffix}_${t}`)).rows;
     await writeCsv(path.join('backups',t+'-'+suffix+'.csv'),rows.length?Object.keys(rows[0]):['empty'],rows);
    }
   }else await db.query("UPDATE legacy_import_runs SET status='running',error=NULL WHERE run_key=$1",[runKey]);
   const done=prior?.batches_done||0;
   const J=(rows)=>JSON.stringify(rows);
   await db.query("INSERT INTO legacy_catalogue_sources(source_id,rel_path,semester_root,root_recognized,level,layout,status,course_rows,content_links,size_bytes,modified_at,run_key) "+
    "SELECT $1,s.rel_path,s.semester_root,s.root_recognized,s.level,s.layout,s.status,s.course_rows,s.content_links,s.size_bytes,s.modified_at,$2 "+
    "FROM jsonb_to_recordset($3::jsonb) AS s(rel_path text,semester_root text,root_recognized boolean,level text,layout text,status text,course_rows int,content_links int,size_bytes bigint,modified_at timestamptz) "+
    "ON CONFLICT(source_id,rel_path) DO UPDATE SET semester_root=EXCLUDED.semester_root,root_recognized=EXCLUDED.root_recognized,level=EXCLUDED.level,"+
    "layout=EXCLUDED.layout,status=EXCLUDED.status,course_rows=EXCLUDED.course_rows,content_links=EXCLUDED.content_links,size_bytes=EXCLUDED.size_bytes,"+
    "modified_at=EXCLUDED.modified_at,run_key=EXCLUDED.run_key,updated_at=now()",[src.id,runKey,J(sources)]);
   for(let b=done;b<batches.length;b++){
    const part=batches[b].map(k=>byCode.get(k));
    const recs=part.flatMap(p=>p.records),lnk=part.flatMap(p=>p.links),ttl=part.flatMap(p=>p.titles);
    const lec=part.flatMap(p=>p.lectures),cfl=part.flatMap(p=>p.conflicts),plans=part.map(p=>p.plan).filter(Boolean);
    await db.query('BEGIN');
    try{
     if(recs.length)await db.query("INSERT INTO legacy_course_records(source_id,semester_root,course_code,source_rel_path,discipline_folder,title,discipline,coordinators,course_type,institution,inventory_files,confidence,run_key) "+
      "SELECT $1,r.semester_root,r.course_code,r.source_rel_path,r.discipline_folder,r.title,r.discipline,r.coordinators,r.course_type,r.institution,r.inventory_files,r.confidence,$2 "+
      "FROM jsonb_to_recordset($3::jsonb) AS r(semester_root text,course_code text,source_rel_path text,discipline_folder text,title text,discipline text,coordinators text,course_type text,institution text,inventory_files int,confidence text) "+
      "ON CONFLICT(source_id,semester_root,course_code,source_rel_path) DO UPDATE SET discipline_folder=EXCLUDED.discipline_folder,title=EXCLUDED.title,"+
      "discipline=EXCLUDED.discipline,coordinators=EXCLUDED.coordinators,course_type=EXCLUDED.course_type,institution=EXCLUDED.institution,"+
      "inventory_files=EXCLUDED.inventory_files,confidence=EXCLUDED.confidence,run_key=EXCLUDED.run_key,updated_at=now()",[src.id,runKey,J(recs)]);
     if(lnk.length)await db.query("INSERT INTO legacy_resource_links(source_id,source_rel_path,link_ref,resource_id,course_code,semester_root,module_no,lecture_no,label,match_method,confidence,run_key) "+
      "SELECT $1,l.source_rel_path,l.ref,l.resource_id,l.course_code,l.semester_root,l.module_no,l.lecture_no,l.label,l.method,l.confidence,$2 "+
      "FROM jsonb_to_recordset($3::jsonb) AS l(source_rel_path text,ref text,resource_id bigint,course_code text,semester_root text,module_no int,lecture_no int,label text,method text,confidence text) "+
      "ON CONFLICT(source_id,source_rel_path,link_ref) DO UPDATE SET resource_id=EXCLUDED.resource_id,course_code=EXCLUDED.course_code,semester_root=EXCLUDED.semester_root,"+
      "module_no=EXCLUDED.module_no,lecture_no=EXCLUDED.lecture_no,label=EXCLUDED.label,match_method=EXCLUDED.match_method,confidence=EXCLUDED.confidence,run_key=EXCLUDED.run_key",
      [src.id,runKey,J(lnk.map(l=>({...l,label:String(l.label||'').slice(0,300)})))]);
     if(ttl.length)await db.query("INSERT INTO legacy_lecture_titles(resource_id,course_code,semester_root,module_no,lecture_no,title,source_rel_path,confidence,run_key) "+
      "SELECT t.resource_id,t.course_code,t.semester_root,t.module_no,t.lecture_no,t.title,t.source_rel_path,t.confidence,$1 "+
      "FROM jsonb_to_recordset($2::jsonb) AS t(resource_id bigint,course_code text,semester_root text,module_no int,lecture_no int,title text,source_rel_path text,confidence text) "+
      "ON CONFLICT(resource_id) DO UPDATE SET course_code=EXCLUDED.course_code,semester_root=EXCLUDED.semester_root,module_no=EXCLUDED.module_no,"+
      "lecture_no=EXCLUDED.lecture_no,title=EXCLUDED.title,source_rel_path=EXCLUDED.source_rel_path,confidence=EXCLUDED.confidence,run_key=EXCLUDED.run_key,updated_at=now()",[runKey,J(ttl)]);
     const writes=plans.filter(c=>c.action==='insert'||c.action==='update').map(c=>({...c,verified:c.confidence==='high'}));
     // The guard is re-checked in SQL so metadata verified after the dry run is still never overwritten.
     if(writes.length)await db.query("INSERT INTO course_catalog(course_code,title,department,instructor,institution,title_source,verified) "+
      "SELECT c.course_code,c.title,c.department,c.instructor,c.institution,$1,c.verified FROM jsonb_to_recordset($2::jsonb) AS c(course_code text,title text,department text,instructor text,institution text,verified boolean) "+
      "ON CONFLICT(course_code) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,instructor=EXCLUDED.instructor,institution=EXCLUDED.institution,"+
      "title_source=EXCLUDED.title_source,verified=EXCLUDED.verified,updated_at=now() WHERE course_catalog.title_source IN ('unverified','nptel-discipline-prefix-inferred',$1) "+
      "OR (course_catalog.verified=FALSE AND course_catalog.title IN ('','Course '||course_catalog.course_code))",
      [LEGACY_SOURCE,J(writes.map(c=>({course_code:c.course_code,title:c.title.slice(0,250),department:c.department.slice(0,120),
       instructor:c.instructor.slice(0,160),institution:c.institution.slice(0,160),verified:c.verified})))]);
     for(const c of plans)if(c.fill&&(c.fill.instructor||c.fill.institution))
      await db.query("UPDATE course_catalog SET instructor=COALESCE(NULLIF(instructor,''),$2),institution=COALESCE(NULLIF(institution,''),$3),updated_at=now() WHERE course_code=$1",
       [c.course_code,c.fill.instructor?.slice(0,160)||null,c.fill.institution?.slice(0,160)||null]);
     if(lec.length)await db.query("INSERT INTO course_lectures(course_code,module_no,lecture_no,title,title_source,verified) "+
      "SELECT l.course_code,l.module_no,l.lecture_no,l.title,$1,l.verified FROM jsonb_to_recordset($2::jsonb) AS l(course_code text,module_no int,lecture_no int,title text,verified boolean) "+
      "ON CONFLICT(course_code,module_no,lecture_no) DO UPDATE SET title=EXCLUDED.title,verified=EXCLUDED.verified WHERE course_lectures.title_source=$1",[LEGACY_SOURCE,J(lec)]);
     if(cfl.length)await db.query("INSERT INTO legacy_mapping_conflicts(conflict_type,course_code,semester_root,field,existing_value,extracted_value,source_rel_path,resolution,run_key) "+
      "SELECT c.conflict_type,c.course_code,c.semester_root,c.field,c.existing_value,c.extracted_value,c.source_rel_path,c.resolution,$1 "+
      "FROM jsonb_to_recordset($2::jsonb) AS c(conflict_type text,course_code text,semester_root text,field text,existing_value text,extracted_value text,source_rel_path text,resolution text) "+
      "ON CONFLICT(conflict_type,course_code,semester_root,field,source_rel_path,extracted_value) DO UPDATE SET existing_value=EXCLUDED.existing_value,resolution=EXCLUDED.resolution,run_key=EXCLUDED.run_key",[runKey,J(cfl)]);
     await db.query('UPDATE legacy_import_runs SET batches_done=$2 WHERE run_key=$1',[runKey,b+1]);
     await db.query('COMMIT');
    }catch(e){
     await db.query('ROLLBACK');
     await db.query("UPDATE legacy_import_runs SET status='failed',error=$2 WHERE run_key=$1",[runKey,String(e).slice(0,900)]);
     throw e;
    }
    console.log('Imported batch '+(b+1)+'/'+batches.length);
   }
   // Links/titles from catalogue pages processed in this run but no longer produced are removed (stale only).
   await db.query('BEGIN');
   try{
    const processed=sources.map(s=>s.rel_path);
    await db.query('DELETE FROM legacy_resource_links WHERE source_id=$1 AND source_rel_path=ANY($2) AND run_key<>$3',[src.id,processed,runKey]);
    await db.query('DELETE FROM legacy_lecture_titles WHERE source_rel_path=ANY($1) AND run_key<>$2',[processed,runKey]);
    await db.query("UPDATE legacy_import_runs SET status='completed',completed_at=now(),summary=$2 WHERE run_key=$1",[runKey,JSON.stringify(summary)]);
    await db.query('COMMIT');
   }catch(e){await db.query('ROLLBACK');throw e}
   summary.apply={status:'completed',run_key:runKey,backup_tables:['legacy_backup_'+suffix+'_course_catalog','legacy_backup_'+suffix+'_course_lectures'],
    batches:batches.length,resumed_from_batch:done};
  }
 }
 await fs.writeFile(path.join(out,'mapping_coverage_summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');
 console.log(JSON.stringify({mode:summary.mode,run_key:runKey,catalogue_sources:sources.length,course_rows:records.length,
  mapped_courses:summary.courses.mapped_to_inventory,matched_links:matched.length,lecture_titles:lecturePlan.fileTitles.length,
  conflicts:conflicts.length,unresolved:unresolved.length,apply:summary.apply?.status||'not-requested'}));
 console.log('Reports written to '+out+'. Archive untouched.'+(opt.apply?'':' Dry run only: re-run with --apply to import.'));
}finally{await db.end()}
