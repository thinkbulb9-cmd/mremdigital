import Link from 'next/link';
import {CourseCard,Empty,PageHead,Pager,withQuery} from '@/components/lms/ui';
import {departments,findCourses} from '@/lib/campus-catalog';
export const metadata={title:'Video courses · MREM Digital Learning Library'};
type P={searchParams:Promise<{q?:string;dept?:string;page?:string}>};
export default async function VideoCourses({searchParams}:P){
 const sp=await searchParams;
 const [r,depts]=await Promise.all([findCourses({q:sp.q,dept:sp.dept,kind:'video',page:Number(sp.page)||1}),departments(c=>c.videos>0)]);
 return <>
  <PageHead crumbs={[['Home','/'],['Video courses']]} eyebrow="Video courses" title="Video courses" lead="Courses with recorded lectures, from every semester in the archive."/>
  <form className="toolbar" action="/video-courses">
   <label className="field"><input name="q" defaultValue={sp.q||''} aria-label="Search video courses" placeholder="Search video courses…"/></label>
   <select className="select" name="dept" defaultValue={sp.dept||''} aria-label="Department"><option value="">All departments</option>{depts.map(d=><option key={d.slug} value={d.slug}>{d.name} ({d.courses})</option>)}</select>
   <button className="btn btn-primary" type="submit">Search</button>{(sp.q||sp.dept)&&<Link className="btn btn-ghost" href="/video-courses">Clear</Link>}
  </form>
  {r.items.length?<div className="grid g-course">{r.items.map(c=><CourseCard key={c.code} c={c}/>)}</div>:<Empty title="No video courses found" text="Try another search or department."/>}
  <Pager page={r.page} pages={r.pages} total={r.total} unit="video courses" href={p=>withQuery('/video-courses',{q:sp.q,dept:sp.dept,page:p})}/>
 </>;
}
