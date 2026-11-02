import {makeDemoPdf} from '@/lib/demo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){
 const bytes=makeDemoPdf();
 return new Response(bytes.buffer as ArrayBuffer,{headers:{
  'Content-Type':'application/pdf',
  'Content-Disposition':'inline; filename="MREM-Library-Demo.pdf"',
  'Cache-Control':'public, max-age=600',
  'X-Content-Type-Options':'nosniff'
 }});
}
