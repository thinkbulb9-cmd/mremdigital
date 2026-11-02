/** Comparison rules for the NPTEL reconciliation. Pure functions; every result names the rule that produced it. */

const clean=(s)=>String(s??'').replace(/\s+/g,' ').trim();
export const stripNoc=(s)=>clean(s).replace(/^NOC\s*:\s*/i,'');
const fold=(s)=>String(s??'').normalize('NFKD').replace(/\p{M}/gu,'');
export const norm=(s)=>fold(stripNoc(s)).toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const nonLatin=(s)=>/[^\x00-\x7f]/.test(String(s??''))||/\?{3,}/.test(String(s??''));
/** Indian-language script, or "??" left where an encoding lost characters. */
const OTHER_SCRIPT=/[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}]|\?{2,}/u;
const latinPart=(s)=>norm(String(s).replace(new RegExp(OTHER_SCRIPT.source,'gu'),' '));
/** Local catalogue titles are cut off at 63-64 characters; a shorter prefix at least this long is that cut, not another title. */
export const TRUNCATED_AT=60;
/** Text that PDF extraction or catalogue editors attach to a title: a sponsor note, an institute name run into the
 * last word ("RoboticsIITM"), or an institute suffix (" - IITM"). */
const EXTRA=[/\s*\(\s*course sponsored by[^)]*\)\s*$/i,/(?<=[a-z)])(?:IIITM?|IITM?|IISc|IISER|NIT|IIM)(?=[\sA-Z]|$).*$/,/\s+[-–]\s*(?:IIITM?|IITM?|IISc|IISER|NIT)\b[\w ]*$/];
export const stripExtras=(s)=>EXTRA.reduce((t,re)=>t.replace(re,''),clean(s));

/** EXACT_MATCH, PREFIX_DIFFERENCE (only "NOC:"), NORMALIZED_MATCH (case/spacing/punctuation/&/accents, or attached
 * extraction text), TRUNCATED_MATCH (shorter title cut off at TRUNCATED_AT+ characters), SUBTITLE_MATCH (one title adds a
 * series or college name before ":"), NON_LATIN_NOT_COMPARED (Hindi/Tamil text or lost characters), TITLE_CONFLICT, *_MISSING. */
export function titleStatus(a,b,{aMissing='HTML_TITLE_MISSING',bMissing='PDF_TITLE_MISSING'}={}){
 const x=clean(a),y=clean(b);
 if(!x)return {status:aMissing,note:''};
 if(!y)return {status:bMissing,note:''};
 if(x===y)return {status:'EXACT_MATCH',note:''};
 if(stripNoc(x)===stripNoc(y))return {status:'PREFIX_DIFFERENCE',note:'differs only by the "NOC:" prefix'};
 if(norm(x)===norm(y))return {status:'NORMALIZED_MATCH',note:'differs only in case, spacing, punctuation, accents or &/and'+(/^noc\s*:/i.test(x)!==/^noc\s*:/i.test(y)?' and "NOC:"':'')};
 if(norm(stripExtras(x))===norm(stripExtras(y)))return {status:'NORMALIZED_MATCH',note:'same title once attached text is removed (sponsor note or institute name)'};
 if(OTHER_SCRIPT.test(x)||OTHER_SCRIPT.test(y)){
  const lx=latinPart(x),ly=latinPart(y);
  if(lx&&ly&&lx===ly)return {status:'NORMALIZED_MATCH',note:'English text matches; Hindi/Tamil text not compared'};
  return {status:'NON_LATIN_NOT_COMPARED',note:'Hindi/Tamil text or lost characters; use the nptel.ac.in title'};
 }
 const nx=norm(x),ny=norm(y);
 if(nx&&ny&&(ny.startsWith(nx)||nx.startsWith(ny))){
  const n=Math.min(stripNoc(x).length,stripNoc(y).length);
  if(n>=TRUNCATED_AT)return {status:'TRUNCATED_MATCH',note:'the shorter title is cut off at '+n+' characters; the longer one is complete'};
  return {status:'TITLE_CONFLICT',note:'one title is a shorter prefix of the other ('+n+' characters, too short to be a cut-off)'};
 }
 const tail=(s)=>{const t=stripNoc(s),i=t.lastIndexOf(':');return i>0?norm(t.slice(i+1)):''};
 if((tail(x)&&tail(x)===ny&&!stripNoc(y).includes(':'))||(tail(y)&&tail(y)===nx&&!stripNoc(x).includes(':')))
  return {status:'SUBTITLE_MATCH',note:'one title adds a series or college name before ":"'};
 return {status:'TITLE_CONFLICT',note:''};
}
export const titlesAgree=(s)=>['EXACT_MATCH','PREFIX_DIFFERENCE','NORMALIZED_MATCH','TRUNCATED_MATCH','SUBTITLE_MATCH'].includes(s);

