/** Generates the department card illustrations (original vector art, one art direction) into public/art/departments.
 *   node scripts/design/department-art.mjs
 * Each image is 640x400, carries no text or department name, and shares the MREM palette and framing so the grid reads
 * as one collection. Subject motifs: see MOTIFS. Accessible names and alt text live in lib/department-art.ts. */
import fs from 'node:fs';
import path from 'node:path';

const C={navy:'#1f2b4d',maroon:'#8a1d48',gold:'#d4a64a',slate:'#5b6b8c',mist:'#c9d2e3',white:'#ffffff',rose:'#e7b7c5'};
const W=640,H=400;
const frame=(a,b,motif)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${C.navy}" opacity=".07"/></pattern>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${C.navy}" flood-opacity=".16"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#dots)"/>
<circle cx="520" cy="70" r="150" fill="#fff" opacity=".28"/><circle cx="90" cy="380" r="120" fill="#fff" opacity=".2"/>
<g filter="url(#soft)">${motif}</g></svg>`;
const line=(pts,stroke,w=6,extra='')=>`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const gear=(cx,cy,r,teeth,fill,hole)=>{let d='';for(let i=0;i<teeth*2;i++){const a=i*Math.PI/teeth,rr=i%2?r:r*1.18;d+=(i?'L':'M')+(cx+rr*Math.cos(a)).toFixed(1)+' '+(cy+rr*Math.sin(a)).toFixed(1)}
 return `<path d="${d}Z" fill="${fill}"/><circle cx="${cx}" cy="${cy}" r="${r*.62}" fill="${fill}" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="${hole}" fill="#fff"/>`};
