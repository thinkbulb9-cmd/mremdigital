import type {Metadata} from 'next';
import MremOpenLms from '@/components/MremOpenLms';
import CampusLms from '@/components/CampusLms';
import {campusMode} from '@/lib/campus-mode';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'MREM Digital Learning Library',description:'Courses, video lectures and study materials of Malla Reddy Engineering College and Management Sciences'};
/** Students open the library directly: no login. The college server serves the real catalogue; elsewhere the design preview. */
export default function Home(){return campusMode()?<CampusLms/>:<MremOpenLms/>;}
