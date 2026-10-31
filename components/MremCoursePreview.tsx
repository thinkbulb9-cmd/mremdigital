'use client';
import {useMemo,useState,useEffect} from 'react';
import {ArrowDownToLine,ArrowLeft,ArrowRight,BookOpen,CheckCircle2,ChevronDown,ChevronRight,Clock3,Code2,Database,ExternalLink,File,FileText,Folder,FolderOpen,GraduationCap,Grid2X2,HardDrive,LayoutGrid,List,Menu,MonitorPlay,Play,Search,ShieldCheck,SlidersHorizontal,Video, X,HelpCircle,Layers3,Compass,Filter,FolderTree,Eye,Archive,School,Server,Info} from 'lucide-react';
import './mrem-course-preview.css';

type FileKind='video'|'pdf'|'html'|'text';
type Resource={id:string,name:string,display:string,kind:FileKind,module:string,folder:string,info:string};
type Course={code:string,title:string,department:string,instructor:string,school:string,semester:string,folder:string,verified:boolean,description:string,resources:Resource[],tone:string};
type Modal={resource:Resource,course:Course}|null;

const semesters=['All semesters','Jan–Apr 2021','Jul–Dec 2021','Jan–Apr 2022','Jul–Dec 2022','Jan–Apr 2023','Jul–Dec 2023','Jan–Apr 2024'];
const departments=[
 {code:'AE',name:'Aerospace Engineering'},
 {code:'CSE',name:'Computer Science & Engineering'},
 {code:'EEE',name:'Electrical Engineering'},
 {code:'MECH',name:'Mechanical Engineering'},
 {code:'ECE',name:'Electronics & Communication'},
 {code:'CIVIL',name:'Civil Engineering'},
 {code:'IT',name:'Information Technology'},
 {code:'AIML',name:'AI & Machine Learning'},
 {code:'DS',name:'Data Science'}
];
const sampleResources:Resource[]=[
 {id:'l01',name:'mod01lec01.mp4',display:'Module 01 · Lecture 01',kind:'video',module:'Module 01',folder:'101101086',info:'Filename visible in supplied server screenshot'},
 {id:'l02',name:'mod01lec02.mp4',display:'Module 01 · Lecture 02',kind:'video',module:'Module 01',folder:'101101086',info:'Filename visible in supplied server screenshot'},
 {id:'l03',name:'mod01lec03.mp4',display:'Module 01 · Lecture 03',kind:'video',module:'Module 01',folder:'101101086',info:'Filename visible in supplied server screenshot'},
 {id:'l04',name:'mod01lec04.mp4',display:'Module 01 · Lecture 04',kind:'video',module:'Module 01',folder:'101101086',info:'Filename visible in supplied server screenshot'},
 {id:'l05',name:'mod02lec06.mp4',display:'Module 02 · Lecture 06',kind:'video',module:'Module 02',folder:'101101086',info:'Filename visible in supplied server screenshot'},
 {id:'notes',name:'example-notes.pdf',display:'PDF preview example',kind:'pdf',module:'Example material',folder:'PREVIEW',info:'Synthetic demo file — not from the college drive'},
 {id:'html',name:'example-index.html',display:'HTML document preview example',kind:'html',module:'Example material',folder:'PREVIEW',info:'Safe static sample — not copied from the drive'}
];
const courses:Course[]=[
 {code:'101101086',title:'Introduction to Launch Vehicle Analysis and Design',department:'AE',instructor:'Prof. Ashok Joshi',school:'IIT Bombay',semester:'Jan–Apr 2021',folder:'Jan_Apr_2021/101/101101086',verified:true,description:'Learn how launch vehicles are analysed and designed, including mission trajectory fundamentals.',resources:sampleResources,tone:'navy'},
 {code:'101101087',title:'Lighter than Air Systems',department:'AE',instructor:'Prof. Rajkumar S. Pant',school:'IIT Bombay',semester:'Jan–Apr 2021',folder:'Jan_Apr_2021/101/101101087',verified:true,description:'Aerospace course covering lighter-than-air flight systems and their engineering.',resources:[],tone:'sky'},
 {code:'101104086',title:'Computational Science in Engineering',department:'AE',instructor:'Prof. Ashoke De',school:'IIT Kanpur',semester:'Jan–Apr 2021',folder:'Jan_Apr_2021/101/101104086',verified:true,description:'Computational techniques and scientific approaches to engineering problems.',resources:[],tone:'violet'},
 {code:'101110086',title:'Course title awaiting metadata verification',department:'AE',instructor:'Not yet verified',school:'Course code found in screenshot',semester:'Jan–Apr 2021',folder:'Jan_Apr_2021/101/101110086',verified:false,description:'The folder number is visible in your screenshot. Its official course title is not yet verified.',resources:[],tone:'slate'}
];
const otherCollections=['Jan_Apr_2021','Jan_Apr_2023','Jan_Apr_2024','Jan-Apr-2022','Jul_Dec_2022','Jul_Dec_2023','Jul_Dec-2021','Web_courses'];
const word=(kind:FileKind)=>kind==='video'?'MP4':kind==='pdf'?'PDF':kind==='html'?'HTML':'TXT';
const infoFor=(kind:FileKind)=>kind==='video'?<Video size={16}/>:kind==='pdf'?<FileText size={16}/>:kind==='html'?<Code2 size={16}/>:<File size={16}/>;
const official=(code:string)=>'https://nptel.ac.in/courses/'+code;
function Brand({compact=false}:{compact?:boolean}){
 return <div className={'ml-brand '+(compact?'ml-compact':'')}>
   <div className="ml-logo"><img src="https://mrem.ac.in/wp-content/uploads/2022/06/mrem-logo-copy-copy.png" alt="MREM official college emblem" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.add('ml-logo-fallback')}}/><GraduationCap className="ml-logo-fb" size={22}/></div>
   <div><strong>MREM <span>DIGITAL LIBRARY</span></strong><small>Malla Reddy Engineering College & Management Sciences</small></div>
 </div>;
}
export default function MremCoursePreview(){
 const [query,setQuery]=useState('');
 const [department,setDepartment]=useState('all');
 const [semester,setSemester]=useState('All semesters');
 const [server,setServer]=useState('server1');
 const [layout,setLayout]=useState<'grid'|'table'>('grid');
 const [section,setSection]=useState<'courses'|'files'>('courses');
 const [course,setCourse]=useState<Course|null>(null);
 const [modal,setModal]=useState<Modal>(null);
 const [navOpen,setNavOpen]=useState(false);
 const [onlyVerified,setOnlyVerified]=useState(false);
 const [fileFormat,setFileFormat]=useState('All formats');
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return courses.filter(c=>(department==='all'||c.department===department)&&
    (semester==='All semesters'||c.semester===semester)&&
    (!onlyVerified||c.verified)&&
    (!q||[c.title,c.code,c.department,c.instructor,c.folder,c.school].some(v=>v.toLowerCase().includes(q))));
 },[department,semester,query,onlyVerified]);
 const raw=useMemo(()=>{
  const items=courses.flatMap(c=>c.resources.filter(r=>r.folder!=='PREVIEW').map(r=>({...r,course:c})));
  return items.filter(x=>(!query||[x.name,x.display,x.course.title,x.course.code].some(t=>t.toLowerCase().includes(query.toLowerCase())))&&
     (department==='all'||x.course.department===department)&&
     (fileFormat==='All formats'||word(x.kind)===fileFormat));
 },[query,department,fileFormat]);
 const activeResources=course?.resources||[];
 const selectedDep=departments.find(d=>d.code===department);
 function goHome(){setCourse(null);setSection('courses');setNavOpen(false);}
 function changeDep(value:string){setDepartment(value);setCourse(null);setSection('courses');setNavOpen(false);}
 function selectCourse(c:Course){setCourse(c);setSection('courses');window.scrollTo({top:0,behavior:'smooth'});}
 function viewResource(r:Resource,c:Course){setModal({resource:r,course:c});}
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')setModal(null)};document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn)},[]);
 return <div className="ml-shell">
  {navOpen&&<button className="ml-shade" aria-label="Close navigation" onClick={()=>setNavOpen(false)}/>}
  <aside className={'ml-sidebar '+(navOpen?'is-open':'')}>
   <div className="ml-sidebar-top"><Brand compact/><button onClick={()=>setNavOpen(false)} className="ml-side-close" aria-label="Close menu"><X size={18}/></button></div>
   <div className="ml-nav-label">LIBRARY</div>
   <button className={'ml-side-link '+(section==='courses'&&department==='all'&&!course?'is-active':'')} onClick={()=>{goHome();setDepartment('all')}}><LayoutGrid size={18}/> Discover courses <ChevronRight size={15}/></button>
   <button className={'ml-side-link '+(section==='files'?'is-active':'')} onClick={()=>{setSection('files');setCourse(null);setNavOpen(false)}}><FolderOpen size={18}/> File explorer <ChevronRight size={15}/></button>
   <div className="ml-nav-label ml-nav-gap">STORAGE SOURCES</div>
   <button className={'ml-source '+(server==='server1'?'active':'')} onClick={()=>{setServer('server1');setNavOpen(false)}}><HardDrive size={19}/><span><strong>Server 01</strong><small>MREM1 · E: Drive</small></span><span className="ml-source-dot"/></button>
   <div className="ml-future"><Server size={17}/><span>Other servers</span><small>After pilot</small></div>
   <div className="ml-nav-label ml-nav-gap">DEPARTMENTS</div>
   <button className={'ml-dep '+(department==='all'?'active':'')} onClick={()=>changeDep('all')}><Layers3 size={16}/> All departments <span>{departments.length}</span></button>
   {departments.map(d=><button key={d.code} className={'ml-dep '+(department===d.code?'active':'')} onClick={()=>changeDep(d.code)}><span className="ml-dep-dot"/>{d.name}<span>{courses.filter(c=>c.department===d.code&&c.verified).length||'—'}</span></button>)}
   <div className="ml-sidebar-bottom"><span className="ml-online-indicator"/><div><strong>Offline-first architecture</strong><small>Preview uses reference data</small></div></div>
  </aside>
  <div className="ml-stage">
   <header className="ml-header">
    <button className="ml-hamburger" aria-label="Open navigation" onClick={()=>setNavOpen(true)}><Menu size={20}/></button>
    <div className="ml-breadcrumb"><span onClick={goHome}>Digital Library</span><ChevronRight size={14}/><span>{course?course.title:section==='files'?'File explorer':'Course catalogue'}</span></div>
    <div className="ml-header-right"><span className="ml-network"><span/> CAMPUS ACCESS</span><a href="https://nptel.ac.in/courses" target="_blank" rel="noopener noreferrer" className="ml-top-link">NPTEL reference <ExternalLink size={13}/></a><div className="ml-avatar"><GraduationCap size={18}/></div></div>
   </header>
   <main className="ml-main">
    <div className="ml-preview-warning"><Info size={16}/><span><strong>UI CONCEPT · SAMPLE DATA.</strong> Course titles verified from NPTEL; E: drive mapping and media connections are not active. No login required in this preview.</span></div>
    {!course?<><section className="ml-hero">
      <div className="ml-hero-copy">
       <div className="ml-overline"><span className="ml-orb"/> MREM LEARNING RESOURCE HUB</div>
       <h1>Everything to learn.<br/><em>One place to explore.</em></h1>
       <p>Explore course lectures, academic resources and materials from the college's on-premises digital archive.</p>
       <div className="ml-hero-tools"><button onClick={()=>{setSection('courses');document.getElementById('ml-listings')?.scrollIntoView({behavior:'smooth'})}}><Compass size={16}/> Browse courses <ArrowRight size={16}/></button><div className="ml-hero-sub"><ShieldCheck size={17}/> Designed for your campus network</div></div>
      </div>
      <div className="ml-hero-art" aria-hidden="true"><div className="ml-hero-ring ring1"/><div className="ml-hero-ring ring2"/><div className="ml-hero-card hc1"><Video size={20}/><div><strong>Video lessons</strong><small>Play & learn</small></div></div><div className="ml-hero-card hc2"><FileText size={20}/><div><strong>Study materials</strong><small>Read & download</small></div></div><div className="ml-hero-book"><BookOpen size={74} strokeWidth={1.2}/></div></div>
    </section>
    <div className="ml-stats">
     <div><span className="ml-stat-icon"><HardDrive size={20}/></span><section><strong>Server 01</strong><small>Current sample storage</small></section></div>
     <div><span className="ml-stat-icon"><BookOpen size={20}/></span><section><strong>3 verified</strong><small>NPTEL course titles</small></section></div>
     <div><span className="ml-stat-icon"><Layers3 size={20}/></span><section><strong>{departments.length} departments</strong><small>Browse & explore</small></section></div>
     <div><span className="ml-stat-icon"><MonitorPlay size={20}/></span><section><strong>Play · View · Save</strong><small>Browser-based experience</small></section></div>
    </div>
    <section className="ml-catalog" id="ml-listings">
     <div className="ml-section-heading"><div><span className="ml-section-eyebrow">EXPLORE THE ARCHIVE</span><h2>{section==='files'?'File Explorer':selectedDep?.name||'Explore Courses'}</h2><p>{section==='files'?'Browse example lecture filenames observed in the screenshots.':'Discover verified NPTEL course titles and their matching screenshot folder codes.'}</p></div><div className="ml-view-toggle"><button className={layout==='grid'?'active':''} aria-label="Grid view" onClick={()=>setLayout('grid')}><Grid2X2 size={16}/></button><button className={layout==='table'?'active':''} aria-label="Table view" onClick={()=>setLayout('table')}><List size={17}/></button></div></div>
     <div className="ml-filters">
      <label className="ml-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search course title, NPTEL ID, instructor, file..." /></label>
      <label className="ml-select"><HardDrive size={16}/><select value={server} onChange={e=>setServer(e.target.value)}><option value="server1">Server 01 · E:</option></select><ChevronDown size={14}/></label>
      {section==='courses'?<><label className="ml-select"><Clock3 size={16}/><select value={semester} onChange={e=>setSemester(e.target.value)}>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select><ChevronDown size={14}/></label><button className={'ml-verified '+(onlyVerified?'active':'')} onClick={()=>setOnlyVerified(v=>!v)}><CheckCircle2 size={16}/> Verified only</button></>:<label className="ml-select"><Filter size={16}/><select value={fileFormat} onChange={e=>setFileFormat(e.target.value)}>{['All formats','MP4','PDF','HTML'].map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label>}
     </div>
     <div className="ml-resultline"><span>{section==='courses'?filtered.length:raw.length} <strong>{section==='courses'?'course entries':'example files'}</strong></span><span>Source: MREM1 (E:) · Jan_Apr_2021</span></div>
     {section==='courses'?(filtered.length?(layout==='grid'?<div className="ml-course-grid">{filtered.map(c=><CourseCard key={c.code} course={c} onClick={()=>selectCourse(c)}/>)}</div>:<div className="ml-table"><div className="ml-thead"><span>COURSE</span><span>NPTEL ID</span><span>INSTRUCTOR</span><span>STATUS</span></div>{filtered.map(c=><button key={c.code} className="ml-trow" onClick={()=>selectCourse(c)}><span><strong>{c.title}</strong><small>{departments.find(d=>d.code===c.department)?.name}</small></span><span>{c.code}</span><span>{c.instructor}</span><span>{c.verified?'Metadata verified':'Review needed'}</span></button>)}</div>):<EmptyState onReset={()=>{setDepartment('all');setQuery('');setSemester('All semesters')}}/>):raw.length?<div className="ml-table ml-files"><div className="ml-thead"><span>FILE / RESOURCE</span><span>COURSE CODE</span><span>TYPE</span><span>ACTION</span></div>{raw.map(x=><div key={x.id} className="ml-trow"><span className="ml-file-desc">{infoFor(x.kind)}<span><strong>{x.name}</strong><small>{x.course.title}</small></span></span><span>{x.course.code}</span><span>{word(x.kind)}</span><span><button className="ml-mini-action" onClick={()=>viewResource(x,x.course)}><Play size={14}/> Sample player</button></span></div>)}</div>:<EmptyState onReset={()=>{setDepartment('all');setQuery('');setFileFormat('All formats')}}/>}
    </section>
    <section className="ml-source-section"><div><h2>Storage & folder structure</h2><p>Browse original disk folders without changing any source filenames.</p></div><div className="ml-storage-card"><div className="ml-diskmark"><HardDrive size={24}/></div><div><strong>Server 01 — MREM1 (E:)</strong><small>Windows physical drive · screenshot reference</small></div><span className="ml-diskbadge">PILOT SOURCE</span></div><div className="ml-folderchips">{otherCollections.map(f=><span key={f}><Folder size={15}/>{f}</span>)}</div><div className="ml-meta-note"><Info size={16}/> These folder names are transcribed from the screenshot; a direct Windows scan is required to discover every actual file.</div></section>
   </>:<><div className="ml-backline"><button onClick={()=>setCourse(null)}><ArrowLeft size={17}/> Back to all courses</button><span>Server 01 / Jan_Apr_2021 / {course.code}</span></div>
    <div className={'ml-course-hero ml-tonal-'+course.tone}>
     <div><div className="ml-course-meta"><span>{departments.find(d=>d.code===course.department)?.name}</span><span>NPTEL ID: {course.code}</span></div><h1>{course.title}</h1><p>{course.description}</p><div className="ml-prof"><span><GraduationCap size={17}/> {course.instructor}</span><span><School size={17}/> {course.school}</span></div><div className="ml-course-actions"><a href={official(course.code)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> NPTEL course page</a><span>{course.verified?'Verified title':'Verification needed'}</span></div></div><div className="ml-course-large-symbol"><BookOpen size={90} strokeWidth={1}/></div>
    </div>
    <div className="ml-detail-grid"><div className="ml-lectures"><div className="ml-section-heading"><div><span className="ml-section-eyebrow">RESOURCES & LECTURES</span><h2>Course content</h2><p>Example filenames and viewers. Real disk streaming will be enabled after the Windows indexing test.</p></div></div>
      {activeResources.length?<div className="ml-resource-list">{activeResources.map((r,i)=><div className="ml-resource-row" key={r.id}><div className={'ml-file-icon type-'+r.kind}>{infoFor(r.kind)}</div><div className="ml-resource-info"><strong>{r.display}</strong><small>{r.name} · {r.module}</small></div><span className="ml-format">{word(r.kind)}</span><div className="ml-resource-actions"><button onClick={()=>viewResource(r,course)}>{r.kind==='video'?<Play size={15}/>:<Eye size={15}/>} {r.kind==='video'?'Play':'View'}</button><button onClick={()=>viewResource(r,course)}><ArrowDownToLine size={15}/> Sample</button></div></div>)}</div>:<div className="ml-no-lessons"><FolderOpen size={34}/><h3>File mapping not completed</h3><p>This course ID is visible in the supplied screenshot, but its lecture files haven't been indexed from the Windows E: drive.</p><a href={official(course.code)} target="_blank" rel="noopener noreferrer">Open verified NPTEL reference <ExternalLink size={14}/></a></div>}
    </div><aside className="ml-course-side"><h3>Course details</h3><dl><dt>NPTEL course ID</dt><dd>{course.code}</dd><dt>Department</dt><dd>{departments.find(d=>d.code===course.department)?.name}</dd><dt>Academic archive</dt><dd>Jan–Apr 2021</dd><dt>Source drive</dt><dd>Server 01 · MREM1 (E:)</dd><dt>Lectures detected</dt><dd>{course.code==='101101086'?'Example filenames from screenshot':'Awaiting disk scan'}</dd></dl><div className="ml-path"><span>SCREENSHOT PATH REFERENCE</span><code>E:\{course.folder.replaceAll('/','\\')}</code></div><div className="ml-card-notice"><ShieldCheck size={17}/> No login interface in final campus version; actual storage remains read-only.</div></aside></div>
   </>}
   <footer className="ml-footer"><span>© MREM Digital Library · Interface concept</span><span>Inspired by NPTEL academic browsing · Content titles credited to NPTEL · Actual disk mapping pending</span></footer>
   </main>
  </div>
  {modal&&<div className="ml-modal-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="ml-modal" role="dialog" aria-modal="true" aria-label={'Sample preview: '+modal.resource.name}>
   <div className="ml-modal-head"><div><small>PREVIEW MODE · SAMPLE CONTENT</small><h3>{modal.resource.display}</h3></div><button onClick={()=>setModal(null)} aria-label="Close preview"><X size={19}/></button></div>
   <div className="ml-modal-body">{modal.resource.kind==='video'?<div><video src="/demo/mrem-preview.mp4" controls playsInline preload="metadata"/><div className="ml-player-note"><Info size={16}/> This is a generated playback sample, NOT the original NPTEL lecture. Actual local video will play after E: drive mapping.</div></div>:modal.resource.kind==='pdf'?<iframe title="Sample PDF" src="/api/files/12/download?inline=1"/>:modal.resource.kind==='html'?<iframe title="Safe example HTML" sandbox="" srcDoc={'<!doctype html><html><body style="font-family:Arial;padding:24px"><h1>Sample HTML course index</h1><p>Local legacy HTML will be parsed or safely previewed after indexing.</p><ol><li>Lecture 01</li><li>Lecture 02</li><li>Course materials</li></ol></body></html>'}/>:<pre>Sample text preview</pre>}</div>
   <div className="ml-modal-footer"><span><Info size={15}/> Demonstration only — no file downloaded from the college.</span>{modal.resource.kind==='video'?<a href="/demo/mrem-preview.mp4" download="mrem-demo-video.mp4"><ArrowDownToLine size={15}/> Download sample MP4</a>:modal.resource.kind==='pdf'?<a href="/api/files/12/download"><ArrowDownToLine size={15}/> Download sample PDF</a>:null}</div>
  </div></div>}
 </div>;
}
function CourseCard({course,onClick}:{course:Course;onClick:()=>void}){
 return <button className="ml-course-card" onClick={onClick}><div className={'ml-cover ml-tonal-'+course.tone}><div className="ml-cover-bg"><span/><span/><span/></div><div className="ml-cover-label">NPTEL COURSE</div><div className="ml-cover-icon"><BookOpen size={48} strokeWidth={1.2}/></div><span className="ml-cover-code">{course.code}</span></div><div className="ml-course-content"><div className="ml-course-tags"><span>{course.department}</span><span className={course.verified?'verified':'pending'}>{course.verified?<CheckCircle2 size={12}/>:<Clock3 size={12}/>} {course.verified?'Verified':'To verify'}</span></div><h3>{course.title}</h3><p>{course.instructor} · {course.school}</p><div className="ml-course-footer"><span><HardDrive size={14}/> Server 01</span><span>Explore course <ArrowRight size={16}/></span></div></div></button>;
}
function EmptyState({onReset}:{onReset:()=>void}){return <div className="ml-empty"><Search size={29}/><h3>No matching verified catalogue entries</h3><p>Only courses identifiable from the supplied screenshot are shown. More departments will populate after the Windows drive scan.</p><button onClick={onReset}>Clear filters <ArrowRight size={15}/></button></div>}
