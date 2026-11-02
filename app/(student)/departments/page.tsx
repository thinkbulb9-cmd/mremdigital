import {departments} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpDepartmentCard,XpEmpty,XpHeading} from '@/components/lms/LiveExperienceParts';
export const metadata={title:'Departments · MREM Digital Learning Library'};
export default async function Departments(){
 const ds=await departments();
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Departments'}]}/>
  <XpHeading eyebrow="ACADEMIC DEPARTMENTS" title="Find your field of interest." description="Every subject has a place. Choose a department to start exploring."/>
  {ds.length?<div className="xp-department-grid">{ds.map(d=><XpDepartmentCard d={d} key={d.slug}/>)}</div>:<XpEmpty title="No departments available" description="Departments will appear once approved courses are mapped to a discipline."/>}
 </div>;
}
