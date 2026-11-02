import 'server-only';
import * as cheerio from 'cheerio';
import {db} from '@/lib/db';
import {visibleSql} from '@/lib/campus-catalog';
import {resourceRefs,candidatePaths} from '../scripts/legacy-catalogue/resolve.mjs';

/** Elements that run code, load other documents or submit data. Removed outright. */
const DROP='script,noscript,iframe,frame,frameset,object,embed,applet,base,meta,link,param,input,button,textarea,audio,video,source,track,canvas,template,portal';
const fileUrl=(id:string)=>'/api/files/'+id+'/download?inline=1';
const STYLE=`body{font:15px/1.65 Inter,"Segoe UI",Arial,sans-serif;color:#1f2a3d;margin:24px;max-width:1100px}
h1,h2,h3{color:#5d0f31;line-height:1.3}table{border-collapse:collapse;max-width:100%;margin:12px 0}td,th{border:1px solid #dfe3ea;padding:7px 10px;vertical-align:top;text-align:left}
th{background:#f4f5f9}img{max-width:100%;height:auto}a{color:#8a1d4a}.mrem-missing{color:#8b95a5;text-decoration:line-through dotted}
.mrem-note{font-size:12px;color:#6b7686;border:1px solid #e5e8ee;background:#f8f9fb;border-radius:8px;padding:10px 12px;margin:0 0 18px}`;

type Link={el:cheerio.Cheerio<any>;attr:'href'|'src';paths:string[];external:boolean};

/** Rebuild a legacy archive page as a static document: no scripts, frames, plugins or forms; event handlers and
 * javascript: URLs removed; "Content" dropdowns turned into link lists; links and images resolved against the files
 * indexed beside the page and pointed at the library's own file URLs, and only when students may see that file. */
export async function renderSafeHtml(raw:string,file:{source_id:string;rel_path:string;root_path:string;name:string}){
 const $=cheerio.load(raw);
 const framed=$('frame[src],iframe[src]').map((_,e)=>({ref:$(e).attr('src')||'',label:$(e).attr('title')||$(e).attr('name')||$(e).attr('src')||''})).get();
 $('select').each((_,sel)=>{
  const opts=$(sel).find('option').map((_,o)=>({ref:($(o).attr('value')||'').trim(),label:$(o).text().trim()})).get().filter(o=>o.ref&&o.label);
  const ul=$('<ul></ul>');for(const o of opts)ul.append($('<li></li>').append($('<a></a>').attr('href',o.ref).text(o.label)));
  $(sel).replaceWith(opts.length?ul:'');
 });
 $('form').each((_,f)=>{$(f).replaceWith($(f).contents())});
 $(DROP).remove();
 $('*').each((_,el)=>{
  const attribs=(el as {attribs?:Record<string,string>}).attribs||{};
  for(const [a,v] of Object.entries(attribs)){
   const n=a.toLowerCase();
   if(n.startsWith('on')||['srcset','formaction','target','ping','action','background','lowsrc','dynsrc','xlink:href'].includes(n)||
      (n==='style'&&/expression|javascript:|url\s*\(|@import/i.test(v)))$(el).removeAttr(a);
  }
 });
 if(framed.length){
  const list=$('<ul></ul>');for(const f of framed)list.append($('<li></li>').append($('<a></a>').attr('href',f.ref).text(f.label)));
  // A frameset page has no <body>; give it one inside <html>.
  // (A "<body>" string is dropped by fragment parsing, so rename a new element instead.)
  if(!$('body').length){const b=$('<div></div>');(b[0] as unknown as {name:string}).name='body';if($('html').length)$('html').append(b);else $.root().append(b)}
  $('body').first().prepend(list).prepend('<p class="mrem-note">This page was built from frames. Open each part below.</p>');
 }
 const links:Link[]=[];
 const consider=(el:cheerio.Cheerio<any>,attr:'href'|'src')=>{
  const v=(el.attr(attr)||'').trim();
  if(!v||v.startsWith('#'))return;
  if(/^(https?|ftp|mailto|tel|data|blob|vbscript|about):/i.test(v)&&!/^javascript:/i.test(v)){links.push({el,attr,paths:[],external:true});return}
  // Resource links (also those passed to viewer pages or inside javascript: calls), else the page/image itself.
  const refs=(resourceRefs(v) as {ref?:string;viewer?:string|null}[]).filter((r):r is {ref:string;viewer?:string|null}=>Boolean(r.ref));
  const plain=/^javascript:/i.test(v)?[]:[{ref:v.split(/[?#]/)[0],viewer:null}];
  const paths=new Set<string>();
  for(const r of refs.length?refs:plain)for(const p of candidatePaths({ref:r.ref,viewer:r.viewer??null},file.rel_path,file.root_path).paths)paths.add(p);
  links.push({el,attr,paths:[...paths],external:false});
 };
 $('a[href],area[href]').each((_,e)=>consider($(e),'href'));
 $('img[src]').each((_,e)=>consider($(e),'src'));
 // One indexed lookup per folder: links are matched case-insensitively within the folders they point at.
 const folders=[...new Set(links.flatMap(l=>l.paths.map(p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'')))];
 const found=new Map<string,string>();
 if(folders.length){
  const rows=(await db().query(`SELECT r.id::text,r.rel_path FROM resources r WHERE r.source_id=$1 AND r.folder_rel_path=ANY($2) AND ${visibleSql()}`,
   [file.source_id,folders.slice(0,200)])).rows;
  for(const r of rows)found.set(r.rel_path.toLowerCase(),r.id);
 }
 for(const l of links){
  const id=l.paths.map(p=>found.get(p.toLowerCase())).find(Boolean);
  if(id){l.el.attr(l.attr,fileUrl(id));continue}
  if(l.attr==='src'){l.el.replaceWith(l.el.attr('alt')?$('<span class="mrem-missing"></span>').text(l.el.attr('alt')!):'');continue}
  l.el.replaceWith($('<span class="mrem-missing"></span>').attr('title',l.external?'External link: not opened from the library':'Not available in the library').text(l.el.text()));
 }
 $('head').length||$.root().prepend('<head></head>');
 $('head').prepend(`<meta charset="utf-8"><style>${STYLE}</style>`);
 if(!$('title').length)$('head').append($('<title></title>').text(file.name));
 return '<!doctype html>'+$.html();
}

/** The response for a rendered page: sandboxed (no scripts, no same-origin access) and limited to library images.
 * Under "sandbox" the page has an opaque origin, so 'self' would match nothing: the library's own origin is named instead.
 * No frame-ancestors either, for the same reason. */
export function safeHtmlHeaders(origin:string){
 const o=/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)?origin:"'self'";
 return {'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':`sandbox; default-src 'none'; img-src ${o} data:; style-src 'unsafe-inline'; media-src ${o}; form-action 'none'`};
}
