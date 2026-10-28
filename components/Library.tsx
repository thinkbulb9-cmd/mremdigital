'use client';
import { useEffect, useState } from 'react';
import ResourcePreview from './ResourcePreview';
import { Archive, BookOpen, ChevronRight, Download, Eye, Play, File, FileText, FolderOpen, GraduationCap, HardDrive, LayoutDashboard, LogOut, Search, ShieldCheck, SlidersHorizontal, Video } from 'lucide-react';
type Entry={id:string,name:string,ext:string,kind:string,department:string,course:string,size_bytes:string,modified_at:string,source_id:string};
type Api={items:Entry[],total:number,page:number,limit:number,departments:{department:string,total:string}[],courses:string[]};
const empty:Api={items:[],total:0,page:1,limit:30,departments:[],courses:[]};
function size(n:string){const v=Number(n);if(!Number.isFinite(v))return '—';if(v<1024)return v+' B';if(v<1048576)return(v/1024).toFixed(1)+' KB';if(v<1073741824)return(v/1048576).toFixed(1)+' MB';return(v/1073741824).toFixed(2)+' GB';}
function iconFor(kind:string){return kind==='Video'?<Video size={18}/>:kind==='Document'?<FileText size={18}/>:kind==='Archive'?<Archive size={18}/>:<File size={18}/>;}
export default function Library({previewMode=false}:{previewMode?:boolean}){
 const [data,setData]=useState<Api>(empty),[q,setQ]=useState(''),[term,setTerm]=useState(''),[department,setDepartment]=useState(''),[course,setCourse]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[preview,setPreview]=useState<Entry|null>(null);
 useEffect(()=>{const id=setTimeout(()=>setTerm(q),250);return()=>clearTimeout(id);},[q]);
 useEffect(()=>{
  const abort=new AbortController();const params=new URLSearchParams({page:String(page)});
  if(term)params.set('q',term);if(department)params.set('department',department);if(course)params.set('course',course);if(kind)params.set('kind',kind);
  setLoading(true);setError('');
  fetch('/api/files?'+params,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Could not retrieve file catalogue');return await r.json();})
   .then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[term,department,course,kind,page]);
 function chooseDepartment(d:string){setDepartment(d);setCourse('');setPage(1);}
 async function logout(){await fetch('/api/auth/logout',{method:'POST'});window.location.assign('/login');}
 const totalPages=Math.max(1,Math.ceil(data.total/data.limit));
 return <div className="appShell">
 <aside className="sidebar">
  <div className="sidebarBrand"><span className="brandMark"><GraduationCap size={25}/></span><div><strong>MREM<span className="brandAccent">.</span></strong><small>DIGITAL LIBRARY</small></div></div>
  <div className="navTitle">WORKSPACE</div>
  <div className="navItem active"><BookOpen size={18}/> Resource Explorer</div>
  <a href="/admin" className="navItem"><LayoutDashboard size={18}/> Admin Overview</a>
  <div className="navTitle topSpace">DEPARTMENTS</div>
  <button className={`sideFilter ${department===''?'selected':''}`} onClick={()=>chooseDepartment('')}><FolderOpen size={17}/> All departments <ChevronRight size={15}/></button>
  {data.departments.map(d=><button key={d.department} className={`sideFilter ${department===d.department?'selected':''}`} onClick={()=>chooseDepartment(d.department)}><BookOpen size={16}/><span>{d.department}</span><span className="countTag">{d.total}</span></button>)}
  <div className="sidebarFooter"><HardDrive size={17}/><div><strong>Connected Storage</strong><small>Original files • No duplication</small></div></div>
 </aside>
 <main className="mainContent">
  <header className="topbar"><div className="breadcrumb">MREM <ChevronRight size={15}/> Academic Resources</div><div className="headerActions"><span className="pilotChip"><span className="dot"/> {previewMode?'SYNTHETIC PREVIEW':'LOCAL PILOT'}</span>{!previewMode&&<button onClick={logout} className="textBtn" title="Sign out"><LogOut size={17}/> Sign out</button>}</div></header>
  <section className="hero"><div><div className="eyebrow light">KNOWLEDGE, ONE CLICK AWAY</div><h1>Explore the Digital Library<span>.</span></h1><p>Find courses, lectures, study materials, and question papers—all organized from the college&apos;s existing drives.</p></div><div className="heroGraphic"><BookOpen size={68} strokeWidth={1.2}/></div></section>
  {previewMode&&<div className="notice" style={{marginTop:18}}>Preview only: all listed files are synthetic examples. The college's 90 TB disks, PostgreSQL catalogue and streaming service are not connected to Vercel.</div>}
  <section className="searchPanel"><div className="searchLine"><Search size={21}/><input aria-label="Search files" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search lectures, filenames, subjects, or course resources..."/><span className="kbd">SEARCH</span></div><div className="filterRow"><SlidersHorizontal size={17}/><span>Filters</span><select aria-label="Resource type" value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}><option value="">All file types</option><option value="Video">Videos</option><option value="Document">Documents</option><option value="Archive">Archives</option><option value="Other">Other</option></select><select aria-label="Department" value={department} onChange={e=>chooseDepartment(e.target.value)}><option value="">All departments</option>{data.departments.map(d=><option key={d.department} value={d.department}>{d.department}</option>)}</select><select aria-label="Course" value={course} onChange={e=>{setCourse(e.target.value);setPage(1)}} disabled={!department}><option value="">All courses</option>{data.courses.map(c=><option key={c} value={c}>{c}</option>)}</select></div></section>
  <div className="sectionHeader"><div><div className="eyebrow">RESOURCE CATALOGUE</div><h2>{department||'All learning materials'}</h2><p>{data.total.toLocaleString()} indexed resources {department?`in ${department}`:'across available drives'}</p></div><span className="readOnly"><ShieldCheck size={16}/> Read-only access</span></div>
  <div className="tableWrap"><div className="tableHead"><span>RESOURCE NAME</span><span>COURSE</span><span>TYPE</span><span>SIZE</span><span>ACTIONS</span></div>
   {loading?<div className="emptyState">Loading the resource catalogue...</div>:error?<div className="emptyState error">{error}</div>:data.items.length===0?<div className="emptyState"><FolderOpen size={35}/><strong>No files found</strong><span>Try clearing filters or run the indexing worker to load resources.</span></div>:data.items.map(item=><div className="resourceRow" key={item.id}><div className="resourceName"><div className={`resourceIcon ${item.kind.toLowerCase()}`}>{iconFor(item.kind)}</div><div className="resourceText"><strong title={item.name}>{item.name}</strong><small>{item.department} · {item.source_id}</small></div></div><span className="courseText">{item.course}</span><span><span className="typePill">{item.kind}</span></span><span className="sizeText">{size(item.size_bytes)}</span><span className="actionBtns">
   {['.mp4','.m4v','.webm','.pdf','.txt','.md','.png','.jpg','.jpeg','.webp'].includes(item.ext.toLowerCase())&&
     <button type="button" aria-label={'Preview '+item.name} title={'Preview '+item.name}
       className="previewAction" onClick={()=>setPreview(item)}>
       {item.kind==='Video'?<Play size={15}/>:<Eye size={15}/>}<span>{item.kind==='Video'?'Play':'Preview'}</span>
     </button>}
   <a aria-label={'Download '+item.name} title={'Download '+item.name} className="downloadAction"
      href={previewMode&&item.kind==='Video'?'/demo/mrem-preview.mp4':`/api/files/${item.id}/download`}
      download={previewMode&&item.kind==='Video'?item.name:undefined}>
      <Download size={15}/><span>Download</span>
   </a>
  </span></div>)}
  </div>
  <div className="pagination"><span>Page {page} of {totalPages}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
  <footer>© MREM Digital Library — Pilot architecture · Educational access only</footer>
 </main>
 {preview&&<ResourcePreview file={preview} previewMode={previewMode} onClose={()=>setPreview(null)}/>}
 </div>;
}
