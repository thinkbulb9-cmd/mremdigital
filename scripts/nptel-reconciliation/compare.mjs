/** Comparison rules for the NPTEL reconciliation. Pure functions; every result names the rule that produced it. */

const clean=(s)=>String(s??'').replace(/\s+/g,' ').trim();
export const stripNoc=(s)=>clean(s).replace(/^NOC\s*:\s*/i,'');
export const norm=(s)=>stripNoc(s).toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const nonLatin=(s)=>/[^\x00-\x7f]/.test(String(s??''))||/\?{3,}/.test(String(s??''));

/** EXACT_MATCH, PREFIX_DIFFERENCE (only "NOC:"), NORMALIZED_MATCH (case/spacing/punctuation/&), TITLE_CONFLICT, *_MISSING. */
export function titleStatus(a,b,{aMissing='HTML_TITLE_MISSING',bMissing='PDF_TITLE_MISSING'}={}){
 const x=clean(a),y=clean(b);
 if(!x)return {status:aMissing,note:''};
 if(!y)return {status:bMissing,note:''};
 if(x===y)return {status:'EXACT_MATCH',note:''};
 if(stripNoc(x)===stripNoc(y))return {status:'PREFIX_DIFFERENCE',note:'differs only by the "NOC:" prefix'};
 if(norm(x)===norm(y))return {status:'NORMALIZED_MATCH',note:'differs only in case, spacing, punctuation or &/and'+(/^noc\s*:/i.test(x)!==/^noc\s*:/i.test(y)?' and "NOC:"':'')};
 const nx=norm(x),ny=norm(y);
 if(nx&&ny&&(ny.startsWith(nx)||nx.startsWith(ny)))
  return {status:'TITLE_CONFLICT',note:'one title is a shorter prefix of the other (possible truncation at '+Math.min(stripNoc(x).length,stripNoc(y).length)+' characters)'};
 return {status:'TITLE_CONFLICT',note:nonLatin(x)||nonLatin(y)?'non-Latin text; compare visually against the PDF':''};
}
export const titlesAgree=(s)=>['EXACT_MATCH','PREFIX_DIFFERENCE','NORMALIZED_MATCH'].includes(s);

/** People lists are compared by surname, so "Prof. P. K. Garg" and "Prof. Pradeep Kumar Garg" agree;
 * full-name differences are still reported as a note. */
export function people(s){
 return String(s??'').replace(/<br\s*\/?>/gi,',').split(/,|&|;|\b[Aa]nd\b|(?=(?:Prof|Dr|Mr|Ms|Mrs|Shri|Smt)\b)/)
  .map(p=>p.replace(/\b(?:prof|dr|mr|ms|mrs|shri|smt)\b\.?/gi,' ').toLowerCase().replace(/[^\p{L}]+/gu,' ').split(' ').filter(w=>w.length>1))
  .filter(w=>w.length).map(w=>({full:w.join(' '),surname:w[w.length-1]}));
}
export function peopleStatus(a,b){
 const A=people(a),B=people(b);
 if(!A.length||!B.length)return {status:'MISSING',note:''};
 const sa=new Set(A.map(p=>p.surname)),sb=new Set(B.map(p=>p.surname));
 const overlap=[...sa].filter(x=>sb.has(x));
 if(!overlap.length)return {status:'DIFFERS',note:'no coordinator surname in common'};
 const fa=new Set(A.map(p=>p.full)),fb=new Set(B.map(p=>p.full));
 const same=fa.size===fb.size&&[...fa].every(x=>fb.has(x));
 if(same)return {status:'MATCH',note:''};
 const missing=[...sa].filter(x=>!sb.has(x)).length+[...sb].filter(x=>!sa.has(x)).length;
 return {status:'MATCH',note:missing?'coordinator lists differ in who is named':'coordinator names differ in spelling or initials'};
}
export const instNorm=(s)=>clean(s).toLowerCase().replace(/\s*\(\s*/g,'(').replace(/\s*\)\s*/g,')').replace(/[^a-z0-9()]+/g,' ').trim();

/** Lecture titles for local video files, accepted only through an explicit identity, never by list position.
 * HIGH: the official downloads list names the same MP4 file for this course ID.
 * MEDIUM: the official outline has this module (Week/Module N) and this lecture number, and the lecture title's own
 *         number (when it has one) agrees. Used only when the official list publishes no file names. */
export function matchLectures(files,official){
 const byFile=new Map();
 for(const l of official?.downloads?.lessons||[]){
  const base=String(l.url||'').split(/[?#]/)[0].split('/').pop().toLowerCase();
  if(base)byFile.set(base,l);
 }
 const units=new Map();
 for(const u of official?.outline?.units||[]){
  const m=/^(?:week|module|unit)\s*[-:]?\s*0*(\d+)\b/i.exec(clean(u.name));
  if(m&&!units.has(Number(m[1])))units.set(Number(m[1]),u);
 }
 const out=[];
 for(const f of files){
  const hit=byFile.get(String(f.name).toLowerCase());
  if(hit){out.push({...f,title:clean(hit.title),confidence:'HIGH',evidence:'official downloads list names file '+f.name+' (lesson '+hit.lesson_id+')',official_url:hit.url});continue}
  if(byFile.size||f.module_no==null||f.lecture_no==null)continue;
  const u=units.get(Number(f.module_no));
  const lesson=u?.lessons.find(l=>Number(l.id)===Number(f.lecture_no));
  if(!lesson)continue;
  const own=/^(?:lecture|lec|l)\s*[-.:]?\s*0*(\d+)\b/i.exec(clean(lesson.name));
  if(own&&Number(own[1])!==Number(f.lecture_no))continue;
  out.push({...f,title:clean(lesson.name),confidence:'MEDIUM',evidence:'official outline '+clean(u.name)+' lesson '+lesson.id+' = module '+f.module_no+' lecture '+f.lecture_no+' (no file names published)',official_url:''});
 }
 return out;
}
