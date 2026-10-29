import { notFound } from 'next/navigation';
import { demoEnabled } from '@/lib/demo';
import StaffDashboard from '@/components/StaffDashboard';
export const dynamic='force-dynamic';
export default async function StaffDemoPage({searchParams}:{searchParams:Promise<{role?:string}>}){
 if(!demoEnabled())notFound();
 const {role}=await searchParams;
 const librarian=role==='librarian';
 const staff=librarian
  ?{id:'demo-librarian',username:'librarian_demo',display_name:'Demo Librarian',role:'librarian' as const,department_id:null,department_code:null}
  :{id:'demo-hod',username:'hodcse_demo',display_name:'Demo CSE HOD',role:'hod' as const,department_id:'1',department_code:'CSE'};
 return <StaffDashboard staff={staff} demo/>;
}
