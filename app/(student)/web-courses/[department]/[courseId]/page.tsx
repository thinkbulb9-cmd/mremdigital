import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Building2,GraduationCap,ShieldCheck} from 'lucide-react';
import Viewer from '@/components/lms/Viewer';
import {course,resources,webEntry,lesson} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpEmpty,XpPager,XpResourceLine,courseTitle,number} from '@/components/lms/LiveExperienceParts';
import {withQuery} from '@/components/lms/ui';
type P={params:Promise<{department:string;courseId:string}>;searchParams:Promise<{offering?:string;page?:string}>};
export async function generateMetadata({params}:P){const c=await course((await params).courseId);return {title:(c?courseTitle(c):'Web Course')+' · MREM Digital Learning Library'}}
export default async function WebCourse({params,searchParams}:P){
 const {department,courseId}=await params,sp=await searchParams,c=await course(courseId);
 if(!c||!c.isWeb||c.deptSlug!==department)notFound();
 const offs=c.offerings.filter(o=>o.html>0),off=offs.find(o=>o.value===sp.offering)||offs[0];if(!off)notFound();
 const entry=await webEntry(c.code,off.value),start=entry?await lesson(c.code,entry):null;
 const page=Math.max(1,Number(sp.page)||1),list=await resources(c.code,off.value,'html',page,60),base='/web-courses/'+department+'/'+c.code;
 return <div className="xp-container xp-inner xp-study"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Web Courses',href:'/web-courses'},{text:c.department,href:'/web-courses/'+department},{text:courseTitle(c)}]}/>
  <div className="xp-study-heading"><div><span className="xp-eyebrow">{c.titleVerified?'VERIFIED WEB COURSE':'WEB COURSE'} · {c.code}</span><h1>{courseTitle(c)}</h1>
   <p><GraduationCap size={16}/>{[c.instructor,c.institution].filter(Boolean).join(' · ')||c.department}{c.titleVerified&&<span className="xp-verified"><ShieldCheck size={15}/> Verified course title</span>}</p>
  </div></div>
  {offs.length>1&&<div className="xp-offering-bar" aria-label="Academic offering">{offs.map(o=><Link key={o.value} className={o===off?'active':''} href={withQuery(base,{offering:o.value===offs[0].value?undefined:o.value})}>{o.label} · {number(o.html)} pages</Link>)}</div>}
  {start?<div className="xp-viewer xp-live-viewer"><Viewer r={{id:start.resource.id,name:start.resource.name,ext:start.resource.ext,size:start.resource.size,title:start.resource.title||start.resource.name}}/></div>:
   <XpEmpty title="No starting Web Course page" description="The opening HTML resource is currently unavailable."/>}
  <div className="xp-viewer-description"><div><span className="xp-eyebrow">WEB COURSE PAGES</span><h2>Continue reading this course.</h2><p>{number(off.html)} available HTML pages. Pages open inside the LMS with a dedicated URL.</p></div></div>
  <div className="xp-lesson-list xp-web-page-list">{list.map((r,i)=><XpResourceLine key={r.id} code={c.code} id={r.id} href={base+'/pages/'+r.id} title={r.title||r.name} index={(page-1)*60+i+1}/>)}</div>
  <XpPager page={page} pages={Math.max(1,Math.ceil(off.html/60))} total={off.html} href={p=>withQuery(base,{offering:sp.offering,page:p})}/>
 </div>;
}
