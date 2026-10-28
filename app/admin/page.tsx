import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorized } from '@/lib/auth';
import { db } from '@/lib/db';
import { HardDrive, Database, FolderOpen, FileText, ArrowLeft, Activity } from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Admin(){
 if(!(await authorized()))redirect('/login');
 const [sources,summary,jobs]=await Promise.all([
  db().query(`SELECT s.id,s.name,s.root_path,s.enabled,s.last_successful_scan, count(r.id) AS resources FROM storage_sources s LEFT JOIN resources r ON r.source_id=s.id GROUP BY s.id ORDER BY s.id`),
  db().query(`SELECT count(*) AS files,coalesce(sum(size_bytes),0) AS bytes,count(distinct department) AS departments FROM resources WHERE availability='available'`),
  db().query(`SELECT source_id,status,files_seen,folders_seen,started_at,completed_at,error FROM scan_jobs ORDER BY started_at DESC LIMIT 15`)
 ]);
 const stats=summary.rows[0];
 const totalBytes=Number(stats.bytes);
 const statsCards=[{label:'Indexed files',value:Number(stats.files).toLocaleString(),icon:<FileText/>},{label:'Referenced media size',value:(totalBytes/1e12).toFixed(2)+' TB',icon:<Database/>},{label:'Departments',value:stats.departments,icon:<FolderOpen/>},{label:'Connected sources',value:sources.rows.length,icon:<HardDrive/>}];
 return <main className="adminPage"><Link href="/" className="backLink"><ArrowLeft size={16}/> Back to Library</Link><div className="eyebrow">OPERATIONS</div><h1>Storage & Indexing Overview</h1><p className="muted">Read-only visibility into registered storage devices and scanner jobs. Scan jobs run from a trusted server terminal.</p>
 <div className="statGrid">{statsCards.map(x=><div className="statCard" key={x.label}>{x.icon}<span>{x.label}</span><strong>{x.value}</strong></div>)}</div>
 <h2 className="adminHeading"><HardDrive size={20}/> Registered storage sources</h2><div className="tableWrap"><div className="adminTable"><div className="adminTableHeader"><span>IDENTIFIER / NAME</span><span>FILES</span><span>LAST SUCCESSFUL SCAN</span><span>CONFIGURED</span></div>{sources.rows.length===0?<div className="emptyState">No storage devices registered yet.</div>:sources.rows.map(x=><div className="adminTableRow" key={x.id}><div><strong>{x.name}</strong><small>{x.id} · {x.root_path}</small></div><span>{x.resources}</span><span>{x.last_successful_scan?new Date(x.last_successful_scan).toLocaleString():'Not scanned'}</span><span>{x.enabled?'Enabled':'Disabled'}</span></div>)}</div></div>
 <h2 className="adminHeading"><Activity size={20}/> Recent scan activity</h2><div className="tableWrap"><div className="adminTable"><div className="adminTableHeader"><span>STORAGE SOURCE</span><span>FILES</span><span>STARTED</span><span>STATUS</span></div>{jobs.rows.length===0?<div className="emptyState">No scans completed yet. Run npm run scan.</div>:jobs.rows.map((x,i)=><div className="adminTableRow" key={i}><div><strong>{x.source_id}</strong><small>{x.error||`${x.folders_seen} folders scanned`}</small></div><span>{x.files_seen}</span><span>{new Date(x.started_at).toLocaleString()}</span><span className={x.status==='completed'?'statusOk':'statusWarn'}>{x.status}</span></div>)}</div></div>
 <div className="notice">This pilot does not support student accounts, admin write controls, audit-complete reporting or production-grade availability monitoring. Add them before public launch.</div>
 </main>;
}
