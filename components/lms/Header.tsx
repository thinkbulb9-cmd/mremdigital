'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useState} from 'react';
import {Menu,Search,X} from 'lucide-react';

const NAV=[['/','Home'],['/departments','Departments'],['/video-courses','Video Courses'],['/web-courses','Web Courses'],['/study-materials','Study Materials']] as const;

/** Top navigation for every student page. On small screens the same links open in a panel under the header. */
export default function Header(){
 const path=usePathname(),router=useRouter();
 const [open,setOpen]=useState(false),[q,setQ]=useState('');
 const active=(href:string)=>href==='/'?path==='/':path===href||path.startsWith(href+'/')||(href==='/departments'&&path.startsWith('/courses'));
 const search=(e:React.FormEvent)=>{e.preventDefault();setOpen(false);router.push('/courses'+(q.trim()?'?q='+encodeURIComponent(q.trim()):''))};
 const form=<form className="hdr-search" role="search" onSubmit={search}><Search size={15} aria-hidden/><input aria-label="Search courses" placeholder="Search courses, professors, IDs…" value={q} onChange={e=>setQ(e.target.value)}/></form>;
 return <header className="hdr">
  <div className="wrap">
   <div className="hdr-row">
    <Link href="/" className="brand" aria-label="MREM Digital Learning Library home">
     <img src="/brand/mrem-emblem.png" width={42} height={40} alt="MREM college emblem"/>
     <span><b>MREM Digital Learning Library</b><small>An UGC Autonomous Institution</small></span>
    </Link>
    <nav className="nav" aria-label="Main">{NAV.map(([href,label])=><Link key={href} href={href} aria-current={active(href)?'page':undefined}>{label}</Link>)}</nav>
    {form}
    <button className="menu-btn" aria-expanded={open} aria-controls="mobile-nav" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(o=>!o)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
   </div>
   <div id="mobile-nav" className="mobile-panel" hidden={!open}>
    <nav aria-label="Main">{NAV.map(([href,label])=><Link key={href} href={href} aria-current={active(href)?'page':undefined} onClick={()=>setOpen(false)}>{label}</Link>)}</nav>
    {form}
   </div>
  </div>
 </header>;
}
