import type {Metadata} from 'next';
import MremOpenLms from '@/components/MremOpenLms';
export const metadata:Metadata={title:'MREM Digital Learning Library',description:'Open MREM Digital Learning Library design showcase — browse courses without signing in'};
export default function Home(){return <MremOpenLms/>;}
