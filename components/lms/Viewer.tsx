'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,Download,File as FileIcon,Loader2} from 'lucide-react';
import {DOWNLOADABLE,sizeOf} from '@/lib/format';

export type ViewerResource={id:string;name:string;ext:string;size:number;title:string};
const url=(id:string,inline=false)=>'/api/files/'+id+'/download'+(inline?'?inline=1':'');
const ext=(r:ViewerResource)=>r.ext.toLowerCase();

/** Shows one resource in the page: video player, PDF viewer, rendered (sanitized, sandboxed) HTML, text or image.
 * Anything else gets its real file details and, when permitted, a download. Nothing opens in a popup or new tab. */
export default function Viewer({r}:{r:ViewerResource}){
 const e=ext(r);
 const [failed,setFailed]=useState('');
 const [text,setText]=useState<{body?:string;error?:string}|null>(null);
 const isText=['.txt','.md'].includes(e);
 useEffect(()=>{setFailed('');setText(null);if(!isText)return;
  if(r.size>2*1048576){setText({error:'This text file is too large to show here. Use Download to open it.'});return}
  const c=new AbortController();
  fetch(url(r.id,true),{signal:c.signal}).then(async x=>{if(!x.ok)throw Error(x.status===404?'This file is not available on the library storage right now.':'Could not open the file (HTTP '+x.status+').');setText({body:await x.text()})})
   .catch(err=>{if(err.name!=='AbortError')setText({error:err.message})});
  return()=>c.abort();
 },[r.id,r.size,isText]);
 if(failed)return <div className="viewer"><div className="state"><AlertTriangle size={26}/><strong>This video could not be played</strong>{failed}</div></div>;
 if(['.mp4','.m4v','.webm','.mov'].includes(e))return <div className="viewer"><video key={r.id} controls playsInline preload="metadata" src={url(r.id,true)} aria-label={r.title}
  onError={()=>setFailed('The video is not available on the library storage right now, or this browser cannot play its format.')}/></div>;
 if(e==='.pdf')return <div className="viewer light"><iframe key={r.id} title={r.title} src={url(r.id,true)}/></div>;
 // Legacy pages are rebuilt server-side without scripts or event handlers and served with "Content-Security-Policy:
 // sandbox", which gives them an opaque origin with scripts, forms and popups disabled. (A sandbox attribute on the frame
 // would add nothing to that, and some embedded browsers do not paint attribute-sandboxed frames at all.)
 if(e==='.html'||e==='.htm')return <div className="viewer light"><iframe key={r.id} title={r.title} referrerPolicy="no-referrer" src={url(r.id,true)}/></div>;
 if(['.png','.jpg','.jpeg','.webp','.gif'].includes(e))return <div className="viewer light"><img src={url(r.id,true)} alt={r.title}/></div>;
 if(isText)return <div className="viewer light">{!text?<div className="state"><Loader2 size={24}/><strong>Opening…</strong></div>:
  text.error?<div className="state"><AlertTriangle size={24}/><strong>Could not open this file</strong>{text.error}</div>:<pre>{text.body}</pre>}</div>;
 return <div className="viewer light"><div className="state"><FileIcon size={26}/><strong>No preview for {e.replace('.','').toUpperCase()||'this'} files</strong>
  {sizeOf(r.size)}{DOWNLOADABLE.includes(e)?' · use Download to open it on your computer.':' · this file type is not offered for download.'}</div></div>;
}

export function DownloadLink({r}:{r:ViewerResource}){
 return DOWNLOADABLE.includes(ext(r))?<a className="btn btn-ghost" href={url(r.id)} download><Download size={16}/> Download</a>:null;
}
