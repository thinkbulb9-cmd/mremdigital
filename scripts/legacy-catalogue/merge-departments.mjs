/** Merge department names that differ only in spelling, so the student sidebar lists each discipline once.
 * Dry run (default) prints counts; --apply backs up the affected course_catalog rows to a table first.
 *   node --env-file=.env.local scripts/legacy-catalogue/merge-departments.mjs [--apply]
 */
import {parseArgs} from 'node:util';
import pg from 'pg';

// Seen on the college server: a name cut off in the legacy HTML catalogue, and two spellings of one discipline.
export const MERGES=[
 {to:'Electronics and Communication Engineering',from:['Electronics & Communication Engin','Electronics & Communication Engineering']},
 {to:'Multidisciplinary',from:['Multi-Disciplinary','Multi Disciplinary']}];
const {values:opt}=parseArgs({options:{apply:{type:'boolean',default:false}}});
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try{
 const from=MERGES.flatMap(m=>m.from);
 const counts=(await db.query('SELECT department,count(*)::int n FROM course_catalog WHERE department=ANY($1) GROUP BY 1 ORDER BY 1',[from])).rows;
 console.log(JSON.stringify({mode:opt.apply?'apply':'dry-run',rows_to_rename:counts}));
 if(opt.apply&&counts.length){
  const suffix=new Date().toISOString().replace(/\D/g,'').slice(0,14);
  await db.query('BEGIN');
  try{
   await db.query(`CREATE TABLE dept_merge_backup_${suffix}_course_catalog AS SELECT * FROM course_catalog WHERE department=ANY($1)`,[from]);
   for(const m of MERGES){
    const r=await db.query('UPDATE course_catalog SET department=$1,updated_at=now() WHERE department=ANY($2)',[m.to,m.from]);
    console.log(m.to+': '+r.rowCount+' rows renamed');
   }
   await db.query('COMMIT');
   console.log('Backup table: dept_merge_backup_'+suffix+'_course_catalog');
  }catch(e){await db.query('ROLLBACK');throw e}
 }
}finally{await db.end()}
