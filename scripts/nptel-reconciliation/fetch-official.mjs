/** Phase E: fetch official NPTEL records for every local course ID, with a resumable per-ID cache.
 *   node --env-file=.env.local scripts/nptel-reconciliation/fetch-official.mjs --cache C:\MREM\inventory\nptel-reconciliation\web-cache
 * Sources (nptel.ac.in robots.txt allows all paths):
 *   https://nptel.ac.in/courses                    full catalogue (fetched once per run)
 *   https://nptel.ac.in/courses/{id}/__data.json   course outline: title, professor, institute, units and lessons
 *   https://nptel.ac.in/api/downloads/{id}         official lecture list, with MP4 file URLs where published
 * Read-only for the database; course IDs come from the indexed inventory (resources and folders).
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import pg from 'pg';
import {BASE,parseOutline,parseCatalogue} from './official.mjs';

const {values:opt}=parseArgs({options:{cache:{type:'string',default:'C:/MREM/inventory/nptel-reconciliation/web-cache'},
 ids:{type:'string'},'delay-ms':{type:'string',default:'700'},refresh:{type:'boolean',default:false}}});
const UA='MREM-Digital-Library catalogue verification (college archive; contact library admin)';
const delay=Math.max(300,Number(opt['delay-ms'])||700);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function get(url,{json=true}={}){
 let last;
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const res=await fetch(url,{headers:{'user-agent':UA,accept:json?'application/json':'text/html'},signal:AbortSignal.timeout(45000)});
   const body=await res.text();
   if(res.status>=500||res.status===429)throw Error('HTTP '+res.status);
   return {status:res.status,body};
  }catch(e){last=e;await sleep(delay*attempt*3)}
 }
 return {status:0,error:String(last).slice(0,200)};
}
async function localIds(){
 if(opt.ids)return fs.readFileSync(opt.ids,'utf8').split(/\s+/).filter(x=>/^\d{9}$/.test(x));
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required (or --ids file)');
 const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
 try{
  await db.query('BEGIN READ ONLY');
  const r=await db.query("SELECT course_code AS id FROM resources WHERE course_code ~ '^[0-9]{9}$' UNION "+
   "SELECT name FROM folders WHERE name ~ '^[0-9]{9}$' ORDER BY 1");
  await db.query('COMMIT');
  return r.rows.map(x=>x.id);
 }finally{await db.end()}
}

{
 fs.mkdirSync(opt.cache,{recursive:true});
 const ids=await localIds();
 console.log('Local course IDs to verify: '+ids.length);
 const catFile=path.join(opt.cache,'_official-catalogue.json');
 if(opt.refresh||!fs.existsSync(catFile)){
  const r=await get(BASE+'/courses',{json:false});
  if(r.status!==200)throw Error('Official catalogue unavailable: '+(r.status||r.error));
  const cat=parseCatalogue(r.body);
  if(cat.count<1000)throw Error('Official catalogue parse looks wrong: '+cat.count+' courses');
  fs.writeFileSync(catFile,JSON.stringify({fetched_at:new Date().toISOString(),url:BASE+'/courses',...cat}));
  console.log('Official catalogue: '+cat.count+' courses');
 }
 let done=0,fetched=0;
 for(const id of ids){
  const file=path.join(opt.cache,id+'.json');
  if(!opt.refresh&&fs.existsSync(file)){
   const prev=JSON.parse(fs.readFileSync(file,'utf8'));
   if(prev.outline_http&&prev.downloads_http){done++;continue} // checkpoint: complete records are never refetched
  }
  const rec={id,fetched_at:new Date().toISOString(),course_url:BASE+'/courses/'+id,downloads_url:BASE+'/api/downloads/'+id};
  const o=await get(BASE+'/courses/'+id+'/__data.json');await sleep(delay);
  rec.outline_http=o.status;rec.outline_error=o.error||'';
  if(o.status===200){try{rec.outline=parseOutline(o.body)}catch(e){rec.outline={state:'parse-error',message:String(e).slice(0,200)}}}
  const dl=await get(BASE+'/api/downloads/'+id);await sleep(delay);
  rec.downloads_http=dl.status;rec.downloads_error=dl.error||'';
  if(dl.status===200){
   try{const j=JSON.parse(dl.body),dd=j.data||{};
    rec.downloads={message:j.message,title:dd.title||'',lessons:(dd.course_downloads||[]).map(x=>({lesson_id:x.lesson_id,title:x.title,url:x.url||'',mimetype:x.mimetype||''}))};
   }catch(e){rec.downloads={message:'parse-error'}}
  }
  // A transport failure is not cached as complete, so the next run retries it.
  if(!o.status)delete rec.outline_http;if(!dl.status)delete rec.downloads_http;
  fs.writeFileSync(file,JSON.stringify(rec));
  fetched++;done++;
  if(fetched%50===0)console.log('Verified '+done+' of '+ids.length+' course IDs');
 }
 console.log('Done: '+done+' of '+ids.length+' cached ('+fetched+' fetched this run) in '+opt.cache);
}
