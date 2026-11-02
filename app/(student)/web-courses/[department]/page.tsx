import Link from 'next/link';
import {notFound} from 'next/navigation';
import {departments,findCourses} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpCourseCard,XpEmpty,XpHeading,XpPager} from '@/components/lms/LiveExperienceParts';
import {withQuery} from '@/components/lms/ui';
type P={params:Promise<{department:string}>;searchParams:Promise<{page?:string;q?:string}>};
export async function generateMetadata({params}:P){const d=(await departments(c=>c.isWeb)).find(x=>x.slug===(await params).department);return {title:(d?.name||'Department')+' · Web Courses'}}
export default async function WebDepartment({params,searchParams}:P){
 const {department}=await params,sp=await searchParams;
 const d=(await departments(c=>c.isWeb)).find(x=>x.slug===department);if(!d)notFound();
 const data=await findCourses({dept:department,kind:'web',q:sp.q,page:Number(sp.page)||1});
 const href=(p:number)=>withQuery('/web-courses/'+department,{q:sp.q,page:p});
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Web Courses',href:'/web-courses'},{text:d.name}]}/>
  <XpHeading eyebrow="WEB COURSE COLLECTION" title={d.name} description="Open original HTML academic content inside the library's safe in-page viewer."/>
  <form className="xp-filter-toolbar" action={'/web-courses/'+department}><label><span className="sr-only">Search Web Courses</span><input name="q" defaultValue={sp.q||''} placeholder="Search Web Courses"/></label><button type="submit">Search</button>{sp.q&&<Link href={'/web-courses/'+department}>Clear</Link>}</form>
  {data.items.length?<div className="xp-courses-grid">{data.items.map(c=><XpCourseCard c={c} key={c.code} web/>)}</div>:<XpEmpty title="No matching Web Courses" description="Try another search."/>}
  <XpPager page={data.page} pages={data.pages} total={data.total} href={href}/>
 </div>;
}
