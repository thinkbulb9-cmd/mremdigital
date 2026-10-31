import { redirect } from 'next/navigation';
import { authorized } from '@/lib/auth';
import Library from '@/components/Library';
import {campusMode} from '@/lib/campus-mode';
export const dynamic='force-dynamic';
export default async function Home(){
 if(campusMode())redirect('/explore');
 if(!(await authorized()))redirect('/login');
 return <Library previewMode={process.env.MREM_DEMO_PREVIEW==='enabled'&&process.env.VERCEL==='1'}/>;
}
