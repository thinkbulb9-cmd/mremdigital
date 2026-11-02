'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Bookmark,Check,ChevronLeft,ChevronRight,Command,FileCode2,FileText,Globe2,GraduationCap,Layers3,LibraryBig,Menu,MonitorPlay,Pause,Play,Search,ShieldCheck,Video,X} from 'lucide-react';
import './ui-experience-preview.css';
const B='/ux-preview';
const depts=[
 {id:'computer-science',name:'Computer Science & Engineering',art:'computer',about:'Computing, systems and software'},
 {id:'ai',name:'AI & Machine Learning',art:'ai',about:'Intelligent and data-driven systems'},
 {id:'mechanical',name:'Mechanical Engineering',art:'mechanical',about:'Precision, machines and design'},
 {id:'electronics',name:'Electronics & Communication',art:'electronics',about:'Circuits, signals and connectivity'},
 {id:'civil',name:'Civil Engineering',art:'civil',about:'Structures and infrastructure'},
 {id:'aerospace',name:'Aerospace Engineering',art:'aerospace',about:'Flight and propulsion systems'}
];
const courses=[
 {id:'demo-001',name:'Data Structures & Algorithms',dept:'computer-science',kind:'Video',lessons:36},
 {id:'demo-002',name:'Introduction to Computer Networks',dept:'computer-science',kind:'Web',lessons:28},
 {id:'demo-003',name:'Machine Learning Fundamentals',dept:'ai',kind:'Video',lessons:31},
 {id:'demo-004',name:'Mechanical System Design',dept:'mechanical',kind:'Video',lessons:25},
 {id:'demo-005',name:'Principles of Electronics',dept:'electronics',kind:'Web',lessons:20},
 {id:'demo-006',name:'Structural Engineering Basics',dept:'civil',kind:'Video',lessons:24},
 {id:'demo-007',name:'Aerodynamics Foundations',dept:'aerospace',kind:'Video',lessons:27}
];
const lessonItems=[
 {id:'01',title:'Introduction and course overview',type:'video',label:'12 min'},
 {id:'02',title:'Core ideas and important concepts',type:'video',label:'24 min'},
 {id:'03',title:'Practical examples and applications',type:'video',label:'31 min'},
 {id:'04',title:'Supporting course notes',type:'pdf',label:'PDF'},
 {id:'05',title:'Interactive web course reading',type:'html',label:'HTML'}
];
const banners=[
 {title:'Knowledge, beautifully organized.',tag:'EXPLORE MREM',copy:'Courses, lectures and study materials in one beautifully simple learning environment.',art:'academic.svg',style:'berry'},
 {title:'Find the subject that moves you.',tag:'DEPARTMENT COLLECTIONS',copy:'Discover the next topic through focused academic collections.',art:'library.svg',style:'violet'},
 {title:'Designed for deeper learning.',tag:'ONE LEARNING WORKSPACE',copy:'Open a lesson, stay focused and continue at your own pace.',art:'innovation.svg',style:'blue'}
];
function RouteInfo(path:string){
 const p=path.replace(/^\/ux-preview\/?/,'').split('/').filter(Boolean);
 if(p[0]==='departments'&&p[1])return {type:'department',dept:p[1]};
 if(p[0]==='departments')return {type:'departments'};
 if(p[0]==='courses'&&p[1]&&p[2]==='lesson')return {type:'lesson',course:p[1],lesson:p[3]};
 if(p[0]==='courses'&&p[1])return {type:'course',course:p[1]};
 if(p[0]==='courses')return {type:'courses'};
 if(p[0]==='web-courses')return {type:'web'};
 return {type:'home'};
}
function DepartmentCard({d}:{d:typeof depts[number]}){
 return <Link className="xp-department-card" href={B+'/departments/'+d.id}><div className="xp-department-image" style={{backgroundImage:'url(/art/departments/'+d.art+'.svg)'}}/><div className="xp-department-copy"><div><h3>{d.name}</h3><p>{d.about}</p></div><span><ArrowRight size={18}/></span></div></Link>;
}
function CourseCard({c}:{c:typeof courses[number]}){
 const d=depts.find(d=>d.id===c.dept)!;
 return <Link className="xp-course-card" href={B+'/courses/'+c.id}><div className="xp-course-art" style={{backgroundImage:'url(/art/departments/'+d.art+'.svg)'}}><span>{c.kind==='Web'?<Globe2 size={13}/>:<Video size={13}/>} {c.kind} course</span></div><div className="xp-course-details"><small>{d.name}</small><h3>{c.name}</h3><p>{c.lessons} illustrative lessons · No actual NPTEL files</p><strong>Explore course <ArrowRight size={15}/></strong></div></Link>;
}
function StatCard({icon:Icon,title,value,note,featured=false}:{icon:any;title:string;value:string;note:string;featured?:boolean}){
 return <div className={'xp-stat '+(featured?'xp-stat-featured':'')}><span className="xp-stat-icon"><Icon size={20}/></span><strong>{value}</strong><h3>{title}</h3><p>{note}</p></div>;
}
function SearchDialog({visible,onClose}:{visible:boolean;onClose:()=>void}){
 const [q,setQ]=useState(''),[selected,setSelected]=useState(0);
 const inp=useRef<HTMLInputElement>(null),router=useRouter();
 const items=useMemo(()=>courses.filter(c=>(c.name+' '+(depts.find(d=>d.id===c.dept)?.name||'')).toLowerCase().includes(q.toLowerCase())).slice(0,5),[q]);
 useEffect(()=>{if(visible){setQ('');setSelected(0);requestAnimationFrame(()=>inp.current?.focus())}},[visible]);
 useEffect(()=>{setSelected(0)},[q]);
 if(!visible)return null;
 return <div className="xp-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="xp-search-dialog" role="dialog" aria-modal="true" aria-label="Search academic courses" onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='ArrowDown'){e.preventDefault();setSelected(v=>Math.min(items.length-1,v+1))}if(e.key==='ArrowUp'){e.preventDefault();setSelected(v=>Math.max(0,v-1))}if(e.key==='Enter'&&items[selected]){router.push(B+'/courses/'+items[selected].id);onClose()}}}>
  <div className="xp-search-field"><Search size={21}/><input ref={inp} aria-label="Search course titles" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search subjects, courses, departments..."/><button onClick={onClose}>ESC</button></div>
  <div className="xp-search-results"><small>{q?'MATCHING COURSES':'SUGGESTED COURSES'}</small>{items.length?items.map((c,i)=><Link key={c.id} href={B+'/courses/'+c.id} onClick={onClose} className={'xp-search-result '+(selected===i?'selected':'')} onMouseEnter={()=>setSelected(i)}><span><BookOpen size={19}/></span><div><strong>{c.name}</strong><p>{depts.find(d=>d.id===c.dept)?.name}</p></div><ArrowRight size={17}/></Link>):<p className="xp-no-result">No matching sample courses.</p>}</div>
  <div className="xp-search-help">↑ ↓ Navigate　↵ Open　ESC Close <span>Design preview data only</span></div>
 </div></div>;
}
function Breadcrumb({links}:{links:{text:string;href?:string}[]}){
 return <nav className="xp-breadcrumb" aria-label="Breadcrumb">{links.map((x,i)=><span key={i}>{i>0&&<ChevronRight size={13}/>} {x.href?<Link href={x.href}>{x.text}</Link>:<span aria-current="page">{x.text}</span>}</span>)}</nav>;
}
export default function UiExperiencePreview(){
 const pathname=usePathname()||B;
 const route=RouteInfo(pathname);
 const [dialog,setDialog]=useState(false),[menu,setMenu]=useState(false),[banner,setBanner]=useState(0),[paused,setPaused]=useState(false),[saved,setSaved]=useState(false),[recent,setRecent]=useState('');
 const course=courses.find(c=>c.id===route.course)||courses[0],current=lessonItems.find(x=>x.id===route.lesson)||lessonItems[0];
 const department=depts.find(d=>d.id===route.dept)||depts[0],cdept=depts.find(d=>d.id===course.dept)!;
 useEffect(()=>{try{setRecent(window.localStorage.getItem('mrem-ux-sample-last')||'')}catch{}},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setDialog(v=>!v)}if(e.key==='Escape')setDialog(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 useEffect(()=>{if(paused||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const t=setInterval(()=>setBanner(x=>(x+1)%banners.length),9000);return()=>clearInterval(t)},[paused]);
 useEffect(()=>{setMenu(false);if(route.course){try{window.localStorage.setItem('mrem-ux-sample-last',route.course);setRecent(route.course)}catch{}}},[pathname]);
 const links=[{text:'Discover',href:B},{text:course.name,href:route.type==='lesson'?B+'/courses/'+course.id:undefined}];
 const idx=lessonItems.indexOf(current);
 return <div className="xp-app">
  <header className="xp-header"><div className="xp-container xp-header-content"><Link href={B} className="xp-brand"><img src="/brand/mrem-emblem.png" width={45} height={45} alt="MREM emblem"/><span><strong>MREM</strong><small>Digital Learning Library</small></span></Link>
   <nav className="xp-mainnav" aria-label="Main navigation"><Link className={route.type==='home'?'on':''} href={B}>Discover</Link><Link className={['departments','department'].includes(route.type)?'on':''} href={B+'/departments'}>Departments</Link><Link className={['courses','course','lesson'].includes(route.type)?'on':''} href={B+'/courses'}>Courses</Link><Link className={route.type==='web'?'on':''} href={B+'/web-courses'}>Web Courses</Link></nav>
   <div className="xp-header-actions"><button className="xp-header-search" onClick={()=>setDialog(true)}><Search size={18}/> <span>Search library</span><kbd>⌘ K</kbd></button><span className="xp-access"><span/> Open library</span><button className="xp-menu-btn" onClick={()=>setMenu(v=>!v)} aria-label={menu?'Close menu':'Open menu'}>{menu?<X size={22}/>:<Menu size={22}/>}</button></div></div>
   {menu&&<nav className="xp-mobile-menu" aria-label="Mobile navigation"><Link href={B}>Discover</Link><Link href={B+'/departments'}>Departments</Link><Link href={B+'/courses'}>Courses</Link><Link href={B+'/web-courses'}>Web Courses</Link><button onClick={()=>{setDialog(true);setMenu(false)}}>Search</button></nav>}
  </header>
  <main>
   {route.type==='home'&&<>
    <section className="xp-hero xp-container"><div className="xp-hero-copy"><span className="xp-eyebrow">THE MREM LEARNING EXPERIENCE</span><h1>Everything you need<br/>to <em>keep learning.</em></h1><p>Discover academic courses, watch lessons and explore study materials through one calm, beautifully organized library.</p><button className="xp-hero-search" onClick={()=>setDialog(true)}><Search size={21}/><span>What would you like to learn?</span><kbd>⌘ K</kbd></button><div className="xp-hero-features"><span><Check size={15}/> No login needed</span><span><Check size={15}/> Focused learning</span></div></div><div className="xp-hero-visual"><div className="xp-orbit xp-orbit-one"/><div className="xp-orbit xp-orbit-two"/><div className="xp-hero-icon"><GraduationCap size={70} strokeWidth={1.1}/></div><div className="xp-float xp-float-one"><BookOpen size={21}/><span><strong>Discover</strong><small>Find your subject</small></span></div><div className="xp-float xp-float-two"><MonitorPlay size={21}/><span><strong>Focus</strong><small>Enjoy the lesson</small></span></div></div></section>
    <section className="xp-container xp-section xp-stats-section"><div className="xp-section-heading"><div><span className="xp-eyebrow">LIBRARY AT A GLANCE</span><h2>One place. Every resource.</h2></div><span className="xp-sample-label"><ShieldCheck size={15}/> Illustrative preview counts</span></div><div className="xp-bento"><StatCard featured icon={LibraryBig} title="Total courses" value="1,752" note="Example metric"/><StatCard icon={Video} title="Video courses" value="730" note="Sample count"/><StatCard icon={Globe2} title="Web courses" value="592" note="Sample count"/><StatCard icon={MonitorPlay} title="Video lectures" value="36,617" note="Sample count"/><StatCard icon={FileText} title="PDF resources" value="28,861" note="Sample count"/><StatCard icon={Layers3} title="Academic disciplines" value="24" note="Sample count"/></div></section>
    <section className="xp-container xp-section"><div className="xp-section-heading"><div><span className="xp-eyebrow">FIND YOUR DISCIPLINE</span><h2>Where curiosity begins.</h2><p>Explore academic areas through meaningful, subject-specific artwork.</p></div><Link href={B+'/departments'}>All departments <ArrowRight size={17}/></Link></div><div className="xp-department-grid">{depts.map(d=><DepartmentCard d={d} key={d.id}/>)}</div></section>
    <section className="xp-container xp-section"><div className="xp-section-heading"><div><span className="xp-eyebrow">CURATED DISCOVERY</span><h2>Pick up something new.</h2><p>Courses that feel easy to explore—not like a directory of files.</p></div><Link href={B+'/courses'}>Browse all <ArrowRight size={17}/></Link></div><div className="xp-courses-grid">{courses.slice(0,4).map(c=><CourseCard key={c.id} c={c}/>)}</div></section>
    <section className="xp-container xp-section"><div className={'xp-banner xp-banner-'+banners[banner].style} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setPaused(false)}}><div className="xp-banner-copy"><span className="xp-eyebrow">{banners[banner].tag}</span><h2>{banners[banner].title}</h2><p>{banners[banner].copy}</p><Link href={B+'/departments'}>Explore learning <ArrowRight size={16}/></Link></div><img src={'/lms-art/'+banners[banner].art} alt="" loading="lazy"/><div className="xp-banner-controls"><button onClick={()=>setBanner(v=>(v+banners.length-1)%banners.length)} aria-label="Previous banner"><ChevronLeft size={17}/></button>{banners.map((b,i)=><button className={'xp-banner-dot '+(i===banner?'on':'')} onClick={()=>setBanner(i)} key={b.title} aria-label={'Show banner '+(i+1)}/>)}<button onClick={()=>setBanner(v=>(v+1)%banners.length)} aria-label="Next banner"><ChevronRight size={17}/></button><button onClick={()=>setPaused(x=>!x)} aria-label={paused?'Resume carousel':'Pause carousel'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div></div></section>
    {recent&&courses.some(x=>x.id===recent)&&<section className="xp-container xp-resume"><div><span className="xp-eyebrow">CONTINUE LEARNING</span><h3>{courses.find(x=>x.id===recent)?.name}</h3><p>Saved only in this browser</p></div><Link href={B+'/courses/'+recent}>Continue <ArrowRight size={16}/></Link></section>}
   </>}
   {route.type==='departments'&&<div className="xp-container xp-inner"><Breadcrumb links={[{text:'Discover',href:B},{text:'Departments'}]}/><div className="xp-intro"><span className="xp-eyebrow">ACADEMIC DEPARTMENTS</span><h1>Find your field of interest.</h1><p>Every subject has a place. Choose a department to start exploring.</p></div><div className="xp-department-grid">{depts.map(d=><DepartmentCard d={d} key={d.id}/>)}</div></div>}
   {route.type==='department'&&<div className="xp-container xp-inner"><Breadcrumb links={[{text:'Discover',href:B},{text:'Departments',href:B+'/departments'},{text:department.name}]}/><div className="xp-department-hero"><div><span className="xp-eyebrow">DEPARTMENT COLLECTION</span><h1>{department.name}</h1><p>{department.about}. Find a course that interests you.</p></div><img src={'/art/departments/'+department.art+'.svg'} alt="" /></div><div className="xp-section-heading"><div><span className="xp-eyebrow">EXPLORE THIS COLLECTION</span><h2>Available course examples</h2></div><button onClick={()=>setDialog(true)}>Search <Search size={16}/></button></div><div className="xp-courses-grid">{courses.filter(x=>x.dept===department.id).map(c=><CourseCard key={c.id} c={c}/>)}</div></div>}
   {route.type==='courses'&&<div className="xp-container xp-inner"><Breadcrumb links={[{text:'Discover',href:B},{text:'Courses'}]}/><div className="xp-intro"><span className="xp-eyebrow">ALL COURSES</span><h1>Your next learning adventure.</h1><p>Courses organized by subject instead of folders. Search to find your exact topic.</p></div><button className="xp-wide-search" onClick={()=>setDialog(true)}><Search size={19}/> Search all courses <ArrowRight size={17}/></button><div className="xp-courses-grid">{courses.map(c=><CourseCard key={c.id} c={c}/>)}</div></div>}
   {route.type==='web'&&<div className="xp-container xp-inner"><Breadcrumb links={[{text:'Discover',href:B},{text:'Web Courses'}]}/><div className="xp-intro"><span className="xp-eyebrow">WEB COURSE COLLECTION</span><h1>Explore interactive reading.</h1><p>Web courses have a dedicated discovery experience—not a folder archive.</p></div><div className="xp-courses-grid">{courses.filter(c=>c.kind==='Web').map(c=><CourseCard key={c.id} c={c}/>)}</div></div>}
   {(route.type==='course'||route.type==='lesson')&&<div className="xp-container xp-inner xp-study"><Breadcrumb links={[{text:'Discover',href:B},{text:cdept.name,href:B+'/departments/'+cdept.id},{text:course.name,href:route.type==='lesson'?B+'/courses/'+course.id:undefined},...(route.type==='lesson'?[{text:'Lesson '+(route.lesson||'01')}]:[])]}/><div className="xp-study-heading"><div><span className="xp-eyebrow">{course.kind.toUpperCase()} COURSE · DEMONSTRATION</span><h1>{course.name}</h1><p><GraduationCap size={16}/>{cdept.name} · UI sample</p></div><button className={'xp-save '+(saved?'saved':'')} onClick={()=>setSaved(v=>!v)}><Bookmark size={17} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save for this visit'}</button></div>
     {route.type==='course'?<div className="xp-study-columns"><div><div className="xp-course-preview" style={{backgroundImage:'url(/art/departments/'+cdept.art+'.svg)'}}><div><span>LEARNING WORKSPACE</span><h2>Designed to help you focus.</h2><p>No sidebar. Just your course, lessons and resources.</p><Link href={B+'/courses/'+course.id+'/lesson/01'}><Play size={17} fill="currentColor"/> Start learning</Link></div></div><div className="xp-about"><h2>About this course</h2><p>This UI review uses illustrative academic data. The final campus version will show verified NPTEL titles and connect to authorized resources across E:, F:, G: and H:.</p></div></div><div className="xp-lesson-list"><div><span className="xp-eyebrow">COURSE CONTENT</span><h2>Choose a lesson</h2><p>Easy-to-scan content in one place.</p></div>{lessonItems.map((l,i)=><Link href={B+'/courses/'+course.id+'/lesson/'+l.id} key={l.id}><span className="xp-lesson-number">{l.type==='video'?l.id:l.type==='pdf'?<FileText size={17}/>:<FileCode2 size={17}/>}</span><span><strong>{l.title}</strong><small>{l.type.toUpperCase()} · {l.label}</small></span><ArrowRight size={16}/></Link>)}</div></div>:<>
      <div className="xp-viewer">{current.type==='video'?<div className="xp-video-placeholder"><MonitorPlay size={45}/><h2>Keep learning, without distractions.</h2><p>A clean video workspace for real, authorized campus media.</p><span>Visual demo — no NPTEL video is published here</span></div>:current.type==='pdf'?<div className="xp-pdf-placeholder"><div className="xp-paper"><small>DOCUMENT VIEWER EXAMPLE</small><h2>Course study material</h2><p>PDF previews will open here from the approved college database.</p><hr/><hr/><hr/></div></div>:<iframe className="xp-html-frame" title="Safe HTML viewer example" sandbox="" srcDoc={'<!doctype html><html><head><style>body{font-family:Arial,sans-serif;margin:36px;color:#192b42}h1{font-size:24px;color:#77163c}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #e4e6eb;text-align:left}th{background:#f4f4f8}</style></head><body><h1>Web Course Contents</h1><p>This is a rendered static HTML example, never raw source.</p><table><tr><th>Topic</th><th>Learning material</th></tr><tr><td>Introduction</td><td>Reading</td></tr></table></body></html>'}/>}</div>
      <div className="xp-viewer-description"><div><span className="xp-eyebrow">CURRENT LESSON</span><h2>{current.title}</h2><p>{current.type.toUpperCase()} · {course.name} · Example resource</p></div><Link href={B+'/courses/'+course.id}>All lessons <Layers3 size={16}/></Link></div>
      <div className="xp-lesson-nav"><Link href={idx>0?B+'/courses/'+course.id+'/lesson/'+lessonItems[idx-1].id:B+'/courses/'+course.id}><ChevronLeft size={17}/>{idx>0?lessonItems[idx-1].title:'Back to course'}</Link><Link href={idx<lessonItems.length-1?B+'/courses/'+course.id+'/lesson/'+lessonItems[idx+1].id:B+'/courses/'+course.id}>{idx<lessonItems.length-1?lessonItems[idx+1].title:'Return to course'} <ChevronRight size={17}/></Link></div>
      <div className="xp-lessons-shortcut"><span className="xp-eyebrow">JUMP TO A RESOURCE</span><div>{lessonItems.map(l=><Link href={B+'/courses/'+course.id+'/lesson/'+l.id} className={l.id===current.id?'active':''} key={l.id}>{l.id} · {l.type.toUpperCase()}</Link>)}</div></div>
     </>}
   </div>}
  </main>
  <footer className="xp-footer"><div className="xp-container"><div><img src="/brand/mrem-emblem.png" alt="" width={39} height={39}/><span><strong>MREM Digital Learning Library</strong><small>An UGC Autonomous Institution</small></span></div><p>UI review build · sample content only · no campus files connected</p><Link href={B}>Back to discover <ArrowRight size={16}/></Link></div></footer>
  <div className="xp-ribbon"><ShieldCheck size={16}/> UX preview only · No change to the college server or GitHub main branch</div>
  <SearchDialog visible={dialog} onClose={()=>setDialog(false)}/>
 </div>;
}
