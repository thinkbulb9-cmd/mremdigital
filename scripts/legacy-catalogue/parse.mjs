/** Static parsing of legacy NPTEL catalogue pages. Read-only and offline:
 * page scripts are never executed; inline JavaScript is only scanned for quoted string literals.
 */
import * as cheerio from 'cheerio';

const COLUMNS={
 code:/^(subject|course)\s?(id|code|no|number)$/,
 title:/^(subject|course)\s?(name|title)$|^title$/,
 discipline:/^discipline(\s?name)?$|^department(\s?name)?$/,
 coordinators:/^(course\s)?(coordinators?|faculty|instructors?|professors?)(\s?names?)?$/,
 type:/^(course\s)?type$/,
 institution:/^institut(e|ion)(\s?name)?$/,
 content:/^(course\s)?(contents?|materials?)$/
};
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const SMALL=new Set(['a','an','and','of','in','on','for','to','the','with','by','at','or','via','from']);

export function clean(s){return String(s??'').replace(/[ ​]/g,' ').replace(/\s+/g,' ').trim()}
/** Cheerio decodes one level of entities; legacy pages are sometimes double-escaped (&amp;amp;). */
export function decodeEntities(s){
 let v=String(s??'');
 for(let i=0;i<2&&/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(v);i++)
  v=v.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi,(m,e)=>e[0]==='#'?
   String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITIES[e.toLowerCase()]??m);
 return v;
}
export const text=(s)=>clean(decodeEntities(s));
/** Later semesters prefix some subject names with "NOC:" (e.g. "NOC:Environmental Biotechnology"); the course is the same. */
export const courseTitle=(s)=>text(s).replace(/^NOC\s*:\s*/i,'');
/** Comparison key: case, spacing, punctuation and "&"/"and" differences are ignored. */
export const compareKey=(s)=>text(s).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
/** Title-case only text that is entirely upper or lower case; mixed-case source text is kept as written. */
export function displayCase(s){
 const v=text(s),letters=v.replace(/[^A-Za-z]/g,'');
 if(!letters||(letters!==letters.toUpperCase()&&letters!==letters.toLowerCase()))return v;
 const upper=letters===letters.toUpperCase();
 return v.replace(/[A-Za-z][A-Za-z'.]*/g,(w,i)=>{
  const lw=w.toLowerCase();
  if(i>0&&SMALL.has(lw))return lw;
  if(upper&&w.length<=3)return w; // short all-caps words are usually acronyms (IIT, CFD, DSP)
  return lw[0].toUpperCase()+lw.slice(1);
 });
}
export function headerKey(cell){
 const h=text(cell).toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
 for(const [k,re] of Object.entries(COLUMNS))if(re.test(h))return k;
 return null;
}
export function decodeHtmlBytes(buf){
 const head=buf.subarray(0,4096).toString('latin1');
 let enc=(/charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1]||'utf-8').toLowerCase();
 if(['iso-8859-1','latin1','us-ascii','ascii'].includes(enc))enc='windows-1252';
 try{return new TextDecoder(enc,{fatal:enc==='utf-8'}).decode(buf)}
 catch{return new TextDecoder('windows-1252').decode(buf)}
}

