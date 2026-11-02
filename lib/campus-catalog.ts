import 'server-only';
import {db} from '@/lib/db';
import {approvalRequired} from '@/lib/campus-publication';
import {campusMode} from '@/lib/campus-mode';

/** LIKE pattern for "inside folder <col>", with LIKE wildcards in folder names escaped (folders often contain "_"). */
const insideFolder=(col:string)=>`replace(replace(replace(${col},'\\','\\\\'),'%','\\%'),'_','\\_')||'/%'`;

/** The one student visibility rule, used by every listing and by file streaming: the file is available on an enabled
 * source and, when college approval is switched on, its course is approved or (for files with no course ID) a folder
 * containing it is approved. */
export function visibleSql(a='r'){
 const base=`${a}.availability='available' AND EXISTS(SELECT 1 FROM storage_sources vs WHERE vs.id=${a}.source_id AND vs.enabled)`;
 if(!approvalRequired())return base;
 return base+` AND (EXISTS(SELECT 1 FROM campus_publications vp WHERE vp.course_code=${a}.course_code AND vp.approved)`+
  ` OR (${a}.course_code IS NULL AND EXISTS(SELECT 1 FROM campus_folder_publications vf WHERE vf.source_id=${a}.source_id AND vf.approved`+
  ` AND (${a}.folder_rel_path=vf.rel_path OR ${a}.folder_rel_path LIKE ${insideFolder('vf.rel_path')} ESCAPE '\\'))))`;
}

// Catalogue listings are cached (default 5 minutes): a new approval or scan shows up within that time.
const TTL=(Number(process.env.MREM_CATALOG_CACHE_SECONDS)||300)*1000;
const memo=new Map<string,{at:number;value:unknown}>();
async function cached<T>(key:string,load:()=>Promise<T>):Promise<T>{
 const k=key+'|'+approvalRequired(),hit=memo.get(k);
 if(hit&&Date.now()-hit.at<TTL)return hit.value as T;
 const value=await load();memo.set(k,{at:Date.now(),value});return value;
}

/** Document extensions counted as "text / documents" (PDF is counted on its own). */
export const TEXT_EXT=['.txt','.md','.doc','.docx','.ppt','.pptx','.pps','.ppsx','.xls','.xlsx','.csv','.rtf','.odt','.odp','.ods'];
export type CourseSummary={code:string;title:string;titleVerified:boolean;department:string;deptSlug:string;instructor:string;institution:string;
 contentType:string;isWeb:boolean;files:number;videos:number;pdfs:number;texts:number;html:number;offerings:string[]};
const PLACEHOLDER=/^course\s+\d{9}$/i;
const clean=(s:unknown)=>String(s??'').replace(/\s+/g,' ').trim();
export const slugify=(s:string)=>clean(s).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

/** Every course ID with visible files in a course folder, on any drive, joined to its catalogue metadata. A course on several
 * drives is one row. A missing or placeholder title stays empty: pages then show the original course ID. */
export function courseSummaries(){
 if(!campusMode())return Promise.resolve([] as CourseSummary[]);
 return cached('courses',async()=>{
  const stats=await db().query(`SELECT r.course_code AS code,count(*)::int AS files,count(*) FILTER(WHERE r.kind='Video')::int AS videos,
   count(*) FILTER(WHERE lower(r.ext)='.pdf')::int AS pdfs,count(*) FILTER(WHERE lower(r.ext)=ANY($1))::int AS texts,
   count(*) FILTER(WHERE r.kind='HTML')::int AS html,array_remove(array_agg(DISTINCT r.semester_name),NULL) AS offerings
   FROM resources r WHERE r.course_code IS NOT NULL AND ${visibleSql()} GROUP BY r.course_code`,[TEXT_EXT]);
  const meta=new Map((await db().query('SELECT course_code,title,department,instructor,institution,verified,content_type FROM course_catalog')).rows
   .map(m=>[m.course_code,m]));
  return stats.rows.map(s=>{
   const m=meta.get(s.code)||{},title=PLACEHOLDER.test(m.title||'')?'':clean(m.title);
   const department=m.department&&!/^(unclassified|general)$/i.test(clean(m.department))?clean(m.department):'';
   return {code:s.code,title,titleVerified:Boolean(title&&m.verified),department,deptSlug:department?slugify(department):'',
    instructor:clean(m.instructor),institution:clean(m.institution),contentType:m.content_type||'',
    // A Web Course is typed "Web" in NPTEL metadata and has HTML pages to open; a folder of HTML alone is not enough.
    isWeb:m.content_type==='Web'&&s.html>0,files:s.files,videos:s.videos,pdfs:s.pdfs,texts:s.texts,html:s.html,
    offerings:sortOfferings(s.offerings||[])} as CourseSummary;
  }).sort((a,b)=>Number(!a.title)-Number(!b.title)||(a.title||a.code).localeCompare(b.title||b.code));
 });
}

