import Link from 'next/link';
import {departments,findCourses} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpCourseCard,XpEmpty,XpHeading,XpPager} from '@/components/lms/LiveExperienceParts';
import {withQuery} from '@/components/lms/ui';
export const metadata={title:'Video courses · MREM Digital Learning Library'};
type P={searchParams:Promise<{q?:string;dept?:string;page?:string}>};
export default async function VideoCourses({searchParams}:P){
 const sp=await searchParams;
 const [data,ds]=await Promise.all([findCourses({q:sp.q,dept:sp.dept,kind:'video',page:Number(sp.page)||1}),departments(c=>c.videos>0)]);
 const href=(p:number)=>withQuery('/video-courses',{q:sp.q,dept:sp.dept,page:p});
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Video Courses'}]}/>
  <XpHeading eyebrow="VIDEO LEARNING" title="Watch. Learn. Explore." description="Browse all available video courses, with original lessons and approved study materials."/>
  <form className="xp-filter-toolbar" action="/video-courses"><label><span className="sr-only">Search video courses</span><input name="q" defaultValue={sp.q||''} placeholder="Search video courses..."/></label>
   <select name="dept" defaultValue={sp.dept||''} aria-label="Department"><option value="">All departments</option>{ds.map(d=><option key={d.slug} value={d.slug}>{d.name}</option>)}</select>
   <button type="submit">Find courses</button>{(sp.q||sp.dept)&&<Link href="/video-courses">Clear</Link>}</form>
  {data.items.length?<div className="xp-courses-grid">{data.items.map(c=><XpCourseCard key={c.code} c={c}/>)}</div>:<XpEmpty title="No video courses found" description="Try another search or department."/>}
  <XpPager page={data.page} pages={data.pages} total={data.total} href={href}/>
 </div>;
}
