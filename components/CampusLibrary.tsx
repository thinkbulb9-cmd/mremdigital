'use client';
import {useEffect,useMemo,useState} from 'react';
import {BookOpen,Search,GraduationCap,Layers3,ChevronRight,ChevronDown,ArrowLeft,FileText,Video,Play,Download,Eye,X,File,FolderOpen,ShieldCheck,Menu,Info,RefreshCw} from 'lucide-react';
import './campus-library.css';
type Course={code:string;title:string;department:string;instructor:string;files:string;videos:string;verified:boolean};
type Resource={id:string;name:string;ext:string;kind:string;size_bytes:string;module_no:number|null;lecture_no:number|null;semester_name:string|null;lecture_title?:string|null};
type Details={code:string;title:string;department:string;instructor:string;institution:string;verified:boolean;items:Resource[];total:number;page:number;limit:number};
type Listing={items:Course[];departments:string[];total:number;page:number;limit:number};
const fileUrl=(id:string,inline=false)=>'/api/files/'+encodeURIComponent(id)+'/download'+(inline?'?inline=1':'');
const size=(s:string)=>{const n=Number(s);return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B'};
const supportedVideo=(e:string)=>['.mp4','.m4v','.webm','.mov'].includes(e.toLowerCase());
const supportedPreview=(e:string)=>supportedVideo(e)||['.pdf','.txt','.md','.html','.htm','.jpg','.jpeg','.png','.webp'].includes(e.toLowerCase());
async function getJSON<T>(url:string,signal?:AbortSignal):Promise<T>{
 const res=await fetch(url,{signal,cache:'no-store'});
 if(!res.ok)throw Error('Could not read campus catalogue (HTTP '+res.status+')');
 return await res.json() as T;
}
export default function CampusLibrary(){
 const [search,setSearch]=useState(''),[term,setTerm]=useState(''),[dept,setDept]=useState(''),[page,setPage]=useState(1);
 const [course,setCourse]=useState<string|null>(null),[detailPage,setDetailPage]=useState(1);
 const [list,setList]=useState<Listing>({items:[],departments:[],total:0,page:1,limit:24});
 const [details,setDetails]=useState<Details|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [preview,setPreview]=useState<Resource|null>(null),[expanded,setExpanded]=useState<string[]>([]);
 const [mobileMenu,setMobileMenu]=useState(false);
 const [status,setStatus]=useState<{latestScan:{status:string;files_seen:string}|null}|null>(null);
 useEffect(()=>{const timer=setTimeout(()=>setTerm(search.trim()),270);return()=>clearTimeout(timer)},[search]);
 useEffect(()=>{
  const c=new AbortController();setLoading(true);setError('');
  const params=new URLSearchParams({page:String(page)});
  if(term)params.set('q',term);if(dept)params.set('department',dept);
  getJSON<Listing>('/api/campus/courses?'+params,c.signal).then(setList).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
  return()=>c.abort();
 },[term,dept,page]);
 useEffect(()=>{
  const controller=new AbortController();
  getJSON<{latestScan:{status:string;files_seen:string}|null}>('/api/campus/status',controller.signal).then(setStatus).catch(()=>{});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!course){setDetails(null);return;}
  const c=new AbortController();setError('');setLoading(true);
  getJSON<Details>('/api/campus/courses/'+encodeURIComponent(course)+'?page='+detailPage,c.signal)
   .then(r=>{setDetails(r);setExpanded([...new Set(r.items.map(x=>x.module_no===null?'Other Materials':'Module '+String(x.module_no).padStart(2,'0')))].slice(0,1))})
   .catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
  return()=>c.abort();
 },[course,detailPage]);
 useEffect(()=>{function key(e:KeyboardEvent){if(e.key==='Escape')setPreview(null)}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 const groups=useMemo(()=>{
  const map=new Map<string,Resource[]>();
  for(const f of details?.items||[]){
   const name=f.module_no===null?'Other Materials':'Module '+String(f.module_no).padStart(2,'0');
   if(!map.has(name))map.set(name,[]);
   map.get(name)!.push(f);
  }
  return [...map.entries()];
 },[details]);
 function showCourse(code:string){setCourse(code);setDetailPage(1);setMobileMenu(false);window.scrollTo({top:0})}
 function goHome(){setCourse(null);setDetails(null);setMobileMenu(false);window.scrollTo({top:0})}
 function toggle(k:string){setExpanded(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k])}
 const pageCount=Math.max(1,Math.ceil(list.total/list.limit));
 const detailCount=Math.max(1,Math.ceil((details?.total||0)/(details?.limit||100)));
 return <div className="cl-shell">
  <aside className={'cl-sidebar '+(mobileMenu?'open':'')}>
   <button className="cl-brand" onClick={goHome}><span className="cl-mark"><GraduationCap size={23}/></span><span><b>MREM</b><small>DIGITAL LEARNING LIBRARY</small></span></button>
   <div className="cl-side-label">LEARNING</div>
   <button className="cl-side active" onClick={()=>{setDept('');goHome()}}><BookOpen size={18}/> All Courses</button>
   <div className="cl-side-label">DEPARTMENTS</div>
   {list.departments.map(d=><button key={d} className={'cl-side '+(dept===d?'active':'')} onClick={()=>{setDept(d);setPage(1);goHome()}}><Layers3 size={15}/><span>{d}</span><ChevronRight size={14}/></button>)}
   <button className={'cl-side '+(dept==='Unclassified'?'active':'')} onClick={()=>{setDept('Unclassified');setPage(1);goHome()}}><FolderOpen size={16}/> Unclassified Courses</button>
   <div className="cl-side-bottom"><ShieldCheck size={18}/><span>Campus learning access<br/><small>Locally hosted · No student login</small></span></div>
  </aside>
  {mobileMenu&&<button className="cl-scrim" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
  <div className="cl-workspace">
   <header className="cl-header"><button className="cl-menu" onClick={()=>setMobileMenu(true)} aria-label="Open menu"><Menu size={22}/></button>
    <div className="cl-crumb" onClick={goHome}>MREM Digital Library <ChevronRight size={16}/> <strong>{details?details.title:'Explore Courses'}</strong></div>
    <div className="cl-campus-tag">CAMPUS DIGITAL LIBRARY</div>
   </header>
   <main className="cl-main">
    {!course?<><section className="cl-hero"><div><span className="cl-eyebrow">YOUR ACADEMIC RESOURCE CENTRE</span><h1>Learn at your pace.<br/><em>Find every lesson.</em></h1><p>Explore courses, browse modules, play video lectures, read study material and download resources from your college library.</p></div><BookOpen size={110} strokeWidth={1} className="cl-hero-icon"/></section>
    <div className="cl-heading"><div><small>LEARNING CATALOGUE</small><h2>{dept||'Explore All Courses'}</h2><p>Available courses appear automatically as the local drive is indexed.</p></div></div>
    <div className="cl-search-row"><div className="cl-search"><Search size={20}/><input placeholder="Search by subject, topic or course ID..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><button onClick={()=>{setSearch('');setDept('');setPage(1)}}>Clear filters</button></div>
    {status?.latestScan?.status==='running'&&<div className="cl-inline-note"><RefreshCw size={16}/> Library index is being built. {Number(status.latestScan.files_seen||0).toLocaleString()} files indexed so far; new courses will appear as scanning continues.</div>}
    {error&&<div className="cl-error">{error}</div>}
    {loading?<div className="cl-loading">Loading course catalogue...</div>:list.items.length?<div className="cl-cards">{list.items.map(c=><button className="cl-course" key={c.code} onClick={()=>showCourse(c.code)}>
       <div className="cl-course-top"><span>{c.department}</span><BookOpen size={38} strokeWidth={1}/></div>
       <div className="cl-course-body"><small>{c.verified?'VERIFIED COURSE TITLE':'COURSE TITLE PENDING'}</small><h3>{c.title}</h3><p>{c.instructor||'Course materials'}</p><div className="cl-course-stats"><span><Video size={15}/>{Number(c.videos).toLocaleString()} videos</span><span><FileText size={15}/>{Number(c.files).toLocaleString()} files</span></div><div className="cl-enter">Open course <ChevronRight size={17}/></div></div>
      </button>)}</div>:<div className="cl-empty">No courses match these filters. {status?.latestScan?.status==='running'?'The drive is still being indexed.':'Make sure the source drive has been registered and scanned.'}</div>}
    <div className="cl-pagination"><span>{list.total.toLocaleString()} course groups</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{page} / {pageCount}</span><button disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
    </>:<><button className="cl-back" onClick={goHome}><ArrowLeft size={18}/> Back to Courses</button>
     {loading&&!details?<div className="cl-loading">Loading course lessons...</div>:details?<><section className="cl-detail-hero"><div><small>{details.department} · Course {details.code}</small><h1>{details.title}</h1><p>{details.instructor}{details.institution?' · '+details.institution:''}</p></div><Layers3 size={65} strokeWidth={1.3}/></section>
      <div className="cl-detail-columns"><section className="cl-module-panel"><div className="cl-module-top"><h2>Modules & Lessons</h2><p>{details.total.toLocaleString()} files available. Click a module to expand its lessons.</p></div>
       {groups.length?groups.map(([key,files])=><div className="cl-module" key={key}><button className="cl-module-toggle" onClick={()=>toggle(key)}><span className="cl-module-icon"><Layers3 size={20}/></span><span><strong>{key}</strong><small>{files.length} {files.length===1?'resource':'resources'} on this page</small></span><ChevronDown size={18} className={expanded.includes(key)?'rotated':''}/></button>
        {expanded.includes(key)&&<div className="cl-resources">{files.map(f=><div className="cl-resource" key={f.id}>
         <span className="cl-file-icon">{f.kind==='Video'?<Video size={20}/>:<FileText size={20}/>}</span>
         <div className="cl-resource-info"><strong>{f.lecture_title|| (f.lecture_no===null?f.name:'Lecture '+String(f.lecture_no).padStart(2,'0'))}</strong><small>{f.name} · {f.semester_name||f.kind} · {size(f.size_bytes)}</small></div>
         <div className="cl-resource-actions">{supportedPreview(f.ext)&&<button onClick={()=>setPreview(f)}>{supportedVideo(f.ext)?<Play size={16}/>:<Eye size={16}/>} {supportedVideo(f.ext)?'Play':'View'}</button>}<a href={fileUrl(f.id)} download><Download size={16}/> Download</a></div>
        </div>)}</div>}
       </div>):<div className="cl-empty">No indexed files found for this course.</div>}
       <div className="cl-pagination"><span>Page {detailPage} / {detailCount}</span><div><button disabled={detailPage===1} onClick={()=>{setDetailPage(p=>p-1);window.scrollTo({top:0})}}>Previous</button><button disabled={detailPage>=detailCount} onClick={()=>{setDetailPage(p=>p+1);window.scrollTo({top:0})}}>Next 100</button></div></div>
      </section><aside className="cl-course-aside"><h3>Course Information</h3><dl><dt>Course title</dt><dd>{details.title}</dd><dt>Department</dt><dd>{details.department}</dd><dt>Course ID</dt><dd>{details.code}</dd><dt>Academic files</dt><dd>{details.total.toLocaleString()}</dd><dt>Course title status</dt><dd>{details.verified?'Verified':'Metadata pending'}</dd></dl><div className="cl-help"><Info size={19}/> Topic names are shown only when verified metadata exists. Other items keep their original filenames or lecture numbers.</div></aside></div>
     </>:<div className="cl-loading">Loading...</div>}
    </>}
    <footer className="cl-footer">MREM Digital Learning Library · Internal college resources</footer>
   </main>
  </div>
  {preview&&<div className="cl-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPreview(null)}}><div className="cl-modal" role="dialog" aria-modal="true" aria-label={'Preview '+preview.name}>
    <div className="cl-modal-header"><strong>{preview.lecture_title||preview.name}</strong><button aria-label="Close" onClick={()=>setPreview(null)}><X size={18}/></button></div>
    <div className="cl-modal-body">{supportedVideo(preview.ext)?<video key={preview.id} src={fileUrl(preview.id,true)} controls playsInline preload="metadata"/>:preview.kind==='Image'?<img alt={preview.name} src={fileUrl(preview.id,true)}/>:<iframe title={'Preview '+preview.name} src={fileUrl(preview.id,true)} sandbox="allow-same-origin"/>}</div>
    <div className="cl-modal-footer"><span>Viewed directly from the local college library</span><a href={fileUrl(preview.id)} download><Download size={16}/> Download Original</a></div>
  </div></div>}
 </div>;
}
