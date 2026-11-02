'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
 AlertTriangle,ArrowLeft,ArrowRight,BookOpen,BookText,ChevronLeft,ChevronRight,Code2,Download,File,FileText,Folder,FolderOpen,
 GraduationCap,Home,Image as ImageIcon,Layers,Loader2,Menu,MonitorPlay,Play,Search,ShieldCheck,Video,X
} from 'lucide-react';
import './mrem-open-lms.css';
import './campus-lms.css';

type View='home'|'departments'|'courses'|'course'|'uncategorized';
type Nav={view:View;dept?:string;q?:string;type?:string;offering?:string;page?:number;code?:string;co?:string;kind?:string;cp?:number;res?:string;src?:string;path?:string;up?:number};
type Overview={courses:number;verifiedTitles:number;videos:number;documents:number;departments:{name:string;courses:number}[];uncategorizedFiles:number;collections:number};
type Course={code:string;title:string;titleVerified:boolean;department:string;instructor:string;institution:string;files:number;videos:number;documents:number;html:number;offerings:string[];offeringLabels:string[]};
type Listing={items:Course[];total:number;page:number;limit:number;offerings:{value:string;label:string}[]};
type Resource={id:string;name:string;ext:string;kind:string;size_bytes:string;module_no?:number|null;lecture_no?:number|null;lecture_title?:string|null;title_source?:string|null};
type Offering={value:string;label:string;files:number;videos:number;documents:number;html:number;other:number};
type Workspace={code:string;title:string;titleVerified:boolean;department:string;instructor:string;institution:string;videos:number;documents:number;offerings:Offering[];offering:string;kind:string;page:number;limit:number;total:number;items:Resource[]};
type Folder={collection:string;source:string;path:string;folders:{name:string;path:string;files:number}[];files:Resource[];totalFiles:number;page:number;limit:number};

const BANNERS=[
 {tag:'WELCOME',title:'Welcome to MREM Digital Learning Library',text:'Explore academic knowledge in one organized learning space.',art:'/lms-art/academic.svg',theme:'welcome',action:'Explore departments',to:{view:'departments'} as Nav},
 {tag:'ONE LIBRARY',title:'One Library. Multiple Departments.',text:'Discover courses, video lectures and study resources.',art:'/lms-art/library.svg',theme:'library',action:'Browse courses',to:{view:'courses'} as Nav},
 {tag:'ORGANIZED RESOURCES',title:'Your Academic Resources, Organized.',text:'Watch, read, browse and access approved study materials.',art:'/lms-art/innovation.svg',theme:'innovation',action:'Browse courses',to:{view:'courses'} as Nav},
 {tag:'SELF-PACED',title:'Learning Beyond the Classroom',text:'Explore available academic resources at your own pace.',art:'/lms-art/learning.svg',theme:'learning',action:'Explore departments',to:{view:'departments'} as Nav}
];
const fileUrl=(id:string,inline=false)=>'/api/files/'+encodeURIComponent(id)+'/download'+(inline?'?inline=1':'');
const ext=(r:Resource)=>r.ext.toLowerCase();
const isVideo=(r:Resource)=>['.mp4','.m4v','.webm','.mov'].includes(ext(r));
const isPdf=(r:Resource)=>ext(r)==='.pdf';
const isHtml=(r:Resource)=>['.html','.htm'].includes(ext(r));
const isText=(r:Resource)=>['.txt','.md'].includes(ext(r));
const isImage=(r:Resource)=>['.png','.jpg','.jpeg','.webp','.gif'].includes(ext(r));
const downloadable=(r:Resource)=>['.mp4','.m4v','.webm','.mov','.avi','.mkv','.pdf','.txt','.md','.html','.htm','.jpg','.jpeg','.png','.webp','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv','.zip','.rar','.7z'].includes(ext(r));
const sizeOf=(s:string)=>{const n=Number(s);return n>=1073741824?(n/1073741824).toFixed(1)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(0)+' KB':n+' B'};
const nice=(n:number)=>n.toLocaleString('en-IN');
const courseName=(c:{title:string;code:string})=>c.title||'Course ID '+c.code;
const resourceIcon=(r:Resource)=>isVideo(r)?Play:isPdf(r)?FileText:isHtml(r)?Code2:isText(r)?BookText:isImage(r)?ImageIcon:File;

