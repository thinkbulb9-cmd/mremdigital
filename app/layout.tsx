import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'MREM Digital Library',description:'MREM course resources and digital library'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
