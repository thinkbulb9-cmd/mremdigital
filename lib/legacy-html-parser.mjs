/** Pure, deliberately conservative parser for legacy NPTEL catalogue index.html pages.
 * No HTML script execution, no external URLs, no original file uploads.
 */
function decode(s) {
 return String(s??'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi,(_,v)=>{
  const k=v.toLowerCase(),chars={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'-',mdash:'—'};
  if(k[0]==='#'){const cp=k[1]==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):' '}
  return chars[k]||' ';
 });
}
export function textFromHtml(s){
 return decode(String(s??'').replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/[\x00-\x1F\x7F]/g,' '))
  .replace(/\s+/g,' ').trim();
}
function safeText(s,max=250){
 const t=textFromHtml(s);
 // The public GitHub export must contain academic catalogue fields, not emails or phone numbers.
 if(t.length<2||t.length>max||/@|https?:\/\/|\b\d{10,}\b/i.test(t))return '';
 return t;
}
const norm=s=>textFromHtml(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const rowCells=s=>[...s.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
export function extractCourseRows(html,semester,disciplineFolder){
 const result=[];
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)){
  let cols=null;
  for(const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
   const cells=rowCells(tr[1]);if(cells.length<4)continue;
   const normalized=cells.map(norm);
   if(normalized.some(s=>['subjectid','courseid','subjectcode','coursecode'].includes(s)) &&
      normalized.some(s=>['subjectname','coursename','coursetitle','subjecttitle'].includes(s))){
    cols={
     code:normalized.findIndex(s=>['subjectid','courseid','subjectcode','coursecode'].includes(s)),
     title:normalized.findIndex(s=>['subjectname','coursename','coursetitle','subjecttitle'].includes(s)),
     discipline:normalized.findIndex(s=>['disciplinename','discipline','department','departmentname'].includes(s)),
     faculty:normalized.findIndex(s=>['coordinators','coordinator','faculty','instructor','instructors'].includes(s)),
     institution:normalized.findIndex(s=>['institute','institution','college'].includes(s))
    };
    continue;
   }
   if(!cols)continue;
   const code=textFromHtml(cells[cols.code]??'').replace(/\s/g,'');
   const title=safeText(cells[cols.title]);
   if(!/^\d{9}$/.test(code)||!title)continue;
   const discipline=cols.discipline<0?'':safeText(cells[cols.discipline],120);
   const instructor=cols.faculty<0?'':safeText(cells[cols.faculty],160);
   const institution=cols.institution<0?'':safeText(cells[cols.institution],160);
   result.push({course_code:code,title,department:discipline||'Unclassified',
    instructor,institution,semester,discipline_folder:disciplineFolder});
  }
 }
 return result;
}
export function extractLectureHints(html,semester){
 const records=[];
 for(const m of html.matchAll(/<(option|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)){
  const attrs=m[2],v=/(?:value|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  if(!v)continue;
  let url=decode(v[1]??v[2]??v[3]??'');
  try{url=decodeURIComponent(url)}catch{continue}
  url=url.replaceAll('\\','/');
  const hit=/(?:^|[=/])([0-9]{9})\/(mod0*(\d+)lec0*(\d+)\.(?:mp4|pdf|m4v|webm))\b/i.exec(url);
  if(!hit)continue;
  let title=safeText(m[3],180);
  if(!title||/^(select|choose|play|download|video|lecture\s*0*\d+|mod0*\d+lec0*\d+(?:\.\w+)?)$/i.test(title))title='';
  records.push({course_code:hit[1],filename:hit[2],module_no:Number(hit[3]),lecture_no:Number(hit[4]),title,semester});
 }
 return records;
}