export async function departments(filter:(c:CourseSummary)=>boolean=()=>true){
 const m=new Map<string,{name:string;slug:string;courses:number}>();
 for(const c of (await courseSummaries()).filter(filter))if(c.department){const d=m.get(c.deptSlug)||{name:c.department,slug:c.deptSlug,courses:0};d.courses++;m.set(c.deptSlug,d)}
 return [...m.values()].sort((a,b)=>b.courses-a.courses||a.name.localeCompare(b.name));
}

/** Library statistics. Definitions (also on the home page): courses are unique course IDs with visible files; a video
 * course has at least one video; a web course is typed "Web" by NPTEL and has HTML pages; video, PDF and text/document
 * counts are files inside course folders (a lecture copied on two drives counts twice); uncategorized files are excluded. */
export async function libraryStats(){
 const c=await courseSummaries();
 return {courses:c.length,videoCourses:c.filter(x=>x.videos>0).length,webCourses:c.filter(x=>x.isWeb).length,
  videos:c.reduce((a,x)=>a+x.videos,0),pdfs:c.reduce((a,x)=>a+x.pdfs,0),texts:c.reduce((a,x)=>a+x.texts,0),
  departments:new Set(c.filter(x=>x.department).map(x=>x.deptSlug)).size};
}

const TERM:Record<string,number>={jan:1,jul:2};
/** Offerings sort newest first: Jul-Dec 2025 before Jan-Apr 2025 before 2024. */
export function sortOfferings(list:string[]){
 const k=(s:string)=>{const m=/^(jan|jul)\D*(?:apr|dec)\D*(\d{4})$/i.exec(s);return m?Number(m[2])*10+TERM[m[1].toLowerCase()]:0};
 return [...new Set(list)].sort((a,b)=>k(b)-k(a)||a.localeCompare(b));
}
export const offeringLabel=(s:string|null)=>{
 if(!s)return 'Web course';
 const m=/^(jan|jul)\D*(apr|dec)\D*(\d{4})$/i.exec(s);
 return m?`${m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()}–${m[2][0].toUpperCase()+m[2].slice(1).toLowerCase()} ${m[3]}`:s.replace(/[_-]+/g,' ');
};

/** Course IDs whose verified lecture titles or original file names match a search (trigram indexes, bounded). */
export async function codesMatching(q:string):Promise<Set<string>>{
 if(!campusMode()||q.length<3)return new Set();
 const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
 const r=await db().query(`SELECT DISTINCT course_code FROM (
   (SELECT lt.course_code FROM lecture_titles lt WHERE lt.confidence='HIGH' AND lt.title ILIKE $1 LIMIT 300)
   UNION (SELECT llt.course_code FROM legacy_lecture_titles llt WHERE llt.confidence='high' AND llt.title ILIKE $1 LIMIT 300)
   UNION (SELECT cl.course_code FROM course_lectures cl WHERE cl.verified AND cl.title ILIKE $1 LIMIT 300)
   UNION (SELECT r.course_code FROM resources r WHERE r.name ILIKE $1 AND r.course_code IS NOT NULL AND ${visibleSql()} LIMIT 300)) x`,[like]);
 return new Set(r.rows.map(x=>x.course_code));
}

