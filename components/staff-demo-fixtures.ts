/* Synthetic, client-only mapping preview: never makes API calls or modifies original disks. */
type Staff={id:string;username:string;display_name:string;role:'hod'|'librarian'|'super_admin';department_id:string|null;department_code:string|null};
type Mapping={id:string;source_id:string;scope:'folder'|'file';rel_path:string;department_id:string;department_code:string;course_name:string|null;course_id:string|null;status:string;submitted_by:string;submitted_at:string;reviewed_at:string|null;review_note:string;note:string;indexing_status:string|null;indexed_count:string|null};
type Audit={id:string;action:string;entity_type:string;entity_id:string;username:string|null;details:Record<string,string>;created_at:string};
const departments=[{id:'1',code:'CSE',name:'Computer Science and Engineering'},{id:'2',code:'EEE',name:'Electrical and Electronics Engineering'},{id:'3',code:'MECH',name:'Mechanical Engineering'}];
const courses=[
 {id:'11',department_id:'1',code:'DS',name:'Data Structures'},
 {id:'12',department_id:'1',code:'DBMS',name:'Database Management Systems'},
 {id:'13',department_id:'1',code:'AI',name:'Artificial Intelligence'},
 {id:'21',department_id:'2',code:'CT',name:'Circuit Theory'},
 {id:'22',department_id:'2',code:'PS',name:'Power Systems'},
 {id:'31',department_id:'3',code:'TH',name:'Thermodynamics'}
];
const sources=[
 {id:'disk01',name:'Sample NPTEL Drive 01',enabled:true},
 {id:'disk02',name:'Sample Archive Drive 02',enabled:true},
 {id:'disk03',name:'Sample Legacy Drive 03',enabled:true}
];
const records=[
 {source:'disk01',folder:'NPTEL/CSE/Data Structures',file:'Lecture_01.mp4',kind:'Video',size_bytes:'218956345'},
 {source:'disk01',folder:'NPTEL/CSE/Data Structures',file:'Lecture_02.mp4',kind:'Video',size_bytes:'228156345'},
 {source:'disk01',folder:'NPTEL/CSE/Data Structures',file:'Data_Structures_Notes.pdf',kind:'Document',size_bytes:'3892653'},
 {source:'disk01',folder:'NPTEL/EEE/Circuit Theory',file:'Introduction_to_Circuits.mp4',kind:'Video',size_bytes:'239236345'},
 {source:'disk02',folder:'Old Data/CS/DS',file:'Algorithms_Lecture_03.mp4',kind:'Video',size_bytes:'198551234'},
 {source:'disk02',folder:'Old Data/CS/DS',file:'Question_Bank.pdf',kind:'Document',size_bytes:'982733'},
 {source:'disk02',folder:'Electrical/Power Systems',file:'Power_Grid.mp4',kind:'Video',size_bytes:'367820134'},
 {source:'disk03',folder:'A/Batch2022/Database',file:'DBMS_Lecture_08.mp4',kind:'Video',size_bytes:'176712399'},
 {source:'disk03',folder:'A/Batch2022/Database',file:'DBMS_Syllabus.pdf',kind:'Document',size_bytes:'165933'},
 {source:'disk03',folder:'Mechanical/Thermodynamics',file:'Heat_Transfer.mp4',kind:'Video',size_bytes:'289204332'}
];
const stamp='2026-10-29T10:00:00Z';
let demoMappings:Mapping[]=[
 {id:'1001',source_id:'disk01',scope:'folder',rel_path:'NPTEL/CSE/Data Structures',department_id:'1',department_code:'CSE',course_id:'11',course_name:'Data Structures',status:'approved',submitted_by:'hodcse',submitted_at:stamp,reviewed_at:stamp,review_note:'Approved for CSE library',note:'Sample NPTEL subject folder',indexing_status:'completed',indexed_count:'3'},
 {id:'1002',source_id:'disk02',scope:'folder',rel_path:'Old Data/CS/DS',department_id:'1',department_code:'CSE',course_id:'11',course_name:'Data Structures',status:'pending',submitted_by:'hodcse',submitted_at:stamp,reviewed_at:null,review_note:'',note:'Combine archived DS lectures with Disk 01',indexing_status:null,indexed_count:null},
 {id:'1003',source_id:'disk01',scope:'folder',rel_path:'NPTEL/EEE/Circuit Theory',department_id:'2',department_code:'EEE',course_id:'21',course_name:'Circuit Theory',status:'pending',submitted_by:'hodeee',submitted_at:stamp,reviewed_at:null,review_note:'',note:'Circuit Theory collection',indexing_status:null,indexed_count:null}
];
let audit:Audit[]=[
 {id:'1',username:'librarian',action:'mapping.approved',entity_type:'mapping_request',entity_id:'1001',created_at:stamp,details:{source_id:'disk01',rel_path:'NPTEL/CSE/Data Structures',department_id:'1'}},
 {id:'2',username:'hodcse',action:'mapping.proposed',entity_type:'mapping_request',entity_id:'1002',created_at:stamp,details:{source_id:'disk02',rel_path:'Old Data/CS/DS',department_id:'1'}},
 {id:'3',username:'hodeee',action:'mapping.proposed',entity_type:'mapping_request',entity_id:'1003',created_at:stamp,details:{source_id:'disk01',rel_path:'NPTEL/EEE/Circuit Theory',department_id:'2'}}
];
let serial=1100;
const error=(message:string)=>{throw new Error(message);};
export async function demoStaffRequest(url:string,init:RequestInit|undefined,staff:Staff):Promise<any>{
 const method=init?.method?.toUpperCase()||'GET';
 const target=new URL(url,'https://example.invalid');
 if(target.pathname==='/api/staff/logout')return {ok:true};
 if(target.pathname==='/api/staff/catalog'&&method==='GET'){
  const sourceId=target.searchParams.get('source')||'';
  const q=(target.searchParams.get('q')||'').toLowerCase();
  const allowedSources=staff.role==='hod'?sources.filter(s=>s.id!=='disk03'):sources;
  const sourceRows=records.filter(r=>r.source===sourceId);
  const folderPaths=[...new Set(sourceRows.map(r=>r.folder))].filter(f=>f.toLowerCase().includes(q));
  return {
   staff,sources:allowedSources,
   departments:staff.role==='hod'?departments.filter(d=>d.id===staff.department_id):departments,
   courses:staff.role==='hod'?courses.filter(c=>c.department_id===staff.department_id):courses,
   folders:folderPaths.map(f=>({rel_path:f,name:f.split('/').at(-1)||f,parent_rel_path:f.substring(0,f.lastIndexOf('/'))})),
   files:sourceRows.filter(r=>r.file.toLowerCase().includes(q)||r.folder.toLowerCase().includes(q)).map((r,i)=>({
    id:String(i+1),rel_path:r.folder+'/'+r.file,name:r.file,kind:r.kind,size_bytes:r.size_bytes,mapped_department:null
   }))
  };
 }
 if(target.pathname==='/api/staff/mappings'&&method==='GET')
  return {items:staff.role==='hod'?demoMappings.filter(m=>m.department_id===staff.department_id):demoMappings};
 if(target.pathname==='/api/staff/audit'&&method==='GET')
  return {items:staff.role==='hod'?audit.filter(a=>a.details.department_id===staff.department_id):audit};
 if(target.pathname==='/api/staff/mappings'&&method==='POST'){
  const input=JSON.parse(String(init?.body||'{}'));
  if(staff.role==='hod'&&input.department_id!==staff.department_id)return error('You cannot map another department');
  if(!sources.some(s=>s.id===input.source_id))return error('Unknown demo drive');
  const rel=String(input.rel_path||'');
  if(!records.some(r=>r.source===input.source_id&&(input.scope==='folder'?r.folder===rel:r.folder+'/'+r.file===rel)))return error('Select an indexed folder or file');
  if(!departments.some(d=>d.id===input.department_id))return error('Select a valid department');
  if(demoMappings.some(m=>m.source_id===input.source_id&&m.rel_path===rel&&m.status==='pending'))return error('This path already has a pending request');
  const dep=departments.find(d=>d.id===input.department_id)!;
  const subject=courses.find(c=>c.id===input.course_id);
  const id=String(++serial);
  demoMappings=[{id,source_id:input.source_id,scope:input.scope,rel_path:rel,department_id:dep.id,department_code:dep.code,course_id:subject?.id||null,course_name:subject?.name||null,status:'pending',submitted_by:staff.username,submitted_at:new Date().toISOString(),reviewed_at:null,review_note:'',note:String(input.note||''),indexing_status:null,indexed_count:null},...demoMappings];
  audit=[{id:String(++serial),username:staff.username,action:'mapping.proposed',entity_type:'mapping_request',entity_id:id,created_at:new Date().toISOString(),details:{source_id:input.source_id,rel_path:rel,department_id:dep.id}},...audit];
  return {ok:true,id,status:'pending'};
 }
 const match=target.pathname.match(/^\/api\/staff\/mappings\/(\d+)\/review$/);
 if(match&&method==='POST'){
  if(staff.role==='hod')return error('Only librarian or super admin can approve mappings');
  const body=JSON.parse(String(init?.body||'{}'));
  const found=demoMappings.find(m=>m.id===match[1]);
  if(!found||found.status!=='pending')return error('No pending mapping found');
  if(!['approve','reject'].includes(body.decision))return error('Invalid review decision');
  demoMappings=demoMappings.map(m=>m.id===match[1]?{...m,status:body.decision==='approve'?'approved':'rejected',review_note:String(body.note||''),reviewed_at:new Date().toISOString(),indexing_status:body.decision==='approve'?'completed':null,indexed_count:body.decision==='approve'?'2':null}:m);
  audit=[{id:String(++serial),username:staff.username,action:body.decision==='approve'?'mapping.approved':'mapping.rejected',entity_type:'mapping_request',entity_id:match[1],created_at:new Date().toISOString(),details:{department_id:found.department_id,source_id:found.source_id,rel_path:found.rel_path}},...audit];
  return {ok:true,status:body.decision};
 }
 return error('Demo action not supported');
}
