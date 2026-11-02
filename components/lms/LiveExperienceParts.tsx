import Link from 'next/link';
import {ArrowRight,BookOpen,ChevronRight,FileText,Globe2,Video} from 'lucide-react';
import {departmentArt} from '@/lib/department-art';
import type {CourseSummary} from '@/lib/campus-catalog';
export const number=(n:number)=>n.toLocaleString('en-IN');
export const courseTitle=(c:{title:string;code:string})=>c.title||'Course ID '+c.code;
export const coursePath=(c:CourseSummary)=>c.isWeb&&c.videos===0&&c.deptSlug?'/web-courses/'+c.deptSlug+'/'+c.code:'/courses/'+c.code;
export function XpBreadcrumb({links}:{links:{text:string;href?:string}[]}){
 return <nav className="xp-breadcrumb" aria-label="Breadcrumb">{links.map((x,i)=><span key={i}>{i>0&&<ChevronRight size={13} aria-hidden/>} {x.href?<Link href={x.href}>{x.text}</Link>:<span aria-current="page">{x.text}</span>}</span>)}</nav>;
}
export function XpHeading({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
 return <div className="xp-intro"><span className="xp-eyebrow">{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>;
}
export function XpSectionHeading({eyebrow,title,href,more,description}:{eyebrow:string;title:string;href?:string;more?:string;description?:string}){
 return <div className="xp-section-heading"><div><span className="xp-eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{href&&<Link href={href}>{more||'View all'} <ArrowRight size={17}/></Link>}</div>;
}
export function XpDepartmentCard({d,href}:{d:{name:string;slug:string;courses:number};href?:string}){
 const art=departmentArt(d.name);
 return <Link href={href||'/departments/'+d.slug} className="xp-department-card">
  <div className="xp-department-image" style={{backgroundImage:'url('+art.src+')'}} role="img" aria-label={art.alt}/>
  <div className="xp-department-copy"><div><h3>{d.name}</h3><p>{number(d.courses)} {d.courses===1?'course':'courses'} available</p></div><span><ArrowRight size={18}/></span></div>
 </Link>;
}
export function XpCourseCard({c,web=false}:{c:CourseSummary;web?:boolean}){
 const art=departmentArt(c.department||'General');
 const isWeb=web||(c.isWeb&&c.videos===0);
 return <Link href={isWeb&&c.deptSlug?'/web-courses/'+c.deptSlug+'/'+c.code:coursePath(c)} className="xp-course-card">
  <div className="xp-course-art" style={{backgroundImage:'url('+art.src+')'}} role="img" aria-label={art.alt}>
   <span>{isWeb?<Globe2 size={13}/>:<Video size={13}/>} {isWeb?'Web course':'Video course'}</span>
  </div>
  <div className="xp-course-details"><small>{c.department||'Academic course'}</small><h3>{courseTitle(c)}</h3>
   <p>{[c.instructor,c.institution].filter(Boolean).join(' · ')||'Course ID '+c.code}</p>
   <strong>{isWeb?number(c.html)+' web pages':number(c.videos)+' videos'} <ArrowRight size={15}/></strong>
  </div>
 </Link>;
}
export function XpEmpty({title,description}:{title:string;description:string}){return <div className="xp-empty"><BookOpen size={26}/><h3>{title}</h3><p>{description}</p></div>}
export function XpStat({icon:Icon,title,value,note,featured=false}:{icon:any;title:string;value:number;note?:string;featured?:boolean}){
 return <div className={'xp-stat '+(featured?'xp-stat-featured':'')}><span className="xp-stat-icon"><Icon size={20}/></span><strong>{number(value)}</strong><h3>{title}</h3>{note&&<p>{note}</p>}</div>;
}
export function XpResourceLine({id,code,title,details,index,href}:{id:string;code:string;title:string;details?:string;index:string|number;href?:string}){
 return <Link href={href||'/courses/'+code+'/lessons/'+id} className="xp-lesson-line">
  <span className="xp-lesson-number">{index}</span><span><strong>{title}</strong>{details&&<small>{details}</small>}</span><ArrowRight size={16}/></Link>;
}
export function XpPager({page,pages,total,href}:{page:number;pages:number;total:number;href:(i:number)=>string}){
 return total>0&&pages>1?<nav className="xp-page-nav" aria-label="Pagination"><span>{number(total)} results · Page {page} of {pages}</span><div>
  {page>1&&<Link href={href(page-1)}>Previous</Link>}{page<pages&&<Link href={href(page+1)}>Next <ChevronRight size={16}/></Link>}
 </div></nav>:null;
}
export function XpSearchSubmit({value='',name='q',placeholder='Search courses by title, lecturer or ID'}:{value?:string;name?:string;placeholder?:string}){
 return <label className="xp-inline-search"><span className="sr-only">{placeholder}</span><input name={name} defaultValue={value} placeholder={placeholder}/></label>;
}
