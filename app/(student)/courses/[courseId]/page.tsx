import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Building2,Code2,GraduationCap,Play,ShieldCheck} from 'lucide-react';
import {Crumbs,Empty,Pager,courseName,nice,withQuery} from '@/components/lms/ui';
import {sizeOf} from '@/lib/format';
import {course,resources,GROUPS,type Group} from '@/lib/campus-catalog';
import {departmentArt} from '@/lib/department-art';

const LABEL:Record<Group,string>={video:'Videos',pdf:'PDFs',html:'Web pages',document:'Documents',other:'Other files'};
type P={params:Promise<{courseId:string}>;searchParams:Promise<{offering?:string;group?:string;page?:string}>};
export async function generateMetadata({params}:P){const c=await course((await params).courseId);return {title:(c?courseName(c):'Course')+' · MREM Digital Learning Library'}}

/** Course overview: offerings (semesters on any drive), resource groups as tabs, and the lesson list. No sidebar. */
export default async function CoursePage({params,searchParams}:P){
 const {courseId}=await params,sp=await searchParams;
 const c=await course(courseId);
 if(!c)notFound();
 const off=c.offerings.find(o=>o.value===sp.offering)||c.offerings[0];
 if(!off)notFound();
 const groups=(Object.keys(GROUPS) as Group[]).filter(g=>off[g]>0);
 const group=groups.includes(sp.group as Group)?sp.group as Group:groups[0];
 const page=Number(sp.page)||1,limit=60;
 const list=group?await resources(c.code,off.value,group,page,limit):[];
 const art=departmentArt(c.department||'general');
 const href=(p:Record<string,string|number|undefined>)=>withQuery('/courses/'+c.code,{offering:off.value===c.offerings[0].value?undefined:off.value,group,...p});
 return <>
  <section className="course-hero">
   <div>
    <Crumbs items={[['Home','/'],...(c.department?[[c.department,'/departments/'+c.deptSlug] as [string,string]]:[['Courses','/courses'] as [string,string]]),[courseName(c)]]}/>
    <h1 className="h-page">{courseName(c)}</h1>
    <div className="facts">
     {c.instructor&&<span><GraduationCap size={16}/> {c.instructor}</span>}{c.institution&&<span><Building2 size={16}/> {c.institution}</span>}
     <span>Course ID {c.code}</span>{c.titleVerified&&<span className="verified"><ShieldCheck size={16}/> Verified title</span>}
    </div>
    {list[0]&&<div className="lesson-nav"><Link className="btn btn-primary" href={`/courses/${c.code}/lessons/${list[0].id}`}><Play size={16}/> Start with {group==='video'?'the first lecture':'the first item'}</Link>
     {c.isWeb&&c.deptSlug&&<Link className="btn btn-ghost" href={`/web-courses/${c.deptSlug}/${c.code}`}><Code2 size={16}/> Open as web course</Link>}</div>}
   </div>
   <img src={art.src} alt={art.alt} width={640} height={400}/>
  </section>
  {c.offerings.length>1&&<div className="chips" role="group" aria-label="Academic offering" style={{marginBottom:16}}>{c.offerings.map(o=>
   <Link key={o.value||'web'} className="chip" href={withQuery('/courses/'+c.code,{offering:o.value===c.offerings[0].value?undefined:o.value})} aria-current={o===off?'true':undefined}>
    {o.label}<small>{nice((Object.keys(GROUPS) as Group[]).reduce((a,g)=>a+o[g],0))}</small></Link>)}</div>}
  {groups.length?<>
   <nav className="tabs" aria-label="Resource type">{groups.map(g=><Link key={g} href={href({group:g,page:undefined})} aria-current={g===group?'page':undefined}>{LABEL[g]}<small>{nice(off[g])}</small></Link>)}</nav>
   <div className="list">{list.map((r,i)=><Link key={r.id} className="row" href={`/courses/${c.code}/lessons/${r.id}`}>
    <span className="row-n">{(page-1)*limit+i+1}</span>
    <span className="row-t"><strong>{r.title||r.name}</strong><small>{[r.title?r.name:'',r.module?'Module '+r.module:'',sizeOf(r.size)].filter(Boolean).join(' · ')}</small></span>
   </Link>)}</div>
   <Pager page={page} pages={Math.max(1,Math.ceil(off[group]/limit))} total={off[group]} unit={LABEL[group].toLowerCase()} href={p=>href({page:p})}/>
   <p className="note">Lecture titles appear only when they are tied to the exact file by the course catalogue or the official NPTEL lecture list; other items keep their original file names.</p>
  </>:<Empty title="No learning resources yet" text="This course has no files available to students in this offering."/>}
 </>;
}
