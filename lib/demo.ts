/** Synthetic preview catalogue. These items are NOT taken from MREM's 90 TB disks. */
export type DemoEntry = {id:string;name:string;ext:string;kind:string;department:string;course:string;size_bytes:string;modified_at:string;source_id:string;content:string};
export const previewFiles:DemoEntry[]=[
  {id:'1',name:'Lecture 01 - Introduction.txt',ext:'.txt',kind:'Document',department:'Aerospace Engineering',course:'Aerodynamics',size_bytes:'1560',modified_at:'2026-10-20',source_id:'preview-only',content:'Aerodynamics — sample lecture outline. Placeholder data for interface testing only.'},
  {id:'2',name:'Introduction to Flight - Notes.txt',ext:'.txt',kind:'Document',department:'Aerospace Engineering',course:'Flight Mechanics',size_bytes:'860',modified_at:'2026-10-20',source_id:'preview-only',content:'Flight Mechanics — sample text resource. No real college files are connected.'},
  {id:'3',name:'Engineering Thermodynamics - Notes.txt',ext:'.txt',kind:'Document',department:'Mechanical Engineering',course:'Thermodynamics',size_bytes:'2048',modified_at:'2026-10-20',source_id:'preview-only',content:'Thermodynamics — synthetic material for MREM preview review.'},
  {id:'4',name:'Fluid Mechanics - Question Bank.txt',ext:'.txt',kind:'Document',department:'Mechanical Engineering',course:'Fluid Mechanics',size_bytes:'1200',modified_at:'2026-10-20',source_id:'preview-only',content:'Fluid Mechanics — demonstration question bank. No real questions are included.'},
  {id:'5',name:'Electric Circuits - Overview.txt',ext:'.txt',kind:'Document',department:'Electrical Engineering',course:'Circuit Theory',size_bytes:'950',modified_at:'2026-10-20',source_id:'preview-only',content:'Circuit Theory — example resource used in UI demonstration.'},
  {id:'6',name:'Control Systems - Lecture Outline.txt',ext:'.txt',kind:'Document',department:'Electrical Engineering',course:'Control Systems',size_bytes:'1300',modified_at:'2026-10-20',source_id:'preview-only',content:'Control Systems — mock lecture outline.'},
  {id:'7',name:'Data Structures - Study Guide.txt',ext:'.txt',kind:'Document',department:'Computer Science',course:'Data Structures',size_bytes:'1500',modified_at:'2026-10-20',source_id:'preview-only',content:'Data Structures — demonstration study guide.'},
  {id:'8',name:'Computer Networks - Model Questions.txt',ext:'.txt',kind:'Document',department:'Computer Science',course:'Computer Networks',size_bytes:'1000',modified_at:'2026-10-20',source_id:'preview-only',content:'Computer Networks — synthetic model questions.'},
  {id:'9',name:'Machine Learning - Introduction.txt',ext:'.txt',kind:'Document',department:'Artificial Intelligence & ML',course:'Machine Learning',size_bytes:'2400',modified_at:'2026-10-20',source_id:'preview-only',content:'Machine Learning — synthetic introductory notes, no external media.'},
  {id:'10',name:'Neural Networks - Sample Notes.txt',ext:'.txt',kind:'Document',department:'Artificial Intelligence & ML',course:'Neural Networks',size_bytes:'2100',modified_at:'2026-10-20',source_id:'preview-only',content:'Neural Networks — synthetic teaching resource.'}
];
export function demoCatalogue(params:URLSearchParams){
 const q=(params.get('q')||'').trim().toLowerCase();
 const department=params.get('department')||'';
 const course=params.get('course')||'';
 const kind=params.get('kind')||'';
 const page=Math.max(1,Number.parseInt(params.get('page')||'1',10)||1);
 const filtered=previewFiles.filter(f=>(!q||[f.name,f.department,f.course].some(v=>v.toLowerCase().includes(q)))&&(!department||f.department===department)&&(!course||f.course===course)&&(!kind||f.kind===kind));
 const counts=new Map<string,number>();
 for(const f of previewFiles)counts.set(f.department,(counts.get(f.department)||0)+1);
 return {items:filtered.slice((page-1)*30,page*30).map(({content,...rest})=>rest),total:filtered.length,page,limit:30,
 departments:[...counts].sort((a,b)=>a[0].localeCompare(b[0])).map(([department,total])=>({department,total:String(total)})),
 courses:[...new Set(previewFiles.filter(f=>f.department===department).map(f=>f.course))].sort()};
}
export const demoEnabled=()=>process.env.MREM_DEMO_PREVIEW==='enabled'&&process.env.VERCEL==='1';
