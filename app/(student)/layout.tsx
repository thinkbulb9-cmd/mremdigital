import Link from 'next/link';
import './lms.css';
import Header from '@/components/lms/Header';
import {campusMode} from '@/lib/campus-mode';
export const dynamic='force-dynamic';
/** Every student page: top navigation, full-width content, footer. No sidebar, no login. */
export default function StudentLayout({children}:{children:React.ReactNode}){
 return <div className="lms">
  <a className="lms-skip" href="#main">Skip to content</a>
  <Header/>
  <main id="main" className="wrap">{campusMode()?children:<div className="page-head"><span className="eyebrow">MREM Digital Learning Library</span>
   <h1 className="h-page">Available on the college network</h1><p className="lead">The library opens on the MREM campus network, where the course archive is hosted.</p></div>}</main>
  <footer className="ftr"><div className="wrap ftr-row">
   <div><b>Malla Reddy Engineering College and Management Sciences</b><br/>An UGC Autonomous Institution · <a href="https://mrem.ac.in/" rel="noopener">mrem.ac.in</a></div>
   <nav aria-label="Footer"><Link href="/departments">Departments</Link><Link href="/video-courses">Video Courses</Link><Link href="/web-courses">Web Courses</Link><Link href="/study-materials">Study Materials</Link></nav>
  </div></footer>
 </div>;
}
