import MremCoursePreview from '@/components/MremCoursePreview';
import CampusLms from '@/components/CampusLms';
import {campusMode} from '@/lib/campus-mode';
export const dynamic='force-dynamic';
export const metadata={title:'MREM Digital Learning Library',description:'College-hosted learning courses and media'};
export default function Page(){return campusMode()?<CampusLms/>:<MremCoursePreview/>;}