function readNav():Nav{
 if(typeof window==='undefined')return {view:'home'};
 const p=new URLSearchParams(window.location.search),n=(k:string)=>p.get(k)||undefined,num=(k:string)=>Number(p.get(k))||undefined;
 const view=(['home','departments','courses','course','uncategorized'].includes(p.get('view')||'')?p.get('view'):'home') as View;
 return {view,dept:n('dept'),q:n('q'),type:n('type'),offering:n('offering'),page:num('page'),code:n('code'),co:p.has('co')?p.get('co')!:undefined,kind:n('kind'),cp:num('cp'),res:n('res'),src:n('src'),path:p.has('path')?p.get('path')!:undefined,up:num('up')};
}
function navQuery(n:Nav){
 const p=new URLSearchParams();
 for(const [k,v] of Object.entries(n))if(v!==undefined&&v!==''&&!(k==='view'&&v==='home'))p.set(k,String(v));
 const s=p.toString();return s?'?'+s:window.location.pathname;
}
async function getJSON<T>(url:string,signal?:AbortSignal):Promise<T>{
 const r=await fetch(url,{signal,cache:'no-store'});
 if(!r.ok){let m='The library could not load this page (HTTP '+r.status+').';try{const j=await r.json();if(j.error)m=j.error}catch{}throw Error(m)}
 return r.json() as Promise<T>;
}
function useData<T>(url:string|null){
 const [state,setState]=useState<{data:T|null;error:string;loading:boolean}>({data:null,error:'',loading:Boolean(url)});
 useEffect(()=>{
  if(!url){setState({data:null,error:'',loading:false});return}
  const c=new AbortController();setState(s=>({...s,loading:true,error:''}));
  getJSON<T>(url,c.signal).then(data=>setState({data,error:'',loading:false})).catch(e=>{if(e.name!=='AbortError')setState({data:null,error:e.message,loading:false})});
  return()=>c.abort();
 },[url]);
 return state;
}

