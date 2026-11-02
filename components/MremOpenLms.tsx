'use client';
import {useEffect,useMemo,useState} from 'react';
import {
  ArrowLeft,ArrowRight,BookOpen,BookMarked,BookText,Bookmark,Check,ChevronDown,ChevronLeft,
  ChevronRight,Clock3,Code2,Compass,Download,File,FileCode2,FileText,FolderOpen,GraduationCap,
  Grid2X2,Headphones,HelpCircle,Home,Layers,Library,Menu,MonitorPlay,Play,
  Search,ShieldCheck,Sparkles,Video,X
} from 'lucide-react';
import './mrem-open-lms.css';

type View='home'|'departments'|'catalogue'|'department'|'course'|'uncategorized';
type Mode='video'|'pdf'|'html'|'text';
type Course={code:string;title:string;dept:string;faculty:string;institute:string;type:'Video'|'Web';picture:string};
const SAMPLE_COURSES:Course[]=[
 {code:'106102064',title:'Data Structures And Algorithms',dept:'Computer Science and Engineering',faculty:'Prof. Naveen Garg',institute:'IIT Delhi',type:'Video',picture:'computer'},
 {code:'106105152',title:'Introduction to Machine Learning',dept:'Computer Science and Engineering',faculty:'Prof. S. Sarkar',institute:'IIT Kharagpur',type:'Video',picture:'ai'},
 {code:'112101002',title:'Convective Heat and Mass Transfer',dept:'Mechanical Engineering',faculty:'Prof. A.W. Date',institute:'IIT Bombay',type:'Video',picture:'mechanical'},
 {code:'108101037',title:'Control Engineering',dept:'Electrical Engineering',faculty:'Prof. S.D. Agashe',institute:'IIT Bombay',type:'Video',picture:'electrical'},
 {code:'105101006',title:'Structural Dynamics',dept:'Civil Engineering',faculty:'Dr. P. Banerji',institute:'IIT Bombay',type:'Video',picture:'civil'},
 {code:'101101086',title:'Introduction to Launch Vehicle Analysis and Design',dept:'Aerospace Engineering',faculty:'Prof. Ashok Joshi',institute:'IIT Bombay',type:'Video',picture:'aero'},
 {code:'101104086',title:'Computational Science in Engineering',dept:'Aerospace Engineering',faculty:'Prof. Ashoke De',institute:'IIT Kanpur',type:'Video',picture:'aero'},
 {code:'101108086',title:'Gasdynamics: Fundamentals and Applications',dept:'Aerospace Engineering',faculty:'Prof. Srisha Rao M V',institute:'IISc Bangalore',type:'Video',picture:'aero'},
 {code:'106101060',title:'Design and Analysis of Algorithms',dept:'Computer Science and Engineering',faculty:'Multiple coordinators',institute:'IIT Bombay',type:'Video',picture:'computer'}
];
const DEPARTMENTS=[
 {name:'Computer Science and Engineering',short:'CSE',theme:'blue',icon:'⌘'},
 {name:'CSE – AI & ML',short:'AI/ML',theme:'violet',icon:'✦'},
 {name:'CSE – Data Science',short:'DS',theme:'blue',icon:'◈'},
 {name:'Electronics and Communication Engineering',short:'ECE',theme:'orange',icon:'◫'},
 {name:'Electrical Engineering',short:'EEE',theme:'amber',icon:'ϟ'},
 {name:'Mechanical Engineering',short:'ME',theme:'rose',icon:'⚙'},
 {name:'Civil Engineering',short:'CE',theme:'teal',icon:'▣'},
 {name:'Aerospace Engineering',short:'AE',theme:'violet',icon:'✈'},
 {name:'Information Technology',short:'IT',theme:'blue',icon:'⌘'}
];
const BANNERS=[
 {tag:'WELCOME TO THE DIGITAL LIBRARY',title:'A new space for curiosity.',description:'A beautifully organized learning experience for the MREM academic community.',art:'/lms-art/academic.svg',theme:'welcome',button:'Explore departments'},
 {tag:'ONE LIBRARY · EVERY DISCIPLINE',title:'Discover what moves you.',description:'Browse course collections, video lectures and study resources in one focused workspace.',art:'/lms-art/library.svg',theme:'library',button:'Browse courses'},
 {tag:'STUDY WITHOUT DISTRACTIONS',title:'Learn at your own pace.',description:'Stay with your course—watch, read and navigate lessons without leaving the learning workspace.',art:'/lms-art/innovation.svg',theme:'innovation',button:'Explore courses'},
];
const resourceTypes:{id:Mode;label:string;icon:typeof Video}[]=[
 {id:'video',label:'Video',icon:Video},
 {id:'pdf',label:'PDF',icon:FileText},
 {id:'html',label:'HTML',icon:Code2},
 {id:'text',label:'Text',icon:BookText}
];
const SITE_LOGO='https://mrem.ac.in/wp-content/uploads/2022/06/mrem-logo-copy-copy.png';
const sampleFileNames=[
 {id:'v1',name:'mod01lec01.mp4',kind:'video' as Mode,tag:'Video'},
 {id:'v2',name:'mod01lec02.mp4',kind:'video' as Mode,tag:'Video'},
 {id:'v3',name:'mod01lec03.mp4',kind:'video' as Mode,tag:'Video'},
 {id:'p1',name:'Sample study material.pdf',kind:'pdf' as Mode,tag:'PDF'},
 {id:'h1',name:'index.html',kind:'html' as Mode,tag:'HTML'},
 {id:'t1',name:'Readme.txt',kind:'text' as Mode,tag:'Text'}
];
const imageFor=(c:Course)=>c.picture==='computer'?'code':c.picture==='ai'?'ai':c.picture==='electrical'?'circuit':c.picture==='mechanical'?'gears':c.picture==='civil'?'building':'flight';
const resourceIcon=(x:Mode)=>x==='video'?Play:x==='html'?FileCode2:FileText;
export default function MremOpenLms(){
 const [view,setView]=useState<View>('home');
 const [department,setDepartment]=useState('Computer Science and Engineering');
 const [course,setCourse]=useState<Course>(SAMPLE_COURSES[0]);
 const [currentResource,setCurrentResource]=useState('v1');
 const [banner,setBanner]=useState(0);
 const [query,setQuery]=useState('');
 const [format,setFormat]=useState<'All'|'Video'|'Web'>('All');
 const [mobileMenu,setMobileMenu]=useState(false);
 const [lessonDrawer,setLessonDrawer]=useState(false);
 const [logoError,setLogoError]=useState(false);
 const [videoStarted,setVideoStarted]=useState(false);
 const [saved,setSaved]=useState<string[]>([]);
 const [activeGroup,setActiveGroup]=useState<'All'|'Academic content'|'Study material'>('All');
 useEffect(()=>{
  const timer=setInterval(()=>setBanner(x=>(x+1)%BANNERS.length),6800);
  return ()=>clearInterval(timer);
 },[]);
 const filtered=useMemo(()=>SAMPLE_COURSES.filter(c=>
  (view!=='department'||c.dept===department)&&
  (format==='All'||c.type===format)&&
  (!query.trim()||[c.title,c.code,c.dept,c.institute,c.faculty].some(v=>v.toLowerCase().includes(query.toLowerCase().trim())))
 ),[query,view,department,format]);
 const deptCourseCount=(name:string)=>SAMPLE_COURSES.filter(c=>c.dept===name).length;
 const current=sampleFileNames.find(x=>x.id===currentResource)||sampleFileNames[0];
 function navigate(next:View){setView(next);setMobileMenu(false);setLessonDrawer(false);setFormat('All');setQuery('');window.scrollTo({top:0,behavior:'smooth'})}
 function selectDept(name:string){setDepartment(name);navigate('department')}
 function selectCourse(c:Course){setCourse(c);setDepartment(c.dept);setCurrentResource('v1');setVideoStarted(false);setView('course');setMobileMenu(false);setLessonDrawer(false);window.scrollTo({top:0,behavior:'smooth'})}
 function chooseResource(id:string){setCurrentResource(id);setVideoStarted(false);setLessonDrawer(false)}
 function bannerAction(){if(banner===0)navigate('departments');else navigate('catalogue')}
 const courseSaved=saved.includes(course.code);
 const badge='UI DESIGN DEMO · SAMPLE DATA';
 const visibleContent=(x:{id:string;name:string;kind:Mode})=>activeGroup==='All'||(activeGroup==='Academic content'?x.kind==='video':x.kind!=='video');
 return <div className="mo-shell">
  <aside className={'mo-sidebar'+(mobileMenu?' mo-open':'')} aria-label="Primary navigation">
    <button className="mo-brand" onClick={()=>navigate('home')} aria-label="MREM Digital Learning Library home">
      {logoError?<span className="mo-brand-fallback">M</span>:<img src={SITE_LOGO} width={51} height={51} alt="Official MREM college emblem" onError={()=>setLogoError(true)}/>}
      <span className="mo-brand-text"><strong>MREM</strong><small>Digital Learning Library</small></span>
    </button>
    <div className="mo-divider"/>
    <div className="mo-nav-label">LEARNING SPACE</div>
    <button className={'mo-nav'+(view==='home'?' active':'')} onClick={()=>navigate('home')}><Home size={18}/> Home</button>
    <button className={'mo-nav'+(view==='departments'||view==='department'?' active':'')} onClick={()=>navigate('departments')}><Layers size={18}/> Departments</button>
    <button className={'mo-nav'+(view==='catalogue'||view==='course'?' active':'')} onClick={()=>navigate('catalogue')}><BookOpen size={18}/> Browse courses</button>
    <button className={'mo-nav'+(view==='uncategorized'?' active':'')} onClick={()=>navigate('uncategorized')}><FolderOpen size={18}/> Uncategorized</button>
    <div className="mo-nav-label mo-nav-label-spaced">DEPARTMENT SHORTCUTS</div>
    <div className="mo-dept-shortcuts">
      {DEPARTMENTS.slice(0,7).map(d=><button key={d.name} onClick={()=>selectDept(d.name)}><span className={'mo-small-mark mo-mark-'+d.theme}>{d.icon}</span><span>{d.name}</span><ChevronRight size={13}/></button>)}
    </div>
    <div className="mo-sidebar-bottom"><div><GraduationCap size={20}/><span>Explore. Learn. Grow.</span></div><p>Open learning interface<br/>No student login required</p></div>
  </aside>
  {mobileMenu&&<button className="mo-screen-shade" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
  <div className="mo-page">
    <header className="mo-topbar">
      <div className="mo-top-title"><button className="mo-mobile-nav" aria-label="Open navigation" onClick={()=>setMobileMenu(true)}><Menu size={21}/></button><div><b>MREM Digital Learning Library</b><span>An UGC Autonomous Institution</span></div></div>
      <div className="mo-header-right"><div className="mo-header-search"><Search size={16}/><input aria-label="Search academic courses" placeholder="Search courses, IDs, departments..." value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value.trim()&&view!=='catalogue'&&view!=='department')setView('catalogue')}}/></div><span className="mo-open-chip"><span/> Open library</span></div>
    </header>
    <div className="mo-content">
      <section className="mo-banner" aria-label="MREM institutional announcements">
        <div className={'mo-banner-frame mo-banner-'+BANNERS[banner].theme}>
          <div className="mo-banner-copy"><span className="mo-overline"><span className="mo-overline-line"/> {BANNERS[banner].tag}</span><h1>{BANNERS[banner].title}</h1><p>{BANNERS[banner].description}</p><button className="mo-banner-action" onClick={bannerAction}>{BANNERS[banner].button} <ArrowRight size={16}/></button></div>
          <img className="mo-banner-art" src={BANNERS[banner].art} alt="" />
          <button className="mo-banner-prev" onClick={()=>setBanner(x=>(x+BANNERS.length-1)%BANNERS.length)} aria-label="Previous MREM banner"><ChevronLeft size={20}/></button>
          <button className="mo-banner-next" onClick={()=>setBanner(x=>(x+1)%BANNERS.length)} aria-label="Next MREM banner"><ChevronRight size={20}/></button>
        </div>
        <div className="mo-banner-dots">{BANNERS.map((b,i)=><button key={b.tag} className={i===banner?'active':''} onClick={()=>setBanner(i)} aria-label={'Show banner '+(i+1)} aria-current={i===banner?'true':undefined}/>)}</div>
      </section>
      <div className="mo-demo-label"><ShieldCheck size={14}/><span>{badge}. The current hosted preview does not connect to E:, F:, G: or H:.</span></div>

      {view==='home'&&<>
        <div className="mo-section-title mo-welcome"><div><small>EXPLORE THE LIBRARY</small><h2>Your learning starts here.</h2><p>Everything in one place, thoughtfully organized for easier discovery.</p></div><button onClick={()=>navigate('catalogue')}>Explore all courses <ArrowRight size={16}/></button></div>
        <div className="mo-search-feature"><Search size={21}/><input aria-label="Search NPTEL catalogue samples" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())setView('catalogue')}} placeholder="What would you like to learn today?"/><button onClick={()=>navigate('catalogue')}>Search library <ArrowRight size={15}/></button></div>
        <div className="mo-overview-row">
          <div className="mo-feature-mini"><div><BookOpen size={21}/></div><strong>{SAMPLE_COURSES.length}</strong><span>Sample courses</span></div>
          <div className="mo-feature-mini"><div><Layers size={21}/></div><strong>{DEPARTMENTS.length}</strong><span>Department categories</span></div>
          <div className="mo-feature-mini"><div><MonitorPlay size={21}/></div><strong>4</strong><span>Learning formats</span></div>
          <div className="mo-resource-tags"><strong>EXPLORE BY RESOURCE</strong><div>{resourceTypes.map(x=>{const Icon=x.icon;return <button key={x.id} onClick={()=>{navigate('catalogue')}}><Icon size={17}/>{x.label}</button>})}</div></div>
        </div>
        <div className="mo-home-cols">
          <div className="mo-home-left">
           <div className="mo-section-title"><div><small>FROM THE REFERENCE CATALOGUE</small><h2>Discover courses</h2><p>Illustrative cards using real course-level NPTEL catalogue titles.</p></div><button onClick={()=>navigate('catalogue')}>View all <ArrowRight size={16}/></button></div>
           <div className="mo-course-grid">{SAMPLE_COURSES.slice(0,4).map(c=><CourseCard key={c.code} c={c} onClick={()=>selectCourse(c)}/>)}</div>
          </div>
          <div className="mo-home-right">
           <div className="mo-update-card"><div className="mo-update-heading"><span><Sparkles size={18}/></span><h3>Why this library?</h3></div><p>Discover verified courses, explore organized materials and study at your own pace—without an account.</p><div className="mo-update-point"><Check size={15}/> Browse by academic department</div><div className="mo-update-point"><Check size={15}/> Learn with an inline course viewer</div><div className="mo-update-point"><Check size={15}/> Preserve original file identities</div><button onClick={()=>navigate('departments')}>Browse departments <ArrowRight size={16}/></button></div>
          </div>
        </div>
        <div className="mo-section-title mo-departments-heading"><div><small>FIND YOUR DISCIPLINE</small><h2>Featured departments</h2><p>Explore courses through MREM's academic areas and related reference disciplines.</p></div><button onClick={()=>navigate('departments')}>View all departments <ArrowRight size={16}/></button></div>
        <div className="mo-dept-grid">{DEPARTMENTS.slice(0,6).map(d=><DeptCard key={d.name} d={d} count={deptCourseCount(d.name)} onClick={()=>selectDept(d.name)}/>)}</div>
      </>}

      {view==='departments'&&<>
       <PageIntro eyebrow="ACADEMIC DIRECTORY" title="Browse departments" note="Choose a discipline to explore its courses and reference materials. These are navigation samples, not your live folder counts."/>
       <div className="mo-dept-grid mo-all-depts">{DEPARTMENTS.map(d=><DeptCard key={d.name} d={d} count={deptCourseCount(d.name)} onClick={()=>selectDept(d.name)}/>)}</div>
      </>}

      {(view==='catalogue'||view==='department')&&<>
        <PageIntro eyebrow={view==='department'?'DEPARTMENT COURSES':'ACADEMIC CATALOGUE'} title={view==='department'?department:'Explore all courses'} note="Verified course-level titles are shown from the supplied NPTEL reference catalogue. Local availability must be confirmed on the campus server."/>
        <div className="mo-catalogue-toolbar"><label><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter by title, professor or Course ID..." aria-label="Filter course catalogue"/></label><div><span>Content</span><select aria-label="Content type" value={format} onChange={e=>setFormat(e.target.value as typeof format)}><option>All</option><option>Video</option><option>Web</option></select><ChevronDown size={13}/></div>{view==='department'&&<button className="mo-muted-button" onClick={()=>navigate('departments')}><ArrowLeft size={15}/> Departments</button>}</div>
        <div className="mo-catalogue-list"><div className="mo-table-head"><span>COURSE</span><span>TYPE</span><span/></div>{filtered.length?filtered.map(c=><button className="mo-catalogue-row" key={c.code} onClick={()=>selectCourse(c)}><span className={'mo-course-icon mo-icon-'+imageFor(c)}><BookOpen size={21}/></span><span className="mo-catalogue-name"><strong>{c.title}</strong><small>{c.dept} · {c.faculty} · {c.code}</small></span><span className="mo-type-pill">{c.type}</span><ChevronRight size={16}/></button>):<div className="mo-empty"><Search size={26}/><strong>No matching sample courses</strong><p>Change your search or browse the departments.</p><button onClick={()=>{setQuery('');setFormat('All')}}>Clear filters</button></div>}</div>
        <div className="mo-results-note">Showing {filtered.length} course-level catalogue examples · UI demonstration only</div>
      </>}

      {view==='course'&&<>
        <div className="mo-course-heading"><button className="mo-link-back" onClick={()=>selectDept(course.dept)}><ChevronLeft size={15}/> {course.dept}</button><div><h2>{course.title}</h2><button className={courseSaved?'mo-save-button saved':'mo-save-button'} onClick={()=>setSaved(x=>courseSaved?x.filter(v=>v!==course.code):[...x,course.code])}><Bookmark size={16} fill={courseSaved?'currentColor':'none'}/>{courseSaved?'Saved in this session':'Save for this session'}</button></div><p><GraduationCap size={16}/> {course.faculty} <span className="mo-sep"/> {course.institute} <span className="mo-sep"/> Course ID {course.code}</p></div>
        <button className="mo-lessons-mobile-button" onClick={()=>setLessonDrawer(true)}><Layers size={17}/> Browse learning resources <ChevronRight size={15}/></button>
        <div className="mo-course-layout">
          {lessonDrawer&&<button className="mo-lessons-backdrop" aria-label="Close lesson navigation" onClick={()=>setLessonDrawer(false)}/>}
          <aside className={'mo-lessons-panel'+(lessonDrawer?' mo-lessons-open':'')} aria-label="Course resources">
            <div className="mo-lessons-head"><div><small>COURSE WORKSPACE</small><h3>Learning resources</h3><p>Viewer examples only</p></div><button className="mo-close-mobile-lessons" onClick={()=>setLessonDrawer(false)} aria-label="Close learning resources"><X size={18}/></button></div>
            <div className="mo-lesson-filters">{(['All','Academic content','Study material'] as const).map(x=><button key={x} className={activeGroup===x?'active':''} onClick={()=>setActiveGroup(x)}>{x}</button>)}</div>
            <div className="mo-lesson-group"><div className="mo-lesson-group-title">SAMPLE LOCAL RESOURCES <span>{sampleFileNames.filter(visibleContent).length}</span></div>{sampleFileNames.filter(visibleContent).map((x,i)=>{const Icon=resourceIcon(x.kind);return <button className={'mo-lesson-item'+(x.id===currentResource?' active':'')} key={x.id} onClick={()=>chooseResource(x.id)}><span className="mo-lesson-num">{x.kind==='video'?String(i+1).padStart(2,'0'):<Icon size={16}/>}</span><span><strong>{x.name}</strong><small>{x.tag} · illustrative local filename</small></span>{currentResource===x.id&&<span className="mo-lesson-active"/>}</button>})}</div>
            <div className="mo-original-note"><ShieldCheck size={16}/><p>Unverified lesson titles retain their original filenames until the exact media-to-title relationship is validated.</p></div>
          </aside>
          <section className="mo-study-panel">
            <div className="mo-study-top"><div><small>NOW VIEWING</small><h3>{current.name}</h3></div><span className="mo-content-type">{current.kind.toUpperCase()}</span></div>
            <div className="mo-study-viewer">
              {current.kind==='video'&&<div className="mo-video-area">{videoStarted?<video controls autoPlay playsInline src="/demo/mrem-preview.mp4" aria-label="Short original synthetic video for UI testing"/>:<div className="mo-video-poster"><span className="mo-video-spark"><MonitorPlay size={34}/></span><div className="mo-video-heading">A focused place to learn.</div><p>Inline video playback—your lesson list stays within reach.</p><button onClick={()=>setVideoStarted(true)}><Play size={21} fill="currentColor"/> Play sample video</button><small>Original synthetic video for layout testing only</small></div>}</div>}
              {current.kind==='pdf'&&<iframe className="mo-pdf-frame" title="Synthetic MREM sample PDF" src="/design-preview/sample-pdf"/>}
              {current.kind==='html'&&<iframe className="mo-html-frame" title="Safe rendered sample HTML page" sandbox="" srcDoc={'<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:36px;color:#18233b}h1{font-size:24px;color:#7b1639}p{line-height:1.7;color:#68778d}table{border-collapse:collapse;width:100%;margin-top:20px}td,th{padding:14px 12px;border:1px solid #dfe4ec;text-align:left;font-size:13px}th{background:#f2f4fa}small{color:#8c98aa}</style></head><body><small>STATIC HTML PREVIEW · NO SCRIPTS</small><h1>Academic content index</h1><p>This example shows how legacy HTML tables can appear as a properly formatted page instead of raw source code.</p><table><tr><th>Course ID</th><th>Subject name</th></tr><tr><td>'+course.code.replace(/[^0-9]/g,'')+'</td><td>'+course.title.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td></tr></table></body></html>'}/>}
              {current.kind==='text'&&<div className="mo-text-viewer"><div>README.TXT</div><h3>Text resource preview</h3><p>This is a formatted example of how plain text study materials will be displayed directly in the workspace.</p><p>Real content will use authorized campus storage endpoints. No original course files are connected here.</p></div>}
            </div>
            <div className="mo-viewer-footer"><div><ShieldCheck size={16}/> Sample content · No college media publicly exposed</div><div><button onClick={()=>chooseResource(sampleFileNames[(sampleFileNames.findIndex(x=>x.id===current.id)+sampleFileNames.length-1)%sampleFileNames.length].id)}><ChevronLeft size={16}/> Previous</button><button className="mo-next" onClick={()=>chooseResource(sampleFileNames[(sampleFileNames.findIndex(x=>x.id===current.id)+1)%sampleFileNames.length].id)}>Next resource <ChevronRight size={16}/></button></div></div>
            <div className="mo-study-info"><div className="mo-info-card"><h4><BookOpen size={17}/> About this course</h4><p>{course.title} is a course-level catalogue entry in the supplied reference list. This demo deliberately does not assign unverified lecture titles or claim that the video sample belongs to this course.</p></div><div className="mo-info-card"><h4><FileText size={17}/> Resource types</h4><p>Video lectures, documents, legacy HTML pages and text can be presented in one reading and viewing workspace.</p></div></div>
          </section>
        </div>
      </>}

      {view==='uncategorized'&&<>
       <PageIntro eyebrow="UNMAPPED LIBRARY" title="Uncategorized resources" note="The real app will preserve original filenames and source folder hierarchy where verified academic classification is unavailable."/>
       <div className="mo-uncat"><FolderOpen size={39}/><h3>No simulated folder tree</h3><p>This design preview has no access to E:, F:, G: or H:, so it will not invent paths, file counts or names. In the on-premises LMS, this area must show only authorized records from the real indexed folder tree.</p><button onClick={()=>navigate('departments')}>Browse departments <ArrowRight size={16}/></button></div>
      </>}
    </div>
    <footer className="mo-footer"><span>© MREM Digital Learning Library · Design preview</span><span>Open browsing · No account · Source media not connected</span></footer>
  </div>
 </div>;
}
function PageIntro({eyebrow,title,note}:{eyebrow:string;title:string;note:string}){return <div className="mo-page-intro"><small>{eyebrow}</small><h1>{title}</h1><p>{note}</p></div>}
function CourseCard({c,onClick}:{c:Course;onClick:()=>void}){return <button className="mo-course-card" onClick={onClick}><div className={'mo-course-art mo-art-'+imageFor(c)}><span className="mo-card-art-label">{c.dept}</span><span className="mo-art-symbol">{c.picture==='computer'?'⌘':c.picture==='ai'?'✦':c.picture==='mechanical'?'⚙':c.picture==='electrical'?'ϟ':c.picture==='civil'?'▣':'✈'}</span><span className="mo-card-bookmark"><Bookmark size={17}/></span></div><div className="mo-card-body"><span className="mo-course-code">{c.code} · NPTEL REFERENCE</span><h3>{c.title}</h3><p>{c.faculty} · {c.institute}</p><span className="mo-card-footer"><span><Video size={15}/> {c.type} course</span><span>Open course <ArrowRight size={15}/></span></span></div></button>}
function DeptCard({d,count,onClick}:{d:{name:string;short:string;theme:string;icon:string};count:number;onClick:()=>void}){return <button className="mo-dept-card" onClick={onClick}><span className={'mo-dept-icon mo-bg-'+d.theme}>{d.icon}</span><strong>{d.name}</strong><small>{count?count+' catalogue examples':'Awaiting mapped catalogue'}</small><ChevronRight size={16}/></button>}
