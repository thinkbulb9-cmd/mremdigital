import type {Metadata} from 'next';
import UiExperiencePreview from '@/components/lms/UiExperiencePreview';
export const metadata:Metadata={title:'MREM · UX Refresh Preview',description:'Review the next MREM student LMS design before campus deployment'};
export default function UXPreview(){return <UiExperiencePreview/>;}
