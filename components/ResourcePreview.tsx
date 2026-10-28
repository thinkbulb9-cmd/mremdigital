'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, Download, ExternalLink, FileText, Play, X } from 'lucide-react';

type Resource = { id:string; name:string; ext:string; kind:string; course:string; department:string };
export default function ResourcePreview({file,previewMode,onClose}:{file:Resource;previewMode:boolean;onClose:()=>void}){
 const [failed,setFailed]=useState(false);
 const type=file.ext.toLowerCase();
 const video=['.mp4','.m4v','.webm'].includes(type);
 const pdf=type==='.pdf';
 const text=['.txt','.md'].includes(type);
 const image=['.png','.jpg','.jpeg','.webp'].includes(type);
 const endpoint=`/api/files/${encodeURIComponent(file.id)}/download`;
 const previewUrl=endpoint+'?inline=1';
 const downloadUrl=previewMode&&video?'/demo/mrem-preview.mp4':endpoint;
 useEffect(()=>{
  function escape(e:KeyboardEvent){ if(e.key==='Escape')onClose(); }
  document.addEventListener('keydown',escape);
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  return ()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=old;};
 },[onClose]);
 return <div className="mediaOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="mediaDialog" role="dialog" aria-modal="true" aria-label={`Preview ${file.name}`}>
   <header className="mediaHeader">
    <div className="mediaHeaderText"><span>{video?<Play size={17}/>:<FileText size={17}/>} {video?'Video preview':'Document preview'}</span><h3 title={file.name}>{file.name}</h3><small>{file.department} / {file.course}</small></div>
    <button type="button" className="mediaClose" onClick={onClose} aria-label="Close preview"><X size={20}/></button>
   </header>
   <div className="mediaContent">
    {failed?<div className="mediaFallback"><AlertCircle size={34}/><strong>Preview unavailable</strong>
      <p>This file may use an unsupported codec or browser format. You can still download the original file.</p></div>
    :video?<video key={file.id} src={previewUrl} controls playsInline preload="metadata" onError={()=>setFailed(true)} aria-label={file.name}/>
    :pdf||text?<iframe key={file.id} title={'Preview '+file.name} src={previewUrl} onError={()=>setFailed(true)}/>
    :image?<img src={previewUrl} alt={file.name} onError={()=>setFailed(true)}/>
    :<div className="mediaFallback"><FileText size={36}/><strong>No in-browser preview</strong><p>Download this file to open it in a compatible application.</p></div>}
   </div>
   <footer className="mediaFooter"><div className="mediaTip">{previewMode?'Demonstration resource — not college content':video?'Playback requires a browser-compatible codec.':'Read-only preview of the original file'}</div>
    <div className="mediaFooterActions"><a className="mediaSecondary" href={previewUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Open</a>
    <a className="mediaDownload" href={downloadUrl} download={previewMode&&video?file.name:undefined}><Download size={16}/> Download original</a></div>
   </footer>
  </section>
 </div>;
}