const hex=(cx,cy,r,stroke,w=5,fill='none')=>`<polygon points="${[0,1,2,3,4,5].map(i=>{const a=Math.PI/3*i+Math.PI/6;return (cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1)}).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;

const MOTIFS={
 computer:['#e8edf7','#f6eef2',`<rect x="150" y="80" width="300" height="200" rx="18" fill="${C.navy}"/><rect x="168" y="112" width="264" height="150" rx="8" fill="#26365f"/>
  <circle cx="176" cy="96" r="5" fill="${C.rose}"/><circle cx="192" cy="96" r="5" fill="${C.gold}"/><circle cx="208" cy="96" r="5" fill="${C.mist}"/>
  ${line('196,150 176,172 196,194',C.gold,7)}${line('256,150 276,172 256,194',C.gold,7)}<rect x="300" y="140" width="110" height="10" rx="5" fill="${C.mist}"/>
  <rect x="300" y="166" width="80" height="10" rx="5" fill="${C.rose}"/><rect x="300" y="192" width="96" height="10" rx="5" fill="${C.mist}"/><rect x="190" y="226" width="180" height="10" rx="5" fill="#3b4c78"/>
  <rect x="440" y="230" width="90" height="90" rx="12" fill="${C.maroon}"/><rect x="458" y="248" width="54" height="54" rx="6" fill="#a8375f"/>
  ${[0,1,2,3].map(i=>`<rect x="${448+i*20}" y="318" width="8" height="18" rx="3" fill="${C.slate}"/><rect x="${448+i*20}" y="214" width="8" height="18" rx="3" fill="${C.slate}"/>`).join('')}`],
 ai:['#ecebf8','#f4eef3',`${(()=>{const L=[[150,[110,200,290]],[300,[80,160,240,320]],[450,[130,250]]];let s='';
  for(let i=0;i<L.length-1;i++)for(const a of L[i][1])for(const b of L[i+1][1])s+=`<line x1="${L[i][0]}" y1="${a}" x2="${L[i+1][0]}" y2="${b}" stroke="${C.slate}" stroke-width="3" opacity=".55"/>`;
  L.forEach(([x,ys],i)=>ys.forEach((y,j)=>{s+=`<circle cx="${x}" cy="${y}" r="${i===1?20:24}" fill="${i===2?C.maroon:i===1?C.navy:'#fff'}" stroke="${C.navy}" stroke-width="5"/>`;if(i===1&&j===1)s+=`<circle cx="${x}" cy="${y}" r="8" fill="${C.gold}"/>`}));return s})()}
  <rect x="490" y="160" width="80" height="80" rx="16" fill="#fff" stroke="${C.navy}" stroke-width="5"/><circle cx="530" cy="200" r="18" fill="none" stroke="${C.maroon}" stroke-width="6"/><circle cx="530" cy="200" r="6" fill="${C.navy}"/>`],
 electronics:['#e6f0ee','#eef0f7',`<rect x="120" y="70" width="400" height="260" rx="22" fill="#1d5b55"/>
  ${line('150,120 240,120 270,150 330,150',C.gold,5)}${line('150,280 230,280 260,250 330,250',C.gold,5)}${line('490,110 420,110 400,130 400,170',C.gold,5)}${line('490,300 430,300 410,280 410,230',C.gold,5)}
  ${line('200,200 260,200',C.gold,5)}${line('380,200 470,200',C.gold,5)}
  ${[[150,120],[150,280],[490,110],[490,300],[200,200],[470,200]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="#fff"/><circle cx="${x}" cy="${y}" r="4" fill="${C.gold}"/>`).join('')}
  <rect x="260" y="140" width="120" height="120" rx="12" fill="${C.navy}"/><rect x="282" y="162" width="76" height="76" rx="6" fill="#2d3d68"/><circle cx="320" cy="200" r="14" fill="${C.gold}"/>
  ${[0,1,2,3,4].map(i=>`<rect x="${270+i*22}" y="126" width="8" height="14" rx="2" fill="#cfd8d6"/><rect x="${270+i*22}" y="260" width="8" height="14" rx="2" fill="#cfd8d6"/>`).join('')}`],
 electrical:['#eef1f8','#f8f1e8',`${line('230,330 270,90 310,330',C.navy,9)}${line('250,210 290,210',C.navy,7)}${line('243,250 297,250',C.navy,7)}${line('258,160 282,160',C.navy,7)}
  ${line('200,130 340,130',C.navy,8)}${line('215,170 325,170',C.navy,6)}${line('250,210 290,250',C.slate,4)}${line('290,210 250,250',C.slate,4)}
  <path d="M340 130 Q420 160 500 150" fill="none" stroke="${C.slate}" stroke-width="4"/><path d="M200 130 Q140 150 90 140" fill="none" stroke="${C.slate}" stroke-width="4"/>
  <path d="M470 180 L430 260 L462 260 L440 330 L510 235 L476 235 L500 180 Z" fill="${C.gold}" stroke="${C.maroon}" stroke-width="5" stroke-linejoin="round"/>`],
 mechanical:['#eef0f4','#f6efe9',`${gear(255,200,78,12,C.navy,26)}${gear(392,150,52,10,C.maroon,18)}${gear(410,285,40,9,C.slate,14)}
  <circle cx="255" cy="200" r="10" fill="${C.gold}"/>`],
 civil:['#e9eef6','#f3efe7',`<rect x="80" y="300" width="480" height="16" rx="6" fill="${C.navy}"/><rect x="170" y="110" width="22" height="200" rx="5" fill="${C.navy}"/><rect x="448" y="110" width="22" height="200" rx="5" fill="${C.navy}"/>
  <path d="M80 270 Q181 110 181 110 Q320 260 459 110 Q459 110 560 270" fill="none" stroke="${C.maroon}" stroke-width="7"/>
  ${[220,260,300,340,380,420].map(x=>{const t=(x-181)/278,y=110+ (1-Math.pow(2*t-1,2))*130;return `<line x1="${x}" y1="${y.toFixed(0)}" x2="${x}" y2="300" stroke="${C.slate}" stroke-width="3"/>`}).join('')}
  <rect x="80" y="292" width="480" height="10" fill="${C.gold}"/><path d="M60 340 Q200 320 320 340 T580 340" fill="none" stroke="${C.mist}" stroke-width="10" stroke-linecap="round"/>`],
 aerospace:['#e7ecf7','#f2eef6',`<path d="M120 320 Q250 300 330 210 Q390 140 470 110" fill="none" stroke="${C.mist}" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/>
  <g transform="translate(410 190) rotate(40) scale(1.45)"><path d="M0 -110 C28 -80 32 -30 30 40 L-30 40 C-32 -30 -28 -80 0 -110Z" fill="#fff" stroke="${C.navy}" stroke-width="6"/>
  <circle cx="0" cy="-40" r="14" fill="${C.navy}"/><circle cx="0" cy="-40" r="7" fill="${C.gold}"/><path d="M-30 10 L-58 52 L-30 46Z" fill="${C.maroon}"/><path d="M30 10 L58 52 L30 46Z" fill="${C.maroon}"/>
  <path d="M-18 44 L0 92 L18 44Z" fill="${C.gold}"/></g><circle cx="200" cy="120" r="5" fill="${C.navy}"/><circle cx="160" cy="180" r="3" fill="${C.navy}"/><circle cx="540" cy="300" r="4" fill="${C.navy}"/>`],
 chemical:['#eaf1f4','#f5efe9',`<rect x="120" y="150" width="120" height="170" rx="18" fill="#fff" stroke="${C.navy}" stroke-width="6"/><rect x="128" y="230" width="104" height="82" rx="12" fill="${C.maroon}" opacity=".85"/>
  ${line('240,190 330,190 330,140 420,140',C.slate,10)}<path d="M400 120 L400 160 L380 160 L370 300 Q370 320 390 320 L490 320 Q510 320 510 300 L500 160 L480 160 L480 120Z" fill="#fff" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M376 250 L504 250 L508 300 Q508 314 494 314 L386 314 Q372 314 372 300Z" fill="${C.gold}" opacity=".85"/><circle cx="420" cy="230" r="8" fill="${C.gold}"/><circle cx="455" cy="210" r="6" fill="${C.gold}"/><circle cx="175" cy="210" r="7" fill="${C.rose}"/>`],
 chemistry:['#f0eef7','#f6efe9',`${hex(300,200,70,C.navy,8)}${hex(300,200,48,C.slate,4)}
  ${[0,1,2,3,4,5].map(i=>{const a=Math.PI/3*i+Math.PI/6,x=300+70*Math.cos(a),y=200+70*Math.sin(a),x2=300+125*Math.cos(a),y2=200+125*Math.sin(a);return `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${C.navy}" stroke-width="6"/><circle cx="${x2.toFixed(0)}" cy="${y2.toFixed(0)}" r="${i%2?16:22}" fill="${i%3===0?C.maroon:i%3===1?C.gold:'#fff'}" stroke="${C.navy}" stroke-width="5"/>`}).join('')}`],
 biotech:['#e8f2ee','#f3eef4',`${(()=>{let s='';for(let i=0;i<=12;i++){const y=70+i*22,x1=320+70*Math.sin(i/12*Math.PI*2),x2=320-70*Math.sin(i/12*Math.PI*2);
  s+=`<line x1="${x1.toFixed(0)}" y1="${y}" x2="${x2.toFixed(0)}" y2="${y}" stroke="${i%2?C.gold:C.rose}" stroke-width="6" stroke-linecap="round"/>`}
  const p=(sgn)=>Array.from({length:49},(_,k)=>{const t=k/48;return (320+sgn*70*Math.sin(t*Math.PI*2)).toFixed(1)+','+(70+t*264).toFixed(1)}).join(' ');
  return s+line(p(1),C.navy,9)+line(p(-1),C.maroon,9)})()}<circle cx="470" cy="120" r="30" fill="#fff" stroke="${C.navy}" stroke-width="5"/><circle cx="462" cy="114" r="8" fill="${C.maroon}"/><circle cx="480" cy="128" r="6" fill="${C.gold}"/>`],
 physics:['#e9edf8','#f5eef1',`<ellipse cx="320" cy="200" rx="160" ry="56" fill="none" stroke="${C.navy}" stroke-width="7"/><ellipse cx="320" cy="200" rx="160" ry="56" fill="none" stroke="${C.maroon}" stroke-width="7" transform="rotate(60 320 200)"/>
  <ellipse cx="320" cy="200" rx="160" ry="56" fill="none" stroke="${C.slate}" stroke-width="7" transform="rotate(-60 320 200)"/><circle cx="320" cy="200" r="26" fill="${C.gold}" stroke="${C.navy}" stroke-width="5"/>
  <circle cx="480" cy="200" r="12" fill="${C.navy}"/><circle cx="240" cy="62" r="12" fill="${C.maroon}"/><circle cx="240" cy="338" r="12" fill="${C.slate}"/>`],
 mathematics:['#eef0f8','#f7f0ea',`${line('130,320 520,320',C.navy,6)}${line('150,340 150,70',C.navy,6)}
  <path d="M150 300 C220 300 240 120 310 140 S420 300 500 110" fill="none" stroke="${C.maroon}" stroke-width="8" stroke-linecap="round"/>
  <path d="M150 260 Q330 260 500 160" fill="none" stroke="${C.gold}" stroke-width="6" stroke-dasharray="14 12" stroke-linecap="round"/>
  ${[[230,236],[310,140],[410,232],[500,110]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${C.navy}" stroke-width="4"/>`).join('')}
  ${[200,260,320,380,440,500].map(x=>`<line x1="${x}" y1="314" x2="${x}" y2="326" stroke="${C.navy}" stroke-width="4"/>`).join('')}`],
 management:['#edf0f6','#f6efe8',`${[[170,240,70],[240,190,120],[310,150,160],[380,110,200],[450,170,140]].map(([x,y,h],i)=>`<rect x="${x}" y="${y}" width="46" height="${310-y}" rx="8" fill="${i===3?C.maroon:i%2?C.navy:C.slate}"/>`).join('')}
  <rect x="140" y="310" width="380" height="10" rx="5" fill="${C.navy}"/>${line('170,220 260,170 330,190 420,100 500,80',C.gold,7)}<path d="M500 80 L478 76 L494 98Z" fill="${C.gold}"/>`],
 humanities:['#f4efe7','#eef0f7',`<path d="M320 120 Q250 90 150 100 L150 300 Q250 290 320 320Z" fill="#fff" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M320 120 Q390 90 490 100 L490 300 Q390 290 320 320Z" fill="#fff" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/>
  ${[140,170,200,230].map(y=>`<line x1="180" y1="${y}" x2="290" y2="${y+6}" stroke="${C.mist}" stroke-width="7" stroke-linecap="round"/><line x1="350" y1="${y+6}" x2="460" y2="${y}" stroke="${C.mist}" stroke-width="7" stroke-linecap="round"/>`).join('')}
  <path d="M400 60 Q460 40 500 70 Q530 100 490 120 L470 140 L470 118 Q420 118 400 95 Q385 75 400 60Z" fill="${C.maroon}"/><circle cx="428" cy="88" r="5" fill="#fff"/><circle cx="448" cy="88" r="5" fill="#fff"/><circle cx="468" cy="88" r="5" fill="#fff"/>`],
 metallurgy:['#eceff4','#f5efe8',`${(()=>{const P=[[230,140],[370,140],[230,280],[370,280],[290,100],[430,100],[290,240],[430,240]];
  const E=[[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]];
  return E.map(([a,b])=>`<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="${C.navy}" stroke-width="6"/>`).join('')+
  P.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i<4?20:16}" fill="${i%3===0?C.maroon:i%3===1?C.gold:C.slate}" stroke="#fff" stroke-width="4"/>`).join('')+`<circle cx="330" cy="190" r="22" fill="#fff" stroke="${C.navy}" stroke-width="5"/>`})()}`],
 ocean:['#e4eef6','#eff1f7',`<path d="M300 110 L300 250" stroke="${C.navy}" stroke-width="8"/><path d="M300 115 L380 210 L300 210Z" fill="#fff" stroke="${C.navy}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M296 130 L240 210 L296 210Z" fill="${C.maroon}"/><path d="M220 240 L390 240 L360 285 L250 285Z" fill="${C.navy}"/>
  ${[0,1,2].map(i=>`<path d="M80 ${300+i*28} Q140 ${282+i*28} 200 ${300+i*28} T320 ${300+i*28} T440 ${300+i*28} T560 ${300+i*28}" fill="none" stroke="${i===1?C.gold:'#5f8fb5'}" stroke-width="7" stroke-linecap="round"/>`).join('')}`],
 textile:['#f4eef0','#eef1f7',`${[0,1,2,3,4,5,6].map(i=>`<path d="M${150+i*50} 80 L${150+i*50} 320" stroke="${i%2?C.maroon:C.navy}" stroke-width="16" stroke-linecap="round"/>`).join('')}
  ${[0,1,2,3,4].map(i=>`<path d="M120 ${110+i*50} ${[0,1,2,3,4,5,6].map(j=>`L${150+j*50} ${110+i*50+((i+j)%2?-7:7)}`).join(' ')} L480 ${110+i*50}" fill="none" stroke="${i%2?C.gold:'#fff'}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}`],
 mining:['#eef0f3','#f5eee7',`<path d="M80 330 L230 120 L320 220 L400 150 L560 330Z" fill="${C.slate}"/><path d="M230 120 L270 176 L248 168 L230 190 L212 160Z" fill="#fff" opacity=".7"/>
  <path d="M290 330 L290 270 Q320 240 350 270 L350 330Z" fill="${C.navy}"/>${line('250,330 390,330',C.gold,6)}
  <rect x="410" y="270" width="80" height="44" rx="6" fill="${C.maroon}"/><circle cx="428" cy="320" r="10" fill="${C.navy}"/><circle cx="472" cy="320" r="10" fill="${C.navy}"/>
  <path d="M415 270 L430 252 L470 252 L485 270Z" fill="${C.gold}"/>`],
 architecture:['#f2eee8','#eceff6',`<rect x="150" y="150" width="340" height="170" fill="#fff" stroke="${C.navy}" stroke-width="6"/><path d="M130 150 L320 70 L510 150Z" fill="${C.maroon}"/>
  ${[0,1,2,3].map(i=>`<path d="M${180+i*80} 320 L${180+i*80} 230 Q${210+i*80} 190 ${240+i*80} 230 L${240+i*80} 320Z" fill="${i%2?C.mist:'#dfe6f2'}" stroke="${C.navy}" stroke-width="4"/>`).join('')}
  <rect x="130" y="320" width="380" height="14" fill="${C.navy}"/><circle cx="320" cy="118" r="14" fill="${C.gold}"/>`],
 agriculture:['#ecf3e8','#f6f0e6',`${[0,1,2,3].map(i=>`<path d="M${60+i*20} ${330-i*30} Q320 ${250-i*30} ${580-i*20} ${330-i*30}" fill="none" stroke="${i%2?'#7aa361':'#5b8a4a'}" stroke-width="12" stroke-linecap="round"/>`).join('')}
  <path d="M400 70 Q500 80 500 170 Q420 180 400 70Z" fill="#5b8a4a"/><path d="M405 78 Q450 120 492 162" stroke="#fff" stroke-width="4" fill="none"/>
  <path d="M300 230 L300 120" stroke="${C.navy}" stroke-width="6"/><path d="M300 150 Q260 130 250 100 Q290 110 300 150Z" fill="${C.gold}"/><path d="M300 175 Q340 155 350 125 Q310 135 300 175Z" fill="${C.gold}"/><circle cx="170" cy="100" r="34" fill="${C.gold}" opacity=".9"/>`],
 atmosphere:['#e6eef8','#f6f0e8',`<circle cx="230" cy="140" r="50" fill="${C.gold}"/>${[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return `<line x1="${(230+66*Math.cos(a)).toFixed(0)}" y1="${(140+66*Math.sin(a)).toFixed(0)}" x2="${(230+86*Math.cos(a)).toFixed(0)}" y2="${(140+86*Math.sin(a)).toFixed(0)}" stroke="${C.gold}" stroke-width="7" stroke-linecap="round"/>`}).join('')}
  <path d="M260 280 Q240 220 300 210 Q320 160 380 175 Q430 150 460 200 Q520 205 510 260 Q510 290 470 290 L290 290 Q260 290 260 280Z" fill="#fff" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/>
  ${line('120,320 280,320',C.slate,6)}${line('150,345 360,345',C.maroon,6)}${line('330,320 520,320',C.slate,6)}`],
 nano:['#ecedf8','#f3eef3',`${(()=>{let s='';for(let r=0;r<4;r++)for(let c=0;c<5;c++){const x=170+c*72+(r%2)*36,y=95+r*62;s+=hex(x,y,36,r===1&&c===2?C.maroon:C.navy,5,r===1&&c===2?'#f3d5df':'none')}return s})()}
  <circle cx="350" cy="157" r="12" fill="${C.gold}"/>`],
 design:['#eef0f7','#f6efe8',`<rect x="130" y="90" width="380" height="240" rx="14" fill="#fff" stroke="${C.navy}" stroke-width="6"/>
  ${[0,1,2,3,4,5,6,7].map(i=>`<line x1="${170+i*45}" y1="100" x2="${170+i*45}" y2="320" stroke="${C.mist}" stroke-width="2"/>`).join('')}
  <path d="M190 290 L330 150 L330 290Z" fill="none" stroke="${C.maroon}" stroke-width="7" stroke-linejoin="round"/><circle cx="420" cy="200" r="70" fill="none" stroke="${C.slate}" stroke-width="5" stroke-dasharray="10 10"/>
  <path d="M420 120 L380 290 M420 120 L460 290" stroke="${C.navy}" stroke-width="7" stroke-linecap="round"/><circle cx="420" cy="118" r="12" fill="${C.gold}" stroke="${C.navy}" stroke-width="4"/>`],
 general:['#ecf0f7','#f6eff1',`<circle cx="320" cy="200" r="120" fill="#fff" stroke="${C.navy}" stroke-width="7"/><ellipse cx="320" cy="200" rx="50" ry="120" fill="none" stroke="${C.slate}" stroke-width="5"/>
  <path d="M200 200 L440 200 M215 140 L425 140 M215 260 L425 260" stroke="${C.slate}" stroke-width="5"/>
  ${[[180,110],[470,120],[200,320],[470,300],[320,60]].map(([x,y],i)=>`<line x1="${x}" y1="${y}" x2="320" y2="200" stroke="${C.maroon}" stroke-width="3" opacity=".5"/><circle cx="${x}" cy="${y}" r="15" fill="${i%2?C.gold:C.maroon}" stroke="#fff" stroke-width="4"/>`).join('')}`]
};
const out=path.join(path.dirname(new URL(import.meta.url).pathname),'../../public/art/departments');
fs.mkdirSync(out,{recursive:true});
for(const [k,[a,b,m]] of Object.entries(MOTIFS))fs.writeFileSync(path.join(out,k+'.svg'),frame(a,b,m).replace(/\n\s*/g,''));
console.log('Wrote '+Object.keys(MOTIFS).length+' illustrations to '+out);
