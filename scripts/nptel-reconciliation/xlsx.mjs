/** Minimal .xlsx writer (no dependencies): inline strings, numbers, formulas with cached values, a few fixed styles,
 * frozen header rows, autofilters and column widths. Enough for audit workbooks; not a general spreadsheet library. */
import zlib from 'node:zlib';

export const STYLE={plain:0,header:1,wrap:2,bold:3,good:4,warn:5,bad:6,title:7,section:8,link:9};
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="15"/><name val="Calibri"/></font>
<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8CBAD"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export const colName=(i)=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const esc=(s)=>String(s).slice(0,32000)
 .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'')
 .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** A cell is a string, a number, null, or {v, s, f} (value, style, formula without "="). */
function cellXml(ref,c){
 if(c==null||c==='')return '';
 const o=typeof c==='object'?c:{v:c};
 const s=o.s?` s="${o.s}"`:'';
 if(o.f!=null)return `<c r="${ref}"${s}${typeof o.v==='number'?'':' t="str"'}><f>${esc(o.f)}</f><v>${esc(o.v??'')}</v></c>`;
 if(typeof o.v==='number'&&Number.isFinite(o.v))return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
 if(o.v==null||o.v==='')return s?`<c r="${ref}"${s}/>`:'';
 return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
}

/** sheet: {name, rows: cell[][], widths?: number[], headerRow?: 1-based row of the table header (freeze + filter), filterCols?} */
function sheetXml(sh){
 const rows=sh.rows,width=Math.max(1,...rows.map(r=>r.length));
 const views=sh.headerRow?`<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.headerRow}" topLeftCell="A${sh.headerRow+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`:'<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
 const cols=sh.widths?'<cols>'+sh.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>':'';
 const data=rows.map((r,i)=>`<row r="${i+1}">${r.map((c,j)=>cellXml(colName(j)+(i+1),c)).join('')}</row>`).join('');
 const filter=sh.headerRow&&rows.length>sh.headerRow?`<autoFilter ref="A${sh.headerRow}:${colName(width-1)}${rows.length}"/>`:'';
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${data}</sheetData>${filter}</worksheet>`;
}

const CRC=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c});
const crc32=(b)=>{let c=-1;for(const x of b)c=CRC[(c^x)&0xFF]^(c>>>8);return (c^-1)>>>0};
function zip(files){
 const out=[],dir=[];let off=0;
 for(const {name,data} of files){
  const n=Buffer.from(name,'utf8'),body=zlib.deflateRawSync(data,{level:6}),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x0800,6);h.writeUInt16LE(8,8);
  h.writeUInt16LE(0,10);h.writeUInt16LE(0x21,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
  const d=Buffer.alloc(46);d.writeUInt32LE(0x02014b50,0);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(0x0800,8);d.writeUInt16LE(8,10);
  d.writeUInt16LE(0,12);d.writeUInt16LE(0x21,14);d.writeUInt32LE(crc,16);d.writeUInt32LE(body.length,20);d.writeUInt32LE(data.length,24);d.writeUInt16LE(n.length,28);
  d.writeUInt32LE(off,42);
  out.push(h,n,body);dir.push(d,n);off+=30+n.length+body.length;
 }
 const cd=Buffer.concat(dir),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(files.length,8);e.writeUInt16LE(files.length,10);
 e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);
 return Buffer.concat([...out,cd,e]);
}

/** Read a .xlsx (zip) without dependencies: returns [{name, rows: string[][]}] for every worksheet, cell text only. */
export function readXlsx(buf){
 const files=new Map();let e=buf.length-22;while(e>=0&&buf.readUInt32LE(e)!==0x06054b50)e--;
 if(e<0)throw Error('not a zip file');
 for(let p=buf.readUInt32LE(e+16),n=buf.readUInt16LE(e+10);n--;){
  const method=buf.readUInt16LE(p+10),size=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),xl=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
  const name=buf.toString('utf8',p+46,p+46+nl),start=off+30+buf.readUInt16LE(off+26)+buf.readUInt16LE(off+28),data=buf.subarray(start,start+size);
  files.set(name,(method===8?zlib.inflateRawSync(data):data).toString('utf8'));p+=46+nl+xl+cl;
 }
 const unx=(s)=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
 const text=(x)=>unx([...x.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m=>m[1]).join(''));
 const shared=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>text(m[1]));
 const rels=new Map([...(files.get('xl/_rels/workbook.xml.rels')||'').matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m=>[m[1],m[2].replace(/^\/?(xl\/)?/,'xl/')]));
 return [...(files.get('xl/workbook.xml')||'').matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(([,name,rid])=>{
  const xml=files.get(rels.get(rid))||'',rows=[];
  for(const [,r] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
   const row=[];
   for(const [,ref,attrs,body] of r.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    let col=0;for(const ch of ref)col=col*26+ch.charCodeAt(0)-64;
    const v=(/<v>([^<]*)<\/v>/.exec(body||'')||[])[1];
    row[col-1]=/t="s"/.test(attrs)?shared[Number(v)]??'':/t="inlineStr"/.test(attrs)?text(body||''):unx(v??'');
   }
   rows.push(Array.from(row,(x)=>x??''));
  }
  return {name:unx(name),rows};
 });
}

export function workbook(sheets){
 const names=sheets.map(s=>s.name);
 if(names.some(n=>n.length>31||/[\\/?*[\]:]/.test(n))||new Set(names).size!==names.length)throw Error('bad sheet names: '+names.join(', '));
 const q=(n)=>"'"+n.replace(/'/g,"''")+"'";
 const defined=sheets.map((s,i)=>s.headerRow&&s.rows.length>s.headerRow
  ?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${q(s.name)}!$A$${s.headerRow}:$${colName(Math.max(...s.rows.map(r=>r.length))-1)}$${s.rows.length}</definedName>`:'').join('');
 const files=[
  ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>${defined?'<definedNames>'+defined+'</definedNames>':''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml',STYLES],
  ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(s)])];
 return zip(files.map(([name,xml])=>({name,data:Buffer.from(xml,'utf8')})));
}
