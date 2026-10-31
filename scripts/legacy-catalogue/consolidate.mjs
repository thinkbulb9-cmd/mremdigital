/** Combines per-semester catalogue records into catalogue updates and conflict rows. Pure functions.
 * Previously verified metadata from any other source is never overwritten; differences become conflicts.
 */
import {compareKey,displayCase,text} from './parse.mjs';

export const LEGACY_SOURCE='legacy-nptel-html-catalogue';
const REPLACEABLE_SOURCES=new Set(['unverified','nptel-discipline-prefix-inferred',LEGACY_SOURCE]);
const cap=(s,n)=>String(s??'').slice(0,n);

/** Most common display form per comparison key; ties go to the latest semester. */
function pick(records,field){
 const groups=new Map();
 for(const r of records){
  const v=text(r[field]);if(!v)continue;
  const k=compareKey(v),g=groups.get(k)||{count:0,order:-2,value:v};
  g.count++;if(r.order>g.order){g.order=r.order;g.value=v}
  groups.set(k,g);
 }
 const sorted=[...groups.values()].sort((a,b)=>b.count-a.count||b.order-a.order);
 return {value:sorted[0]?.value||'',variants:sorted.map(g=>g.value)};
}
/** Department display names are unified across courses so the student sidebar has one entry per discipline. */
export function departmentNames(records){
 const byKey=new Map();
 for(const r of records){
  const v=displayCase(r.discipline);if(!v)continue;
  const k=compareKey(v),m=byKey.get(k)||new Map();
  m.set(v,(m.get(v)||0)+1);byKey.set(k,m);
 }
 const out=new Map();
 for(const [k,m] of byKey)out.set(k,[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0]);
 return out;
}

/** records: extracted rows (recognized roots only) with order and inventory_files.
 * existing: Map course_code -> course_catalog row. Returns {courses, conflicts}. */
export function planCourses(records,existing){
 const byCode=new Map(),depts=departmentNames(records),courses=[],conflicts=[];
 for(const r of records){if(!byCode.has(r.course_code))byCode.set(r.course_code,[]);byCode.get(r.course_code).push(r)}
 for(const [code,rows] of byCode){
  const title=pick(rows,'title'),disc=pick(rows,'discipline'),coord=pick(rows,'coordinators'),inst=pick(rows,'institution');
  const files=rows.reduce((n,r)=>n+(r.inventory_files||0),0);
  const latest=[...rows].sort((a,b)=>b.order-a.order)[0];
  const plan={course_code:code,title:displayCase(title.value),department:depts.get(compareKey(displayCase(disc.value)))||'Unclassified',
   instructor:coord.value,institution:inst.value,semesters:[...new Set(rows.map(r=>r.semester_root))].sort(),
   sources:[...new Set(rows.map(r=>r.source_rel_path))],inventory_files:files,
   confidence:title.variants.length===1&&disc.variants.length<=1?'high':'medium',action:'',note:''};
  const conflict=(type,field,existingValue,extracted,resolution)=>conflicts.push({conflict_type:type,course_code:code,
   semester_root:plan.semesters.join(' | '),field,existing_value:cap(existingValue,500),extracted_value:cap(extracted,500),
   source_rel_path:cap(latest.source_rel_path,500),resolution});
  if(title.variants.length>1)conflict('title-differs-between-semesters','title','',title.variants.join(' || '),'latest-most-common-used-not-auto-verified');
  if(disc.variants.length>1)conflict('discipline-differs-between-semesters','department','',disc.variants.join(' || '),'most-common-used');
  if(coord.variants.length>1)conflict('coordinators-differ-between-semesters','instructor','',coord.variants.join(' || '),'latest-most-common-used');
  if(!files){plan.action='skip-no-indexed-files';courses.push(plan);continue}
  const cur=existing.get(code);
  if(!cur){plan.action='insert';courses.push(plan);continue}
  const placeholder=!text(cur.title)||text(cur.title)==='Course '+code;
  if(REPLACEABLE_SOURCES.has(cur.title_source)||(placeholder&&!cur.verified)){plan.action='update';courses.push(plan);continue}
  // Verified or human-reviewed metadata: keep it, fill only empty fields, report every disagreement.
  const diffs=[['title',cur.title,plan.title],['department',cur.department,plan.department],
   ['instructor',cur.instructor,plan.instructor],['institution',cur.institution,plan.institution]]
   .filter(([,a,b])=>text(a)&&text(b)&&compareKey(a)!==compareKey(b));
  for(const [field,a,b] of diffs)conflict('differs-from-existing-'+(cur.verified?'verified':'reviewed')+'-metadata',field,a,b,'existing-preserved');
  plan.fill={instructor:!text(cur.instructor)&&plan.instructor?plan.instructor:null,
   institution:!text(cur.institution)&&plan.institution?plan.institution:null};
  plan.action=diffs.length?'preserve-existing-conflict':'confirm-existing';
  plan.note=diffs.map(d=>d[0]).join(',');
  courses.push(plan);
 }
 return {courses,conflicts};
}

