import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
// Downloaded at build time and served by the app itself: no font request leaves the campus network.
const inter=Inter({subsets:['latin'],variable:'--font-inter',display:'swap'});
export const metadata: Metadata = {title:'MREM Digital Learning Library',description:'Courses, video lectures and study materials of Malla Reddy Engineering College and Management Sciences',
 icons:{icon:'/brand/mrem-icon-192.png',apple:'/brand/mrem-icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en" className={inter.variable}><body>{children}</body></html>;
}
