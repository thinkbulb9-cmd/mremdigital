import Link from 'next/link';
import {ArrowRight,ChevronLeft,ChevronRight,Code2,FileText,Video} from 'lucide-react';
import {departmentArt} from '@/lib/department-art';
import type {CourseSummary} from '@/lib/campus-catalog';

export const nice=(n:number)=>n.toLocaleString('en-IN');
export const count=(n:number,one:string,many=one+'s')=>nice(n)+' '+(n===1?one:many);
export const courseName=(c:{title:string;code:string})=>c.title||'Course ID '+c.code;
export const courseHref=(c:CourseSummary)=>c.isWeb&&c.videos===0&&c.deptSlug?`/web-courses/${c.deptSlug}/${c.code}`:`/courses/${c.code}`;

export function Crumbs({items}:{items:[string,string?][]}){
 return <nav className="crumbs" aria-label="Breadcrumb">{items.map(([label,href],i)=><span key={i}>{i>0&&<span aria-hidden> / </span>}{href?<Link href={href}>{label}</Link>:<span aria-current="page">{label}</span>}</span>)}</nav>;
}

export function PageHead({eyebrow,title,lead,crumbs}:{eyebrow?:string;title:string;lead?:string;crumbs?:[string,string?][]}){
 return <div className="page-head">{crumbs&&<Crumbs items={crumbs}/>}{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1 className="h-page">{title}</h1>{lead&&<p className="lead">{lead}</p>}</div>;
}

export function SectionHead({eyebrow,title,href,more}:{eyebrow:string;title:string;href?:string;more?:string}){
 return <div className="sec-head"><div><span className="eyebrow">{eyebrow}</span><h2 className="h-sec">{title}</h2></div>{href&&<Link className="more" href={href}>{more||'View all'} <ArrowRight size={15}/></Link>}</div>;
}

export function DeptCard({name,count,href,unit='course'}:{name:string;count:number;href:string;unit?:string}){
 const art=departmentArt(name);
 return <Link className="card" href={href}><img className="card-img" src={art.src} alt={art.alt} width={640} height={400} loading="lazy"/>
  <div className="card-body"><h3>{name}</h3><span className="card-foot"><span>{nice(count)} {count===1?unit:unit+'s'}</span><ChevronRight size={16} className="chev"/></span></div></Link>;
}

export function CourseCard({c,web=false}:{c:CourseSummary;web?:boolean}){
 const art=departmentArt(c.department||'general');
 const href=web&&c.deptSlug?`/web-courses/${c.deptSlug}/${c.code}`:courseHref(c);
 return <Link className="card" href={href}><img className="card-img" src={art.src} alt={art.alt} width={640} height={400} loading="lazy"/>
  <div className="card-body">
   {web?<span className="tag tag-web"><Code2 size={12}/> Web course</span>:<span className="meta">{c.department||'Department not yet mapped'}</span>}
   <h3>{courseName(c)}</h3>
   <p>{[c.instructor,c.institution].filter(Boolean).join(' · ')||(c.title?'':'Title not yet verified')}</p>
   <span className="card-foot">{web?<span><Code2 size={14}/> {count(c.html,'page')}</span>:<span><Video size={14}/> {count(c.videos,'video')}</span>}
    {c.pdfs+c.texts>0&&<span><FileText size={14}/> {count(c.pdfs+c.texts,'document')}</span>}</span>
  </div></Link>;
}

export function Pager({page,pages,total,unit,href}:{page:number;pages:number;total:number;unit:string;href:(p:number)=>string}){
 if(total===0)return null;
 return <nav className="pager" aria-label="Pages"><span>{nice(total)} {unit} · page {page} of {nice(pages)}</span><div>
  <Link className="btn btn-ghost" href={href(page-1)} aria-disabled={page<=1} tabIndex={page<=1?-1:undefined}><ChevronLeft size={15}/> Previous</Link>
  <Link className="btn btn-ghost" href={href(page+1)} aria-disabled={page>=pages} tabIndex={page>=pages?-1:undefined}>Next <ChevronRight size={15}/></Link></div></nav>;
}

export function Empty({title,text}:{title:string;text:string}){return <div className="empty"><strong>{title}</strong>{text}</div>}

/** Build a URL with query parameters, dropping empty values. */
export function withQuery(path:string,params:Record<string,string|number|undefined>){
 const q=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==''&&!(k==='page'&&v===1))q.set(k,String(v));
 const s=q.toString();return s?path+'?'+s:path;
}