export default function CampusLms(){
 const [nav,setNav]=useState<Nav>({view:'home'});
 const [menu,setMenu]=useState(false);
 const [search,setSearch]=useState('');
 useEffect(()=>{const n=readNav();setNav(n);setSearch(n.q||'');const pop=()=>{const m=readNav();setNav(m);setSearch(m.q||'');setMenu(false)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 const go=useCallback((n:Nav,replace=false)=>{
  setNav(n);setMenu(false);
  window.history[replace?'replaceState':'pushState'](null,'',navQuery(n));
  if(!replace)window.scrollTo({top:0,behavior:'smooth'});
 },[]);
 const overview=useData<Overview>('/api/campus/overview');
 const depts=overview.data?.departments||[];
 useEffect(()=>{
  const t=setTimeout(()=>{const q=search.trim();if(q===(nav.q||''))return;
   if(q||nav.view==='courses')go({view:'courses',dept:nav.view==='courses'?nav.dept:undefined,q,type:nav.type,offering:nav.offering},nav.view==='courses')},350);
  return()=>clearTimeout(t);
 },[search]); // eslint-disable-line react-hooks/exhaustive-deps
 return <div className="mo-shell mo-live">
  <a className="cl2-skip" href="#lms-main">Skip to content</a>
  <aside className={'mo-sidebar'+(menu?' mo-open':'')} aria-label="Library navigation">
   <button className="mo-brand" onClick={()=>go({view:'home'})} aria-label="MREM Digital Learning Library home">
    <img src="/brand/mrem-emblem.png" width={52} height={50} alt="MREM college emblem"/>
    <span className="mo-brand-text"><strong>MREM</strong><small>Digital Learning Library</small><small className="cl2-ugc">An UGC Autonomous Institution</small></span>
   </button>
   <div className="mo-divider"/>
   <div className="mo-nav-label">LEARNING SPACE</div>
   <button className={'mo-nav'+(nav.view==='home'?' active':'')} onClick={()=>go({view:'home'})}><Home size={18}/> Home</button>
   <button className={'mo-nav'+(nav.view==='departments'||(nav.view==='courses'&&nav.dept)?' active':'')} onClick={()=>go({view:'departments'})}><Layers size={18}/> Departments</button>
   <button className={'mo-nav'+((nav.view==='courses'&&!nav.dept)||nav.view==='course'?' active':'')} onClick={()=>go({view:'courses'})}><BookOpen size={18}/> Browse courses</button>
   <button className={'mo-nav'+(nav.view==='uncategorized'?' active':'')} onClick={()=>go({view:'uncategorized'})}><FolderOpen size={18}/> Uncategorized resources</button>
   {depts.length>0&&<><div className="mo-nav-label mo-nav-label-spaced">DEPARTMENTS</div>
    <div className="mo-dept-shortcuts">{depts.slice(0,8).map(d=><button key={d.name} className={nav.dept===d.name?'cl2-on':''} onClick={()=>go({view:'courses',dept:d.name})}><span className="mo-small-mark">{d.name.slice(0,1)}</span><span>{d.name}</span><ChevronRight size={13}/></button>)}</div></>}
   <div className="mo-sidebar-bottom"><div><GraduationCap size={20}/><span>Campus learning library</span></div><p>Open on the college network<br/>No student login needed</p></div>
  </aside>
  {menu&&<button className="mo-screen-shade" aria-label="Close menu" onClick={()=>setMenu(false)}/>}
  <div className="mo-page">
   <header className="mo-topbar">
    <div className="mo-top-title"><button className="mo-mobile-nav" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={22}/></button><div><b>MREM Digital Learning Library</b><span>MALLA REDDY ENGINEERING COLLEGE AND MANAGEMENT SCIENCES</span></div></div>
    <div className="mo-header-right"><label className="mo-header-search"><Search size={16}/><input aria-label="Search courses" placeholder="Search courses, professors, course IDs, lectures…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
   </header>
   <main className="mo-content" id="lms-main">
    {nav.view==='home'&&<HomeView o={overview} go={go} search={search} setSearch={setSearch}/>}
    {nav.view==='departments'&&<DepartmentsView o={overview} go={go}/>}
    {nav.view==='courses'&&<CoursesView nav={nav} go={go}/>}
    {nav.view==='course'&&nav.code&&<CourseView nav={nav} go={go}/>}
    {nav.view==='uncategorized'&&<UncategorizedView nav={nav} go={go}/>}
   </main>
   <footer className="mo-footer"><span>© Malla Reddy Engineering College and Management Sciences · Digital Learning Library</span><span>Hosted on the college network</span></footer>
  </div>
 </div>;
}

function Banner({go}:{go:(n:Nav)=>void}){
 const [i,setI]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(m.matches);const f=()=>setReduced(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f)},[]);
 useEffect(()=>{if(paused||reduced)return;const t=setInterval(()=>setI(x=>(x+1)%BANNERS.length),7000);return()=>clearInterval(t)},[paused,reduced]);
 const b=BANNERS[i],prev=()=>setI(x=>(x+BANNERS.length-1)%BANNERS.length),next=()=>setI(x=>(x+1)%BANNERS.length);
 return <section className="mo-banner" aria-roledescription="carousel" aria-label="MREM announcements" tabIndex={0}
   onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setPaused(false)}}
   onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();prev()}if(e.key==='ArrowRight'){e.preventDefault();next()}}}>
  <div className={'mo-banner-frame mo-banner-'+b.theme} aria-live={paused?'polite':'off'}>
   <div className="mo-banner-copy"><span className="mo-overline"><span className="mo-overline-line"/> {b.tag}</span><h1>{b.title}</h1><p>{b.text}</p><button className="mo-banner-action" onClick={()=>go(b.to)}>{b.action} <ArrowRight size={16}/></button></div>
   <img className="mo-banner-art" src={b.art} alt="" width={750} height={360}/>
   <button className="mo-banner-prev" onClick={prev} aria-label="Previous announcement"><ChevronLeft size={20}/></button>
   <button className="mo-banner-next" onClick={next} aria-label="Next announcement"><ChevronRight size={20}/></button>
  </div>
  <div className="mo-banner-dots">{BANNERS.map((x,k)=><button key={x.tag} className={k===i?'active':''} onClick={()=>setI(k)} aria-label={'Show announcement '+(k+1)+' of '+BANNERS.length} aria-current={k===i?'true':undefined}/>)}</div>
 </section>;
}

function State({icon:Icon=Loader2,title,text,spin,action}:{icon?:typeof Loader2;title:string;text?:string;spin?:boolean;action?:React.ReactNode}){
 return <div className="cl2-state" role={spin?'status':undefined}><Icon size={28} className={spin?'cl2-spin':''}/><strong>{title}</strong>{text&&<p>{text}</p>}{action}</div>;
}
function Problem({error}:{error:string}){return <State icon={AlertTriangle} title="Something went wrong" text={error} action={<button className="cl2-button" onClick={()=>window.location.reload()}>Try again</button>}/>}

