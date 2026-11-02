import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'MREM Digital Learning Library',description:'MREM course resources and digital library',
 icons:{icon:'/brand/mrem-icon-192.png',apple:'/brand/mrem-icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
