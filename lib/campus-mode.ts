import 'server-only';
/** Only the on-prem Windows deployment may serve the campus catalogue without login. */
export function campusMode():boolean {
 return process.env.MREM_CAMPUS_PUBLIC==='enabled' &&
        process.env.VERCEL!=='1' &&
        Boolean(process.env.DATABASE_URL);
}
