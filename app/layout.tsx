import './globals.css';
import '@fontsource-variable/inter/index.css';
import type {Metadata} from 'next';
// Same Inter typeface as the approved design, now self-hosted: no Google Fonts build dependency.
export const metadata:Metadata={title:'MREM Digital Learning Library',description:'Courses, video lectures and study materials of Malla Reddy Engineering College and Management Sciences',icons:{icon:'/brand/mrem-icon-192.png',apple:'/brand/mrem-icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body style={{'--font-inter':'"Inter Variable", Inter, sans-serif'} as React.CSSProperties}>{children}</body></html>}
