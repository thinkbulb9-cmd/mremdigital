'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { BookOpen,Check,CheckCircle,ChevronRight,ClipboardCheck,Database,File,FolderOpen,HardDrive,LockKeyhole,LogOut,RefreshCw,Search,ShieldCheck,Users,X,FileText,Activity } from 'lucide-react';
type Role='hod'|'librarian'|'super_admin';
type Staff={id:string;username:string;display_name:string;role:Role;department_id:string|null;department_code:string|null};
type Source={id:string;name:string;enabled:boolean};
type Department={id:string;code:string;name:string};
type Course={id:string;department_id:string;code:string;name:string};
type Folder={rel_path:string;name:string;parent_rel_path:string};
type RawFile={id:string;name:string;rel_path:string;kind:string;size_bytes:string;mapped_department:string|null};
type Catalog={staff:Staff;sources:Source[];departments:Department[];courses:Course[];folders:Folder[];files:RawFile[]};
type Mapping={id:string;source_id:string;scope:'folder'|'file';rel_path:string;department_id:string;department_code:string;course_name:string|null;course_id:string|null;status:string;submitted_by:string;submitted_at:string;reviewed_at:string|null;review_note:string;note:string;indexing_status:string|null;indexed_count:string|null};
type Audit={id:string;action:string;entity_type:string;entity_id:string;username:string|null;details:Record<string,string>|null;created_at:string};
const canApprove=(r:Role)=>r==='librarian'||r==='super_admin';
const toDate=(v:string)=>new Date(v).toLocaleString();
const request=async (url:string,init?:RequestInit)=>{
 const response=await fetch(url,{cache:'no-store',...init});
 let json;try{json=await response.json();}catch{json={error:'Unexpected server response'};}
 if(!response.ok)throw new Error(json.error||'Request failed');
 return json;
};
export default function StaffDashboard({staff}:{staff:Staff}){
 const [tab,setTab]=useState<'explore'|'requests'|'audit'>('explore');
 const [data,setData]=useState<Catalog|null>(null);
 const [source,setSource]=useState(''),[search,setSearch]=useState('');
 const [scope,setScope]=useState<'folder'|'file'>('folder'),[path,setPath]=useState('');
 const [department,setDepartment]=useState(staff.department_id||'');
 const [course,setCourse]=useState(''),[note,setNote]=useState('');
 const [mappings,setMappings]=useState<Mapping[]>([]),[audit,setAudit]=useState<Audit[]>([]);
 const [working,setWorking]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [reviewNote,setReviewNote]=useState('');
 const courses=useMemo(()=>data?.courses.filter(c=>c.department_id===department)||[],[data,department]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const params=new URLSearchParams();
   if(source)params.set('source',source);
   if(search)params.set('q',search);
   const [catalog,mappingRes,auditRes]=await Promise.all([
    request('/api/staff/catalog?'+params.toString()),
    request('/api/staff/mappings'),
    request('/api/staff/audit')
   ]);
   setData(catalog);setMappings(mappingRes.items);setAudit(auditRes.items);
   if(!source&&catalog.sources.length)setSource(catalog.sources[0].id);
   if(!department&&catalog.departments.length)setDepartment(catalog.departments[0].id);
  }catch(e){setError(e instanceof Error?e.message:'Cannot load dashboard');}
  finally{setLoading(false);}
 },[source,search,department]);
 useEffect(()=>{const t=setTimeout(()=>{void load();},260);return()=>clearTimeout(t);},[load]);
 function choosePath(s:'folder'|'file',p:string){setScope(s);setPath(p);setMessage('');}
 async function propose(){
  if(!source||!path||!department){setError('Select a disk, a file/folder and a department');return;}
  setWorking(true);setError('');setMessage('');
  try{
   await request('/api/staff/mappings',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({source_id:source,scope,rel_path:path,department_id:department,course_id:course||null,note})});
   setMessage('Mapping submitted for librarian approval. No original file was modified.');
   setPath('');setNote('');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Mapping could not be submitted');}
  finally{setWorking(false);}
 }
 async function review(id:string,decision:'approve'|'reject'){
  setWorking(true);setError('');setMessage('');
  try{
   const res=await request('/api/staff/mappings/'+id+'/review',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({decision,note:reviewNote})});
   setMessage(decision==='approve'?'Approved. Run the background mapping worker to publish the metadata to student search.':'Request rejected.');
   setReviewNote('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Review failed');}
  finally{setWorking(false);}
 }
 async function logout(){await request('/api/staff/logout',{method:'POST'});window.location.assign('/staff/login');}
 const pending=mappings.filter(x=>x.status==='pending').length;
 const approved=mappings.filter(x=>x.status==='approved').length;
 return <div className="staffLayout">
  <aside className="staffSidebar">
   <div className="staffBrand"><span className="brandMark"><BookOpen/></span><div><strong>MREM Library</strong><small>ACADEMIC CONTENT CONTROL</small></div></div>
   <div className="staffRole"><ShieldCheck size={18}/><span>{staff.role==='hod'?'Department HOD':staff.role==='librarian'?'Librarian':'Super Administrator'}</span></div>
   <p className="staffSectionLabel">MANAGEMENT</p>
   <button className={tab==='explore'?'staffNav selected':'staffNav'} onClick={()=>setTab('explore')}><FolderOpen size={18}/> Raw Storage Mapping</button>
   <button className={tab==='requests'?'staffNav selected':'staffNav'} onClick={()=>setTab('requests')}><ClipboardCheck size={18}/> Mapping Requests <span className="staffNavCount">{pending}</span></button>
   <button className={tab==='audit'?'staffNav selected':'staffNav'} onClick={()=>setTab('audit')}><Activity size={18}/> Audit Trail</button>
   <div className="staffSidebarBottom"><div className="staffUserIcon"><Users size={18}/></div><div><strong>{staff.display_name}</strong><small>{staff.username}</small></div><button onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></div>
  </aside>
  <main className="staffMain">
   <div className="staffTop"><div><div className="eyebrow">MREM WINDOWS SERVER / CONTENT MANAGEMENT</div><h1>{tab==='explore'?'Storage & Department Mapping':tab==='requests'?'Mapping Approvals':'Audit Trail'}</h1><p>Organize library resources without moving, renaming, or copying source files.</p></div><button className="staffRefresh" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div>
   {error&&<div className="staffError" role="alert">{error}</div>}
   {message&&<div className="staffSuccess" role="status"><CheckCircle size={17}/>{message}</div>}
   <div className="staffStats">
    <div><HardDrive/><span>Authorized drives</span><strong>{data?.sources.length??'—'}</strong></div>
    <div><FolderOpen/><span>Available folders</span><strong>{data?.folders.length??'—'}{data&&data.folders.length===100?'+':''}</strong></div>
    <div><ClipboardCheck/><span>Pending requests</span><strong>{pending}</strong></div>
    <div><CheckCircle/><span>Approved mappings</span><strong>{approved}</strong></div>
   </div>
   {tab==='explore'&&<div className="staffColumns">
    <section className="staffCard">
     <div className="staffCardHeading"><h2>1. Browse indexed storage</h2><small>Read-only metadata catalogue</small></div>
     <label className="staffLabel" htmlFor="staff-source">Storage drive</label>
     <select id="staff-source" value={source} onChange={e=>{setSource(e.target.value);setPath('')}}>
      <option value="">Select a drive</option>{data?.sources.map(s=><option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
     </select>
     <div className="staffSearch"><Search size={16}/><input aria-label="Search raw folders and files" placeholder="Search folder or filename" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     <div className="staffRawHeading"><span>FOLDERS — SELECT TO MAP ENTIRE SUBTREE</span><span>{data?.folders.length??0}</span></div>
     <div className="staffScroll">
      {data?.folders.length?data.folders.map(f=>
       <button key={f.rel_path} className={'staffRawItem '+(scope==='folder'&&path===f.rel_path?'active':'')} onClick={()=>choosePath('folder',f.rel_path)}>
        <FolderOpen size={17}/><span><b>{f.name}</b><small>{f.rel_path}</small></span><ChevronRight size={15}/></button>
      ):<p className="staffEmpty">No folders indexed for this source or search. Run the disk scanner first.</p>}
     </div>
     <div className="staffRawHeading"><span>FILES — SELECT SINGLE FILE</span><span>{data?.files.length??0}</span></div>
     <div className="staffScroll">
      {data?.files.length?data.files.map(f=>
       <button key={f.id} className={'staffRawItem '+(scope==='file'&&path===f.rel_path?'active':'')} onClick={()=>choosePath('file',f.rel_path)}>
        <File size={17}/><span><b>{f.name}</b><small>{f.rel_path}</small></span><ChevronRight size={15}/></button>
      ):<p className="staffEmpty">No files match the current search.</p>}
     </div>
    </section>
    <section className="staffCard">
     <div className="staffCardHeading"><h2>2. Assign academic category</h2><small>Creates a review request; does not modify disk files</small></div>
     <div className="staffSelectedPath"><span>{path?scope==='folder'?'SELECTED FOLDER — BULK MAP':'SELECTED FILE':'NO FILE OR FOLDER SELECTED'}</span>
      <strong>{path||'Select a source folder from the left to begin.'}</strong></div>
     <label htmlFor="staff-dept" className="staffLabel">Department</label>
     <select id="staff-dept" value={department} disabled={staff.role==='hod'} onChange={e=>{setDepartment(e.target.value);setCourse('')}}>
      <option value="">Select department</option>
      {data?.departments.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
     </select>
     <label htmlFor="staff-course" className="staffLabel">Course / Subject</label>
     <select id="staff-course" value={course} onChange={e=>setCourse(e.target.value)}>
      <option value="">General / Unassigned course</option>
      {courses.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
     </select>
     <label htmlFor="staff-note" className="staffLabel">Reason or notes (optional)</label>
     <textarea id="staff-note" rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain why the selected folder belongs to this course"/>
     <div className="staffNotice"><LockKeyhole size={17}/><span>{staff.role==='hod'?'HOD submissions require a librarian or super admin to approve before publication.':'Even librarian proposals go through the review step for auditability.'}</span></div>
     <button disabled={!path||!source||!department||working} className="staffPrimary" onClick={()=>void propose()}>Submit Mapping for Approval <ChevronRight size={17}/></button>
     <div className="staffCardHeading staffSubHeading"><h2>How bulk mapping works</h2></div>
     <p className="staffHelp">Map one indexed folder and every descendant file can inherit the approved department and course. A more specific folder or individual file rule takes precedence. The Windows file path and original filename are preserved.</p>
    </section>
   </div>}
   {tab==='requests'&&<section className="staffCard">
    <div className="staffCardHeading"><h2>Mapping requests</h2><small>{canApprove(staff.role)?'Review pending HOD submissions':'Track your department submissions'}</small></div>
    {canApprove(staff.role)&&<div className="staffReviewInput"><label className="staffLabel" htmlFor="review-note">Review note (optional)</label><input id="review-note" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Review notes for approval or rejection"/></div>}
    <div className="staffRequestList">
     {mappings.length?mappings.map(m=><div key={m.id} className="staffRequest">
      <div className="staffRequestHead"><div><span className="staffTag">{m.scope.toUpperCase()}</span><span className={'staffStatus '+m.status}>{m.status}</span>
       <h3>{m.rel_path}</h3><p>{m.source_id} · {m.department_code} / {m.course_name||'General'} · by {m.submitted_by}</p></div>
       <small>{toDate(m.submitted_at)}</small></div>
      {m.note&&<p className="staffHelp">{m.note}</p>}
      {m.status==='approved'&&<p className="staffHelp">Indexing: <strong>{m.indexing_status||'queued'}</strong> · {m.indexed_count||'0'} resource records processed</p>}
      {m.review_note&&<p className="staffHelp">Reviewer note: {m.review_note}</p>}
      {canApprove(staff.role)&&m.status==='pending'&&<div className="staffRequestActions">
       <button className="staffApprove" disabled={working} onClick={()=>void review(m.id,'approve')}><Check size={15}/> Approve & Queue</button>
       <button className="staffReject" disabled={working} onClick={()=>void review(m.id,'reject')}><X size={15}/> Reject</button>
      </div>}
     </div>):<p className="staffEmpty">No mapping requests yet. Select a raw folder to submit the first mapping.</p>}
    </div>
   </section>}
   {tab==='audit'&&<section className="staffCard"><div className="staffCardHeading"><h2>Audit history</h2><small>Read-only audit records for permitted operations</small></div>
    <div className="staffRequestList">
     {audit.length?audit.map(a=><div key={a.id} className="staffAuditRow"><Activity size={17}/><div><strong>{a.action}</strong><small>{a.entity_type} #{a.entity_id} · {a.username||'system'} · {toDate(a.created_at)}</small>
      {a.details&&<small>{Object.entries(a.details).filter(([k])=>['source_id','rel_path','department_id','course_id','scope','status'].includes(k)).map(([k,v])=>k+': '+v).join(' · ')}</small>}</div></div>):<p className="staffEmpty">No audit records yet.</p>}
    </div>
   </section>}
  </main>
 </div>;
}
