/** CSV for college HODs to review missing course titles and department suggestions.
 * No media bytes. Names are course titles, not file paths. Kept in C:/MREM/inventory.
 * Command: npm run campus:review:export -- C:/MREM/inventory
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const output=path.resolve(process.argv[2]||'C:/MREM/inventory');
await fs.mkdir(output,{recursive:true});
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
function csv(value){const s=String(value??'');return '"'+s.replaceAll('"','""')+'"';}
await db.connect();
try{
 const r=await db.query(
 "SELECT r.course_code, COALESCE(c.title,'Course '||r.course_code) AS current_title,"+
 "COALESCE(c.department,'Unclassified') AS department,"+
 "COALESCE(c.verified,FALSE) AS verified,"+
 "count(*)::bigint AS files, count(*) FILTER(WHERE r.kind='Video')::bigint AS videos,"+
 "string_agg(DISTINCT r.semester_name,', ' ORDER BY r.semester_name) AS semesters "+
 "FROM resources r LEFT JOIN course_catalog c ON c.course_code=r.course_code "+
 "WHERE r.availability='available' AND r.course_code ~ '^[0-9]{9}$' "+
 "GROUP BY r.course_code,c.title,c.department,c.verified ORDER BY r.course_code");
 const headers=['course_code','current_title','suggested_department','verified','files','videos','semesters','reviewed_title','reviewed_department','reviewed_by','approve_title'];
 const data=[headers.join(',')];
 for(const x of r.rows) data.push([
  x.course_code,x.current_title,x.department,x.verified,x.files,x.videos,x.semesters,
  '','','',''
 ].map(csv).join(','));
 const file=path.join(output,'course-hod-review.csv');
 await fs.writeFile(file,data.join('\r\n')+'\r\n','utf8');
 console.log('Created '+file+' with '+r.rowCount+' course IDs.');
 console.log('HOD must fill reviewed_title, reviewed_department, reviewed_by and approve_title=YES. Save as CSV UTF-8.');
 console.log('Original E: drive was not opened or changed.');
}finally{await db.end()}
