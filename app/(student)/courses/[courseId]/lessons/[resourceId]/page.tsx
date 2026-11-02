import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,ChevronRight,GraduationCap} from 'lucide-react';
import Viewer,{DownloadLink} from '@/components/lms/Viewer';
import {course,lesson,offeringLabel,resources} from '@/lib/campus-catalog';
import {XpBreadcrumb,XpResourceLine,courseTitle,number} from '@/components/lms/LiveExperienceParts';
type P={params:Promise<{courseId:string;resourceId:string}>};
export async function generateMetadata({params}:P){const {courseId,resourceId}=await params,l=await lesson(courseId,resourceId);return {title:(l?.resource.title||l?.resource.name||'Lesson')+' · MREM Digital Learning Library'}}
export default async function Lesson({params}:P){
 const {courseId,resourceId}=await params;
 const [c,l]=await Promise.all([course(courseId),lesson(courseId,resourceId)]);if(!c||!l)notFound();
 const r=l.resource,title=r.title||r.name;
 const base='/courses/'+c.code;
 const back=base+(l.offering&&l.offering!==c.offerings[0]?.value?'?offering='+encodeURIComponent(l.offering):'');
 const [prev,next]=await Promise.all([l.prev?lesson(c.code,l.prev):Promise.resolve(null),l.next?lesson(c.code,l.next):Promise.resolve(null)]);
 const prevName=prev?.resource.title||prev?.resource.name||'Back to course';
 const nextName=next?.resource.title||next?.resource.name||'Back to course';
 const related=l.group==='video'?[...await resources(c.code,l.offering,'pdf',1,5),...await resources(c.code,l.offering,'document',1,5)].slice(0,6):[];
 return <div className="xp-container xp-inner xp-study">
  <XpBreadcrumb links={[{text:'Discover',href:'/'},{text:c.department||'Courses',href:c.deptSlug?'/departments/'+c.deptSlug:'/courses'},{text:courseTitle(c),href:back},{text:title}]}/>
  <div className="xp-study-heading"><div><span className="xp-eyebrow">LEARNING WORKSPACE · {offeringLabel(l.offering||null)}</span><h1>{title}</h1>
   <p><GraduationCap size={16}/>{courseTitle(c)} · Lesson {number(l.position)} of {number(l.count)}</p></div>
   <DownloadLink r={{id:r.id,name:r.name,ext:r.ext,size:r.size,title}}/>
  </div>
  <div className="xp-viewer xp-live-viewer"><Viewer r={{id:r.id,name:r.name,ext:r.ext,size:r.size,title}}/></div>
  <div className="xp-viewer-description"><div><span className="xp-eyebrow">CURRENT LEARNING RESOURCE</span><h2>{title}</h2>
   <p>{[r.title?r.name:'',r.titleSource||'',offeringLabel(l.offering||null)].filter(Boolean).join(' · ')}</p>
  </div><Link href={back}>All lessons <ArrowLeft size={16}/></Link></div>
  <div className="xp-lesson-nav">
   <Link href={l.prev?base+'/lessons/'+l.prev:back}><ChevronLeft size={17}/><span className="xp-adjacent-label"><small>{l.prev?'Previous lesson':'Back to course'}</small><strong>{prevName}</strong></span></Link>
   <Link href={l.next?base+'/lessons/'+l.next:back}><span className="xp-adjacent-label"><small>{l.next?'Next lesson':'Back to course'}</small><strong>{nextName}</strong></span><ChevronRight size={17}/></Link>
  </div>
  {related.length>0&&<section className="xp-lessons-shortcut"><span className="xp-eyebrow">RELATED STUDY MATERIALS</span>
   <div className="xp-related-resources">{related.map(x=><XpResourceLine key={x.id} id={x.id} code={c.code} title={x.title||x.name} index={x.ext.slice(1).toUpperCase().slice(0,4)}/>)}</div>
  </section>}
 </div>;
}
