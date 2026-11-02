import Link from 'next/link';
import {CourseCard,Empty,PageHead,Pager,withQuery} from '@/components/lms/ui';
import {departments,findCourses} from '@/lib/campus-catalog';
export const metadata={title:'All courses · MREM Digital Learning Library'};
type P={searchParams:Promise<{q?:string;dept?:string;kind?:string;page?:string}>};
export default async function Courses({searchParams}:P){
 const sp=await searchParams,kind=sp.kind==='video'||sp.kind==='web'?sp.kind:'';
 const [r,depts]=await Promise.all([findCourses({q:sp.q,dept:sp.dept,kind,page:Number(sp.page)||1}),departments()]);
 const href=(p:Record<string,string|number|undefined>)=>withQuery('/courses',{q:sp.q,dept:sp.dept,kind,...p});
 return <>
  <PageHead crumbs={[['Home','/'],['Courses']]} eyebrow="Course catalogue" title={sp.q?'Results for “'+sp.q+'”':'All courses'}
   lead={sp.q?'Matched on course title, course ID, professor, institute, semester, verified lecture titles and file names.':undefined}/>
  <form className="toolbar" action="/courses">
   <label className="field"><input name="q" defaultValue={sp.q||''} aria-label="Search courses" placeholder="Search by title, professor, course ID or lecture…"/></label>
   <select className="select" name="dept" defaultValue={sp.dept||''} aria-label="Department"><option value="">All departments</option>{depts.map(d=><option key={d.slug} value={d.slug}>{d.name}</option>)}</select>
   <select className="select" name="kind" defaultValue={kind} aria-label="Course type"><option value="">All course types</option><option value="video">Video courses</option><option value="web">Web courses</option></select>
   <button className="btn btn-primary" type="submit">Search</button>
   {(sp.q||sp.dept||kind)&&<Link className="btn btn-ghost" href="/courses">Clear</Link>}
  </form>
  {r.items.length?<div className="grid g-course">{r.items.map(c=><CourseCard key={c.code} c={c} web={kind==='web'}/>)}</div>:
   <Empty title="No courses found" text="Try a different search, or browse the departments."/>}
  <Pager page={r.page} pages={r.pages} total={r.total} unit="courses" href={p=>href({page:p})}/>
 </>;
}
