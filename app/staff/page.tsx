import { redirect } from 'next/navigation';
import { staffEnabled,staffSession } from '@/lib/staff-auth';
import StaffDashboard from '@/components/StaffDashboard';
export const dynamic='force-dynamic';
export default async function StaffPage(){
 if(!staffEnabled())return <main style={{padding:40}}><h1>HOD Content Mapping — Live Preview</h1><p>The real mapping system requires the college Windows Server. Explore the sample-data dashboard here:</p><p><a href="/staff/demo?role=hod" style={{color:'#d83d69',textDecoration:'underline'}}>Open HOD Mapping Preview</a> · <a href="/staff/demo?role=librarian" style={{color:'#d83d69',textDecoration:'underline'}}>Open Librarian Approval Preview</a></p><p>Demo actions are simulated; no college files or credentials are connected.</p></main>;
 const staff=await staffSession();
 if(!staff)redirect('/staff/login');
 return <StaffDashboard staff={staff}/>;
}
