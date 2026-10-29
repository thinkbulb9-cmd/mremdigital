import { redirect } from 'next/navigation';
import { staffEnabled,staffSession } from '@/lib/staff-auth';
import StaffDashboard from '@/components/StaffDashboard';
export const dynamic='force-dynamic';
export default async function StaffPage(){
 if(!staffEnabled())return <main style={{padding:40}}><h1>Staff Mapping — Windows Server</h1><p>This administrative area is available only on the college's self-hosted PostgreSQL installation, not the synthetic Vercel demo.</p></main>;
 const staff=await staffSession();
 if(!staff)redirect('/staff/login');
 return <StaffDashboard staff={staff}/>;
}
