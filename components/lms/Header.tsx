'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {Menu,X} from 'lucide-react';
import QuickSearch from '@/components/lms/QuickSearch';
const NAV=[['/','Discover'],['/departments','Departments'],['/courses','Courses'],['/video-courses','Video Courses'],['/web-courses','Web Courses'],['/study-materials','Study Materials']] as const;
export default function Header(){
 const pathname=usePathname(),[menu,setMenu]=useState(false);
 const active=(path:string)=>path==='/'?pathname==='/':pathname===path||pathname.startsWith(path+'/');
 return <header className="xp-header"><div className="xp-container xp-header-content">
  <Link href="/" className="xp-brand" aria-label="MREM Digital Learning Library homepage"><img src="/brand/mrem-emblem.png" width={45} height={45} alt="Official MREM emblem"/><span><strong>MREM</strong><small>Digital Learning Library</small></span></Link>
  <nav className="xp-mainnav" aria-label="Student main navigation">{NAV.map(([path,label])=><Link key={path} href={path} className={active(path)?'on':''} aria-current={active(path)?'page':undefined}>{label}</Link>)}</nav>
  <div className="xp-header-actions"><QuickSearch/><span className="xp-access"><span/> Open library</span><button type="button" className="xp-menu-btn" aria-expanded={menu} aria-controls="xp-mobile-navigation" onClick={()=>setMenu(v=>!v)} aria-label={menu?'Close navigation':'Open navigation'}>{menu?<X size={22}/>:<Menu size={22}/>}</button></div>
 </div>{menu&&<nav id="xp-mobile-navigation" className="xp-mobile-menu" aria-label="Mobile navigation">{NAV.map(([p,t])=><Link key={p} href={p} onClick={()=>setMenu(false)}>{t}</Link>)}</nav>}</header>;
}
