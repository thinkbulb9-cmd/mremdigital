import Link from 'next/link';
import './lms.css';
import '@/components/lms/ui-experience-preview.css';
import Header from '@/components/lms/Header';
import {campusMode} from '@/lib/campus-mode';
export const dynamic='force-dynamic';
/** The approved XP visual system, backed by the existing college-only database and secure file APIs. */
export default function StudentLayout({children}:{children:React.ReactNode}){
 return <div className="lms xp-app">
  <a className="lms-skip" href="#main">Skip to content</a>
  <Header/>
  <main id="main">{campusMode()?children:<div className="xp-container xp-inner"><div className="xp-intro"><span className="xp-eyebrow">MREM DIGITAL LEARNING LIBRARY</span>
   <h1>Available on the college network</h1><p>Live academic courses and files remain on the authorized campus server. Connect through the college library network to browse them.</p></div></div>}</main>
  <footer className="xp-footer"><div className="xp-container"><div><img src="/brand/mrem-emblem.png" alt="" width={39} height={39}/><span><strong>MREM Digital Learning Library</strong><small>An UGC Autonomous Institution</small></span></div>
    <p>Academic resources served from authorized college storage</p><Link href="/">Back to discover</Link>
  </div></footer>
 </div>;
}
