import {DeptCard,Empty,PageHead} from '@/components/lms/ui';
import {departments} from '@/lib/campus-catalog';
export const metadata={title:'Departments · MREM Digital Learning Library'};
export default async function Departments(){
 const list=await departments();
 return <>
  <PageHead crumbs={[['Home','/'],['Departments']]} eyebrow="Departments" title="Browse by department" lead="Every course belongs to its NPTEL discipline. Course counts include only material available to students."/>
  {list.length?<div className="grid g-dept">{list.map(d=><DeptCard key={d.slug} name={d.name} count={d.courses} href={'/departments/'+d.slug}/>)}</div>:
   <Empty title="No departments yet" text="Departments appear once courses are mapped to a discipline."/>}
 </>;
}
