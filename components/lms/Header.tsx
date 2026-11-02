'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {Menu,X} from 'lucide-react';
import QuickSearch from '@/components/lms/QuickSearch';
const NAV=[['/','Discover'],['/departments','Departments'],['/video-courses','Video Courses'],['/web-courses','Web Courses'],['/study-materials','Study Materials']] as const;
/** Compact desktop top bar with accessible expandable mobile navigation and keyboard-first search. No sidebar. */
export default function Header(){
 const path=usePathname(),[open,setOpen]=useState(false);
 const active=(href:string)=>href==='/'?path==='/':path===href||path.startsWith(href+'/')||(href==='/departments'&&path.startsWith('/courses'));
 return <header className="hdr"><div className="wrap">
  <div className="hdr-row"><Link href="/" className="brand" aria-label="MREM Digital Learning Library home">
   <img src="/brand/mrem-emblem.png" width={42} height={40} alt="MREM college emblem"/>
   <span><b>MREM Digital Learning Library</b><small>An UGC Autonomous Institution</small></span>
  </Link>
  <nav className="nav" aria-label="Main">{NAV.map(([href,label])=><Link key={href} href={href} aria-current={active(href)?'page':undefined}>{label}</Link>)}</nav>
  <QuickSearch/>
  <button className="menu-btn" aria-expanded={open} aria-controls="mobile-nav" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(o=>!o)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
  </div><div id="mobile-nav" className="mobile-panel" hidden={!open}><nav aria-label="Mobile navigation">{NAV.map(([href,label])=><Link key={href} href={href} aria-current={active(href)?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}</nav></div>
 </div></header>;
}
