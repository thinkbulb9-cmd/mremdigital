import Link from 'next/link';
import {Empty,PageHead,Pager,courseName,withQuery} from '@/components/lms/ui';
import {sizeOf} from '@/lib/format';
import {studyMaterials} from '@/lib/campus-catalog';
export const metadata={title:'Study materials · MREM Digital Learning Library'};
type P={searchParams:Promise<{q?:string;type?:string;page?:string}>};
/** PDFs and documents from course folders, each opening at its lesson URL inside its course. */
export default async function StudyMaterials({searchParams}:P){
 const sp=await searchParams,type=sp.type==='pdf'||sp.type==='document'?sp.type:'';
 const r=await studyMaterials({q:sp.q,type,page:Number(sp.page)||1});
 const href=(p:Record<string,string|number|undefined>)=>withQuery('/study-materials',{q:sp.q,type,...p});
 return <>
  <PageHead crumbs={[['Home','/'],['Study materials']]} eyebrow="Study materials" title="Study materials" lead="PDF notes, slides and documents from the course folders. Each opens inside its course."/>
  <div className="toolbar">
   <form className="field" action="/study-materials"><input name="q" defaultValue={sp.q||''} aria-label="Search study materials" placeholder="Search by file name…"/>{type&&<input type="hidden" name="type" value={type}/>}</form>
   <div className="chips" role="group" aria-label="Material type">{[['','All'],['pdf','PDF'],['document','Text and documents']].map(([k,l])=>
    <Link key={k} className="chip" href={href({type:k,page:undefined})} aria-current={type===k?'true':undefined}>{l}</Link>)}</div>
  </div>
  {r.items.length?<div className="list">{r.items.map(x=><Link key={x.id} className="row" href={`/courses/${x.code}/lessons/${x.id}`}>
   <span className="row-n">{String(x.ext).replace('.','').toUpperCase().slice(0,4)}</span>
   <span className="row-t"><strong>{x.name}</strong><small>{[x.course?courseName(x.course):'Course ID '+x.code,x.course?.department,sizeOf(x.size)].filter(Boolean).join(' · ')}</small></span></Link>)}</div>:
   <Empty title="No study materials found" text="Try another search or type."/>}
  <Pager page={r.page} pages={r.pages} total={r.total} unit="files" href={p=>href({page:p})}/>
 </>;
}
