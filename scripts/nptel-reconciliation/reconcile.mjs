/** NPTEL reconciliation, phases B-D and F-G: E: course folders x index.html catalogues x NPTEL Courses PDF x official web cache.
 *   node --env-file=.env.local scripts/nptel-reconciliation/reconcile.mjs --pdf C:\MREM\inventory\nptel-courses-pdf.json.gz
 * Read-only throughout: the archive is only listed (to course-ID level) and catalogue pages are only read; the database is
 * queried inside a READ ONLY transaction. Reports go to C:\MREM\inventory\nptel-reconciliation.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {decodeHtmlBytes,parseCatalogueHtml} from '../legacy-catalogue/parse.mjs';
import {titleStatus,titlesAgree,peopleStatus,instNorm,norm,stripNoc,nonLatin,matchLectures,TRUNCATED_AT} from './compare.mjs';

const {values:opt}=parseArgs({options:{source:{type:'string',default:'server1'},pdf:{type:'string'},
 web:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation/web-cache'},out:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation'},
 'max-depth':{type:'string',default:'4'},'max-kb':{type:'string',default:'4096'}}});
if(!opt.pdf)throw Error('--pdf <parsed NPTEL Courses PDF .json or .json.gz> required');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const MAX_DEPTH=Math.max(2,Number(opt['max-depth'])||4),MAX_BYTES=(Number(opt['max-kb'])||4096)*1024;
const started=Date.now(),today=new Date().toISOString().slice(0,10);
const ID=/^\d{9}$/,SEM=/^(jan|jul)[-_ ]?(apr|dec)[-_ ]?(20\d{2})$/i;
const csvCell=(v)=>'"'+String(v??'').replace(/"/g,'""')+'"';
function writeCsv(name,cols,rows){
 fs.writeFileSync(path.join(opt.out,name),'\ufeff'+[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\r\n')+'\r\n','utf8');
 return rows.length;
}
const yes=(b)=>b?'YES':'NO';
const winRel=(rel)=>rel.split('/').join('\\');
const tally=(rows,f)=>rows.reduce((o,r)=>{const k=typeof f==='function'?f(r):r[f];o[k]=(o[k]||0)+1;return o},{});

const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 await db.query('BEGIN READ ONLY');
 const src=(await db.query('SELECT id,root_path FROM storage_sources WHERE id=$1',[opt.source])).rows[0];
 if(!src)throw Error('Unknown storage source '+opt.source);
 const root=await fs.promises.realpath(src.root_path);
 fs.mkdirSync(opt.out,{recursive:true});

 // Phase B: list the archive down to course-ID folders (directories only; course folders are never entered).
 const semesters=[],excluded=[],disciplines=[],occ=[],invalid=[],inaccessible=[],htmlFiles=[];
 const ls=async(rel)=>{try{return await fs.promises.readdir(path.join(root,...rel.split('/').filter(Boolean)),{withFileTypes:true})}
  catch(e){inaccessible.push({rel,error:e.code||String(e)});return null}};
 const indexIn=(entries)=>entries.find(e=>e.isFile()&&/^index\.html?$/i.test(e.name))?.name;
 async function visit(rel,depth,sem,chain){
  const name=rel.split('/').pop();
  if(ID.test(name)){occ.push({sem,discipline_path:chain.join('/'),id:name,rel});return}
  if(depth===2&&/^\d{3}$/.test(name))disciplines.push({sem,folder:name,rel});
  else if(/^\d+$/.test(name))invalid.push({rel,sem,name,reason:depth===2?'numeric folder directly under the semester that is neither a 3-digit discipline nor a 9-digit course ID':'numeric folder name that is not a 9-digit course ID'});
  if(depth>=MAX_DEPTH)return;
  const entries=await ls(rel);if(!entries)return;
  if(depth===2){const ix=indexIn(entries);if(ix)htmlFiles.push({rel:rel+'/'+ix,level:'discipline',sem,folder:name})}
  for(const e of entries.filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))await visit(rel+'/'+e.name,depth+1,sem,[...chain,name]);
 }
 for(const e of ((await ls(''))||[]).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  if(/^\$|^system volume information$/i.test(e.name)){excluded.push(e.name);continue}
  semesters.push(e.name);
  const entries=await ls(e.name);if(!entries)continue;
  const ix=indexIn(entries);if(ix)htmlFiles.push({rel:e.name+'/'+ix,level:'semester',sem:e.name,folder:''});
  for(const d of entries.filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))await visit(e.name+'/'+d.name,2,e.name,[]);
 }
 console.log('Phase B: '+semesters.length+' academic folders, '+disciplines.length+' discipline folders, '+occ.length+' course-ID folder occurrences');

 // Phase C: discipline-level index.html catalogues (static parse; scripts never run).
 const htmlStatus=new Map(),htmlRows=[];
 for(const h of htmlFiles){
  const st={...h,status:'',rows:0,note:''};htmlStatus.set(h.rel,st);
  if(h.level!=='discipline'){st.status='SEMESTER_INDEX';continue}
  try{
   const abs=path.join(root,...h.rel.split('/'));const size=(await fs.promises.stat(abs)).size;
   if(size>MAX_BYTES){st.status='HTML_PARSE_FAILED';st.note='larger than '+opt['max-kb']+' KB';continue}
   const p=parseCatalogueHtml(decodeHtmlBytes(await fs.promises.readFile(abs)));
   st.rows=p.courses.length;st.status=p.courses.length?'PARSED':'NO_COURSE_TABLE';
   for(const c of p.courses)htmlRows.push({sem:h.sem,folder:h.folder,html_rel:h.rel,id:c.course_code,title:c.raw_title||c.title,
    discipline:c.discipline,coordinators:c.coordinators,institute:c.institution,type:c.course_type});
  }catch(e){st.status='HTML_PARSE_FAILED';st.note=String(e.code||e.message||e).slice(0,160)}
 }
 const htmlBySem=new Map();
 for(const r of htmlRows){if(!htmlBySem.has(r.sem))htmlBySem.set(r.sem,new Map());const m=htmlBySem.get(r.sem);if(!m.has(r.id))m.set(r.id,[]);m.get(r.id).push(r)}
 console.log('Phase C: '+htmlFiles.filter(h=>h.level==='discipline').length+' discipline index.html files, '+htmlRows.length+' catalogue rows');

 // Phase D input: parsed PDF rows (string IDs, page numbers).
 const rawPdf=fs.readFileSync(opt.pdf);
 const pdfRows=JSON.parse((opt.pdf.endsWith('.gz')?zlib.gunzipSync(rawPdf):rawPdf).toString('utf8'));
 const pdf=new Map();const pdfDup=[];
 for(const r of pdfRows){const id=String(r.code);if(pdf.has(id))pdfDup.push(r);else pdf.set(id,r)}

 // Phase E input: official cache written by fetch-official.mjs.
 const catFile=path.join(opt.web,'_official-catalogue.json');
 const catalogue=fs.existsSync(catFile)?JSON.parse(fs.readFileSync(catFile,'utf8')):null;
 const officialCache=(id)=>{const f=path.join(opt.web,id+'.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null};

 // Phase F: indexed inventory, grouped by the course-ID folder each file sits in.
 const COURSE_REL="substring(r.rel_path from '^((?:[^/]+/)*?[0-9]{9})(?:/|$)')";
 const DOCS=['.doc','.docx','.ppt','.pptx','.pps','.ppsx','.txt','.rtf','.xls','.xlsx','.odt','.odp','.ods','.csv'];
 const inventoryFolders=new Set((await db.query("SELECT rel_path FROM folders WHERE source_id=$1 AND name ~ '^[0-9]{9}$'",[src.id])).rows.map(r=>r.rel_path));
 const counts=new Map((await db.query(`SELECT ${COURSE_REL} AS course_rel,count(*)::int AS total,
   count(*) FILTER(WHERE r.kind='Video')::int AS videos,count(*) FILTER(WHERE lower(r.ext)='.pdf')::int AS pdfs,
   count(*) FILTER(WHERE lower(r.ext) IN ('.html','.htm'))::int AS html,count(*) FILTER(WHERE lower(r.ext)=ANY($2))::int AS other_docs
   FROM resources r WHERE r.source_id=$1 AND r.availability='available' AND r.rel_path ~ '(^|/)[0-9]{9}/' GROUP BY 1`,[src.id,DOCS])).rows.map(r=>[r.course_rel,r]));
 const videos=new Map();
 for(const r of (await db.query(`SELECT r.id::text,r.name,r.module_no,r.lecture_no,${COURSE_REL} AS course_rel FROM resources r
   WHERE r.source_id=$1 AND r.availability='available' AND r.kind='Video' AND r.rel_path ~ '(^|/)[0-9]{9}/'`,[src.id])).rows){
  if(!videos.has(r.course_rel))videos.set(r.course_rel,[]);videos.get(r.course_rel).push(r);
 }
 const legacyTitles=(await db.query("SELECT to_regclass('legacy_lecture_titles') IS NOT NULL AS ok")).rows[0].ok
  ?(await db.query('SELECT count(*)::int n FROM legacy_lecture_titles')).rows[0].n:0;
 await db.query('COMMIT');
 console.log('Phase F: '+counts.size+' course folders with indexed files');

 // Shared per-ID facts.
 const occById=new Map();for(const o of occ){if(!occById.has(o.id))occById.set(o.id,[]);occById.get(o.id).push(o)}
 const semInfo=(s)=>{const m=SEM.exec(s);return m?{year:m[3],term:m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()+'-'+m[2][0].toUpperCase()+m[2].slice(1).toLowerCase()}
  :/^web[-_ ]?courses?$/i.test(s)?{year:'',term:'Web courses (no term)'}:{year:'',term:'Unrecognized: review'}};
 const official=new Map();
 const officialFor=(id)=>{
  if(official.has(id))return official.get(id);
  const c=officialCache(id),cat=catalogue?.courses?.[id]||null,o=c?.outline?.state==='ok'?c.outline:null;
  // The catalogue listing is NPTEL's own listing form (with "NOC:" where it applies); the course page stores the bare title.
  const v={cache:c,cat,outline:o,found:Boolean(cat||o),title:cat?.title||(o?(o.nocCourse?'NOC:'+o.title:o.title):''),professor:o?.professor||cat?.professor||'',
   institute:o?.institute||cat?.institute||'',coordinating:o?.coordinatingInstitute||'',discipline:cat?.discipline||catalogue?.disciplines?.[id.slice(0,3)]||'',
   type:o?.contentType||cat?.contentType||'',noc:o?o.nocCourse:/^noc\s*:/i.test(cat?.title||'')};
  // Distinguish "page could not be fetched" from "NPTEL has no such course".
  v.web_state=v.found?'FOUND':!catalogue?'NOT_CHECKED':c&&!c.outline_http?'UNAVAILABLE':c?.outline?.state==='error'||c?.downloads?.lessons?.length===0?'NOT_FOUND':c?'NOT_FOUND':'NOT_FETCHED';
  official.set(id,v);return v;
 };
 // Digits 4-6 of a course ID name NPTEL's coordinating institute; a course may be hosted elsewhere.
 const COORDINATING={'101':'IIT Bombay','102':'IIT Delhi','103':'IIT Guwahati','104':'IIT Kanpur','105':'IIT Kharagpur','106':'IIT Madras','107':'IIT Roorkee','108':'IISc Bangalore'};
 const institutesAgree=(a,b,id,off,{label='HTML / PDF',prefix='institute differs: '}={})=>{
  if(!a||!b)return {ok:true,note:''};
  const x=instNorm(a),y=instNorm(b);
  if(x===y)return {ok:true,note:''};
  const within=(big,small)=>small.length>=6&&(' '+big+' ').includes(' '+small+' ');
  if(within(x,y)||within(y,x))return {ok:true,note:'one source lists more institutes ('+label+': '+a+' / '+b+')'};
  // From the ID digits, and as nptel.ac.in states it for the course (they can differ).
  const co=[COORDINATING[id.slice(3,6)],off?.coordinating].filter(Boolean).find(c=>x===instNorm(c)||y===instNorm(c));
  if(co)return {ok:true,note:co+' is the NPTEL coordinating institute for this ID; the other source names the host institute ('+label+': '+a+' / '+b+')'};
  return {ok:false,note:prefix+(label==='HTML / PDF'?'HTML '+a+' / PDF '+b:a+' / '+b)};
 };
 const disciplinesAgree=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y||x===y)return {ok:true,note:''};
  if(x.startsWith(y)||y.startsWith(x))return {ok:true,note:'discipline name is cut off in one source'};return {ok:false,note:'discipline differs: HTML '+a+' / PDF '+b}};

 // Report 01: structure.
 const r01=occ.map(o=>({Source_ID:src.id,Drive:root,Academic_Folder:o.sem,Year:semInfo(o.sem).year,Academic_Term:semInfo(o.sem).term,
  Discipline_Folder:o.discipline_path,Course_ID:o.id,Course_Folder_Relative_Path:winRel(o.rel),Folder_Exists:'YES',
  Indexed_In_Database:yes(inventoryFolders.has(o.rel))}));
 const n01=writeCsv('01_COMPLETE_E_DRIVE_COURSE_FOLDER_STRUCTURE.csv',['Source_ID','Drive','Academic_Folder','Year','Academic_Term',
  'Discipline_Folder','Course_ID','Course_Folder_Relative_Path','Folder_Exists','Indexed_In_Database'],r01);
 const tree=[root+'   (source '+src.id+'; tree stops at 9-digit course-ID folders; generated '+new Date().toISOString()+')'];
 for(const s of semesters){
  const os=occ.filter(o=>o.sem===s);
  tree.push('  '+s+'\\   ['+os.length+' course-ID folders]');
  const groups=new Map();for(const o of os){if(!groups.has(o.discipline_path))groups.set(o.discipline_path,[]);groups.get(o.discipline_path).push(o.id)}
  for(const d of disciplines.filter(d=>d.sem===s&&!groups.has(d.folder)))groups.set(d.folder,[]);
  for(const [d,ids] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))){
   const ind=d?'    ':'';
   if(d)tree.push('    '+winRel(d)+'\\   ['+ids.length+']');
   for(const id of ids.sort())tree.push('    '+ind+id+'\\');
  }
 }
 if(excluded.length)tree.push('','Not listed (system folders): '+excluded.join(', '));
 fs.writeFileSync(path.join(opt.out,'01_COMPLETE_E_DRIVE_COURSE_FOLDER_TREE.txt'),'\ufeff'+tree.join('\r\n')+'\r\n','utf8');

 // Report 02: each folder occurrence against its semester's catalogues.
 const htmlFor=(sem,folder)=>[...htmlStatus.values()].find(h=>h.level==='discipline'&&h.sem===sem&&h.folder===folder);
 const r02=[];
 for(const o of occ){
  const top=o.discipline_path.split('/')[0],own=htmlFor(o.sem,top),semRows=htmlBySem.get(o.sem)?.get(o.id)||[];
  const here=semRows.filter(r=>r.folder===top),elsewhere=semRows.filter(r=>r.folder!==top);
  const use=here.length?here:elsewhere;
  let status,remark='';
  if(here.length){status=new Set(here.map(r=>norm(r.title))).size>1?'HTML_CONFLICT':'HTML_MATCHED';if(status==='HTML_CONFLICT')remark='listed more than once with different titles'}
  else if(elsewhere.length){status='HTML_CONFLICT';remark='listed in '+[...new Set(elsewhere.map(r=>r.html_rel))].join(' | ')+', not in its own discipline folder\'s index'}
  else if(!own)status='HTML_NOT_AVAILABLE',remark=o.discipline_path?'no index.html in '+winRel(o.sem+'/'+top):'course folder is not inside a discipline folder';
  else if(own.status==='HTML_PARSE_FAILED')status='HTML_PARSE_FAILED',remark=own.note;
  else if(own.status==='NO_COURSE_TABLE')status='HTML_NOT_AVAILABLE',remark='index.html has no course table';
  else status='FOLDER_ID_NOT_IN_HTML';
  const h=use[0]||{};
  o.html=use.length?h:null;o.html_status=status;
  r02.push({Source_ID:src.id,Academic_Folder:o.sem,Discipline_Folder:o.discipline_path,Course_ID:o.id,Folder_Exists:'YES',Found_In_HTML:yes(use.length),
   HTML_Course_Title:h.title||'',HTML_Discipline:h.discipline||'',HTML_Coordinator:h.coordinators||'',HTML_Institute:h.institute||'',
   HTML_Content_Type:h.type||'',HTML_Source_Relative_Path:h.html_rel?winRel(h.html_rel):(own?winRel(own.rel):''),HTML_Mapping_Status:status,Remarks:remark});
 }
 const htmlOnly=[];
 for(const [sem,m] of htmlBySem)for(const [id,rows] of m){
  if(occ.some(o=>o.sem===sem&&o.id===id))continue;
  const h=rows[0];htmlOnly.push({sem,id,h});
  r02.push({Source_ID:src.id,Academic_Folder:sem,Discipline_Folder:h.folder,Course_ID:id,Folder_Exists:'NO',Found_In_HTML:'YES',
   HTML_Course_Title:h.title,HTML_Discipline:h.discipline,HTML_Coordinator:h.coordinators,HTML_Institute:h.institute,HTML_Content_Type:h.type,
   HTML_Source_Relative_Path:winRel(h.html_rel),HTML_Mapping_Status:'HTML_ID_WITHOUT_FOLDER',Remarks:'listed in the catalogue; no course-ID folder for it anywhere in '+sem});
 }
 const n02=writeCsv('02_HTML_INDEX_COURSE_MAPPING_STATUS.csv',['Source_ID','Academic_Folder','Discipline_Folder','Course_ID','Folder_Exists',
  'Found_In_HTML','HTML_Course_Title','HTML_Discipline','HTML_Coordinator','HTML_Institute','HTML_Content_Type','HTML_Source_Relative_Path','HTML_Mapping_Status','Remarks'],r02);

 // Report 03: folder x HTML x PDF.
 const r03=[];
 // A PDF title the parser flagged as non-Latin is garbled by extraction: it is not evidence of a different title.
 const withPdfTitle=(t,p)=>p?.non_latin&&t.status==='TITLE_CONFLICT'?{status:'NON_LATIN_NOT_COMPARED',note:'PDF title is Hindi/Tamil text garbled by extraction; use the nptel.ac.in title'}:t;
 const reconcileRow=(o,folderExists,h,id)=>{
  const p=pdf.get(id),off=officialFor(id),remarks=[];
  const t=withPdfTitle(titleStatus(h?.title,p?.title),p);if(t.note)remarks.push('title: '+t.note);
  if(p?.non_latin)remarks.push('PDF title is non-Latin; text extraction may be unreliable, check the PDF page');
  if(p&&p.split==='unsplit')remarks.push('PDF row: institute could not be separated from the title');
  let conflict=Boolean(h&&p&&t.status==='TITLE_CONFLICT');
  if(h&&p){
   const pp=peopleStatus(h.coordinators,p.coordinator);if(pp.status==='DIFFERS'){conflict=true;remarks.push('coordinators differ: HTML '+h.coordinators+' / PDF '+p.coordinator)}else if(pp.note)remarks.push(pp.note);
   const ii=institutesAgree(h.institute,p.institute,id,off);if(!ii.ok)conflict=true;if(ii.note)remarks.push(ii.note);
   const dd=disciplinesAgree(h.discipline,p.discipline);if(!dd.ok)conflict=true;if(dd.note)remarks.push(dd.note);
  }
  const overall=conflict?'CONFLICT_REVIEW_REQUIRED':folderExists&&h&&p?'MATCHED_IN_ALL_THREE':folderExists&&p?'FOLDER_AND_PDF_ONLY':folderExists&&h?'FOLDER_AND_HTML_ONLY':
   !folderExists&&h&&p?'HTML_AND_PDF_BUT_FOLDER_MISSING':folderExists?'FOLDER_ONLY':p?'PDF_ONLY':'CONFLICT_REVIEW_REQUIRED';
  if(!folderExists&&h&&!p)remarks.push('listed only in the HTML catalogue: no folder, not in the PDF');
  return {Source_ID:src.id,Academic_Folder:o?.sem||'',Discipline_Folder:o?.discipline_path??'',Course_ID:id,Folder_Exists:yes(folderExists),
   Found_In_HTML:yes(h),HTML_Course_Title:h?.title||'',Found_In_NPTEL_PDF:yes(p),PDF_Course_Title:p?.title||'',PDF_Discipline:p?.discipline||'',
   PDF_Professor:p?.coordinator||'',PDF_Institute:p?.institute||'',PDF_Content_Type:p?.ctype||'',PDF_Page:p?.page||'',
   Title_Match_Status:h||p?t.status:'',Overall_Mapping_Status:overall,Remarks:remarks.join('; ')};
 };
 for(const o of occ){const row=reconcileRow(o,true,o.html,o.id);o.r03=row;r03.push(row)}
 for(const x of htmlOnly)r03.push(reconcileRow({sem:x.sem,discipline_path:x.h.folder},false,x.h,x.id));
 const onE=new Set(occ.map(o=>o.id));
 const pdfOnly=[...pdf.keys()].filter(id=>!onE.has(id)).sort();
 for(const id of pdfOnly)r03.push(reconcileRow(null,false,null,id));
 const n03=writeCsv('03_NPTEL_PDF_VS_E_DRIVE_RECONCILIATION.csv',['Source_ID','Academic_Folder','Discipline_Folder','Course_ID','Folder_Exists',
  'Found_In_HTML','HTML_Course_Title','Found_In_NPTEL_PDF','PDF_Course_Title','PDF_Discipline','PDF_Professor','PDF_Institute','PDF_Content_Type','PDF_Page',
  'Title_Match_Status','Overall_Mapping_Status','Remarks'],r03);

 // Report 05: indexed files per course-folder occurrence.
 const r05=occ.map(o=>{
  const c=counts.get(o.rel)||{total:0,videos:0,pdfs:0,html:0,other_docs:0};
  const status=!inventoryFolders.has(o.rel)&&!c.total?'FOLDER_NOT_IN_INVENTORY':!c.total?'NO_INDEXED_FILES':c.videos&&c.pdfs?'VIDEOS_AND_PDFS':
   c.videos?'VIDEOS_ONLY':c.pdfs?'PDFS_ONLY':c.other_docs||c.html?'DOCUMENTS_ONLY':'OTHER_FILES_ONLY';
  o.counts=c;
  return {Source_ID:src.id,Academic_Folder:o.sem,Discipline_Folder:o.discipline_path,Course_ID:o.id,PDF_Course_Title:pdf.get(o.id)?.title||'',
   Videos_Count:c.videos,PDFs_Count:c.pdfs,Other_Documents_Count:c.other_docs,HTML_Count:c.html,Total_Files:c.total,Content_Availability_Status:status};
 });
 const n05=writeCsv('05_COURSE_CONTENT_AVAILABILITY.csv',['Source_ID','Academic_Folder','Discipline_Folder','Course_ID','PDF_Course_Title','Videos_Count',
  'PDFs_Count','Other_Documents_Count','HTML_Count','Total_Files','Content_Availability_Status'],r05);

 // Report 06: lecture titles tied to indexed files by an explicit identity.
 const r06=[],lectureSummary=new Map();
 for(const o of occ){
  const files=videos.get(o.rel)||[],off=officialFor(o.id);
  const hits=files.length&&off.cache?matchLectures(files,off.cache):[];
  const s=lectureSummary.get(o.id)||{local:0,high:0,medium:0,officialLessons:off.cache?.downloads?.lessons?.length||0,withUrl:(off.cache?.downloads?.lessons||[]).filter(l=>l.url).length};
  s.local+=files.length;s.high+=hits.filter(h=>h.confidence==='HIGH').length;s.medium+=hits.filter(h=>h.confidence==='MEDIUM').length;lectureSummary.set(o.id,s);
  for(const h of hits)r06.push({Course_ID:o.id,Semester:o.sem,Discipline_Folder:o.discipline_path,Module_Number:h.module_no??'',Lecture_Number:h.lecture_no??'',
   Actual_Lecture_Title:h.title,Indexed_File_ID:h.id,Local_File_Name:h.name,Source_Evidence:h.evidence,
   Official_Source_URL:h.official_url||off.cache?.downloads_url||'',Confidence:h.confidence});
 }
 const n06=writeCsv('06_VERIFIED_LECTURE_TITLES_DISCOVERED.csv',['Course_ID','Semester','Discipline_Folder','Module_Number','Lecture_Number',
  'Actual_Lecture_Title','Indexed_File_ID','Local_File_Name','Source_Evidence','Official_Source_URL','Confidence'],r06);

 // Report 08: per distinct course ID, three sources.
 const r08=[];
 const verify=(id)=>{
  const occs=occById.get(id)||[],p=pdf.get(id),off=officialFor(id),c=off.cache;
  const htmlTitles=[...new Set(occs.map(o=>o.html?.title).filter(Boolean))],h=occs.find(o=>o.html)?.html||null,remarks=[];
  const tHP=withPdfTitle(titleStatus(h?.title,p?.title),p),tPO=withPdfTitle(titleStatus(p?.title,off.title,{aMissing:'PDF_TITLE_MISSING',bMissing:'OFFICIAL_TITLE_MISSING'}),p),
   tHO=titleStatus(h?.title,off.title,{bMissing:'OFFICIAL_TITLE_MISSING'});
  if(htmlTitles.length>1)remarks.push('local HTML titles differ between semesters: '+htmlTitles.join(' || '));
  const pairs=[h&&p&&tHP,p&&off.found&&tPO,h&&off.found&&tHO].filter(Boolean);
  let conflict=pairs.some(x=>x.status==='TITLE_CONFLICT');
  const nonLatinTitle=pairs.some(x=>x.status==='NON_LATIN_NOT_COMPARED');
  for(const x of pairs)if(x.status!=='EXACT_MATCH'&&x.status!=='PREFIX_DIFFERENCE'&&x.note&&!remarks.includes(x.note))remarks.push(x.note);
  const profs=[[h?.coordinators,p?.coordinator,'HTML/PDF'],[p?.coordinator,off.professor,'PDF/official'],[h?.coordinators,off.professor,'HTML/official']];
  for(const [a,b,lbl] of profs){if(!a||!b)continue;const s=peopleStatus(a,b);
   if(s.status==='DIFFERS'){conflict=true;remarks.push('coordinators differ ('+lbl+')')}
   else if(/share|placeholder/.test(s.note))remarks.push('coordinators ('+lbl+'): '+s.note)}
  if(p&&off.found){const ii=institutesAgree(p.institute,off.institute,id,off,{label:'PDF / official',prefix:'institute differs (PDF/official): '});if(!ii.ok)conflict=true;if(ii.note)remarks.push(ii.note)}
  if(h&&(p||off.found)){const ii=institutesAgree(h.institute,p?.institute||off.institute,id,off);if(!ii.ok){conflict=true}if(ii.note)remarks.push(ii.note)}
  const allExact=pairs.length&&pairs.every(x=>x.status==='EXACT_MATCH');
  let status;
  if(!occs.length)status=!p?'NOT_VERIFIED':off.found&&!conflict?'CATALOGUE_MATCH_NO_LOCAL_CONTENT':off.found?'CONFLICT_REQUIRES_REVIEW':'NOT_VERIFIED';
  else if(conflict)status='CONFLICT_REQUIRES_REVIEW';
  else if(off.web_state==='UNAVAILABLE'||off.web_state==='NOT_FETCHED'||off.web_state==='NOT_CHECKED')status=h&&p&&titlesAgree(tHP.status)?'LOCAL_AND_PDF_MATCHED':'NOT_VERIFIED';
  else if(nonLatinTitle&&off.found)status='OFFICIAL_TITLE_USED_NON_LATIN';
  else if(h&&p&&off.found)status=allExact?'THREE_SOURCE_VERIFIED':'NORMALIZED_TITLE_MATCH';
  else if(h&&p&&!off.found)status='LOCAL_AND_PDF_MATCHED';
  else if(!h&&p&&off.found)status='PDF_AND_OFFICIAL_MATCHED_LOCAL_FOLDER_ONLY';
  else if(!p&&off.found)status='OFFICIAL_MATCHED_NOT_IN_PDF';
  else status='LOCAL_ID_REQUIRES_REVIEW';
  if(off.web_state==='UNAVAILABLE')remarks.push('nptel.ac.in did not answer for this course (page unavailable, not proven missing)');
  if(off.web_state==='NOT_FOUND')remarks.push('nptel.ac.in has no course with this ID (catalogue and course page both checked)');
  if(!p&&occs.length)remarks.push('not in the NPTEL Courses PDF');
  const s=lectureSummary.get(id);
  const lect=!occs.length?'NO_LOCAL_CONTENT':!s?.local?'NO_LOCAL_VIDEOS':!c?.downloads?.lessons?.length?'NO_OFFICIAL_LECTURE_LIST':
   s.high?`FILENAME_MATCHED ${s.high}/${s.local} local videos`:s.medium?`OUTLINE_NUMBER_MATCHED ${s.medium}/${s.local} local videos (no official file names)`:
   `OFFICIAL_LIST_NOT_LINKABLE (${s.officialLessons} official lessons, ${s.local} local videos)`;
  const sems=[...new Set(occs.map(o=>o.sem))];
  r08.push({Course_ID:id,Local_HTML_Title:h?.title||'',PDF_Title:p?.title||'',Official_NPTEL_Title:off.title,
   Official_Discipline:off.found?off.discipline:'',Official_Professor:off.professor,Official_Institute:off.institute,
   Official_Course_URL:off.outline?c.course_url:off.cat?'https://nptel.ac.in/courses/'+id+' (listed in catalogue)':'',
   Official_Lecture_List_URL:c?.downloads?.lessons?.length?c.downloads_url:'',
   Course_Version:off.found?((off.noc?'NOC course':'Non-NOC course')+'; nptel.ac.in shows the latest published version'+(off.outline?.currentRun?' (a run is open now)':'')+
    (sems.length?'; local semesters: '+sems.join(', '):'')):'',
   Local_Semester:sems.join(' | '),Verification_Status:status,
   Title_Match_Status:'HTML/PDF '+tHP.status+'; PDF/official '+tPO.status+'; HTML/official '+tHO.status,
   Lecture_Title_Availability:lect,Date_Verified:(c?.fetched_at||catalogue?.fetched_at||'').slice(0,10),Remarks:remarks.join('; ')});
  return status;
 };
 const localIds=[...occById.keys()].sort();
 for(const id of localIds)verify(id);
 for(const id of pdfOnly)verify(id);
 const n08=writeCsv('08_NPTEL_OFFICIAL_WEB_VERIFICATION.csv',['Course_ID','Local_HTML_Title','PDF_Title','Official_NPTEL_Title','Official_Discipline',
  'Official_Professor','Official_Institute','Official_Course_URL','Official_Lecture_List_URL','Course_Version','Local_Semester','Verification_Status',
  'Title_Match_Status','Lecture_Title_Availability','Date_Verified','Remarks'],r08);

 // Report 04: every exception, with evidence.
 const r04=[];
 const ex=(type,o,id,evidence,reason)=>r04.push({Exception_Type:type,Academic_Folder:o?.sem||'',Discipline_Folder:o?.discipline_path??o?.folder??'',
  Course_ID:id||'',Evidence:evidence,Reason:reason});
 for(const id of localIds.filter(id=>!pdf.has(id)))ex('ID_ON_E_NOT_IN_PDF',null,id,'folders: '+occById.get(id).map(o=>winRel(o.rel)).join(' | '),'course-ID folder exists on E: but the PDF has no row for this Subject ID');
 for(const id of pdfOnly){const p=pdf.get(id);ex('ID_IN_PDF_NOT_ON_E',null,id,'PDF page '+p.page+' S.No '+p.sno+': '+p.title,'no course-ID folder for this Subject ID on E:')}
 for(const r of r02.filter(r=>r.HTML_Mapping_Status==='FOLDER_ID_NOT_IN_HTML'))ex('FOLDER_ID_NOT_IN_HTML',{sem:r.Academic_Folder,discipline_path:r.Discipline_Folder},r.Course_ID,r.HTML_Source_Relative_Path,'folder exists but its discipline index.html does not list it');
 for(const x of htmlOnly)ex('HTML_ID_WITHOUT_FOLDER',{sem:x.sem,discipline_path:x.h.folder},x.id,winRel(x.h.html_rel)+': '+x.h.title,'listed in index.html but no course-ID folder in that semester');
 for(const r of r02.filter(r=>r.HTML_Mapping_Status==='HTML_CONFLICT'))ex('HTML_CONFLICT',{sem:r.Academic_Folder,discipline_path:r.Discipline_Folder},r.Course_ID,r.HTML_Source_Relative_Path,r.Remarks);
 for(const r of r03.filter(r=>r.Title_Match_Status==='TITLE_CONFLICT'))ex('TITLE_CONFLICT',{sem:r.Academic_Folder,discipline_path:r.Discipline_Folder},r.Course_ID,'HTML: '+r.HTML_Course_Title+' | PDF (page '+r.PDF_Page+'): '+r.PDF_Course_Title,r.Remarks||'titles differ');
 for(const r of r03.filter(r=>/discipline differs/.test(r.Remarks)))ex('DISCIPLINE_CONFLICT',{sem:r.Academic_Folder,discipline_path:r.Discipline_Folder},r.Course_ID,r.Remarks.match(/discipline differs[^;]*/)[0],'HTML and PDF name different disciplines');
 for(const r of r03.filter(r=>/coordinators differ|institute differs/.test(r.Remarks)))ex('COORDINATOR_OR_INSTITUTE_CONFLICT',{sem:r.Academic_Folder,discipline_path:r.Discipline_Folder},r.Course_ID,r.Remarks,'HTML and PDF disagree on coordinator or institute');
 for(const o of occ.filter(o=>/^\d{3}$/.test(o.discipline_path)&&o.id.slice(0,3)!==o.discipline_path))ex('FOLDER_DISCIPLINE_DIFFERS_FROM_ID_PREFIX',o,o.id,winRel(o.rel),'course ID starts with '+o.id.slice(0,3)+' but sits in discipline folder '+o.discipline_path);
 for(const id of [...occById.keys()].filter(id=>new Set(occById.get(id).map(o=>o.sem)).size<occById.get(id).length))ex('DUPLICATE_FOLDER_IN_SEMESTER',null,id,occById.get(id).map(o=>winRel(o.rel)).join(' | '),'same course ID has more than one folder in one semester');
 for(const r of pdfDup)ex('DUPLICATE_PDF_SUBJECT_ID',null,r.code,'PDF page '+r.page+' S.No '+r.sno,'Subject ID appears more than once in the PDF');
 for(const r of pdfRows.filter(r=>r.split==='unsplit'||r.non_latin))ex('PDF_EXTRACTION_REVIEW',null,r.code,'PDF page '+r.page+' S.No '+r.sno+': '+r.raw?.slice(0,200),r.non_latin?'non-Latin title; text extraction may garble it':'institute could not be separated from the title');
 for(const h of htmlStatus.values())if(h.status==='HTML_PARSE_FAILED')ex('HTML_INDEX_UNREADABLE',{sem:h.sem,folder:h.folder},'',winRel(h.rel),h.note||'could not be parsed');
 for(const d of disciplines.filter(d=>!htmlFor(d.sem,d.folder)))ex('HTML_INDEX_MISSING',{sem:d.sem,folder:d.folder},'',winRel(d.rel),'discipline folder has no index.html');
 for(const s of semesters.filter(s=>!htmlFiles.some(h=>h.level==='semester'&&h.sem===s)))ex('HTML_INDEX_MISSING',{sem:s},'',s,'academic folder has no top-level index.html');
 for(const v of invalid)ex('INVALID_NUMERIC_FOLDER',{sem:v.sem},'',winRel(v.rel),v.reason);
 for(const i of inaccessible)ex('INACCESSIBLE_FOLDER',null,'',winRel(i.rel)||root,i.error);
 const n04=writeCsv('04_MISSING_AND_CONFLICTING_COURSE_IDS.csv',['Exception_Type','Academic_Folder','Discipline_Folder','Course_ID','Evidence','Reason'],r04);

 // Report 07: summary.
 const distinct=localIds.length,htmlIds=new Set(htmlRows.map(r=>r.id));
 const inAll3=localIds.filter(id=>pdf.has(id)&&officialFor(id).found).length;
 const v08=tally(r08.filter(r=>occById.has(r.Course_ID)),'Verification_Status');
 const idCount=(os)=>new Set(os.map(o=>o.id)).size;
 const notInPdf=localIds.filter(id=>!pdf.has(id)),notInPdfOfficial=notInPdf.filter(id=>officialFor(id).found).length;
 const bySem=semesters.map(s=>{const os=occ.filter(o=>o.sem===s);return {s,info:semInfo(s),occ:os.length,ids:new Set(os.map(o=>o.id)).size,
  disc:disciplines.filter(d=>d.sem===s).length,html:idCount(os.filter(o=>o.html)),pdf:idCount(os.filter(o=>pdf.has(o.id))),
  vids:idCount(os.filter(o=>o.counts?.videos)),pdfs:idCount(os.filter(o=>o.counts?.pdfs))}});
 const courseWith=(f)=>new Set(occ.filter(f).map(o=>o.id)).size;
 const lectureIds=[...lectureSummary].filter(([,s])=>s.high).length,lectureIdsMed=[...lectureSummary].filter(([,s])=>!s.high&&s.medium).length;
 const md=`# NPTEL reconciliation summary — ${src.id} (${root})

Generated ${new Date().toISOString()} in ${Math.round((Date.now()-started)/1000)} s. Read-only: the archive was listed to course-ID level and catalogue pages were read; the database was queried in a READ ONLY transaction.

## Counts

| Measure | Count |
|---|---|
| Academic (semester/year) folders | ${semesters.length} (${semesters.join(', ')}) |
| Discipline folders (3-digit) | ${disciplines.length} |
| Course-ID folder occurrences | ${occ.length} |
| Distinct course IDs on E: | ${distinct} |
| Course-ID folders not in the indexed inventory | ${occ.filter(o=>!inventoryFolders.has(o.rel)).length} |
| Discipline index.html files read / with a course table | ${htmlFiles.filter(h=>h.level==='discipline').length} / ${[...htmlStatus.values()].filter(h=>h.status==='PARSED').length} |
| Course rows in HTML catalogues / distinct IDs | ${htmlRows.length} / ${htmlIds.size} |
| PDF numbered records / distinct Subject IDs / duplicates | ${pdfRows.length} / ${pdf.size} / ${pdfDup.length} |
| Official nptel.ac.in catalogue courses | ${catalogue?.count??'not fetched'} |
| Distinct E: IDs found in PDF and on nptel.ac.in | ${inAll3} |
| Distinct E: IDs missing from the PDF | ${notInPdf.length} (listed on nptel.ac.in: ${notInPdfOfficial}; not on nptel.ac.in: ${notInPdf.length-notInPdfOfficial}) |
| PDF Subject IDs with no folder on E: | ${pdfOnly.length} |
| Folder occurrences with a matching HTML row | ${occ.filter(o=>o.html).length} |
| Folder occurrences not listed in their HTML (FOLDER_ID_NOT_IN_HTML) | ${r02.filter(r=>r.HTML_Mapping_Status==='FOLDER_ID_NOT_IN_HTML').length} |
| HTML rows with no folder (HTML_ID_WITHOUT_FOLDER) | ${htmlOnly.length} |
| HTML-vs-PDF title conflicts (occurrence rows) | ${r03.filter(r=>r.Title_Match_Status==='TITLE_CONFLICT').length} |
| Distinct courses with local videos / local PDFs | ${courseWith(o=>o.counts?.videos)} / ${courseWith(o=>o.counts?.pdfs)} |
| Distinct courses with lecture titles linked by official file name (HIGH) | ${lectureIds} (${r06.filter(r=>r.Confidence==='HIGH').length} files) |
| Distinct courses with titles linked only by module+lecture number (MEDIUM) | ${lectureIdsMed} (${r06.filter(r=>r.Confidence==='MEDIUM').length} files) |
| Lecture titles from local HTML (legacy import table) | ${legacyTitles} |

## Report 03 — overall mapping status (rows)
${Object.entries(tally(r03,'Overall_Mapping_Status')).map(([k,v])=>'- '+k+': '+v).join('\n')}

## Report 03 — title match status (rows with a title)
${Object.entries(tally(r03.filter(r=>r.Title_Match_Status),'Title_Match_Status')).map(([k,v])=>'- '+k+': '+v).join('\n')}

## Report 08 — verification status (distinct course IDs on E:)
${Object.entries(v08).map(([k,v])=>'- '+k+': '+v).join('\n')}

PDF-only IDs in report 08: ${Object.entries(tally(r08.filter(r=>!occById.has(r.Course_ID)),'Verification_Status')).map(([k,v])=>k+' '+v).join(', ')}.

## By academic folder

Course folders counts every course-ID folder (an ID can have more than one folder in a term); the columns after it count distinct course IDs.

| Folder | Year | Term | Discipline folders | Course folders | Distinct IDs | IDs in HTML | IDs in PDF | IDs with videos | IDs with PDFs |
|---|---|---|---|---|---|---|---|---|---|
${bySem.map(b=>`| ${b.s} | ${b.info.year} | ${b.info.term} | ${b.disc} | ${b.occ} | ${b.ids} | ${b.html} | ${b.pdf} | ${b.vids} | ${b.pdfs} |`).join('\n')}

## Exceptions (report 04)
${Object.entries(tally(r04,'Exception_Type')).map(([k,v])=>'- '+k+': '+v).join('\n')}

## Status definitions and limits
- Folders: listed live from ${root}, ${MAX_DEPTH} levels deep, stopping at the first 9-digit folder; system folders skipped: ${excluded.join(', ')||'none'}. Inaccessible folders: ${inaccessible.length}.
- HTML: only discipline-level index.html files (directly inside a 3-digit discipline folder) are treated as course catalogues; other HTML pages are not.
- PDF: text extracted from NPTEL Courses.pdf with pypdf; Hindi and other non-Latin titles can be garbled by extraction and are flagged.
- Title statuses: EXACT_MATCH identical; PREFIX_DIFFERENCE differs only by "NOC:"; NORMALIZED_MATCH differs only in case, spacing, punctuation, accents or &/and, or once text attached by PDF extraction or editors is removed ("(Course sponsored by Aricent)", an institute name run into the title, " - IITM"); TRUNCATED_MATCH the shorter title is the start of the longer one and at least ${TRUNCATED_AT} characters long (the local catalogue cuts titles at 63-64); SUBTITLE_MATCH one title adds a series or college name before ":"; NON_LATIN_NOT_COMPARED Hindi/Tamil text or lost characters that cannot be compared; TITLE_CONFLICT anything else, including shorter prefixes under ${TRUNCATED_AT} characters.
- Coordinators agree when a surname matches, allowing a one-letter spelling difference (two for names of 10+ letters); a shared surname such as Kumar or Chandra counts only with a matching given name; lists with no surname in common but a shared distinctive name ("Prof. Rajesh" / "Prof. Rajesh Kumar") agree with a note; "Multifaculty"-style placeholders count as no name given.
- Institutes agree when one source's list contains the other's, or when one names NPTEL's coordinating institute for the ID (digits 4-6: 101 IIT Bombay, 102 IIT Delhi, 103 IIT Guwahati, 104 IIT Kanpur, 105 IIT Kharagpur, 106 IIT Madras, 107 IIT Roorkee, 108 IISc Bangalore) and the other the host institute; the reason is noted.
- OFFICIAL_TITLE_USED_NON_LATIN (report 08): no conflict except a Hindi/Tamil title that the PDF or local HTML cannot reproduce; the nptel.ac.in title is the one to use.
- Report 08 adds PDF_AND_OFFICIAL_MATCHED_LOCAL_FOLDER_ONLY: a local folder exists with no local HTML row, and the PDF and nptel.ac.in agree. OFFICIAL_MATCHED_NOT_IN_PDF: nptel.ac.in lists the ID (usually a course newer than the PDF) but the PDF does not; LOCAL_ID_REQUIRES_REVIEW is left for IDs found in neither. NORMALIZED_TITLE_MATCH means all three agree once "NOC:"/formatting is set aside; THREE_SOURCE_VERIFIED needs identical titles.
- Lecture titles: HIGH = official downloads list names the same file; MEDIUM = official outline module and lecture numbers both match and no file names are published. Nothing is assigned by list position.
- Counts come from the existing PostgreSQL inventory; files added to E: after the last scan are not counted.
`;
 fs.writeFileSync(path.join(opt.out,'07_RECONCILIATION_SUMMARY.md'),'\ufeff'+md,'utf8');
 console.log(JSON.stringify({out:opt.out,rows:{'01':n01,'02':n02,'03':n03,'04':n04,'05':n05,'06':n06,'08':n08},
  occurrences:occ.length,distinct_ids:distinct,pdf:pdf.size,official:catalogue?.count||0,seconds:Math.round((Date.now()-started)/1000)}));
}finally{await db.end()}