/** links: matched links with label titles. Chooses one title per exact file and one per course lecture
 * only where every semester agrees. existingLectures: Map 'code|m|l' -> course_lectures row. */
export function planLectures(links,existingLectures){
 const perFile=new Map(),conflicts=[];
 for(const l of links){
  if(!l.title)continue;
  const k=l.resource_id;if(!perFile.has(k))perFile.set(k,[]);perFile.get(k).push(l);
 }
 const fileTitles=[];
 for(const [id,rows] of perFile){
  const keys=new Set(rows.map(r=>compareKey(r.title)));
  const r=rows[0];
  if(keys.size>1){
   conflicts.push({conflict_type:'lecture-title-differs-for-same-file',course_code:r.course_code,semester_root:r.semester_root,
    field:'lecture_title:'+r.module_no+'/'+r.lecture_no,existing_value:'',extracted_value:cap(rows.map(x=>x.title).join(' || '),500),
    source_rel_path:cap(r.source_rel_path,500),resolution:'no-title-shown'});
   continue;
  }
  fileTitles.push({resource_id:id,course_code:r.course_code,semester_root:r.semester_root,module_no:r.module_no,
   lecture_no:r.lecture_no,title:r.title,source_rel_path:r.source_rel_path,
   confidence:rows.every(x=>x.confidence==='high')?'high':'medium',resolved_rel_path:r.resolved_rel_path});
 }
 const perLecture=new Map();
 for(const t of fileTitles){
  if(t.module_no===null||t.lecture_no===null)continue;
  const k=t.course_code+'|'+t.module_no+'|'+t.lecture_no;
  if(!perLecture.has(k))perLecture.set(k,[]);perLecture.get(k).push(t);
 }
 const lectures=[];
 for(const [k,rows] of perLecture){
  const keys=new Set(rows.map(r=>compareKey(r.title))),r=rows[0];
  if(keys.size>1)continue; // semester-specific titles stay attached to their own files only
  const cur=existingLectures.get(k);
  if(cur&&cur.title_source!==LEGACY_SOURCE){
   if(compareKey(cur.title)!==compareKey(r.title))conflicts.push({conflict_type:'lecture-title-differs-from-existing',
    course_code:r.course_code,semester_root:rows.map(x=>x.semester_root).join(' | '),field:'lecture_title:'+r.module_no+'/'+r.lecture_no,
    existing_value:cap(cur.title,500),extracted_value:cap(r.title,500),source_rel_path:cap(r.source_rel_path,500),resolution:'existing-preserved'});
   continue;
  }
  lectures.push({course_code:r.course_code,module_no:r.module_no,lecture_no:r.lecture_no,title:r.title,
   verified:rows.every(x=>x.confidence==='high')});
 }
 return {fileTitles,lectures,conflicts};
}
