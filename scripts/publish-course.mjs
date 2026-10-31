/** Only college IT/HOD may approve a course after reviewing ALL indexed files.
 * Usage: npm run campus:publish -- --code 101101086 --reviewer 'Library HOD' --confirm
 * To unpublish: npm run campus:publish -- --code 101101086 --reviewer 'Library HOD' --revoke --confirm
 * This changes database visibility only, NEVER the E: drive.
 */
import pg from 'pg';
function arg(key){let i=process.argv.indexOf('--'+key);return i<0?'':process.argv[i+1]||''}
const code=arg('code'),reviewer=arg('reviewer'),revoke=process.argv.includes('--revoke');
if(!/^\d{9}$/.test(code)||reviewer.length<3||reviewer.length>120||!process.argv.includes('--confirm')){
 console.error("Usage: npm run campus:publish -- --code 101101086 --reviewer 'College Library HOD' --confirm [--revoke]");
 process.exit(2);
}
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const totals=await db.query("SELECT count(*)::bigint AS files FROM resources WHERE course_code=$1 AND availability='available'",[code]);
 if(Number(totals.rows[0].files)===0)throw Error('No available files for course '+code);
 await db.query("INSERT INTO campus_publications(course_code,approved,reviewed_by,reviewed_at) VALUES($1,$2,$3,now()) "+
   "ON CONFLICT(course_code) DO UPDATE SET approved=EXCLUDED.approved,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=now()",
   [code,!revoke,reviewer]);
 console.log(JSON.stringify({code,approved:!revoke,reviewed_by:reviewer,files_in_course:totals.rows[0].files}));
 console.log('Publication only takes effect when MREM_CAMPUS_REQUIRE_APPROVAL=enabled.');
}finally{await db.end()}
