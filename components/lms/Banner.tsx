'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';

const SLIDES=[
 {eyebrow:'MREM Digital Learning Library',title:'Welcome to MREM Digital Learning Library',text:'Explore academic knowledge in one organized learning space.',href:'/departments',action:'Explore departments',art:'/lms-art/academic.svg'},
 {eyebrow:'Departments',title:'Explore Learning Across Departments',text:'Courses from every discipline in the college archive, organized for you.',href:'/departments',action:'Browse departments',art:'/lms-art/library.svg'},
 {eyebrow:'Video Courses',title:'Video Courses and Academic Resources',text:'Watch lectures and read study materials in one place.',href:'/video-courses',action:'Browse video courses',art:'/lms-art/innovation.svg'},
 {eyebrow:'Web Courses',title:'Discover Web-Based Learning',text:'Open web courses page by page, right inside the library.',href:'/web-courses',action:'Browse web courses',art:'/lms-art/web-learning.svg'},
 {eyebrow:'Self-paced',title:'Learning Beyond the Classroom',text:'Explore available academic resources at your own pace.',href:'/study-materials',action:'Open study materials',art:'/lms-art/learning.svg'}
];

/** MREM announcements: rotates every 7 s, pauses on hover, focus or the pause button, never auto-rotates for reduced motion. */
export default function Banner(){
 const [i,setI]=useState(0),[hold,setHold]=useState(false),[stopped,setStopped]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');setReduced(m.matches);const f=()=>setReduced(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f)},[]);
 useEffect(()=>{if(hold||stopped||reduced)return;const t=setInterval(()=>setI(x=>(x+1)%SLIDES.length),7000);return()=>clearInterval(t)},[hold,stopped,reduced]);
 const go=(d:number)=>setI(x=>(x+d+SLIDES.length)%SLIDES.length);
 return <section className="banner" aria-roledescription="carousel" aria-label="MREM announcements"
   onMouseEnter={()=>setHold(true)} onMouseLeave={()=>setHold(false)} onFocus={()=>setHold(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHold(false)}}
   onKeyDown={e=>{if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1)}}>
  {SLIDES.map((s,k)=><div key={s.title} className={'slide slide-'+k+(k===i?' on':'')} aria-roledescription="slide" aria-label={(k+1)+' of '+SLIDES.length} aria-hidden={k!==i}>
   <div className="slide-copy"><span className="eyebrow">{s.eyebrow}</span><h2>{s.title}</h2><p>{s.text}</p>
    <Link className="btn btn-light" href={s.href} tabIndex={k===i?0:-1}>{s.action} <ArrowRight size={16}/></Link></div>
   <img className="slide-art" src={s.art} alt="" width={750} height={360} loading={k===0?'eager':'lazy'}/>
  </div>)}
  <div className="ban-ctl">
   <button onClick={()=>go(-1)} aria-label="Previous announcement"><ChevronLeft size={18}/></button>
   <div className="dots">{SLIDES.map((s,k)=><button key={s.title} onClick={()=>setI(k)} aria-label={'Show announcement '+(k+1)} aria-current={k===i?'true':undefined}/>)}</div>
   <button onClick={()=>go(1)} aria-label="Next announcement"><ChevronRight size={18}/></button>
   <button onClick={()=>setStopped(s=>!s)} aria-label={stopped?'Resume rotation':'Pause rotation'}>{stopped?<Play size={15}/>:<Pause size={15}/>}</button>
  </div>
 </section>;
}