const LITERAL=/(["'])((?:\\.|(?!\1)[^\\\r\n])*)\1/g;
export function stringLiterals(js){
 const out=[];
 for(const m of String(js||'').matchAll(LITERAL))out.push(m[2].replace(/\\(.)/g,'$1'));
 return out;
}
/** Static references in a subtree: dropdown options, hyperlinks, embedded sources and inline-handler literals. */
function linksIn($,root){
 const out=[];
 $(root).find('option').each((_,o)=>{
  const value=$(o).attr('value')??$(o).text(),select=$(o).closest('select'),form=select.closest('form');
  out.push({value,label:text($(o).text()),via:'option',param:select.attr('name')||'',
   viewer:form.attr('action')||'',handler:select.attr('onchange')||''});
 });
 $(root).find('a[href],area[href]').each((_,a)=>{out.push({value:$(a).attr('href'),label:text($(a).text()),via:'href'})});
 $(root).find('iframe[src],frame[src],embed[src],source[src],video[src]').each((_,e)=>{out.push({value:$(e).attr('src'),label:'',via:'src'})});
 $(root).find('[onclick]').each((_,e)=>{
  for(const v of stringLiterals($(e).attr('onclick')))out.push({value:v,label:text($(e).text()),via:'inline-js'});
 });
 return out.filter(l=>clean(l.value)&&clean(l.value)!=='#'); // "#" is the dropdown's "Select" placeholder
}
function rowsOf($,table){
 return $(table).children('thead,tbody,tfoot').children('tr').add($(table).children('tr')).toArray();
}
/** Cells keyed by their visual column start, so colspan headers do not shift later columns. */
function cellsOf($,tr){
 let col=0;const cells=[];
 $(tr).children('td,th').each((_,c)=>{cells.push({col,el:c});col+=Math.max(1,parseInt($(c).attr('colspan')||'1',10)||1)});
 return cells;
}
function scriptLinks($){
 const out=[];
 $('script').each((_,s)=>{
  const js=$(s).text();
  for(const m of js.matchAll(/new\s+Option\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*,\s*(["'])((?:\\.|(?!\3).)*)\3/g))
   out.push({value:m[4],label:text(m[2]),via:'script-option'});
  for(const v of stringLiterals(js))out.push({value:v,label:'',via:'script-literal'});
 });
 return out;
}
/** Returns course rows from any table whose header names identify a subject catalogue, plus page-level links. */
export function parseCatalogueHtml(html){
 const $=cheerio.load(html,{scriptingEnabled:false});
 const courses=[],tables=[];let skippedRows=0;
 $('table').each((_,table)=>{
  const rows=rowsOf($,table);
  let headerAt=-1,cols=null;
  for(let i=0;i<Math.min(rows.length,10)&&headerAt<0;i++){
   const map={};
   for(const c of cellsOf($,rows[i])){const k=headerKey($(c.el).text());if(k&&map[k]===undefined)map[k]=c.col}
   if(map.code!==undefined&&map.title!==undefined){headerAt=i;cols=map}
  }
  if(headerAt<0)return;
  tables.push(Object.keys(cols));
  for(const tr of rows.slice(headerAt+1)){
   const byCol=new Map(cellsOf($,tr).map(c=>[c.col,c.el]));
   const cell=(k)=>cols[k]===undefined?null:byCol.get(cols[k])||null;
   const code=/(?:^|\D)(\d{9})(?!\d)/.exec(text($(cell('code')).text()))?.[1];
   const title=courseTitle($(cell('title')).text());
   if(!code||!title){if(clean($(tr).text()))skippedRows++;continue}
   courses.push({course_code:code,title,discipline:text($(cell('discipline')).text()),
    coordinators:text($(cell('coordinators')).text()),course_type:text($(cell('type')).text()),
    institution:text($(cell('institution')).text()),links:cell('content')?linksIn($,cell('content')):linksIn($,tr)});
  }
 });
 return {title:text($('title').text()),tables,courses,skippedRows,
  pageLinks:[...linksIn($,$.root()),...scriptLinks($)]};
}
/** Path prefixes a viewer page (e.g. displayvideo.html) puts in front of its query parameter, such as "videos/"+type1. */
export function viewerPrefixes(html){
 const $=cheerio.load(html,{scriptingEnabled:false}),found=new Set();
 const js=$('script').map((_,s)=>$(s).text()).get().join('\n');
 for(const m of js.matchAll(/(["'])([^"'\r\n<>]*\/)\1\s*\+/g)){
  const p=m[2];
  if(!/^[a-z]+:/i.test(p)&&!p.startsWith('//')&&p.length<200)found.add(p);
 }
 return [...found];
}

export function parseCsv(src){
 const rows=[];let row=[],field='',q=false;
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(q){if(ch==='"'){if(src[i+1]==='"'){field+='"';i++}else q=false}else field+=ch;continue}
  if(ch==='"')q=true;else if(ch===','){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field=''}
  else field+=ch;
 }
 if(field||row.length){row.push(field);rows.push(row)}
 return rows;
}
/** Same header-name detection for CSV exports of the catalogue. */
export function parseCatalogueCsv(src){
 const rows=parseCsv(src.replace(/^﻿/,''));
 const at=rows.slice(0,10).findIndex(r=>{const k=r.map(headerKey);return k.includes('code')&&k.includes('title')});
 if(at<0)return {tables:[],courses:[],skippedRows:0,pageLinks:[]};
 const cols={};rows[at].forEach((h,i)=>{const k=headerKey(h);if(k&&cols[k]===undefined)cols[k]=i});
 const courses=[];let skippedRows=0;
 for(const r of rows.slice(at+1)){
  const get=(k)=>cols[k]===undefined?'':text(r[cols[k]]);
  const code=/(?:^|\D)(\d{9})(?!\d)/.exec(get('code'))?.[1],title=courseTitle(get('title'));
  if(!code||!title){if(r.some(c=>clean(c)))skippedRows++;continue}
  courses.push({course_code:code,title,discipline:get('discipline'),coordinators:get('coordinators'),
   course_type:get('type'),institution:get('institution'),links:get('content')?[{value:get('content'),label:'',via:'csv'}]:[]});
 }
 return {tables:[Object.keys(cols)],courses,skippedRows,pageLinks:[]};
}

const GENERIC_LABEL=/^(?:(?:mod(?:ule)?|m)\s*[-_.:]?\s*\d+\s*[-_.:/,]*\s*(?:lec(?:ture)?|l)\s*[-_.:]?\s*\d+|(?:lec(?:ture)?|lesson|video|part|session|week|unit|module|chapter|topic|class|day|file|pdf|download|play|view|click here|open)\s*[-_.:#]?\s*\d*|\d+|-+.*-+|select.*|choose.*|please select.*|video lectures?|lecture notes?|pdf|videos?)$/i;
// Seen on the Web_courses pages: links named after the kind of material, a figure/equation, or the act of clicking.
const MATERIAL_LABEL=/^(?:(?:course\s+|learning\s+)?objectives?|(?:teacher|student)s?\s+slides(?:\s*\d+)?|slides(?:\s*\d+)?|(?:lesson|lecture|module|unit)\s*\d+(?:\s*(?:and|&|-)\s*\d+)?\s*(?:slides|notes|pdf|ppt|video|questions?|objectives?|summary)?|sample\s+questions|question\s+bank|multiple\s+choice\s+questions|glossary|references?(?:\s+and\s+resources)?|further\s+references|refrences|summary|syllabus|assignments?(?:\s*\d+)?|quiz(?:zes)?|answers?|solutions?|downloads?|notes|transcripts?|motivation|highlights(?:\s*(?:and|&)\s*motivation)?|worked\s+examples|test\s+(?:problems|examples)|problems\s+and\s+solutions|case\s+(?:study|studies|tools)(?:\s+[ivx\d]+)?|mini\s+projects?|suggestions\s+for\s+mini\s+projects|pointers|web\s+pages|start\s+course|course\s+contents|application\s*\d*|applications\s*\d*|schematic\s*\d*|hyperlink[-\s]*\d*|(?:fig(?:ure)?|eqns?|equations?|table)\.?\s*\(?\s*[\d.]+.*|\(?\s*(?:fig|eqn|table)\b.*|.*click\s+here.*|download\b.*|open\b.*|here|original\s+profile|[\w.-]+\.(?:pdf|ppt|pptx|doc|docx|mp4|html?))$/i;
/** True only for a label that says something beyond module/lecture numbering or the filename itself. */
export function meaningfulLabel(label,filename){
 const l=text(label);
 if(l.length<4||l.length>300||!/[a-z]{3}/i.test(l))return false;
 const base=String(filename||'').replace(/\.[a-z0-9]+$/i,'').toLowerCase();
 if(base&&[base,String(filename).toLowerCase()].includes(l.toLowerCase()))return false;
 return !GENERIC_LABEL.test(l)&&!MATERIAL_LABEL.test(l);
}
