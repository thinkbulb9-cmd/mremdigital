'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';
const slides=[
 {title:'Knowledge, beautifully organized.',tag:'EXPLORE MREM',copy:'Courses, lectures and study materials in one beautifully simple learning environment.',art:'academic.svg',style:'berry',href:'/departments'},
 {title:'Find the subject that moves you.',tag:'DEPARTMENT COLLECTIONS',copy:'Discover the next topic through focused academic collections.',art:'library.svg',style:'violet',href:'/departments'},
 {title:'Designed for deeper learning.',tag:'ONE LEARNING WORKSPACE',copy:'Open a lesson, stay focused and continue at your own pace.',art:'innovation.svg',style:'blue',href:'/courses'}
];
export default function LiveAnnouncement(){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false);
 useEffect(()=>{if(paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const t=setInterval(()=>setIndex(i=>(i+1)%slides.length),9000);return()=>clearInterval(t)},[paused]);
 const s=slides[index];
 return <div className={'xp-banner xp-banner-'+s.style} aria-label="MREM institutional announcements" aria-roledescription="carousel"
  onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}
  onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setPaused(false)}}>
  <div className="xp-banner-copy"><span className="xp-eyebrow">{s.tag}</span><h2>{s.title}</h2><p>{s.copy}</p><Link href={s.href}>Explore learning <ArrowRight size={16}/></Link></div>
  <img src={'/lms-art/'+s.art} alt="" loading="lazy" width={750} height={360}/>
  <div className="xp-banner-controls"><button onClick={()=>setIndex(i=>(i+slides.length-1)%slides.length)} aria-label="Previous banner"><ChevronLeft size={17}/></button>
   {slides.map((a,i)=><button className={'xp-banner-dot '+(i===index?'on':'')} onClick={()=>setIndex(i)} key={a.title} aria-label={'Show banner '+(i+1)} aria-current={i===index?'true':undefined}/>)}
   <button onClick={()=>setIndex(i=>(i+1)%slides.length)} aria-label="Next banner"><ChevronRight size={17}/></button>
   <button onClick={()=>setPaused(p=>!p)} aria-label={paused?'Resume carousel':'Pause carousel'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div>
 </div>;
}