/** Filter and page the catalogue. */
export async function findCourses({q='',dept='',kind='',page=1,limit=24}:{q?:string;dept?:string;kind?:''|'video'|'web';page?:number;limit?:number}){
 if(!campusMode())return {items:[] as CourseSummary[],total:0,page:Math.max(1,page),pages:1};
 const query=clean(q).toLowerCase();
 const deep=query?await codesMatching(query):new Set<string>();
 const all=(await courseSummaries()).filter(c=>(!dept||c.deptSlug===dept)&&(kind!=='video'||c.videos>0)&&(kind!=='web'||c.isWeb)&&
  (!query||deep.has(c.code)||[c.title,c.code,c.department,c.instructor,c.institution,...c.offerings.map(offeringLabel)].some(v=>v.toLowerCase().includes(query))));
 const p=Math.max(1,page);
 return {items:all.slice((p-1)*limit,p*limit),total:all.length,page:p,pages:Math.max(1,Math.ceil(all.length/limit))};
}

export type Resource={id:string;name:string;ext:string;kind:string;size:number;module:number|null;lecture:number|null;semester:string|null;
 title:string|null;titleSource:string|null};
const RESOURCE_SQL=`SELECT r.id::text,r.name,r.ext,r.kind,r.size_bytes::float8 AS size,r.module_no AS module,r.lecture_no AS lecture,r.semester_name AS semester,
 COALESCE(llt.title,lt.title,cl.title) AS title,
 CASE WHEN llt.title IS NOT NULL THEN 'Local course catalogue' WHEN lt.title IS NOT NULL THEN 'NPTEL lecture list (same file name)'
      WHEN cl.title IS NOT NULL THEN 'Reviewed by college staff' END AS "titleSource"
 FROM resources r
 LEFT JOIN legacy_lecture_titles llt ON llt.resource_id=r.id AND llt.confidence='high'
 LEFT JOIN lecture_titles lt ON lt.resource_id=r.id AND lt.confidence='HIGH'
 LEFT JOIN course_lectures cl ON cl.course_code=r.course_code AND cl.module_no=r.module_no AND cl.lecture_no=r.lecture_no AND cl.verified`;
/** Resource groups shown on a course page, each in lecture order. */
export const GROUPS={video:"r.kind='Video'",pdf:"lower(r.ext)='.pdf'",html:"r.kind='HTML'",
 document:`r.kind='Document' AND lower(r.ext)<>'.pdf'`,other:"r.kind NOT IN ('Video','Document','HTML')"} as const;
export type Group=keyof typeof GROUPS;
const ORDER='ORDER BY r.module_no NULLS LAST,r.lecture_no NULLS LAST,r.name,r.id';

/** One course: its offerings (semesters, on whichever drive) with counts per group. Physical drives are not returned. */
export async function course(code:string){
 if(!campusMode()||!/^\d{9}$/.test(code))return null;
 const summary=(await courseSummaries()).find(c=>c.code===code);
 if(!summary)return null;
 const rows=(await db().query(`SELECT COALESCE(r.semester_name,'') AS value,${Object.entries(GROUPS).map(([g,w])=>`count(*) FILTER(WHERE ${w})::int AS ${g}`).join(',')}
   FROM resources r WHERE r.course_code=$1 AND ${visibleSql()} GROUP BY 1`,[code])).rows as ({value:string}&Record<Group,number>)[];
 const order=sortOfferings(rows.map(o=>o.value).filter(Boolean));
 rows.sort((a,b)=>(a.value?order.indexOf(a.value):1e9)-(b.value?order.indexOf(b.value):1e9));
 return {...summary,offerings:rows.map(o=>({...o,label:offeringLabel(o.value||null)}))};
}

