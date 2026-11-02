import Link from 'next/link';
import {notFound} from 'next/navigation';
import {departments,findCourses} from '@/lib/campus-catalog';
import {departmentArt} from '@/lib/department-art';
import {XpBreadcrumb,XpCourseCard,XpEmpty,XpPager,XpSectionHeading} from '@/components/lms/LiveExperienceParts';
import {withQuery} from '@/components/lms/ui';
type P={params:Promise<{department:string}>;searchParams:Promise<{page?:string;kind?:string;q?:string}>};
export async function generateMetadata({params}:P){const {department}=await params;const d=(await departments()).find(x=>x.slug===department);return {title:(d?.name||'Department')+' · MREM Digital Learning Library'}}
export default async function Department({params,searchParams}:P){
 const {department}=await params,sp=await searchParams,d=(await departments()).find(x=>x.slug===department);if(!d)notFound();
 const kind=sp.kind==='video'||sp.kind==='web'?sp.kind:'';
 const data=await findCourses({dept:department,kind,q:sp.q,page:Number(sp.page)||1});
 const href=(p:number)=>withQuery('/departments/'+department,{q:sp.q,kind,page:p});
 const art=departmentArt(d.name);
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Departments',href:'/departments'},{text:d.name}]}/>
  <div className="xp-department-hero"><div><span className="xp-eyebrow">DEPARTMENT COLLECTION</span><h1>{d.name}</h1><p>{d.courses.toLocaleString('en-IN')} approved courses in this academic subject.</p></div><img src={art.src} alt={art.alt}/></div>
  <XpSectionHeading eyebrow="EXPLORE THIS COLLECTION" title="Available courses"/>
  <form className="xp-filter-toolbar" action={'/departments/'+department}><label><span className="sr-only">Search department courses</span><input name="q" defaultValue={sp.q||''} placeholder="Search within this department"/></label>
   <select name="kind" defaultValue={kind} aria-label="Course format"><option value="">All courses</option><option value="video">Video courses</option><option value="web">Web courses</option></select>
   <button type="submit">Search</button>{(sp.q||kind)&&<Link href={'/departments/'+department}>Clear</Link>}</form>
  {data.items.length?<div className="xp-courses-grid">{data.items.map(c=><XpCourseCard c={c} key={c.code} web={kind==='web'}/>)}</div>:<XpEmpty title="No courses found" description="Try another search or content type."/>}
  <XpPager page={data.page} pages={data.pages} total={data.total} href={href}/>
 </div>;
}
