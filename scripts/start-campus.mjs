/** Starts the library for the campus network (all interfaces) only while college approval is on and at least one course is
 * approved, so a network listener never serves unreviewed material. Local-only use stays `npm start`.
 *   npm run start:campus            (port 3000; MREM_PORT to change)
 */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

if(process.env.MREM_CAMPUS_REQUIRE_APPROVAL!=='enabled'){
 console.error('Refusing to listen on the network: add MREM_CAMPUS_REQUIRE_APPROVAL=enabled to .env.local first.');process.exit(1);
}
if(!process.env.DATABASE_URL){console.error('DATABASE_URL required');process.exit(1)}
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
const approved=(await db.query('SELECT count(*)::int n FROM campus_publications WHERE approved')).rows[0].n;
await db.end();
if(approved<1){console.error('Refusing to listen on the network: no course is approved yet (npm run campus:publish:bulk).');process.exit(1)}
const port=process.env.MREM_PORT||'3000';
console.log(`${approved} approved courses. Listening on all interfaces, port ${port}.`);
const next=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'start','-H','0.0.0.0','-p',port],{stdio:'inherit'});
next.on('exit',(code)=>process.exit(code??0));
for(const signal of ['SIGINT','SIGTERM','SIGBREAK'])process.on(signal,()=>next.kill(signal));
