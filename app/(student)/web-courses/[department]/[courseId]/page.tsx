import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Building2,GraduationCap,ShieldCheck} from 'lucide-react';
import {Crumbs,Empty,Pager,courseName,nice,withQuery} from '@/components/lms/ui';
import Viewer from '@/components/lms/Viewer';
import {course,resources,webEntry,lesson} from '@/lib/campus-catalog';

type P={params:Promise<{department:string;courseId:string}>;searchParams:Promise<{offering?:string;page?:string}>};
export async function generateMetadata({params}:P){const c=await course((await params).courseId);return {title:(c?courseName(c):'Web course')+' · Web courses'}}

/** A web course opens on its start page, rendered safely in the page; its other pages are listed below with their own URLs. */
export default async function WebCourse({params,searchParams}:P){
 const {department,courseId}=await params,sp=await searchParams;
 const c=await course(courseId);
 if(!c||!c.isWeb||c.deptSlug!==department)notFound();
 const offs=c.offerings.filter(o=>o.html>0),off=offs.find(o=>o.value===sp.offering)||offs[0];
 if(!off)notFound();
 const entry=await webEntry(c.code,off.value),start=entry?await lesson(c.code,entry):null;
 const page=Number(sp.page)||1,limit=60,pages=await resources(c.code,off.value,'html',page,limit);
 const base=`/web-courses/${department}/${c.code}`;
 return <>
  <div className="lesson-head"><div style={{minWidth:0}}>
   <Crumbs items={[['Home','/'],['Web courses','/web-courses'],[c.department,'/web-courses/'+department],[courseName(c)]]}/>
   <span className="tag tag-web">Web course</span>
   <h1>{courseName(c)}</h1>
   <div className="facts">{c.instructor&&<span><GraduationCap size={16}/> {c.instructor}</span>}{c.institution&&<span><Building2 size={16}/> {c.institution}</span>}
    <span>Course ID {c.code}</span>{c.titleVerified&&<span className="verified"><ShieldCheck size={16}/> Verified title</span>}</div>
  </div></div>
  {offs.length>1&&<div className="chips" role="group" aria-label="Academic offering" style={{marginBottom:16}}>{offs.map(o=>
   <Link key={o.value||'web'} className="chip" href={withQuery(base,{offering:o.value===offs[0].value?undefined:o.value})} aria-current={o===off?'true':undefined}>{o.label}<small>{nice(o.html)}</small></Link>)}</div>}
  {start?<Viewer r={{id:start.resource.id,name:start.resource.name,ext:start.resource.ext,size:start.resource.size,title:start.resource.title||start.resource.name}}/>:
   <Empty title="No start page found" text="This web course has no page available to students."/>}
  <section className="sec"><div className="sec-head"><div><span className="eyebrow">Course pages</span><h2 className="h-sec">All pages in this course</h2></div></div>
   <div className="list">{pages.map((r,i)=><Link key={r.id} className="row" href={`${base}/pages/${r.id}`} aria-current={r.id===entry?'true':undefined}>
    <span className="row-n">{(page-1)*limit+i+1}</span><span className="row-t"><strong>{r.title||r.name}</strong></span></Link>)}</div>
   <Pager page={page} pages={Math.max(1,Math.ceil(off.html/limit))} total={off.html} unit="pages" href={p=>withQuery(base,{offering:sp.offering,page:p})}/>
  </section>
 </>;
}
