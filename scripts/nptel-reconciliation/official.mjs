/** Parsers for official NPTEL data (nptel.ac.in). Pure functions; page scripts are never executed. */
export const BASE='https://nptel.ac.in';
/** SvelteKit __data.json uses devalue's flat encoding: values reference other entries by index. */
export function unflatten(arr){
 const seen=new Map();
 const hyd=(i)=>{
  if(i===-1)return undefined;if(i===-2||i===-3)return null;if(i<0)return null;
  if(seen.has(i))return seen.get(i);
  const v=arr[i];
  if(Array.isArray(v)){const out=[];seen.set(i,out);for(const x of v)out.push(hyd(x));return out}
  if(v&&typeof v==='object'){const out={};seen.set(i,out);for(const [k,x] of Object.entries(v))out[k]=hyd(x);return out}
  return v;
 };
 return hyd(0);
}
export function parseOutline(body){
 const j=JSON.parse(body),node=(j.nodes||[]).find(n=>n&&(n.type==='data'||n.type==='error'));
 if(!node)return {state:'no-data'};
 if(node.type==='error')return {state:'error',message:node.error?.message||''};
 const o=unflatten(node.data)?.courseOutline;
 if(!o)return {state:'no-outline'};
 return {state:'ok',title:o.title,professor:o.professor,institute:o.instituteName,coordinatingInstitute:o.nocCoordinatingInstitute,
  contentType:o.contentType,nocCourse:o.nocCourse,currentRun:o.currentRun,
  units:(o.units||[]).map(u=>({id:u.id,name:u.name,lessons:(u.lessons||[]).map(l=>({id:l.id,name:l.name}))}))};
}
/** Catalogue records are embedded as JS object literals in the /courses page; parsed by pattern, never executed. */
export function parseCatalogue(html){
 const d=html.slice(Math.max(0,html.indexOf('data: [null,{type:"data",data:{courses:[')));
 const S='"((?:\\\\.|[^"\\\\])*)"';
 const J=(s)=>JSON.parse('"'+s+'"');
 const pat=new RegExp('\\{id:(\\d+),title:'+S+',instituteName:'+S+',professor:'+S+',instituteLogo:'+S+',contentType:'+S+
  ',noccourse:(true|false),currentRun:(true|false|null),selfPaced:(true|false|null),disciplineId:(\\d+),instituteId:'+S+'\\}','g');
 const listAt=(name)=>{const i=d.indexOf(name+':[');return i<0?'':d.slice(i,d.indexOf(']',i))};
 const named=(name)=>Object.fromEntries([...listAt(name).matchAll(new RegExp('\\{id:"(\\d+)",name:'+S+'\\}','g'))].map(m=>[m[1],J(m[2])]));
 const disciplines=named('disciplines');
 const courses={};
 for(const m of d.matchAll(pat))courses[m[1]]={id:m[1],title:J(m[2]),institute:J(m[3]),professor:J(m[4]),contentType:m[6],
  disciplineId:m[10],discipline:disciplines[m[10]]||''};
 return {courses,disciplines,count:Object.keys(courses).length};
}
