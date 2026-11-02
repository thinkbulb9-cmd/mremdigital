import Link from 'next/link';
import {BookOpen,Check,FileText,Globe2,GraduationCap,Layers3,LibraryBig,MonitorPlay,Video} from 'lucide-react';
import QuickSearch from '@/components/lms/QuickSearch';
import LiveAnnouncement from '@/components/lms/LiveAnnouncement';
import {XpDepartmentCard,XpCourseCard,XpSectionHeading,XpStat} from '@/components/lms/LiveExperienceParts';
import {courseSummaries,departments,libraryStats} from '@/lib/campus-catalog';
export const metadata={title:'MREM Digital Learning Library'};
export const dynamic='force-dynamic';
export default async function Home(){
 const [stats,depts,all]=await Promise.all([libraryStats(),departments(),courseSummaries()]);
 const featured=all.filter(c=>c.title&&c.videos>0).sort((a,b)=>b.videos-a.videos).slice(0,4);
 const web=all.filter(c=>c.title&&c.isWeb&&c.deptSlug).sort((a,b)=>b.html-a.html).slice(0,4);
 return <>
  <section className="xp-hero xp-container"><div className="xp-hero-copy">
   <span className="xp-eyebrow">THE MREM LEARNING EXPERIENCE</span>
   <h1>Everything you need<br/>to <em>keep learning.</em></h1>
   <p>Discover academic courses, watch lessons and explore study materials through one calm, beautifully organized library.</p>
   <QuickSearch variant="hero"/>
   <div className="xp-hero-features"><span><Check size={15}/> No login needed</span><span><Check size={15}/> Focused learning</span></div>
  </div><div className="xp-hero-visual" aria-hidden="true"><div className="xp-orbit xp-orbit-one"/><div className="xp-orbit xp-orbit-two"/><div className="xp-hero-icon"><GraduationCap size={70} strokeWidth={1.1}/></div>
   <div className="xp-float xp-float-one"><BookOpen size={21}/><span><strong>Discover</strong><small>Find your subject</small></span></div><div className="xp-float xp-float-two"><MonitorPlay size={21}/><span><strong>Focus</strong><small>Enjoy the lesson</small></span></div>
  </div></section>
  <section className="xp-container xp-section xp-stats-section" aria-label="Library statistics">
   <div className="xp-section-heading"><div><span className="xp-eyebrow">LIBRARY AT A GLANCE</span><h2>One place. Every resource.</h2></div><span className="xp-sample-label"><LibraryBig size={15}/> Approved campus catalogue</span></div>
   <div className="xp-bento"><XpStat featured icon={LibraryBig} title="Total courses" value={stats.courses} note="Unique approved course IDs"/>
    <XpStat icon={Video} title="Video courses" value={stats.videoCourses}/>
    <XpStat icon={Globe2} title="Web courses" value={stats.webCourses}/>
    <XpStat icon={MonitorPlay} title="Video lectures" value={stats.videos}/>
    <XpStat icon={FileText} title="PDF resources" value={stats.pdfs}/>
    <XpStat icon={Layers3} title="Text & documents" value={stats.texts}/>
   </div>
  </section>
  <section className="xp-container xp-section">
   <XpSectionHeading eyebrow="FIND YOUR DISCIPLINE" title="Where curiosity begins." description={stats.departments+' academic disciplines available to explore.'} href="/departments" more="All departments"/>
   <div className="xp-department-grid">{depts.slice(0,6).map(d=><XpDepartmentCard key={d.slug} d={d}/>)}</div>
  </section>
  {featured.length>0&&<section className="xp-container xp-section">
   <XpSectionHeading eyebrow="CURATED DISCOVERY" title="Pick up something new." description="Real, available video courses from the college catalogue." href="/video-courses" more="Browse all"/>
   <div className="xp-courses-grid">{featured.map(c=><XpCourseCard key={c.code} c={c}/>)}</div>
  </section>}
  {web.length>0&&<section className="xp-container xp-section">
   <XpSectionHeading eyebrow="WEB-BASED LEARNING" title="Explore web courses." description="Rendered HTML materials organized by verified academic subject." href="/web-courses" more="Browse web courses"/>
   <div className="xp-courses-grid">{web.map(c=><XpCourseCard key={c.code} c={c} web/>)}</div>
  </section>}
  <section className="xp-container xp-section"><LiveAnnouncement/></section>
  <section className="xp-container xp-section xp-material-links">
   <XpSectionHeading eyebrow="STUDY MATERIALS" title="Read, revise and explore." href="/study-materials" more="All resources"/>
   <div className="xp-material-grid">
    <Link href="/study-materials?type=pdf"><FileText size={23}/><div><strong>PDF study materials</strong><p>{stats.pdfs.toLocaleString('en-IN')} approved PDF resources</p></div></Link>
    <Link href="/study-materials?type=document"><BookOpen size={23}/><div><strong>Text and documents</strong><p>{stats.texts.toLocaleString('en-IN')} approved resource files</p></div></Link>
   </div>
  </section>
 </>;
}
