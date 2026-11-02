import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CourseCard,Empty,PageHead,Pager,withQuery} from '@/components/lms/ui';
import {departments,findCourses} from '@/lib/campus-catalog';
type P={params:Promise<{department:string}>;searchParams:Promise<{page?:string;kind?:string;q?:string}>};
export async function generateMetadata({params}:P){const {department}=await params;const d=(await departments()).find(x=>x.slug===department);return {title:(d?.name||'Department')+' · MREM Digital Learning Library'}}
export default async function Department({params,searchParams}:P){
 const {department}=await params,sp=await searchParams;
 const d=(await departments()).find(x=>x.slug===department);
 if(!d)notFound();
 const kind=sp.kind==='video'||sp.kind==='web'?sp.kind:'';
 const r=await findCourses({dept:department,kind,q:sp.q,page:Number(sp.page)||1});
 const href=(p:Record<string,string|number|undefined>)=>withQuery('/departments/'+department,{kind,q:sp.q,...p});
 return <>
  <PageHead crumbs={[['Home','/'],['Departments','/departments'],[d.name]]} eyebrow="Department" title={d.name}/>
  <div className="toolbar">
   <form className="field" action={'/departments/'+department}><input name="q" defaultValue={sp.q||''} aria-label="Search this department" placeholder="Search courses in this department…"/>{kind&&<input type="hidden" name="kind" value={kind}/>}</form>
   <div className="chips" role="group" aria-label="Course type">{[['','All courses'],['video','Video courses'],['web','Web courses']].map(([k,l])=>
    <Link key={k} className="chip" href={href({kind:k,page:undefined})} aria-current={kind===k?'true':undefined}>{l}</Link>)}</div>
  </div>
  {r.items.length?<div className="grid g-course">{r.items.map(c=><CourseCard key={c.code} c={c} web={kind==='web'}/>)}</div>:
   <Empty title="No courses found" text="Try another search or course type."/>}
  <Pager page={r.page} pages={r.pages} total={r.total} unit="courses" href={p=>href({page:p})}/>
 </>;
}