function HomeView({o,go,search,setSearch}:{o:{data:Overview|null;error:string;loading:boolean};go:(n:Nav)=>void;search:string;setSearch:(s:string)=>void}){
 const top=useData<Listing>('/api/campus/courses?page=1');
 const d=o.data;
 return <>
  <Banner go={go}/>
  <div className="mo-section-title mo-welcome"><div><small>EXPLORE THE LIBRARY</small><h2>Your learning starts here</h2><p>Courses, video lectures and study materials from the college archive, organized by department.</p></div><button onClick={()=>go({view:'courses'})}>All courses <ArrowRight size={16}/></button></div>
  <form className="mo-search-feature" onSubmit={e=>{e.preventDefault();go({view:'courses',q:search.trim()})}}><Search size={21}/><input aria-label="Search the library" value={search} onChange={e=>setSearch(e.target.value)} placeholder="What would you like to learn today?"/><button type="submit">Search library <ArrowRight size={15}/></button></form>
  {o.error?<Problem error={o.error}/>:<div className="cl2-stats">
   <Stat icon={BookOpen} value={d?.courses} label="Courses"/><Stat icon={Layers} value={d?.departments.length} label="Departments"/>
   <Stat icon={Video} value={d?.videos} label="Video lectures"/><Stat icon={FileText} value={d?.documents} label="Study documents"/>
  </div>}
  {d&&d.departments.length>0&&<><div className="mo-section-title"><div><small>FIND YOUR DISCIPLINE</small><h2>Departments</h2></div><button onClick={()=>go({view:'departments'})}>All departments <ArrowRight size={16}/></button></div>
   <div className="mo-dept-grid">{d.departments.slice(0,6).map(x=><DeptCard key={x.name} name={x.name} count={x.courses} onClick={()=>go({view:'courses',dept:x.name})}/>)}</div></>}
  <div className="mo-section-title cl2-gap"><div><small>FROM THE CATALOGUE</small><h2>Courses</h2></div><button onClick={()=>go({view:'courses'})}>View all <ArrowRight size={16}/></button></div>
  {top.loading?<State title="Loading courses…" spin/>:top.error?<Problem error={top.error}/>:
   <div className="cl2-cards">{(top.data?.items||[]).slice(0,8).map(c=><CourseCard key={c.code} c={c} onClick={()=>go({view:'course',code:c.code})}/>)}</div>}
 </>;
}
function Stat({icon:Icon,value,label}:{icon:typeof Video;value?:number;label:string}){
 return <div className="mo-feature-mini"><div><Icon size={21}/></div><strong>{value===undefined?'—':nice(value)}</strong><span>{label}</span></div>;
}
function DeptCard({name,count,onClick}:{name:string;count:number;onClick:()=>void}){
 return <button className="mo-dept-card" onClick={onClick}><span className="mo-dept-icon mo-bg-blue">{name.slice(0,1)}</span><strong>{name}</strong><small>{nice(count)} {count===1?'course':'courses'}</small><ChevronRight size={16}/></button>;
}
function CourseCard({c,onClick}:{c:Course;onClick:()=>void}){
 return <button className="cl2-card" onClick={onClick}>
  <span className="cl2-card-dept">{c.department||'Department not yet mapped'}</span>
  <h3>{courseName(c)}</h3>
  <p>{[c.instructor,c.institution].filter(Boolean).join(' · ')||(c.title?'':'Title not yet verified · shown by course ID')}</p>
  <span className="cl2-card-meta"><span><Video size={14}/> {nice(c.videos)}</span><span><FileText size={14}/> {nice(c.documents)}</span>{c.offeringLabels[0]&&<span>{c.offeringLabels[0]}{c.offerings.length>1?' +'+(c.offerings.length-1):''}</span>}</span>
 </button>;
}

