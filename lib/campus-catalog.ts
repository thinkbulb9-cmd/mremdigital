import 'server-only';
import {db} from '@/lib/db';
import {approvalRequired} from '@/lib/campus-publication';

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

const TTL=5*60*1000;
const memo=new Map<string,{at:number;value:unknown}>();
async function cached<T>(key:string,load:()=>Promise<T>):Promise<T>{
 const k=key+'|'+approvalRequired(),hit=memo.get(k);
 if(hit&&Date.now()-hit.at<TTL)return hit.value as T;
 const value=await load();memo.set(k,{at:Date.now(),value});return value;
}

export type CourseSummary={code:string;title:string;titleVerified:boolean;department:string;instructor:string;institution:string;
 files:number;videos:number;documents:number;html:number;offerings:string[]};
const PLACEHOLDER=/^course\s+\d{9}$/i;

/** Every course ID with visible files, joined to its catalogue metadata. A missing or placeholder title stays empty:
 * the interface then shows the original course ID instead of inventing a name. */
export function courseSummaries(){
 return cached('courses',async()=>{
  const stats=await db().query(`SELECT r.course_code AS code,count(*)::int AS files,count(*) FILTER(WHERE r.kind='Video')::int AS videos,
   count(*) FILTER(WHERE r.kind='Document')::int AS documents,count(*) FILTER(WHERE r.kind='HTML')::int AS html,
   array_remove(array_agg(DISTINCT r.semester_name),NULL) AS offerings
   FROM resources r WHERE r.course_code IS NOT NULL AND ${visibleSql()} GROUP BY r.course_code`);
  const meta=new Map((await db().query('SELECT course_code,title,department,instructor,institution,verified FROM course_catalog')).rows
   .map(m=>[m.course_code,m]));
  return stats.rows.map(s=>{const m=meta.get(s.code)||{};const title=PLACEHOLDER.test(m.title||'')?'':(m.title||'');
   return {code:s.code,title,titleVerified:Boolean(title&&m.verified),department:m.department&&!/^(unclassified|general)$/i.test(m.department)?m.department:'',
    instructor:m.instructor||'',institution:m.institution||'',files:s.files,videos:s.videos,documents:s.documents,html:s.html,
    offerings:sortOfferings(s.offerings||[])} as CourseSummary;});
 });
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
 if(q.length<3)return new Set();
 const like='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
 const r=await db().query(`SELECT DISTINCT course_code FROM (
   (SELECT lt.course_code FROM lecture_titles lt WHERE lt.confidence='HIGH' AND lt.title ILIKE $1 LIMIT 300)
   UNION (SELECT llt.course_code FROM legacy_lecture_titles llt WHERE llt.confidence='high' AND llt.title ILIKE $1 LIMIT 300)
   UNION (SELECT cl.course_code FROM course_lectures cl WHERE cl.verified AND cl.title ILIKE $1 LIMIT 300)
   UNION (SELECT r.course_code FROM resources r WHERE r.name ILIKE $1 AND r.course_code IS NOT NULL AND ${visibleSql()} LIMIT 300)) x`,[like]);
 return new Set(r.rows.map(x=>x.course_code));
}

/** Folders that hold visible files without a course ID, with every ancestor, per source: the uncategorized tree. */
export function uncategorizedTree(){
 return cached('uncat',async()=>{
  const sources=(await db().query("SELECT id,name FROM storage_sources WHERE enabled ORDER BY id")).rows;
  const rows=(await db().query(`SELECT r.source_id,r.folder_rel_path,count(*)::int AS files FROM resources r
   WHERE r.course_code IS NULL AND ${visibleSql()} GROUP BY 1,2`)).rows;
  const tree=new Map<string,Map<string,{files:number;below:number}>>();
  for(const s of sources)tree.set(s.id,new Map([['',{files:0,below:0}]]));
  for(const r of rows){
   const t=tree.get(r.source_id);if(!t)continue;
   const parts=r.folder_rel_path?r.folder_rel_path.split('/'):[];
   for(let i=0;i<=parts.length;i++){const p=parts.slice(0,i).join('/');const n=t.get(p)||{files:0,below:0};n.below+=r.files;if(i===parts.length)n.files+=r.files;t.set(p,n)}
  }
  return {sources:sources.map(s=>({id:s.id,name:s.name,files:tree.get(s.id)!.get('')!.below})),tree};
 });
}

export async function overview(){
 const courses=await courseSummaries(),uncat=await uncategorizedTree();
 const depts=new Map<string,number>();
 for(const c of courses)if(c.department)depts.set(c.department,(depts.get(c.department)||0)+1);
 return {courses:courses.length,verifiedTitles:courses.filter(c=>c.titleVerified).length,
  videos:courses.reduce((a,c)=>a+c.videos,0),documents:courses.reduce((a,c)=>a+c.documents,0),
  departments:[...depts].map(([name,count])=>({name,courses:count})).sort((a,b)=>b.courses-a.courses||a.name.localeCompare(b.name)),
  uncategorizedFiles:uncat.sources.reduce((a,s)=>a+s.files,0),collections:uncat.sources.filter(s=>s.files).length};
}
