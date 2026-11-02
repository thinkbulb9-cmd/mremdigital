import type {Metadata} from 'next';
import LibraryDesignPreview from '@/components/LibraryDesignPreview';
export const metadata:Metadata={title:'MREM · LMS Design Comparison',description:'UI/UX-only preview of the MREM Digital Learning Library'};
export default function DesignPreview(){return <LibraryDesignPreview/>;}
