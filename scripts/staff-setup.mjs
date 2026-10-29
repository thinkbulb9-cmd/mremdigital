/** Windows Server setup. Secrets generated locally; never stored in GitHub. */
import { randomBytes,scryptSync } from 'node:crypto';
import pg from 'pg';
const [command,...args]=process.argv.slice(2);
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in .env.local');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
const userPattern=/^[a-z0-9._-]{3,60}$/;
const codePattern=/^[A-Z0-9_-]{2,24}$/;
function hashPassword(p){const salt=randomBytes(16);return 'scrypt$'+salt.toString('hex')+'$'+scryptSync(p,salt,64).toString('hex');}
function newPassword(){return randomBytes(24).toString('base64url');}
await db.connect();
try{
 if(command==='bootstrap'){
  const q=await db.query('SELECT count(*)::int AS count FROM staff_users');
  if(q.rows[0].count!==0)throw new Error('Bootstrap allowed only if no staff exist');
  const pw=newPassword();
  await db.query("INSERT INTO staff_users(username,display_name,password_hash,role) VALUES('superadmin','Super Administrator',$1,'super_admin')",[hashPassword(pw)]);
  console.log('\nUsername: superadmin\nOne-time password: '+pw+'\nSave this privately. It cannot be retrieved again.\n');
 }else if(command==='department'){
  const [code,name]=args;
  if(!codePattern.test(code||'')||!name||name.length>120)throw new Error('Usage: department CSE "Computer Science and Engineering"');
  await db.query('INSERT INTO departments(code,name) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name',[code,name]);
  console.log('Department ready: '+code);
 }else if(command==='course'){
  const [dept,code,name]=args;
  if(!codePattern.test(dept||'')||!codePattern.test(code||'')||!name||name.length>140)throw new Error('Usage: course CSE DS "Data Structures"');
  const r=await db.query('INSERT INTO courses(department_id,code,name) SELECT id,$2,$3 FROM departments WHERE code=$1 ON CONFLICT(department_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id',[dept,code,name]);
  if(!r.rowCount)throw new Error('Unknown department: '+dept);
  console.log('Course ready: '+dept+'/'+code);
 }else if(command==='user'){
  const [username,role,department]=args;
  if(!userPattern.test(username||'')||!['hod','librarian'].includes(role)||((role==='hod')!==Boolean(department)))throw new Error('Usage: user hodcse hod CSE | user librarian librarian');
  const pw=newPassword();
  const q=await db.query('INSERT INTO staff_users(username,display_name,password_hash,role,department_id) VALUES($1,$1,$2,$3,(SELECT id FROM departments WHERE code=$4)) RETURNING id',
   [username,hashPassword(pw),role,department||null]);
  if(!q.rowCount)throw new Error('Failed to create user');
  console.log('\nUsername: '+username+'\nRole: '+role+'\nOne-time password: '+pw+'\nStore privately; never post to GitHub or chat.\n');
 }else if(command==='grant'){
  const [username,sourceId]=args;
  if(!username||!sourceId)throw new Error('Usage: grant hodcse disk01');
  const q=await db.query("INSERT INTO hod_source_grants(staff_user_id,source_id) SELECT id,$2 FROM staff_users WHERE username=$1 AND role='hod' ON CONFLICT DO NOTHING RETURNING staff_user_id",[username,sourceId]);
  if(!q.rowCount)throw new Error('Grant unavailable; verify username, source, and existing grants');
  console.log('Granted '+username+' access to raw storage metadata: '+sourceId);
 }else{
  console.log('Usage: bootstrap | department CODE NAME | course DEPT CODE NAME | user USERNAME hod DEPT | user USERNAME librarian | grant USERNAME SOURCE');
  process.exitCode=1;
 }
}finally{await db.end();}