function DepartmentsView({o,go}:{o:{data:Overview|null;error:string;loading:boolean};go:(n:Nav)=>void}){
 return <>
  <Intro eyebrow="ACADEMIC DIRECTORY" title="Departments" note="Departments follow the NPTEL discipline of each course. Course counts include only material available to students."/>
  {o.loading?<State title="Loading departments…" spin/>:o.error?<Problem error={o.error}/>:!o.data?.departments.length?
   <State icon={Layers} title="No departments yet" text="Departments appear once courses are mapped to a discipline."/>:
   <div className="mo-dept-grid mo-all-depts">{o.data.departments.map(x=><DeptCard key={x.name} name={x.name} count={x.courses} onClick={()=>go({view:'courses',dept:x.name})}/>)}</div>}
 </>;
}
function Intro({eyebrow,title,note}:{eyebrow:string;title:string;note?:string}){return <div className="mo-page-intro"><small>{eyebrow}</small><h1>{title}</h1>{note&&<p>{note}</p>}</div>}

function CoursesView({nav,go}:{nav:Nav;go:(n:Nav,replace?:boolean)=>void}){
 const page=nav.page||1;
 const qs=new URLSearchParams({page:String(page)});
 if(nav.q)qs.set('q',nav.q);if(nav.dept)qs.set('department',nav.dept);if(nav.type)qs.set('type',nav.type);if(nav.offering)qs.set('offering',nav.offering);
 const {data,error,loading}=useData<Listing>('/api/campus/courses?'+qs);
 const pages=data?Math.max(1,Math.ceil(data.total/data.limit)):1;
 const set=(patch:Partial<Nav>)=>go({...nav,page:undefined,...patch},true);
 return <>
  {nav.dept&&<button className="mo-link-back" onClick={()=>go({view:'departments'})}><ChevronLeft size={15}/> All departments</button>}
  <Intro eyebrow={nav.dept?'DEPARTMENT':'COURSE CATALOGUE'} title={nav.dept||'All courses'} note={nav.q?'Results for “'+nav.q+'” — matched on course title, ID, professor, institute, semester, lecture titles and file names.':undefined}/>
  <div className="mo-catalogue-toolbar cl2-toolbar">
   <label><Search size={18}/><input defaultValue={nav.q||''} key={nav.q||''} placeholder="Filter by title, professor, course ID…" aria-label="Filter courses" onKeyDown={e=>{if(e.key==='Enter')set({q:(e.target as HTMLInputElement).value.trim()||undefined})}}/></label>
   <select aria-label="Resource type" value={nav.type||''} onChange={e=>set({type:e.target.value||undefined})}><option value="">All resource types</option><option value="video">With videos</option><option value="document">With documents</option><option value="html">With HTML pages</option></select>
   <select aria-label="Academic offering" value={nav.offering||''} onChange={e=>set({offering:e.target.value||undefined})}><option value="">All semesters</option>{data?.offerings.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
   {(nav.q||nav.type||nav.offering)&&<button className="mo-muted-button" onClick={()=>set({q:undefined,type:undefined,offering:undefined})}><X size={14}/> Clear</button>}
  </div>
  {loading&&!data?<State title="Loading courses…" spin/>:error?<Problem error={error}/>:!data?.items.length?
   <State icon={Search} title="No courses found" text="Try a different search term, or browse the departments."/>:
   <div className="mo-catalogue-list">{data.items.map(c=><button className="mo-catalogue-row cl2-row" key={c.code} onClick={()=>go({view:'course',code:c.code})}>
    <span className="mo-course-icon"><BookOpen size={20}/></span>
    <span className="mo-catalogue-name"><strong>{courseName(c)}</strong><small>{[c.department,c.instructor,c.institution,'Course ID '+c.code].filter(Boolean).join(' · ')}</small></span>
    <span className="cl2-row-meta"><span><Video size={14}/> {nice(c.videos)}</span><span><FileText size={14}/> {nice(c.documents)}</span><span className="cl2-offer">{c.offeringLabels.slice(0,2).join(', ')}{c.offerings.length>2?' +'+(c.offerings.length-2):''}</span></span>
    <ChevronRight size={16}/></button>)}</div>}
  {data&&data.total>0&&<Pager page={page} pages={pages} total={data.total} unit="courses" onPage={p=>go({...nav,page:p})}/>}
 </>;
}
function Pager({page,pages,total,unit,onPage}:{page:number;pages:number;total:number;unit:string;onPage:(p:number)=>void}){
 return <nav className="cl2-pager" aria-label="Pages"><span>{nice(total)} {unit}</span><div><button disabled={page<=1} onClick={()=>onPage(page-1)}><ChevronLeft size={15}/> Previous</button><span>Page {page} of {nice(pages)}</span><button disabled={page>=pages} onClick={()=>onPage(page+1)}>Next <ChevronRight size={15}/></button></div></nav>;
}

const KIND_TABS=[{id:'',label:'All'},{id:'video',label:'Videos'},{id:'document',label:'Documents'},{id:'html',label:'HTML pages'},{id:'other',label:'Other files'}];
function CourseView({nav,go}:{nav:Nav;go:(n:Nav,replace?:boolean)=>void}){
 const qs=new URLSearchParams({page:String(nav.cp||1)});if(nav.co!==undefined)qs.set('offering',nav.co);if(nav.kind)qs.set('kind',nav.kind);
 const {data,error,loading}=useData<Workspace>('/api/campus/courses/'+nav.code+'?'+qs);
 const [drawer,setDrawer]=useState(false);
 const items=data?.items||[];
 const current=items.find(x=>x.id===nav.res)||items[0];
 const idx=current?items.indexOf(current):-1;
 const pick=(r:Resource)=>{setDrawer(false);go({...nav,res:r.id},true)};
 if(loading&&!data)return <State title="Opening course…" spin/>;
 if(error)return <><button className="mo-link-back" onClick={()=>window.history.back()}><ChevronLeft size={15}/> Back</button><Problem error={error}/></>;
 if(!data)return null;
 const off=data.offerings.find(o=>o.value===data.offering);
 const count=(k:string)=>!off?0:k==='video'?off.videos:k==='document'?off.documents:k==='html'?off.html:k==='other'?off.other:off.files;
 const pages=Math.max(1,Math.ceil(data.total/data.limit));
 return <>
  <div className="mo-course-heading cl2-course-head">
   <button className="mo-link-back" onClick={()=>data.department?go({view:'courses',dept:data.department}):go({view:'courses'})}><ChevronLeft size={15}/> {data.department||'All courses'}</button>
   <h2>{courseName(data)}</h2>
   <p><span>{[data.instructor,data.institution].filter(Boolean).join(' · ')||'Course details from the archive'}</span><span className="mo-sep"/><span>Course ID {data.code}</span>{data.titleVerified&&<><span className="mo-sep"/><span className="cl2-verified"><ShieldCheck size={14}/> Verified title</span></>}</p>
  </div>
  {data.offerings.length>1&&<div className="cl2-chips" role="tablist" aria-label="Academic offering">{data.offerings.map(o=><button key={o.value||'web'} role="tab" aria-selected={o.value===data.offering} className={o.value===data.offering?'on':''} onClick={()=>go({...nav,co:o.value,cp:undefined,res:undefined},true)}>{o.label}<small>{nice(o.files)}</small></button>)}</div>}
  <button className="mo-lessons-mobile-button" onClick={()=>setDrawer(true)}><Layers size={17}/> Course contents ({nice(data.total)}) <ChevronRight size={15}/></button>
  <div className="mo-course-layout">
   {drawer&&<button className="mo-lessons-backdrop" aria-label="Close course contents" onClick={()=>setDrawer(false)}/>}
   <aside className={'mo-lessons-panel'+(drawer?' mo-lessons-open':'')} aria-label="Course contents">
    <div className="mo-lessons-head"><div><small>{off?.label?.toUpperCase()||'COURSE'}</small><h3>Course contents</h3></div><button className="mo-close-mobile-lessons" onClick={()=>setDrawer(false)} aria-label="Close course contents"><X size={18}/></button></div>
    <div className="mo-lesson-filters">{KIND_TABS.filter(t=>!t.id||count(t.id)>0).map(t=><button key={t.id} className={(data.kind||'')===t.id?'active':''} onClick={()=>go({...nav,kind:t.id||undefined,cp:undefined,res:undefined},true)}>{t.label} <small>{nice(count(t.id))}</small></button>)}</div>
    <div className="mo-lesson-group">{items.length?items.map((r,k)=>{const Icon=resourceIcon(r);return <button className={'mo-lesson-item'+(r.id===current?.id?' active':'')} key={r.id} onClick={()=>pick(r)} aria-current={r.id===current?.id?'true':undefined}>
      <span className="mo-lesson-num">{isVideo(r)&&r.lecture_no?String(r.lecture_no).padStart(2,'0'):<Icon size={16}/>}</span>
      <span><strong>{r.lecture_title||r.name}</strong><small>{r.lecture_title?r.name+' · ':''}{r.module_no?'Module '+r.module_no+' · ':''}{sizeOf(r.size_bytes)}</small></span>
      {r.id===current?.id&&<span className="mo-lesson-active"/>}</button>}):<State icon={FolderOpen} title="Nothing in this view" text="Choose another type or semester."/>}</div>
    {pages>1&&<Pager page={nav.cp||1} pages={pages} total={data.total} unit="files" onPage={p=>go({...nav,cp:p,res:undefined},true)}/>}
    <div className="mo-original-note"><ShieldCheck size={16}/><p>Lecture titles appear only when they are tied to the exact file. Other files keep their original names.</p></div>
   </aside>
   <section className="mo-study-panel" aria-label="Viewer">{current?<Viewer r={current} onPrev={idx>0?()=>pick(items[idx-1]):undefined} onNext={idx<items.length-1?()=>pick(items[idx+1]):undefined}/>:<State icon={MonitorPlay} title="Select a resource" text="Choose a lecture or document from the course contents."/>}</section>
  </div>
 </>;
}

function Viewer({r,onPrev,onNext}:{r:Resource;onPrev?:()=>void;onNext?:()=>void}){
 const [text,setText]=useState<{id:string;body:string;error:string}|null>(null);
 const [failed,setFailed]=useState('');
 useEffect(()=>{setFailed('');setText(null);if(!isText(r))return;
  if(Number(r.size_bytes)>2*1048576){setText({id:r.id,body:'',error:'This text file is too large to show here. Use Download to open it.'});return}
  const c=new AbortController();
  fetch(fileUrl(r.id,true),{signal:c.signal}).then(async x=>{if(!x.ok)throw Error(x.status===404?'This file is not available on the library storage right now.':'Could not open the file (HTTP '+x.status+').');setText({id:r.id,body:await x.text(),error:''})}).catch(e=>{if(e.name!=='AbortError')setText({id:r.id,body:'',error:e.message})});
  return()=>c.abort();
 },[r]);
 const title=r.lecture_title||r.name;
 return <>
  <div className="mo-study-top"><div><small>NOW VIEWING{r.title_source?' · TITLE: '+r.title_source.toUpperCase():''}</small><h3>{title}</h3>{r.lecture_title&&<span className="cl2-filename">{r.name}</span>}</div><span className="mo-content-type">{r.ext.replace('.','').toUpperCase()||r.kind}</span></div>
  <div className="mo-study-viewer cl2-viewer">
   {failed?<State icon={AlertTriangle} title="This file could not be played" text={failed}/>:
    isVideo(r)?<video key={r.id} controls playsInline preload="metadata" src={fileUrl(r.id,true)} onError={()=>setFailed('The video is not available on the library storage right now, or its format is not supported by this browser.')}/>:
    isPdf(r)?<iframe key={r.id} className="mo-pdf-frame" title={title} src={fileUrl(r.id,true)}/>:
    isHtml(r)?<iframe key={r.id} className="mo-html-frame" title={title} sandbox="" referrerPolicy="no-referrer" src={fileUrl(r.id,true)}/>:
    isImage(r)?<img className="cl2-image" src={fileUrl(r.id,true)} alt={title}/>:
    isText(r)?(!text?<State title="Opening text…" spin/>:text.error?<State icon={AlertTriangle} title="Could not open this text" text={text.error}/>:<pre className="cl2-text">{text.body}</pre>):
    <State icon={File} title="No preview for this file type" text={r.ext.toUpperCase().replace('.','')+' · '+sizeOf(r.size_bytes)+(downloadable(r)?'. Download it to open on your computer.':'. This file type is not offered for download.')}/>}
  </div>
  <div className="mo-viewer-footer"><div>{downloadable(r)&&<a className="cl2-download" href={fileUrl(r.id)} download><Download size={16}/> Download</a>}</div>
   <div><button disabled={!onPrev} onClick={onPrev}><ChevronLeft size={16}/> Previous</button><button className="mo-next" disabled={!onNext} onClick={onNext}>Next <ChevronRight size={16}/></button></div></div>
 </>;
}

function UncategorizedView({nav,go}:{nav:Nav;go:(n:Nav,replace?:boolean)=>void}){
 const [q,setQ]=useState('');
 const url=nav.src?'/api/campus/uncategorized?'+new URLSearchParams({source:nav.src,path:nav.path||'',page:String(nav.up||1)}):'/api/campus/uncategorized'+(nav.q?'?q='+encodeURIComponent(nav.q):'');
 const {data,error,loading}=useData<{collections?:{id:string;name:string;files:number}[];results?:(Resource&{collection:string;source_id:string;folder_rel_path:string})[]}&Partial<Folder>>(url);
 const open=useMemo(()=>data?.files?.find(f=>f.id===nav.res),[data,nav.res]);
 const crumbs=(nav.path||'').split('/').filter(Boolean);
 return <>
  <Intro eyebrow="ORIGINAL ARCHIVE FOLDERS" title="Uncategorized resources" note="Material that is not linked to a course ID, shown with its original folder and file names."/>
  {!nav.src&&<form className="mo-catalogue-toolbar cl2-toolbar" onSubmit={e=>{e.preventDefault();go({view:'uncategorized',q:q.trim()||undefined})}}><label><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search file names (3+ letters)…" aria-label="Search uncategorized files"/></label><button className="cl2-button" type="submit">Search</button></form>}
  {nav.src&&<nav className="cl2-crumbs" aria-label="Folder path"><button onClick={()=>go({view:'uncategorized'})}>All collections</button>{data?.collection&&<><ChevronRight size={14}/><button onClick={()=>go({view:'uncategorized',src:nav.src,path:''})}>{data.collection}</button></>}{crumbs.map((c,k)=><span key={k}><ChevronRight size={14}/><button onClick={()=>go({view:'uncategorized',src:nav.src,path:crumbs.slice(0,k+1).join('/')})}>{c}</button></span>)}</nav>}
  {loading&&!data?<State title="Loading folders…" spin/>:error?<Problem error={error}/>:!nav.src?(
   data?.results?<div className="mo-catalogue-list">{data.results.length?data.results.map(f=><button key={f.id} className="mo-catalogue-row cl2-row" onClick={()=>go({view:'uncategorized',src:f.source_id,path:f.folder_rel_path,res:f.id})}><span className="mo-course-icon"><File size={18}/></span><span className="mo-catalogue-name"><strong>{f.name}</strong><small>{f.collection} / {f.folder_rel_path||'(top level)'} · {sizeOf(f.size_bytes)}</small></span><ChevronRight size={16}/></button>):<State icon={Search} title="No files match" text="Try another part of the file name."/>}</div>:
   data?.collections?.length?<div className="mo-dept-grid">{data.collections.map(c=><button key={c.id} className="mo-dept-card" onClick={()=>go({view:'uncategorized',src:c.id,path:''})}><span className="mo-dept-icon mo-bg-teal"><FolderOpen size={18}/></span><strong>{c.name}</strong><small>{nice(c.files)} files</small><ChevronRight size={16}/></button>)}</div>:
   <State icon={FolderOpen} title="No uncategorized resources available" text="Folders appear here once the college approves them for students."/>):
   <div className={'cl2-browser'+(open?' with-viewer':'')}>
    <div className="mo-catalogue-list">
     {data?.folders?.map(f=><button key={f.path} className="mo-catalogue-row cl2-row" onClick={()=>go({view:'uncategorized',src:nav.src,path:f.path})}><span className="mo-course-icon"><Folder size={18}/></span><span className="mo-catalogue-name"><strong>{f.name}</strong><small>{nice(f.files)} files inside</small></span><ChevronRight size={16}/></button>)}
     {data?.files?.map(f=>{const Icon=resourceIcon(f);return <button key={f.id} className={'mo-catalogue-row cl2-row'+(f.id===nav.res?' cl2-row-on':'')} onClick={()=>go({...nav,res:f.id},true)}><span className="mo-course-icon"><Icon size={18}/></span><span className="mo-catalogue-name"><strong>{f.name}</strong><small>{f.kind} · {sizeOf(f.size_bytes)}</small></span><ChevronRight size={16}/></button>})}
     {!data?.folders?.length&&!data?.files?.length&&<State icon={FolderOpen} title="This folder is empty" text="No files here are available to students."/>}
     {(data?.totalFiles||0)>(data?.limit||100)&&<Pager page={nav.up||1} pages={Math.ceil((data?.totalFiles||0)/(data?.limit||100))} total={data?.totalFiles||0} unit="files in this folder" onPage={p=>go({...nav,up:p,res:undefined},true)}/>}
    </div>
    {open&&<section className="mo-study-panel" aria-label="Viewer"><Viewer r={open}/></section>}
   </div>}
 </>;
}