/** Words that stand in for names ("Multifaculty", "Prof. X & Team"). */
const PLACEHOLDER=new Set(['multifaculty','multi','faculty','multidisciplinary','team','various','others']);
/** Given names too common to show two lists name the same person. */
const COMMON_NAME=new Set(['kumar','kumari','chandra','prasad','devi']);
const lev=(a,b)=>{let row=[...Array(b.length+1).keys()];
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}
 return row[b.length]};
/** Same name with a one-letter spelling difference (two for long names): Datta/Dutta, Bannerjee/Banerjee. */
const sameName=(a,b)=>{const n=Math.min(a.length,b.length);return a===b||(n>=5&&lev(a,b)<=(n>=10?2:1))};

/** People lists are compared by surname, so "Prof. P. K. Garg" and "Prof. Pradeep Kumar Garg" agree;
 * full-name differences are still reported as a note. */
export function people(s){
 return String(s??'').replace(/<br\s*\/?>/gi,',').replace(/\([^)]*\)/g,' ').replace(/(\p{Ll})(\p{Lu})/gu,'$1 $2')
  .split(/,|&|;|\n|\/|\b[Aa]nd\b|(?=(?:Prof|Dr|Mr|Ms|Mrs|Shri|Smt)\b)/)
  .map(p=>p.replace(/\b(?:prof|dr|mr|ms|mrs|shri|smt)\b\.?/gi,' ').toLowerCase().replace(/[^\p{L}]+/gu,' ').split(' ').filter(w=>w.length>1&&!PLACEHOLDER.has(w)))
  .filter(w=>w.length).map(w=>({full:w.join(' '),surname:w[w.length-1]}));
}
export function peopleStatus(a,b){
 const A=people(a),B=people(b);
 if(!A.length||!B.length){
  const placeholder=(String(a??'').trim()&&!A.length)||(String(b??'').trim()&&!B.length);
  return {status:'MISSING',note:placeholder?'a placeholder such as "Multifaculty" is given instead of names':''};
 }
 const fa=new Set(A.map(p=>p.full)),fb=new Set(B.map(p=>p.full));
 if(fa.size===fb.size&&[...fa].every(x=>fb.has(x)))return {status:'MATCH',note:''};
 const sa=[...new Set(A.map(p=>p.surname))],sb=[...new Set(B.map(p=>p.surname))];
 if(!sa.some(x=>!COMMON_NAME.has(x)&&sb.some(y=>sameName(x,y)))){
  // No distinctive surname in common: "Prof. Rajesh" / "Prof. Rajesh Kumar", "Srinivas Talabatulla" / "T. Srinivas".
  const ta=new Set(A.flatMap(p=>p.full.split(' '))),tb=[...new Set(B.flatMap(p=>p.full.split(' ')))];
  const shared=[...ta].filter(x=>x.length>=4&&!COMMON_NAME.has(x)&&tb.some(y=>y.length>=4&&sameName(x,y)));
  if(shared.length)return {status:'MATCH',note:'names share "'+shared.join(', ')+'" but are written differently; check the full name'};
  return {status:'DIFFERS',note:'no coordinator surname in common'};
 }
 const missing=sa.filter(x=>!sb.some(y=>sameName(x,y))).length+sb.filter(y=>!sa.some(x=>sameName(x,y))).length;
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
