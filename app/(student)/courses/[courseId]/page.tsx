import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Building2,Code2,GraduationCap,Play,ShieldCheck} from 'lucide-react';
import {course,resources,GROUPS,type Group} from '@/lib/campus-catalog';
import {departmentArt} from '@/lib/department-art';
import {sizeOf} from '@/lib/format';
import {withQuery} from '@/components/lms/ui';
import {XpBreadcrumb,XpEmpty,XpPager,XpResourceLine,courseTitle,number} from '@/components/lms/LiveExperienceParts';
const LABEL:Record<Group,string>={video:'Video lessons',pdf:'PDF notes',html:'Web pages',document:'Documents',other:'Other files'};
type P={params:Promise<{courseId:string}>;searchParams:Promise<{offering?:string;group?:string;page?:string}>};
export async function generateMetadata({params}:P){const c=await course((await params).courseId);return {title:(c?courseTitle(c):'Course')+' · MREM Digital Learning Library'}}
export default async function CoursePage({params,searchParams}:P){
 const {courseId}=await params,sp=await searchParams,c=await course(courseId);if(!c)notFound();
 const off=c.offerings.find(o=>o.value===sp.offering)||c.offerings[0];if(!off)notFound();
 const groups=(Object.keys(GROUPS) as Group[]).filter(g=>off[g]>0);
 const group=groups.includes(sp.group as Group)?sp.group as Group:groups[0];
 const page=Math.max(1,Number(sp.page)||1),limit=60;
 const list=group?await resources(c.code,off.value,group,page,limit):[];
 const link=(p:Record<string,string|number|undefined>)=>withQuery('/courses/'+c.code,{offering:off.value!==c.offerings[0].value?off.value:undefined,group,...p});
 const art=departmentArt(c.department||'general'),start=list[0];
 return <div className="xp-container xp-inner xp-study">
  <XpBreadcrumb links={[{text:'Discover',href:'/'},{text:c.department||'Courses',href:c.deptSlug?'/departments/'+c.deptSlug:'/courses'},{text:courseTitle(c)}]}/>
  <div className="xp-study-heading"><div><span className="xp-eyebrow">{c.isWeb?'WEB COURSE':'ACADEMIC COURSE'} · {c.code}</span>
   <h1>{courseTitle(c)}</h1><p><GraduationCap size={16}/>{[c.instructor,c.institution].filter(Boolean).join(' · ')||c.department||'Academic library'} {c.titleVerified&&<span className="xp-verified"><ShieldCheck size={15}/> Verified title</span>}</p>
  </div></div>
  <div className="xp-study-columns">
   <div><div className="xp-course-preview" style={{backgroundImage:'url('+art.src+')'}}>
    <div><span>LEARNING WORKSPACE</span><h2>Designed to help you focus.</h2>
     <p>{number(c.files)} available resources · {c.offerings.length} academic {c.offerings.length===1?'offering':'offerings'}</p>
     {start&&<Link href={'/courses/'+c.code+'/lessons/'+start.id}><Play size={17} fill="currentColor"/> Start {group==='video'?'learning':'reading'}</Link>}
    </div>
   </div><div className="xp-about"><h2>About this course</h2><p>{courseTitle(c)} · Course ID {c.code}. Browse the original course materials using the verified information available in the MREM library.</p>
    {c.isWeb&&c.deptSlug&&<Link className="xp-web-link" href={'/web-courses/'+c.deptSlug+'/'+c.code}><Code2 size={16}/> Open Web Course <span>→</span></Link>}
   </div></div>
   <div className="xp-lesson-list"><div><span className="xp-eyebrow">COURSE CONTENT</span><h2>Choose a resource</h2><p>Actual indexed files · original names retained where titles are not verified</p></div>
    {c.offerings.length>1&&<div className="xp-offering-bar" aria-label="Academic offering">{c.offerings.map(o=><Link key={o.value} className={o.value===off.value?'active':''} href={withQuery('/courses/'+c.code,{offering:o.value===c.offerings[0].value?undefined:o.value})}>{o.label}</Link>)}</div>}
    <div className="xp-resource-filters" role="group" aria-label="Resource type">{groups.map(g=><Link key={g} className={g===group?'active':''} href={link({group:g,page:undefined})}>{LABEL[g]} <small>{number(off[g])}</small></Link>)}</div>
    {list.length?list.map((r,i)=><XpResourceLine key={r.id} code={c.code} id={r.id} index={(page-1)*limit+i+1} title={r.title||r.name} details={[r.title?r.name:'',r.module?'Module '+r.module:'',sizeOf(r.size)].filter(Boolean).join(' · ')}/>):<XpEmpty title="No resources available" description="Try another academic offering or resource type."/>}
    {group&&<XpPager page={page} pages={Math.max(1,Math.ceil(off[group]/limit))} total={off[group]} href={p=>link({page:p})}/>}
   </div>
  </div>
 </div>;
}
