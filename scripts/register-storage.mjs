import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
function flag(name) {const i=process.argv.indexOf('--'+name);return i<0?'':process.argv[i+1]||'';}
const id=flag('id'), name=flag('name'), directory=flag('path');
if(!/^[a-zA-Z0-9_-]{2,48}$/.test(id)||!name||!directory) {
 console.error('Usage: npm run storage:add -- --id disk01 --name "NPTEL Disk 01" --path "E:\\NPTEL"'); process.exit(1);
}
const root=await fs.realpath(path.resolve(directory));
if(!(await fs.stat(root)).isDirectory())throw new Error('Storage path is not a directory');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
try { await db.query(`INSERT INTO storage_sources(id,name,root_path) VALUES ($1,$2,$3)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,root_path=EXCLUDED.root_path,enabled=TRUE`,[id,name,root]);
 console.log('Registered', id, '->', root); } finally {await db.end();}
