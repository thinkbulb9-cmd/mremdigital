import {notFound} from 'next/navigation';
import {CourseCard,Empty,PageHead,Pager,withQuery} from '@/components/lms/ui';
import {departments,findCourses} from '@/lib/campus-catalog';
type P={params:Promise<{department:string}>;searchParams:Promise<{page?:string;q?:string}>};
export async function generateMetadata({params}:P){const {department}=await params;const d=(await departments(c=>c.isWeb)).find(x=>x.slug===department);return {title:'Web courses · '+(d?.name||'Department')}}
export default async function WebDepartment({params,searchParams}:P){
 const {department}=await params,sp=await searchParams;
 const d=(await departments(c=>c.isWeb)).find(x=>x.slug===department);
 if(!d)notFound();
 const r=await findCourses({dept:department,kind:'web',q:sp.q,page:Number(sp.page)||1});
 return <>
  <PageHead crumbs={[['Home','/'],['Web courses','/web-courses'],[d.name]]} eyebrow="Web courses" title={d.name}/>
  <form className="toolbar" action={'/web-courses/'+department}><label className="field"><input name="q" defaultValue={sp.q||''} aria-label="Search web courses" placeholder="Search web courses in this department…"/></label><button className="btn btn-primary">Search</button></form>
  {r.items.length?<div className="grid g-course">{r.items.map(c=><CourseCard key={c.code} c={c} web/>)}</div>:<Empty title="No web courses found" text="Try another search."/>}
  <Pager page={r.page} pages={r.pages} total={r.total} unit="web courses" href={p=>withQuery('/web-courses/'+department,{q:sp.q,page:p})}/>
 </>;
}
