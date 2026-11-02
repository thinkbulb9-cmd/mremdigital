import Link from 'next/link';
import {BookOpen,Code2,FileText,Files,Layers,MonitorPlay,Video} from 'lucide-react';
import Banner from '@/components/lms/Banner';
import QuickSearch from '@/components/lms/QuickSearch';
import {CourseCard,DeptCard,SectionHead,nice} from '@/components/lms/ui';
import {courseSummaries,departments,libraryStats} from '@/lib/campus-catalog';

export const metadata={title:'MREM Digital Learning Library'};

export default async function Home(){
 const [stats,depts,all]=await Promise.all([libraryStats(),departments(),courseSummaries()]);
 // Featured lists are deterministic: named courses with the most material first.
 const videos=all.filter(c=>c.title&&c.videos>0).sort((a,b)=>b.videos-a.videos).slice(0,8);
 const web=all.filter(c=>c.title&&c.isWeb&&c.deptSlug).sort((a,b)=>b.html-a.html).slice(0,4);
 const STATS=[[BookOpen,stats.courses,'Total courses'],[MonitorPlay,stats.videoCourses,'Video courses'],[Code2,stats.webCourses,'Web courses'],
  [Video,stats.videos,'Video lectures'],[FileText,stats.pdfs,'PDF resources'],[Files,stats.texts,'Text and documents'],[Layers,stats.departments,'Departments']] as const;
 return <>
  <section className="home-hero" aria-label="Discover academic learning"><div className="home-hero-inner"><span className="eyebrow">The MREM learning experience</span>
   <h1>Everything you need to <em>keep learning.</em></h1><p>Find your next subject, open a verified course and focus on learning—without the clutter.</p>
   <QuickSearch variant="hero"/><div className="home-hero-benefits"><span>✓ No student login</span><span>✓ Organized by subject</span></div></div>
   <div className="home-hero-deco" aria-hidden="true"><div className="home-orbit"/><span>Explore · Learn · Grow</span></div></section>
  <section aria-labelledby="stats-title">
   <h2 id="stats-title" className="sr-only">Library statistics</h2>
   <div className="stats stats-bento">{STATS.map(([Icon,value,label])=><div className="stat" key={label}><Icon size={20} aria-hidden/><strong>{nice(value)}</strong><span>{label}</span></div>)}</div>
   <p className="note">Counted from the indexed college archive. A course held on several drives counts once; video, PDF and document counts are files inside
    course folders. A web course is listed by NPTEL as a web course and has pages to open.</p>
  </section>
  <section className="sec"><SectionHead eyebrow="Departments" title="Learn by department" href="/departments" more="All departments"/>
   <div className="grid g-dept">{depts.slice(0,8).map(d=><DeptCard key={d.slug} name={d.name} count={d.courses} href={'/departments/'+d.slug}/>)}</div></section>
  <section className="home-announcements" aria-label="MREM institutional messages"><Banner/></section>
  {videos.length>0&&<section className="sec"><SectionHead eyebrow="Video courses" title="Watch lectures" href="/video-courses" more="All video courses"/>
   <div className="grid g-course">{videos.map(c=><CourseCard key={c.code} c={c}/>)}</div></section>}
  {web.length>0&&<section className="sec"><SectionHead eyebrow="Web courses" title="Read course pages" href="/web-courses" more="All web courses"/>
   <div className="grid g-course">{web.map(c=><CourseCard key={c.code} c={c} web/>)}</div></section>}
  <section className="sec"><SectionHead eyebrow="Study materials" title="Notes, slides and documents" href="/study-materials" more="All study materials"/>
   <div className="grid g-course">
    <Link className="card" href="/study-materials?type=pdf"><div className="card-body"><span className="tag"><FileText size={12}/> PDF</span><h3>PDF resources</h3><p>{nice(stats.pdfs)} PDF files from course folders.</p></div></Link>
    <Link className="card" href="/study-materials?type=document"><div className="card-body"><span className="tag"><Files size={12}/> Documents</span><h3>Text and documents</h3><p>{nice(stats.texts)} slides, notes and text files from course folders.</p></div></Link>
   </div></section>
 </>;
}
