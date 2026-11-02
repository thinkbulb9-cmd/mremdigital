import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ChevronLeft,ChevronRight,GraduationCap} from 'lucide-react';
import {course,lesson} from '@/lib/campus-catalog';
import Viewer from '@/components/lms/Viewer';
import {XpBreadcrumb,courseTitle,number} from '@/components/lms/LiveExperienceParts';
type P={params:Promise<{department:string;courseId:string;resourceId:string}>};
export async function generateMetadata({params}:P){const {courseId,resourceId}=await params,l=await lesson(courseId,resourceId);return {title:(l?.resource.title||l?.resource.name||'HTML page')+' · Web Courses'}}
export default async function WebPage({params}:P){
 const {department,courseId,resourceId}=await params;
 const [c,l]=await Promise.all([course(courseId),lesson(courseId,resourceId)]);
 if(!c||!l||!c.isWeb||c.deptSlug!==department||l.group!=='html')notFound();
 const base='/web-courses/'+department+'/'+c.code,title=l.resource.title||l.resource.name;
 const [prev,next]=await Promise.all([l.prev?lesson(c.code,l.prev):Promise.resolve(null),l.next?lesson(c.code,l.next):Promise.resolve(null)]);
 return <div className="xp-container xp-inner xp-study">
  <XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Web Courses',href:'/web-courses'},{text:c.department,href:'/web-courses/'+department},{text:courseTitle(c),href:base},{text:title}]}/>
  <div className="xp-study-heading"><div><span className="xp-eyebrow">WEB COURSE PAGE · {number(l.position)} OF {number(l.count)}</span><h1>{title}</h1>
   <p><GraduationCap size={16}/>{courseTitle(c)}</p></div></div>
  <div className="xp-viewer xp-live-viewer"><Viewer r={{id:l.resource.id,name:l.resource.name,ext:l.resource.ext,size:l.resource.size,title}}/></div>
  <div className="xp-viewer-description"><div><span className="xp-eyebrow">RENDERED ACADEMIC HTML</span><h2>{title}</h2><p>Original indexed page. Scripts disabled; approved relative academic links only.</p></div><Link href={base}>All course pages</Link></div>
  <div className="xp-lesson-nav"><Link href={l.prev?base+'/pages/'+l.prev:base}><ChevronLeft size={17}/><span className="xp-adjacent-label"><small>{l.prev?'Previous page':'Back to course'}</small><strong>{prev?.resource.title||prev?.resource.name||courseTitle(c)}</strong></span></Link>
   <Link href={l.next?base+'/pages/'+l.next:base}><span className="xp-adjacent-label"><small>{l.next?'Next page':'Back to course'}</small><strong>{next?.resource.title||next?.resource.name||courseTitle(c)}</strong></span><ChevronRight size={17}/></Link></div>
 </div>;
}
