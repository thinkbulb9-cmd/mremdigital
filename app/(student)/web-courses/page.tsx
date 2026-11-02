import {DeptCard,Empty,PageHead} from '@/components/lms/ui';
import {departments} from '@/lib/campus-catalog';
export const metadata={title:'Web courses · MREM Digital Learning Library'};
/** Web Courses: NPTEL web courses (pages, not videos), grouped by department. */
export default async function WebCourses(){
 const list=await departments(c=>c.isWeb);
 return <>
  <PageHead crumbs={[['Home','/'],['Web courses']]} eyebrow="Web courses" title="Web courses" lead="NPTEL web courses are read page by page. Choose a department to see its web courses."/>
  {list.length?<div className="grid g-dept">{list.map(d=><DeptCard key={d.slug} name={d.name} count={d.courses} unit="web course" href={'/web-courses/'+d.slug}/>)}</div>:
   <Empty title="No web courses yet" text="Web courses appear once their course pages are indexed and mapped."/>}
 </>;
}
