'use client';
import {useMemo,useState} from 'react';
import {
  ArrowLeft,ArrowRight,BookOpen,BookText,Check,ChevronDown,ChevronLeft,ChevronRight,
  CircleHelp,Clock3,Compass,Download,FileCode2,FileText,Folder,FolderOpen,
  GraduationCap,Grid2X2,HardDrive,Layers3,LibraryBig,ListFilter,Menu,MoreHorizontal,
  PanelLeftClose,Play,Search,ShieldCheck,Sparkles,Video,Wifi,X
} from 'lucide-react';
import './library-design-preview.css';

type Section='home'|'catalogue'|'department'|'course'|'uncategorized';
type Course={id:string;title:string;department:string;faculty:string;institute:string;type:'Video'|'Web'|'Mixed';reference:boolean};
type Resource={id:string;title:string;description:string;kind:'video'|'pdf'|'html'|'text';group:'Lessons'|'Resources'};

const departments=[
  {name:'Aerospace Engineering',short:'AE',tint:'blue'},
  {name:'Computer Science & Engineering',short:'CS',tint:'indigo'},
  {name:'Mechanical Engineering',short:'ME',tint:'orange'},
  {name:'Electrical Engineering',short:'EE',tint:'purple'},
  {name:'Civil Engineering',short:'CE',tint:'teal'},
  {name:'AI & Machine Learning',short:'AI',tint:'pink'},
];
/** Interface samples only. These are NOT a live inventory of MREM's drives. */
const courses:Course[]=[
 {id:'101101086',title:'Introduction to Launch Vehicle Analysis and Design',department:'Aerospace Engineering',faculty:'Prof. Ashok Joshi',institute:'IIT Bombay',type:'Video',reference:true},
 {id:'101104086',title:'Computational Science in Engineering',department:'Aerospace Engineering',faculty:'Prof. Ashoke De',institute:'IIT Kanpur',type:'Video',reference:true},
 {id:'101108086',title:'Gasdynamics: Fundamentals and Applications',department:'Aerospace Engineering',faculty:'Prof. Srisha Rao M V',institute:'IISc Bangalore',type:'Video',reference:true},
 {id:'DEMO-CS',title:'Data Structures and Algorithms',department:'Computer Science & Engineering',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Mixed',reference:false},
 {id:'DEMO-CN',title:'Computer Networks',department:'Computer Science & Engineering',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Video',reference:false},
 {id:'DEMO-ME',title:'Engineering Thermodynamics',department:'Mechanical Engineering',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Video',reference:false},
 {id:'DEMO-EE',title:'Fundamentals of Electrical Circuits',department:'Electrical Engineering',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Mixed',reference:false},
 {id:'DEMO-CE',title:'Structural Analysis',department:'Civil Engineering',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Web',reference:false},
 {id:'DEMO-AI',title:'Introduction to Machine Learning',department:'AI & Machine Learning',faculty:'Faculty metadata placeholder',institute:'Sample course',type:'Video',reference:false},
];
const resources:Resource[]=[
 {id:'v1',title:'Lesson topic — preview example',description:'Demo video · not mapped to E:, F:, G: or H:',kind:'video',group:'Lessons'},
 {id:'v2',title:'Second lesson — preview example',description:'Video layout example',kind:'video',group:'Lessons'},
 {id:'pdf1',title:'Course reference notes (preview)',description:'PDF viewer layout example',kind:'pdf',group:'Resources'},
 {id:'html1',title:'Legacy HTML learning page (preview)',description:'Safe HTML viewer layout example',kind:'html',group:'Resources'},
 {id:'txt1',title:'Additional reading (preview)',description:'Text viewer layout example',kind:'text',group:'Resources'},
];
const allTypes=[
 {id:'all',name:'All courses'},
 {id:'Video',name:'Video'},
 {id:'Web',name:'Web'},
 {id:'Mixed',name:'Mixed'}
] as const;
const iconForKind=(kind:Resource['kind'])=>kind==='video'?Video:kind==='html'?FileCode2:FileText;
export default function LibraryDesignPreview(){
 const [section,setSection]=useState<Section>('home');
 const [department,setDepartment]=useState('Aerospace Engineering');
 const [course,setCourse]=useState<Course>(courses[0]);
 const [resourceId,setResourceId]=useState(resources[0].id);
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<'all'|'Video'|'Web'|'Mixed'>('all');
 const [mobileOpen,setMobileOpen]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [videoError,setVideoError]=useState(false);
 const [lessonPanelOpen,setLessonPanelOpen]=useState(true);
 const selectedResource=resources.find(x=>x.id===resourceId)||resources[0];
 const visibleCourses=useMemo(()=>courses.filter(c=>
  (section!=='department'||c.department===department)&&
  (filter==='all'||c.type===filter)&&
  (!query.trim()||[c.id,c.title,c.department,c.faculty,c.institute].join(' ').toLowerCase().includes(query.toLowerCase().trim()))
 ),[department,section,filter,query]);
 const countFor=(name:string)=>courses.filter(c=>c.department===name).length;
 const closeMobile=()=>setMobileOpen(false);
 function openDepartment(name:string){setDepartment(name);setSection('department');setFilter('all');setQuery('');closeMobile()}
 function openCourse(next:Course){setCourse(next);setDepartment(next.department);setResourceId('v1');setPlaying(false);setVideoError(false);setSection('course');setLessonPanelOpen(true);closeMobile()}
 function openSection(next:Section){setSection(next);setQuery('');setFilter('all');closeMobile()}
 function selectResource(id:string){setResourceId(id);setPlaying(false);setVideoError(false);closeMobile()}
 function searchChange(v:string){setQuery(v);if(v.trim())setSection('catalogue')}
 const pageLabel=section==='home'?'Overview':section==='catalogue'?'Course catalogue':section==='department'?department:section==='uncategorized'?'Uncategorized Resources':course.title;
 return <div className="lp-app">
  <aside className={'lp-rail '+(mobileOpen?'lp-mobile-open':'')} aria-label="Main library navigation">
   <button className="lp-brand" onClick={()=>openSection('home')} aria-label="Go to library overview">
    <span className="lp-brand-emblem"><GraduationCap size={23} strokeWidth={1.85}/></span>
    <span className="lp-brand-copy"><strong>MREM</strong><small>DIGITAL LEARNING LIBRARY</small></span>
   </button>
   <div className="lp-rail-separator"/>
   <div className="lp-side-label">WORKSPACE</div>
   <button className={'lp-nav '+(section==='home'?'is-active':'')} onClick={()=>openSection('home')}><Grid2X2 size={17}/><span>Overview</span></button>
   <button className={'lp-nav '+(section==='catalogue'?'is-active':'')} onClick={()=>openSection('catalogue')}><LibraryBig size={17}/><span>Course catalogue</span></button>
   <button className={'lp-nav '+(section==='uncategorized'?'is-active':'')} onClick={()=>openSection('uncategorized')}><FolderOpen size={17}/><span>Uncategorized</span></button>
   <div className="lp-side-label lp-space-label">DISCIPLINES</div>
   <div className="lp-department-links">
    {departments.map(d=><button key={d.name} className={'lp-nav lp-dept-nav '+(department===d.name&&(section==='department'||section==='course')?'is-active':'')} onClick={()=>openDepartment(d.name)}>
      <span className={'lp-dept-dot lp-dot-'+d.tint}/><span>{d.name}</span><ChevronRight size={13} className="lp-nav-chevron"/>
    </button>)}
   </div>
   <div className="lp-rail-bottom">
     <div className="lp-campus-shield"><ShieldCheck size={16}/><span>College learning portal</span></div>
     <span>UI concept · no server data connected</span>
   </div>
  </aside>
  {mobileOpen&&<button className="lp-backdrop" aria-label="Close navigation" onClick={closeMobile}/>}
  <div className="lp-body">
   <header className="lp-topbar">
     <div className="lp-top-left">
       <button className="lp-mobile-menu" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button>
       <button className="lp-logo-mini" onClick={()=>openSection('home')}>Library <ChevronRight size={14}/></button>
       <span className="lp-breadcrumb-now">{pageLabel}</span>
     </div>
     <div className="lp-top-actions">
       <div className="lp-top-search"><Search size={16}/><input aria-label="Search courses" value={query} onChange={e=>searchChange(e.target.value)} placeholder="Search courses, topics, course IDs..."/><span>⌘ K</span></div>
       <div className="lp-preview-status"><span/> Design preview</div>
       <div className="lp-avatar" title="Preview user">M</div>
     </div>
   </header>
   <div className="lp-notice"><Sparkles size={15}/><span><strong>UI/UX comparison build.</strong> Illustrative sample courses and lessons only; no live E:, F:, G: or H: content and no database changes.</span><button onClick={()=>openSection('home')} aria-label="Return to overview"><X size={14}/></button></div>

   <div className={'lp-frame '+(section==='home'||section==='uncategorized'?'lp-frame-single':'')}>
     {(section==='course'||section==='department'||section==='catalogue')&&
      <aside className={'lp-context '+(section==='course'&&!lessonPanelOpen?'lp-context-collapsed':'')} aria-label="Context navigation">
       {section==='course'?<>
        <div className="lp-context-header"><button className="lp-context-back" onClick={()=>openDepartment(course.department)}><ChevronLeft size={16}/> All courses</button><button className="lp-plain-icon" title="Collapse course contents" onClick={()=>setLessonPanelOpen(v=>!v)}><PanelLeftClose size={18}/></button></div>
        {lessonPanelOpen&&<>
         <div className="lp-context-course"><div className="lp-context-kicker">COURSE CONTENTS</div><h3>{course.title}</h3><p>{course.reference?'NPTEL reference course':'Illustrative course example'}</p></div>
         {(['Lessons','Resources'] as const).map(group=><div className="lp-context-group" key={group}><div className="lp-context-group-name">{group==='Lessons'?'LEARNING CONTENT':'STUDY MATERIALS'} <span>{resources.filter(x=>x.group===group).length}</span></div>
          {resources.filter(x=>x.group===group).map((r,i)=>{const Icon=iconForKind(r.kind);return <button key={r.id} className={'lp-lesson '+(resourceId===r.id?'is-current':'')} onClick={()=>selectResource(r.id)}><span className="lp-lesson-index">{group==='Lessons'?String(i+1).padStart(2,'0'):<Icon size={16}/>}</span><span className="lp-lesson-label"><strong>{r.title}</strong><small>{r.kind.toUpperCase()} · UI sample</small></span>{resourceId===r.id&&<span className="lp-lesson-active-dot"/>}</button>})}
         </div>)}
        </>}
       </>:<>
         <div className="lp-context-header"><span>EXPLORE</span><Layers3 size={17}/></div>
         <div className="lp-context-group-name">{section==='department'?'THIS DEPARTMENT':'QUICK DEPARTMENTS'}</div>
         {departments.map(d=><button key={d.name} className={'lp-context-dept '+(department===d.name&&section==='department'?'is-current':'')} onClick={()=>openDepartment(d.name)}><span>{d.short}</span><strong>{d.name}</strong><small>{countFor(d.name)}</small></button>)}
         {section==='department'&&<><div className="lp-context-group-name lp-context-course-label">COURSES IN DEPARTMENT</div>
          {courses.filter(c=>c.department===department).map(c=><button className="lp-context-course-link" key={c.id} onClick={()=>openCourse(c)}><BookOpen size={15}/><span>{c.title}</span><ChevronRight size={13}/></button>)}</>}
       </>}
      </aside>}

     <main className="lp-main">
      {section==='home'&&<>
       <div className="lp-page-intro"><div className="lp-eyebrow">MREM / DIGITAL LEARNING</div><h1>Learning, beautifully organized.</h1><p>A focused academic workspace for discovering courses, studying lessons and exploring reference materials.</p></div>
       <div className="lp-summary-cards">
        <div className="lp-stat-card"><div className="lp-stat-icon"><Layers3 size={20}/></div><strong>{departments.length}</strong><span>Sample departments</span><small>Browse by discipline <ArrowRight size={12}/></small></div>
        <div className="lp-stat-card"><div className="lp-stat-icon lp-orange"><BookOpen size={20}/></div><strong>{courses.length}</strong><span>Sample courses</span><small>Interface-only catalogue <ArrowRight size={12}/></small></div>
        <div className="lp-stat-card"><div className="lp-stat-icon lp-purple"><Video size={20}/></div><strong>4</strong><span>Viewer formats</span><small>Video · PDF · HTML · Text <ArrowRight size={12}/></small></div>
       </div>
       <div className="lp-section-heading"><div><div className="lp-eyebrow">EXPLORE BY DISCIPLINE</div><h2>Departments</h2><p>Find academic content through a clear, structured directory.</p></div><button className="lp-text-link" onClick={()=>openSection('catalogue')}>All courses <ArrowRight size={16}/></button></div>
       <div className="lp-dept-grid">
        {departments.map(d=><button key={d.name} className="lp-dept-card" onClick={()=>openDepartment(d.name)}><span className={'lp-dept-monogram lp-dept-'+d.tint}>{d.short}</span><strong>{d.name}</strong><span className="lp-dept-meta">{countFor(d.name)} sample courses <ArrowRight size={14}/></span></button>)}
       </div>
       <div className="lp-section-heading lp-margin-top"><div><div className="lp-eyebrow">COURSE DISCOVERY</div><h2>Explore courses</h2><p>Representative catalogue entries for design evaluation.</p></div><button className="lp-text-link" onClick={()=>openSection('catalogue')}>View catalogue <ArrowRight size={16}/></button></div>
       <div className="lp-course-list">{courses.slice(0,4).map(c=><CourseRow key={c.id} c={c} onClick={()=>openCourse(c)}/>)}</div>
      </>}
      {(section==='catalogue'||section==='department')&&<>
       <div className="lp-page-intro lp-compact-intro"><div className="lp-eyebrow">COURSE DISCOVERY</div><h1>{section==='department'?department:'Explore all courses'}</h1><p>{section==='department'?'Browse the courses associated with this selected discipline.':'A structured, searchable catalogue of academic subjects and learning materials.'}</p></div>
       <div className="lp-toolbar"><div className="lp-inline-search"><Search size={17}/><input aria-label="Filter courses" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a course or subject ID..."/></div><div className="lp-filter-menu"><ListFilter size={15}/><select aria-label="Course content filter" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>{allTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><ChevronDown size={14}/></div></div>
       <div className="lp-list-heading"><span>COURSE NAME</span><span>CONTENT TYPE</span><span/></div>
       <div className="lp-course-list">{visibleCourses.length?visibleCourses.map(c=><CourseRow key={c.id} c={c} onClick={()=>openCourse(c)}/>):<div className="lp-empty"><Search size={26}/><strong>No matching demo courses</strong><p>Try a different title, department, or filter.</p><button onClick={()=>{setQuery('');setFilter('all')}}>Reset filters</button></div>}</div>
       <div className="lp-results-note">{visibleCourses.length} illustrative entries · not a live server inventory</div>
      </>}
      {section==='course'&&<>
       <div className="lp-course-top">
        <div className="lp-eyebrow">LEARNING WORKSPACE <ChevronRight size={12}/> {course.department}</div>
        <h1>{course.title}</h1><div className="lp-course-meta"><span><GraduationCap size={15}/>{course.faculty}</span><span><BookText size={15}/>{course.institute}</span><span><Layers3 size={15}/>{course.reference?'Reference catalogue sample':'Demonstration content'}</span></div>
       </div>
       <div className="lp-player-card">
        <div className="lp-viewer-top"><div><span className="lp-small-pill"><span className="lp-online-dot"/> INTEGRATED VIEWER</span><strong>{selectedResource.title}</strong></div><span className="lp-format">{selectedResource.kind.toUpperCase()}</span></div>
        {selectedResource.kind==='video'?<div className="lp-video-stage">
          {playing&&!videoError?<video key={resourceId} src="/demo/mrem-preview.mp4" controls playsInline autoPlay preload="metadata" onError={()=>setVideoError(true)} aria-label="Synthetic video demonstration"/>:
           <div className="lp-video-poster"><div className="lp-orbit lp-orbit-1"/><div className="lp-orbit lp-orbit-2"/><div className="lp-video-poster-copy"><span>VIDEO LEARNING</span><h2>Stay in the flow.</h2><p>Watch lessons without leaving your course workspace.</p><button onClick={()=>{setPlaying(true);setVideoError(false)}} aria-label="Play synthetic demo video"><Play size={21} fill="currentColor"/></button><small>{videoError?'Synthetic demo video unavailable in this preview.':'Play the tiny synthetic UI test video'}</small></div></div>}
        </div>:selectedResource.kind==='pdf'?<div className="lp-document-stage"><div className="lp-paper"><span className="lp-paper-label">PDF · DESIGN SAMPLE</span><h3>Course reference notes</h3><div className="lp-paper-line lp-line-long"/><div className="lp-paper-line"/><div className="lp-paper-line lp-line-mid"/><div className="lp-paper-subheading">A clean reading experience</div><div className="lp-paper-line lp-line-long"/><div className="lp-paper-line lp-line-mid"/><div className="lp-paper-line"/><div className="lp-paper-note">Document rendering area — no actual college PDF has been loaded.</div></div></div>:
        selectedResource.kind==='html'?<div className="lp-html-stage"><div className="lp-html-toolbar"><span/><span/><span/> <small>Academic HTML · sanitized preview layout</small></div><div className="lp-html-body"><div className="lp-html-title">Course resource index</div><p>Rendered tables and local academic links will be shown here in the actual integration.</p><table><thead><tr><th>Subject ID</th><th>Course name</th><th>Content</th></tr></thead><tbody><tr><td>{course.id}</td><td>{course.title}</td><td>Video</td></tr></tbody></table><div className="lp-html-foot">Illustrative HTML view. No legacy scripts are executed in this UI concept.</div></div></div>:
        <div className="lp-text-stage"><div className="lp-text-heading">Additional reading</div><p>This is an example of a readable inline text resource. The final learning workspace will show approved source files using the existing secure file APIs.</p><p>No original file content is loaded in the design preview.</p></div>}
        <div className="lp-viewer-bottom"><span><ShieldCheck size={16}/> Comparison-only preview · no database connection</span><div><button onClick={()=>selectResource(resources[(resources.findIndex(r=>r.id===resourceId)+1)%resources.length].id)}>Next resource <ArrowRight size={15}/></button></div></div>
       </div>
       <div className="lp-after-player"><div><div className="lp-eyebrow">CURRENT RESOURCE</div><h2>{selectedResource.title}</h2><p>{selectedResource.description}</p></div><span className="lp-reference-label">{course.reference?'Course title appears in supplied NPTEL catalogue':'Illustrative course title'}</span></div>
       <div className="lp-course-extra"><div><BookOpen size={18}/><strong>About this workspace</strong></div><p>When connected to the college server, this layout will use the real department, verified course title, actual indexed lessons and available files. This branch deliberately does not alter existing media APIs, mappings or storage sources.</p></div>
      </>}
      {section==='uncategorized'&&<>
       <div className="lp-page-intro lp-compact-intro"><div className="lp-eyebrow">ORIGINAL FILE HIERARCHY</div><h1>Uncategorized resources</h1><p>Files without verified academic categories stay in their original hierarchy and retain their real filenames.</p></div>
       <div className="lp-uncategorized"><div className="lp-uncat-image"><FolderOpen size={35}/></div><h2>Original names, never invented.</h2><p>The actual uncategorized folder tree will appear here after source-aware integration. This UI-only branch does not access E:, F:, G: or H: and therefore will not invent folder listings.</p><div className="lp-uncat-rule"><ShieldCheck size={17}/> Institution approval is required before unclassified content is visible to students.</div><button onClick={()=>openSection('catalogue')}>Explore catalogue <ArrowRight size={15}/></button></div>
      </>}
     </main>
   </div>
  </div>
 </div>;
}
function CourseRow({c,onClick}:{c:Course;onClick:()=>void}){
 return <button className="lp-course-row" onClick={onClick}>
  <span className="lp-course-row-icon"><BookOpen size={19}/></span>
  <span className="lp-course-row-main"><strong>{c.title}</strong><small>{c.department} <span>·</span> {c.faculty} <span>·</span> {c.id}</small></span>
  <span className="lp-course-type">{c.type}</span><ChevronRight size={18} className="lp-course-arrow"/>
 </button>
}