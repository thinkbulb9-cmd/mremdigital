import {departments} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpDepartmentCard,XpEmpty,XpHeading} from '@/components/lms/LiveExperienceParts';
export const metadata={title:'Web Courses · MREM Digital Learning Library'};
export default async function WebCourses(){
 const ds=await departments(c=>c.isWeb);
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Web Courses'}]}/>
  <XpHeading eyebrow="WEB-BASED LEARNING" title="Explore interactive reading." description="Web Courses are organized by department, not by drive letter or archive folder."/>
  {ds.length?<div className="xp-department-grid">{ds.map(d=><XpDepartmentCard key={d.slug} d={d} href={'/web-courses/'+d.slug}/>)}</div>:<XpEmpty title="No Web Courses published yet" description="Web Courses appear when verified course pages are indexed and approved."/>}
 </div>;
}
