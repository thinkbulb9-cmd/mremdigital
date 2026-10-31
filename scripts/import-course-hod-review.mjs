/** HOD reviewed course-title import. No media editing or automatic publication.
 * Command: npm run campus:review:import -- C:/MREM/inventory/course-hod-review.csv
 */
import fs from 'node:fs/promises';
import pg from 'pg';
const file=process.argv[2];if(!file)throw Error('Pass a reviewed CSV file path');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
const raw=await fs.readFile(file,'utf8');
if(raw.length>15_000_000)throw Error('Review CSV is unreasonably large');
function parseCSV(input){
 const rows=[],row=[];let cell='',quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(ch==='"'){
   if(quoted&&input[i+1]==='"'){cell+='"';i++}
   else quoted=!quoted;
  }else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   row.push(cell);if(row.some(v=>v!==''))rows.push([...row]);row.length=0;cell='';
  }else cell+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quotation');
 if(cell||row.length){row.push(cell);rows.push([...row])}
 return rows;
}
const lines=parseCSV(raw.replace(/^\uFEFF/,''));
if(!lines.length)throw Error('Empty CSV');
const names=lines[0],needed=['course_code','reviewed_title','reviewed_department','reviewed_by','approve_title'];
for(const key of needed)if(!names.includes(key))throw Error('Missing CSV column: '+key);
const idx=k=>names.indexOf(k);
if(lines.length>50001)throw Error('Too many reviewed rows');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
let approved=0,skipped=0;
try{
 await db.query('BEGIN');
 try{
  for(const cells of lines.slice(1)){
   if(cells[idx('approve_title')]?.trim().toUpperCase()!=='YES'){skipped++;continue}
   const code=cells[idx('course_code')]?.trim(),title=cells[idx('reviewed_title')]?.trim(),
     department=cells[idx('reviewed_department')]?.trim(),reviewer=cells[idx('reviewed_by')]?.trim();
   if(!/^\d{9}$/.test(code||'')||!title||title.length>250||!department||department.length>120||!reviewer||reviewer.length>120||
     /^Course \d{9}$/.test(title))throw Error('Invalid reviewed metadata for course '+(code||'(blank)'));
   const exists=await db.query("SELECT 1 FROM resources WHERE course_code=$1 AND availability='available' LIMIT 1",[code]);
   if(!exists.rowCount)throw Error('Course not present in index: '+code);
   await db.query("INSERT INTO course_catalog(course_code,title,department,verified,title_source) VALUES($1,$2,$3,TRUE,$4) "+
    "ON CONFLICT(course_code) DO UPDATE SET title=EXCLUDED.title,department=EXCLUDED.department,verified=TRUE,title_source=EXCLUDED.title_source,updated_at=now()",
     [code,title,department,'HOD reviewed: '+reviewer.slice(0,120)]);
   approved++;
  }
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e}
 console.log(JSON.stringify({verified_titles_imported:approved,skipped_rows:skipped}));
 console.log('Titles verified only; student publication approval remains separate.');
}finally{await db.end()}
