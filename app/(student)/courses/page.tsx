import Link from 'next/link';
import {findCourses,departments} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpCourseCard,XpEmpty,XpHeading,XpPager} from '@/components/lms/LiveExperienceParts';
import {withQuery} from '@/components/lms/ui';
export const metadata={title:'All Courses · MREM Digital Learning Library'};
type P={searchParams:Promise<{q?:string;dept?:string;kind?:string;page?:string}>};
export default async function Courses({searchParams}:P){
 const sp=await searchParams,kind=sp.kind==='video'||sp.kind==='web'?sp.kind:'';
 const [data,ds]=await Promise.all([findCourses({q:sp.q,dept:sp.dept,kind,page:Number(sp.page)||1}),departments()]);
 const href=(p:number)=>withQuery('/courses',{q:sp.q,dept:sp.dept,kind,page:p});
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Courses'}]}/>
  <XpHeading eyebrow="ALL COURSES" title={sp.q?'Results for “'+sp.q+'”':'Your next learning adventure.'} description="Explore the real approved catalogue, organized by academic subjects instead of folders."/>
  <form className="xp-filter-toolbar" action="/courses">
   <label><span className="sr-only">Search course titles</span><input name="q" defaultValue={sp.q||''} placeholder="Course title, faculty or subject ID"/></label>
   <select name="dept" defaultValue={sp.dept||''} aria-label="Filter by department"><option value="">All departments</option>{ds.map(d=><option key={d.slug} value={d.slug}>{d.name}</option>)}</select>
   <select name="kind" defaultValue={kind} aria-label="Filter by content"><option value="">All formats</option><option value="video">Video</option><option value="web">Web</option></select>
   <button type="submit">Find courses</button>{(sp.q||sp.dept||kind)&&<Link href="/courses">Clear</Link>}
  </form>
  {data.items.length?<div className="xp-courses-grid">{data.items.map(c=><XpCourseCard key={c.code} c={c} web={kind==='web'}/>)}</div>:<XpEmpty title="No matching courses" description="Try changing the search, department or format."/>}
  <XpPager page={data.page} pages={data.pages} total={data.total} href={href}/>
 </div>;
}
