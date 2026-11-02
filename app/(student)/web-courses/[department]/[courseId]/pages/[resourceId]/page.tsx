import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,ChevronRight} from 'lucide-react';
import {Crumbs,courseName,nice} from '@/components/lms/ui';
import Viewer from '@/components/lms/Viewer';
import {course,lesson} from '@/lib/campus-catalog';

type P={params:Promise<{department:string;courseId:string;resourceId:string}>};
export async function generateMetadata({params}:P){const {courseId,resourceId}=await params;const l=await lesson(courseId,resourceId);return {title:(l?.resource.name||'Page')+' · Web courses'}}

/** One page of a web course at its own URL, rendered in the page (sanitized, sandboxed), with Previous / Next pages. */
export default async function WebPage({params}:P){
 const {department,courseId,resourceId}=await params;
 const [c,l]=await Promise.all([course(courseId),lesson(courseId,resourceId)]);
 if(!c||!l||!c.isWeb||c.deptSlug!==department||l.group!=='html')notFound();
 const base=`/web-courses/${department}/${c.code}`,title=l.resource.title||l.resource.name;
 return <>
  <div className="lesson-head"><div style={{minWidth:0}}>
   <Crumbs items={[['Home','/'],['Web courses','/web-courses'],[c.department,'/web-courses/'+department],[courseName(c),base],[title]]}/>
   <h1>{title}</h1><div className="meta">Page {nice(l.position)} of {nice(l.count)}</div>
  </div></div>
  <Viewer r={{id:l.resource.id,name:l.resource.name,ext:l.resource.ext,size:l.resource.size,title}}/>
  <div className="lesson-nav">
   <Link className="btn btn-ghost" href={base}><ArrowLeft size={16}/> Back to course</Link><span className="spacer"/>
   <Link className="btn btn-ghost" href={l.prev?`${base}/pages/${l.prev}`:base} aria-disabled={!l.prev}><ChevronLeft size={16}/> Previous page</Link>
   <Link className="btn btn-primary" href={l.next?`${base}/pages/${l.next}`:base} aria-disabled={!l.next}>Next page <ChevronRight size={16}/></Link>
  </div>
 </>;
}
