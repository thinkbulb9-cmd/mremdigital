'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Search,X} from 'lucide-react';
type Item={code:string;title:string;department:string;deptSlug:string;isWeb:boolean;videos:number};
export default function QuickSearch({variant='header'}:{variant?:'header'|'hero'}){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[items,setItems]=useState<Item[]>([]),[busy,setBusy]=useState(false),[index,setIndex]=useState(0);
 const input=useRef<HTMLInputElement>(null),router=useRouter(),pathname=usePathname();
 useEffect(()=>{setOpen(false)},[pathname]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(x=>!x)}if(e.key==='Escape')setOpen(false)};
 window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 useEffect(()=>{if(open){setQ('');setItems([]);requestAnimationFrame(()=>input.current?.focus())}},[open]);
 useEffect(()=>{
  if(!open)return;setIndex(0);
  const c=new AbortController();
  const t=setTimeout(async()=>{
   setBusy(true);try{const r=await fetch('/api/campus/search-suggest?q='+encodeURIComponent(q),{signal:c.signal,cache:'no-store'});
    if(!r.ok)throw new Error('Search temporarily unavailable');
    const data=await r.json();setItems(Array.isArray(data.items)?data.items:[]);
   }catch(e){if(!c.signal.aborted)setItems([])}finally{if(!c.signal.aborted)setBusy(false)}
  },q.length?180:0);
  return()=>{clearTimeout(t);c.abort()}
 },[q,open]);
 const goto=(c:Item)=>{setOpen(false);router.push(c.isWeb&&c.deptSlug&&c.videos===0?'/web-courses/'+c.deptSlug+'/'+c.code:'/courses/'+c.code)};
 const close=()=>setOpen(false);
 return <>
  <button type="button" className={'quick-search-trigger '+(variant==='hero'?'quick-search-hero':'quick-search-header')} onClick={()=>setOpen(true)} aria-label="Search courses, departments and lecture titles">
   <Search size={variant==='hero'?20:17}/><span>{variant==='hero'?'Search courses, departments, lecture titles...':'Search courses...'}</span><kbd>⌘ K</kbd>
  </button>
  {open&&<div className="quick-search-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div className="quick-search-modal" role="dialog" aria-modal="true" aria-label="Search library" onKeyDown={e=>{
    if(e.key==='Escape')close();
    if(e.key==='ArrowDown'){e.preventDefault();setIndex(i=>Math.min(Math.max(items.length-1,0),i+1))}
    if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>Math.max(0,i-1))}
    if(e.key==='Enter'&&items[index]){e.preventDefault();goto(items[index])}
   }}>
    <div className="quick-search-input"><Search size={22}/><input ref={input} placeholder="Find a verified course, lesson or department..." value={q} onChange={e=>setQ(e.target.value)} aria-label="Search academic catalogue"/><button type="button" onClick={close} aria-label="Close search"><X size={18}/></button></div>
    <div className="quick-search-results">
     <span className="quick-search-kicker">{busy?'SEARCHING...':q?'RESULTS':'SUGGESTED COURSES'}</span>
     {!busy&&items.length===0&&<p className="quick-search-empty">No matching courses found. Try a different search.</p>}
     {items.map((c,i)=><button type="button" className={'quick-search-result '+(index===i?'chosen':'')} key={c.code} onMouseEnter={()=>setIndex(i)} onClick={()=>goto(c)}>
      <span className="quick-search-book"><BookOpen size={18}/></span><span><strong>{c.title||'Course ID '+c.code}</strong><small>{c.department||'Unclassified course'} · {c.code}</small></span><ArrowRight size={16}/>
     </button>)}
    </div>
    <div className="quick-search-footer"><span>↑↓ Navigate · Enter Open · Esc Close</span><Link href={'/courses'+(q?'?q='+encodeURIComponent(q):'')} onClick={close}>See all results <ArrowRight size={15}/></Link></div>
   </div>
  </div>}
 </>;
}