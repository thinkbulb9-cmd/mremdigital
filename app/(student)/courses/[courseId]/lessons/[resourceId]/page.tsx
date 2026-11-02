import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,ChevronRight} from 'lucide-react';
import {Crumbs,courseName,nice} from '@/components/lms/ui';
import Viewer,{DownloadLink} from '@/components/lms/Viewer';
import {course,lesson,offeringLabel,resources} from '@/lib/campus-catalog';

type P={params:Promise<{courseId:string;resourceId:string}>};
export async function generateMetadata({params}:P){const {courseId,resourceId}=await params;const l=await lesson(courseId,resourceId);
 return {title:(l?l.resource.title||l.resource.name:'Lesson')+' · MREM Digital Learning Library'}}

/** One learning resource at its own URL: viewer across the full width, Previous / Next within the course. */
export default async function Lesson({params}:P){
 const {courseId,resourceId}=await params;
 const [c,l]=await Promise.all([course(courseId),lesson(courseId,resourceId)]);
 if(!c||!l)notFound();
 const r=l.resource,title=r.title||r.name;
 const back='/courses/'+c.code+(l.offering&&l.offering!==c.offerings[0]?.value?'?offering='+encodeURIComponent(l.offering):'');
 const related=l.group==='video'?[...await resources(c.code,l.offering,'pdf',1,6),...await resources(c.code,l.offering,'document',1,6)].slice(0,6):[];
 return <>
  <div className="lesson-head"><div style={{minWidth:0}}>
   <Crumbs items={[['Home','/'],...(c.department?[[c.department,'/departments/'+c.deptSlug] as [string,string]]:[]),[courseName(c),back],[title]]}/>
   <h1>{title}</h1>
   <div className="meta">{[r.title?r.name:'',offeringLabel(l.offering||null),nice(l.position)+' of '+nice(l.count),r.titleSource?'Title: '+r.titleSource:''].filter(Boolean).join(' · ')}</div>
  </div></div>
  <Viewer r={{id:r.id,name:r.name,ext:r.ext,size:r.size,title}}/>
  <div className="lesson-nav">
   <Link className="btn btn-ghost" href={back}><ArrowLeft size={16}/> Back to course</Link>
   <DownloadLink r={{id:r.id,name:r.name,ext:r.ext,size:r.size,title}}/>
   <span className="spacer"/>
   <Link className="btn btn-ghost" href={l.prev?`/courses/${c.code}/lessons/${l.prev}`:back} aria-disabled={!l.prev}><ChevronLeft size={16}/> Previous</Link>
   <Link className="btn btn-primary" href={l.next?`/courses/${c.code}/lessons/${l.next}`:back} aria-disabled={!l.next}>Next <ChevronRight size={16}/></Link>
  </div>
  {related.length>0&&<section className="sec"><div className="sec-head"><div><span className="eyebrow">Study materials</span><h2 className="h-sec">From this course</h2></div></div>
   <div className="list">{related.map(x=><Link key={x.id} className="row" href={`/courses/${c.code}/lessons/${x.id}`}><span className="row-n">{x.ext.replace('.','').toUpperCase().slice(0,4)}</span>
    <span className="row-t"><strong>{x.title||x.name}</strong></span></Link>)}</div></section>}
 </>;
}