export async function resources(code:string,offering:string,group:Group,page=1,limit=60){
 if(!campusMode())return [] as Resource[];
 const r=await db().query(`${RESOURCE_SQL} WHERE r.course_code=$1 AND COALESCE(r.semester_name,'')=$2 AND ${GROUPS[group]} AND ${visibleSql()} ${ORDER} LIMIT $3 OFFSET $4`,
  [code,offering,limit,(Math.max(1,page)-1)*limit]);
 return r.rows as Resource[];
}

/** One learning resource with its neighbours in the same course, offering and group (for Previous / Next). */
export async function lesson(code:string,id:string){
 if(!campusMode()||!/^\d{9}$/.test(code)||!/^\d{1,18}$/.test(id))return null;
 const r=(await db().query(`${RESOURCE_SQL} WHERE r.id=$1 AND r.course_code=$2 AND ${visibleSql()}`,[id,code])).rows[0] as Resource|undefined;
 if(!r)return null;
 const group=(Object.keys(GROUPS) as Group[]).find(g=>g==='video'?r.kind==='Video':g==='pdf'?r.ext.toLowerCase()==='.pdf':g==='html'?r.kind==='HTML':
  g==='document'?r.kind==='Document':true)!;
 const sib=(await db().query(`SELECT r.id::text FROM resources r WHERE r.course_code=$1 AND COALESCE(r.semester_name,'')=$2 AND ${GROUPS[group]} AND ${visibleSql()} ${ORDER}`,
  [code,r.semester||''])).rows.map(x=>x.id);
 const i=sib.indexOf(r.id);
 return {resource:r,group,offering:r.semester||'',prev:i>0?sib[i-1]:null,next:i>=0&&i<sib.length-1?sib[i+1]:null,position:i+1,count:sib.length};
}

/** The page a Web Course opens on: its index page closest to the course folder, else its shallowest HTML page. */
export async function webEntry(code:string,offering:string){
 if(!campusMode())return undefined;
 const r=await db().query(`SELECT r.id::text FROM resources r WHERE r.course_code=$1 AND COALESCE(r.semester_name,'')=$2 AND r.kind='HTML' AND ${visibleSql()}
   ORDER BY (lower(r.name) IN ('index.html','index.htm'))::int DESC,length(r.rel_path)-length(replace(r.rel_path,'/','')),r.rel_path LIMIT 1`,[code,offering]);
 return r.rows[0]?.id as string|undefined;
}

/** Study materials: PDFs and text/documents inside course folders, newest offering first. */
export async function studyMaterials({q='',type='',page=1,limit=30}:{q?:string;type?:''|'pdf'|'document';page?:number;limit?:number}){
 if(!campusMode())return {items:[],total:0,page:Math.max(1,page),pages:1};
 const where=[visibleSql(),'r.course_code IS NOT NULL',type==='pdf'?GROUPS.pdf:type==='document'?GROUPS.document:`(${GROUPS.pdf} OR ${GROUPS.document})`];
 const args:unknown[]=[];
 if(clean(q).length>=2){args.push('%'+clean(q).replace(/[\\%_]/g,'\\$&')+'%');where.push(`r.name ILIKE $${args.length}`)}
 const total=Number((await db().query(`SELECT count(*) AS n FROM resources r WHERE ${where.join(' AND ')}`,args)).rows[0].n);
 args.push(limit,(Math.max(1,page)-1)*limit);
 const rows=(await db().query(`SELECT r.id::text,r.name,r.ext,r.size_bytes::float8 AS size,r.course_code AS code,r.semester_name AS semester
   FROM resources r WHERE ${where.join(' AND ')} ORDER BY r.course_code,r.name,r.id LIMIT $${args.length-1} OFFSET $${args.length}`,args)).rows;
 const meta=new Map((await courseSummaries()).map(c=>[c.code,c]));
 return {items:rows.map(x=>({...x,course:meta.get(x.code)})),total,page,pages:Math.max(1,Math.ceil(total/limit))};
}
