import Link from 'next/link';
import {studyMaterials} from '@/lib/campus-catalog';
import {sizeOf} from '@/lib/format';
import {withQuery} from '@/components/lms/ui';
import {XpBreadcrumb,XpEmpty,XpHeading,XpPager,XpResourceLine,courseTitle} from '@/components/lms/LiveExperienceParts';
type P={searchParams:Promise<{q?:string;type?:string;page?:string}>};
export const metadata={title:'Study Materials · MREM Digital Learning Library'};
export default async function StudyMaterials({searchParams}:P){
 const sp=await searchParams,type=sp.type==='pdf'||sp.type==='document'?sp.type:'';
 const data=await studyMaterials({q:sp.q,type,page:Number(sp.page)||1});
 const href=(p:number)=>withQuery('/study-materials',{q:sp.q,type,page:p});
 return <div className="xp-container xp-inner"><XpBreadcrumb links={[{text:'Discover',href:'/'},{text:'Study Materials'}]}/>
  <XpHeading eyebrow="STUDY MATERIALS" title="Read, revise and explore." description="Original, approved PDFs and documents from the college course catalogue."/>
  <form className="xp-filter-toolbar" action="/study-materials"><label><span className="sr-only">Search study materials</span><input name="q" defaultValue={sp.q||''} placeholder="Search by original file name"/></label>
   <select name="type" defaultValue={type} aria-label="Resource type"><option value="">All materials</option><option value="pdf">PDF</option><option value="document">Text & documents</option></select>
   <button type="submit">Search</button>{(sp.q||type)&&<Link href="/study-materials">Clear</Link>}</form>
  {data.items.length?<div className="xp-lesson-list xp-material-list">{data.items.map((r,i)=><XpResourceLine key={r.id} code={r.code} id={r.id} index={r.ext.replace('.','').toUpperCase().slice(0,4)} title={r.name} details={[r.course?courseTitle(r.course):'Course ID '+r.code,r.course?.department,sizeOf(r.size)].filter(Boolean).join(' · ')}/>)}</div>:
   <XpEmpty title="No matching study materials" description="Try another resource type or filename."/>}
  <XpPager page={data.page} pages={data.pages} total={data.total} href={href}/>
 </div>;
}
