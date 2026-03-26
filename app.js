/* ===== NAVIGATION ===== */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tool-' + btn.dataset.tool).classList.add('active');
  });
});

/* ===== UTILITIES ===== */
function setStatus(id, msg, type='') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'statusbar' + (type ? ' ' + type : '');
}
function $(id) { return document.getElementById(id); }
function copyText(text, statusId, msg='Copied!') {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  if (statusId) setStatus(statusId, msg, 'ok');
}
function copyEl(id) {
  copyText($(''+id).textContent || $(''+id).innerText);
}

/* ================================================
   1. JSON FORMATTER
================================================ */
function jsonFormat() {
  const raw = $('json-in').value.trim();
  if (!raw) return setStatus('json-status','Nothing to format.');
  try {
    const parsed = JSON.parse(raw);
    $('json-out').textContent = JSON.stringify(parsed, null, 2);
    setStatus('json-status', `Valid JSON · ${JSON.stringify(parsed,null,2).split('\n').length} lines`, 'ok');
  } catch(e) { $('json-out').textContent=''; setStatus('json-status','Invalid JSON: '+e.message,'err'); }
}
function jsonMinify() {
  const raw = $('json-in').value.trim();
  try { $('json-out').textContent = JSON.stringify(JSON.parse(raw)); setStatus('json-status','Minified','ok'); } catch(e) { setStatus('json-status',e.message,'err'); }
}
function jsonSort() {
  const raw = $('json-in').value.trim();
  try {
    const sort = obj => {
      if (Array.isArray(obj)) return obj.map(sort);
      if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(Object.keys(obj).sort().map(k => [k, sort(obj[k])]));
      }
      return obj;
    };
    $('json-out').textContent = JSON.stringify(sort(JSON.parse(raw)), null, 2);
    setStatus('json-status','Keys sorted','ok');
  } catch(e) { setStatus('json-status',e.message,'err'); }
}
function jsonCopy() { const t=$('json-out').textContent; if(t) copyText(t,'json-status','Output copied!'); }
function jsonClear() { $('json-in').value=''; $('json-out').textContent=''; setStatus('json-status',''); }
$('json-in').addEventListener('input', () => {
  const v=$('json-in').value.trim(); if(!v) return;
  try { JSON.parse(v); setStatus('json-status','Valid JSON','ok'); } catch(e) { setStatus('json-status',e.message,'err'); }
});

/* ================================================
   2. XML FORMATTER
================================================ */
function xmlFormat() {
  const raw = $('xml-in').value.trim();
  if (!raw) return setStatus('xml-status','Nothing to format.');
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) { setStatus('xml-status', 'XML Error: ' + err.textContent.split('\n')[0], 'err'); return; }
    $('xml-out').textContent = formatXML(raw);
    setStatus('xml-status', 'Valid XML', 'ok');
  } catch(e) { setStatus('xml-status', e.message, 'err'); }
}
function formatXML(xml) {
  let formatted = '', indent = '';
  const lines = xml.replace(/>\s*</g,'>\n<').split('\n');
  lines.forEach(line => {
    if (line.match(/^<\/\w/)) indent = indent.slice(2);
    formatted += indent + line.trim() + '\n';
    if (line.match(/^<\w[^>]*[^\/]>.*$/) && !line.match(/<.*>.*<\/.*>/)) indent += '  ';
  });
  return formatted.trim();
}
function xmlMinify() {
  const raw = $('xml-in').value.trim();
  $('xml-out').textContent = raw.replace(/>\s+</g,'><').replace(/\s+/g,' ').trim();
  setStatus('xml-status','Minified','ok');
}
function xmlCopy() { copyText($('xml-out').textContent,'xml-status','Output copied!'); }
function xmlClear() { $('xml-in').value=''; $('xml-out').textContent=''; setStatus('xml-status',''); }

/* ================================================
   3. YAML ↔ JSON
================================================ */
// Minimal YAML parser/serializer
const YAML = (() => {
  function parse(text) {
    const lines = text.split('\n');
    function parseValue(val) {
      val = val.trim();
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (val === 'null' || val === '~') return null;
      if (/^-?\d+$/.test(val)) return parseInt(val);
      if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) return val.slice(1,-1);
      return val;
    }
    function getIndent(line) { return line.match(/^(\s*)/)[1].length; }
    function parseBlock(lines, baseIndent) {
      const result = {};
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
        const indent = getIndent(line);
        if (indent < baseIndent) break;
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          // array
          const arr = [];
          while (i < lines.length && lines[i].trim().startsWith('- ')) {
            arr.push(parseValue(lines[i].trim().slice(2)));
            i++;
          }
          return arr;
        }
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const rest = trimmed.slice(colonIdx+1).trim();
          if (rest) {
            result[key] = parseValue(rest);
            i++;
          } else {
            // nested
            const nested = [];
            i++;
            while (i < lines.length && (!lines[i].trim() || getIndent(lines[i]) > indent)) {
              nested.push(lines[i]);
              i++;
            }
            result[key] = parseBlock(nested.map(l => l.slice(indent+2)), 0);
          }
        } else { i++; }
      }
      return result;
    }
    return parseBlock(lines, 0);
  }

  function stringify(obj, indent=0) {
    const pad = '  '.repeat(indent);
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return String(obj);
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') {
      if (obj.includes(':') || obj.includes('#') || obj.includes('\n')) return `"${obj.replace(/"/g,'\\"')}"`;
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => `${pad}- ${stringify(item, indent+1)}`).join('\n');
    }
    if (typeof obj === 'object') {
      return Object.entries(obj).map(([k,v]) => {
        if (typeof v === 'object' && v !== null) return `${pad}${k}:\n${stringify(v, indent+1)}`;
        return `${pad}${k}: ${stringify(v, indent)}`;
      }).join('\n');
    }
    return String(obj);
  }

  return { parse, stringify };
})();

function yamlToJson() {
  const raw = $('yj-in').value.trim();
  if (!raw) return;
  try {
    const obj = YAML.parse(raw);
    $('yj-out').textContent = JSON.stringify(obj, null, 2);
    setStatus('yj-status','Converted YAML → JSON','ok');
  } catch(e) { setStatus('yj-status','Parse error: '+e.message,'err'); }
}
function jsonToYaml() {
  const raw = $('yj-in').value.trim();
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    $('yj-out').textContent = YAML.stringify(obj);
    setStatus('yj-status','Converted JSON → YAML','ok');
  } catch(e) { setStatus('yj-status','Parse error: '+e.message,'err'); }
}
function yjCopy() { copyText($('yj-out').textContent,'yj-status','Output copied!'); }
function yjClear() { $('yj-in').value=''; $('yj-out').textContent=''; setStatus('yj-status',''); }

/* ================================================
   4. CSV ↔ JSON
================================================ */
function csvToJson() {
  const raw = $('csv-in').value.trim();
  if (!raw) return;
  try {
    const lines = raw.split('\n').filter(l=>l.trim());
    const headers = parseCSVRow(lines[0]);
    const result = lines.slice(1).map(line => {
      const vals = parseCSVRow(line);
      const obj = {};
      headers.forEach((h,i) => { obj[h.trim()] = vals[i] !== undefined ? vals[i].trim() : ''; });
      return obj;
    });
    $('csv-out').textContent = JSON.stringify(result, null, 2);
    setStatus('csv-status',`Converted ${result.length} rows · ${headers.length} columns`,'ok');
  } catch(e) { setStatus('csv-status',e.message,'err'); }
}
function parseCSVRow(row) {
  const result = []; let cur = ''; let inQ = false;
  for (let i=0; i<row.length; i++) {
    if (row[i]==='"') { inQ=!inQ; }
    else if (row[i]===',' && !inQ) { result.push(cur); cur=''; }
    else { cur += row[i]; }
  }
  result.push(cur);
  return result;
}
function jsonToCsv() {
  const raw = $('csv-in').value.trim();
  if (!raw) return;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('Expected a JSON array');
    const headers = Object.keys(arr[0]);
    const rows = [headers.join(','), ...arr.map(row => headers.map(h => {
      const v = String(row[h]??'');
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g,'""')}"` : v;
    }).join(','))];
    $('csv-out').textContent = rows.join('\n');
    setStatus('csv-status',`Converted ${arr.length} objects → CSV`,'ok');
  } catch(e) { setStatus('csv-status',e.message,'err'); }
}
function csvCopy() { copyText($('csv-out').textContent,'csv-status','Output copied!'); }
function csvClear() { $('csv-in').value=''; $('csv-out').textContent=''; setStatus('csv-status',''); }

/* ================================================
   5. BASE64
================================================ */
function b64Encode() {
  const raw = $('b64-in').value;
  if (!raw) return;
  try {
    $('b64-out').textContent = btoa(unescape(encodeURIComponent(raw)));
    setStatus('b64-status','Encoded to Base64','ok');
  } catch(e) { setStatus('b64-status',e.message,'err'); }
}
function b64Decode() {
  const raw = $('b64-in').value.trim();
  if (!raw) return;
  try {
    $('b64-out').textContent = decodeURIComponent(escape(atob(raw)));
    setStatus('b64-status','Decoded from Base64','ok');
  } catch(e) { setStatus('b64-status','Invalid Base64: '+e.message,'err'); }
}
function b64Copy() { copyText($('b64-out').textContent,'b64-status','Output copied!'); }
function b64Clear() { $('b64-in').value=''; $('b64-out').textContent=''; setStatus('b64-status',''); }

/* ================================================
   6. HTML FORMATTER
================================================ */
function htmlFormat() {
  const raw = $('html-in').value.trim();
  if (!raw) return;
  let indent = 0;
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tokens = raw.match(/<[^>]+>|[^<]+/g) || [];
  let result = '';
  tokens.forEach(tok => {
    if (tok.startsWith('</')) {
      indent = Math.max(0, indent-1);
      result += '  '.repeat(indent) + tok.trim() + '\n';
    } else if (tok.startsWith('<')) {
      result += '  '.repeat(indent) + tok.trim() + '\n';
      const tagName = tok.match(/<(\w+)/)?.[1]?.toLowerCase();
      if (tagName && !voidTags.has(tagName) && !tok.endsWith('/>') && !tok.startsWith('<!')) indent++;
    } else {
      const t = tok.trim();
      if (t) result += '  '.repeat(indent) + t + '\n';
    }
  });
  $('html-out').textContent = result.trim();
  setStatus('html-status','Formatted HTML','ok');
}
function htmlMinify() {
  const raw = $('html-in').value;
  $('html-out').textContent = raw.replace(/\s+/g,' ').replace(/>\s+</g,'><').trim();
  setStatus('html-status','Minified HTML','ok');
}
function htmlCopy() { copyText($('html-out').textContent,'html-status','Output copied!'); }
function htmlClear() { $('html-in').value=''; $('html-out').textContent=''; setStatus('html-status',''); }

/* ================================================
   7. JWT DECODER
================================================ */
function jwtDecode() {
  const token = $('jwt-in').value.trim();
  if (!token) return setStatus('jwt-status','Paste a JWT token above.');
  const parts = token.split('.');
  if (parts.length !== 3) return setStatus('jwt-status','Invalid JWT: expected 3 dot-separated parts.','err');
  try {
    const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(s.length+((4-s.length%4)%4),'=')))));
    const header = dec(parts[0]);
    const payload = dec(parts[1]);
    $('jwt-header').textContent = JSON.stringify(header,null,2);
    $('jwt-payload').textContent = JSON.stringify(payload,null,2);
    $('jwt-sig').textContent = parts[2];
    $('jwt-parts').style.display = 'grid';
    const exp = $('jwt-expiry');
    if (payload.exp) {
      const d = new Date(payload.exp*1000), expired = d < new Date();
      exp.className = 'badge ' + (expired?'expired':'valid');
      exp.textContent = expired ? `Expired: ${d.toLocaleString()}` : `Valid until: ${d.toLocaleString()}`;
    } else { exp.className='badge noexp'; exp.textContent='No expiry (exp claim absent)'; }
    exp.style.display='block';
    setStatus('jwt-status',`Algorithm: ${header.alg||'?'} · Type: ${header.typ||'?'}  (signature not verified)`,'ok');
  } catch(e) { setStatus('jwt-status','Decode error: '+e.message,'err'); }
}
function jwtClear() { $('jwt-in').value=''; $('jwt-parts').style.display='none'; $('jwt-expiry').style.display='none'; setStatus('jwt-status',''); }

/* ================================================
   8. HASH GENERATOR
================================================ */
async function sha(algo, msg) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function md5(str) {
  function safeAdd(x,y){const l=(x&0xffff)+(y&0xffff);return(((x>>16)+(y>>16)+(l>>16))<<16)|(l&0xffff)}
  function rotL(n,c){return(n<<c)|(n>>>(32-c))}
  function cmn(q,a,b,x,s,t){return safeAdd(rotL(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b)}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t)}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t)}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t)}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t)}
  const bs=unescape(encodeURIComponent(str));
  const m=[];
  for(let i=0;i<bs.length*8;i+=8)m[i>>5]|=(bs.charCodeAt(i/8)&0xff)<<(i%32);
  m[((bs.length*8+64)>>>9<<4)+14]=bs.length*8;
  m[(bs.length*8)>>5]|=0x80<<(bs.length*8%32);
  let[a,b,c,d]=[1732584193,-271733879,-1732584194,271733878];
  for(let i=0;i<m.length;i+=16){
    const[oa,ob,oc,od]=[a,b,c,d];
    a=ff(a,b,c,d,m[i+0],7,-680876936);d=ff(d,a,b,c,m[i+1],12,-389564586);c=ff(c,d,a,b,m[i+2],17,606105819);b=ff(b,c,d,a,m[i+3],22,-1044525330);
    a=ff(a,b,c,d,m[i+4],7,-176418897);d=ff(d,a,b,c,m[i+5],12,1200080426);c=ff(c,d,a,b,m[i+6],17,-1473231341);b=ff(b,c,d,a,m[i+7],22,-45705983);
    a=ff(a,b,c,d,m[i+8],7,1770035416);d=ff(d,a,b,c,m[i+9],12,-1958414417);c=ff(c,d,a,b,m[i+10],17,-42063);b=ff(b,c,d,a,m[i+11],22,-1990404162);
    a=ff(a,b,c,d,m[i+12],7,1804603682);d=ff(d,a,b,c,m[i+13],12,-40341101);c=ff(c,d,a,b,m[i+14],17,-1502002290);b=ff(b,c,d,a,m[i+15],22,1236535329);
    a=gg(a,b,c,d,m[i+1],5,-165796510);d=gg(d,a,b,c,m[i+6],9,-1069501632);c=gg(c,d,a,b,m[i+11],14,643717713);b=gg(b,c,d,a,m[i+0],20,-373897302);
    a=gg(a,b,c,d,m[i+5],5,-701558691);d=gg(d,a,b,c,m[i+10],9,38016083);c=gg(c,d,a,b,m[i+15],14,-660478335);b=gg(b,c,d,a,m[i+4],20,-405537848);
    a=gg(a,b,c,d,m[i+9],5,568446438);d=gg(d,a,b,c,m[i+14],9,-1019803690);c=gg(c,d,a,b,m[i+3],14,-187363961);b=gg(b,c,d,a,m[i+8],20,1163531501);
    a=gg(a,b,c,d,m[i+13],5,-1444681467);d=gg(d,a,b,c,m[i+2],9,-51403784);c=gg(c,d,a,b,m[i+7],14,1735328473);b=gg(b,c,d,a,m[i+12],20,-1926607734);
    a=hh(a,b,c,d,m[i+5],4,-378558);d=hh(d,a,b,c,m[i+8],11,-2022574463);c=hh(c,d,a,b,m[i+11],16,1839030562);b=hh(b,c,d,a,m[i+14],23,-35309556);
    a=hh(a,b,c,d,m[i+1],4,-1530992060);d=hh(d,a,b,c,m[i+4],11,1272893353);c=hh(c,d,a,b,m[i+7],16,-155497632);b=hh(b,c,d,a,m[i+10],23,-1094730640);
    a=hh(a,b,c,d,m[i+13],4,681279174);d=hh(d,a,b,c,m[i+0],11,-358537222);c=hh(c,d,a,b,m[i+3],16,-722521979);b=hh(b,c,d,a,m[i+6],23,76029189);
    a=hh(a,b,c,d,m[i+9],4,-640364487);d=hh(d,a,b,c,m[i+12],11,-421815835);c=hh(c,d,a,b,m[i+15],16,530742520);b=hh(b,c,d,a,m[i+2],23,-995338651);
    a=ii(a,b,c,d,m[i+0],6,-198630844);d=ii(d,a,b,c,m[i+7],10,1126891415);c=ii(c,d,a,b,m[i+14],15,-1416354905);b=ii(b,c,d,a,m[i+5],21,-57434055);
    a=ii(a,b,c,d,m[i+12],6,1700485571);d=ii(d,a,b,c,m[i+3],10,-1894986606);c=ii(c,d,a,b,m[i+10],15,-1051523);b=ii(b,c,d,a,m[i+1],21,-2054922799);
    a=ii(a,b,c,d,m[i+8],6,1873313359);d=ii(d,a,b,c,m[i+15],10,-30611744);c=ii(c,d,a,b,m[i+6],15,-1560198380);b=ii(b,c,d,a,m[i+13],21,1309151649);
    a=ii(a,b,c,d,m[i+4],6,-145523070);d=ii(d,a,b,c,m[i+11],10,-1120210379);c=ii(c,d,a,b,m[i+2],15,718787259);b=ii(b,c,d,a,m[i+9],21,-343485551);
    a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
  }
  return [a,b,c,d].map(n=>{let h='';for(let j=0;j<4;j++)h+=('0'+((n>>>(j*8))&0xff).toString(16)).slice(-2);return h;}).join('');
}
async function genHashes() {
  const input = $('hash-in').value;
  if (!input) return setStatus('hash-status','Enter text above.');
  $('hash-results').innerHTML='<div style="color:var(--text3);padding:8px">Computing...</div>';
  const algos = [
    {name:'MD5', fn:async()=>md5(input)},
    {name:'SHA-1', fn:async()=>sha('SHA-1',input)},
    {name:'SHA-256', fn:async()=>sha('SHA-256',input)},
    {name:'SHA-384', fn:async()=>sha('SHA-384',input)},
    {name:'SHA-512', fn:async()=>sha('SHA-512',input)},
  ];
  const container = $('hash-results'); container.innerHTML='';
  for (const a of algos) {
    const val = await a.fn();
    const row = document.createElement('div');
    row.className='hash-row';
    row.innerHTML=`<div class="hash-algo">${a.name}</div><div class="hash-val">${val}</div><button class="hash-cp" onclick="this.textContent='✓';copyText('${val}');setTimeout(()=>this.textContent='Copy',1500)">Copy</button>`;
    container.appendChild(row);
  }
  setStatus('hash-status',`5 hashes generated`,'ok');
}
function hashClear() { $('hash-in').value=''; $('hash-results').innerHTML=''; setStatus('hash-status',''); }

/* ================================================
   9. PASSWORD GENERATOR
================================================ */
const CHARS = {upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',lower:'abcdefghijklmnopqrstuvwxyz',digits:'0123456789',sym:'!@#$%^&*()-_=+[]{}|;:,.<>?'};
const AMBIG = /[0OlI1]/g;
function genPassword() {
  let pool='';
  if($('pw-upper').checked) pool+=CHARS.upper;
  if($('pw-lower').checked) pool+=CHARS.lower;
  if($('pw-digits').checked) pool+=CHARS.digits;
  if($('pw-sym').checked) pool+=CHARS.sym;
  if($('pw-ambig').checked) pool=pool.replace(AMBIG,'');
  if (!pool) return setStatus('pw-status','Select at least one character type','err');
  const len=parseInt($('pw-len').value);
  let pw='';
  const arr=new Uint8Array(len*2);
  crypto.getRandomValues(arr);
  for(let i=0;pw.length<len;i++) pw+=pool[arr[i]%pool.length];
  $('pw-display').textContent=pw;
  $('pw-check').value=pw;
  checkStrength();
  setStatus('pw-status',`Generated ${len}-char password`,'ok');
}
function copyPw() { copyText($('pw-display').textContent,'pw-status','Password copied!'); }
function checkStrength() {
  const pw=$('pw-check').value;
  if (!pw) { $('pw-strength-fill').style.width='0%'; $('pw-strength-label').textContent=''; $('pw-strength-details').innerHTML=''; return; }
  let score=0; const issues=[];
  if (pw.length>=8) score+=1; else issues.push('At least 8 characters');
  if (pw.length>=12) score+=1; else if(pw.length>=8) issues.push('12+ chars recommended');
  if (pw.length>=16) score+=1;
  if (/[A-Z]/.test(pw)) score+=1; else issues.push('Add uppercase letters');
  if (/[a-z]/.test(pw)) score+=1; else issues.push('Add lowercase letters');
  if (/[0-9]/.test(pw)) score+=1; else issues.push('Add numbers');
  if (/[^A-Za-z0-9]/.test(pw)) score+=1; else issues.push('Add special characters');
  if (!/(.)\1{2,}/.test(pw)) score+=1;
  const pct=Math.round(score/8*100);
  $('pw-strength-fill').style.width=pct+'%';
  const colors=['#e55353','#f0a500','#f0a500','#3ecf8e','#3ecf8e'];
  const labels=['Very Weak','Weak','Fair','Strong','Very Strong'];
  const idx=score<=2?0:score<=4?1:score<=5?2:score<=6?3:4;
  $('pw-strength-fill').style.background=colors[idx];
  $('pw-strength-label').style.color=colors[idx];
  $('pw-strength-label').textContent=labels[idx]+` · Entropy: ~${Math.round(pw.length*Math.log2(pw.split('').reduce((s,c)=>{if(/[a-z]/.test(c))s.add('l');if(/[A-Z]/.test(c))s.add('u');if(/\d/.test(c))s.add('d');if(/[^a-zA-Z0-9]/.test(c))s.add('s');return s;},new Set()).size===0?26:([...(new Set(pw.split('')))].length||1)))} bits`;
  $('pw-strength-details').innerHTML=issues.map(i=>`<div style="color:var(--amber)">⚠ ${i}</div>`).join('');
}

/* ================================================
   10. UUID GENERATOR
================================================ */
function genUUID4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=crypto.getRandomValues(new Uint8Array(1))[0]&15;
    return (c==='x'?r:(r&0x3|0x8)).toString(16);
  });
}
function genUUID1() {
  const now=Date.now(); const rnd=Math.floor(Math.random()*0xfff);
  const timeLow=(now&0xffffffff).toString(16).padStart(8,'0');
  const timeMid=((now/0x100000000)&0xffff).toString(16).padStart(4,'0');
  const timeHi=(((now/0x1000000000000)&0xfff)|0x1000).toString(16).padStart(4,'0');
  const clk=(rnd|0x8000).toString(16).padStart(4,'0');
  const node=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${timeLow}-${timeMid}-${timeHi}-${clk}-${node}`;
}
function formatUUID(uuid, fmt) {
  if (fmt==='upper') return uuid.toUpperCase();
  if (fmt==='no-dash') return uuid.replace(/-/g,'');
  if (fmt==='braces') return `{${uuid}}`;
  return uuid;
}
function genUUIDs() {
  const count=Math.min(100,parseInt($('uuid-count').value)||1);
  const ver=$('uuid-ver').value;
  const fmt=$('uuid-fmt').value;
  const list=$('uuid-list'); list.innerHTML='';
  for (let i=0;i<count;i++) {
    let uuid = ver==='nil'?'00000000-0000-0000-0000-000000000000':ver==='1'?genUUID1():genUUID4();
    uuid=formatUUID(uuid,fmt);
    const row=document.createElement('div'); row.className='uuid-row';
    row.innerHTML=`<div class="uuid-val">${uuid}</div><button class="uuid-cp" onclick="this.textContent='✓';copyText('${uuid}');setTimeout(()=>this.textContent='Copy',1200)">Copy</button>`;
    list.appendChild(row);
  }
  setStatus('uuid-status',`Generated ${count} UUID${count>1?'s':''}`,'ok');
}
function uuidCopyAll() {
  const vals=[...$('uuid-list').querySelectorAll('.uuid-val')].map(el=>el.textContent).join('\n');
  if(vals) copyText(vals,'uuid-status','All UUIDs copied!');
}
function uuidClear() { $('uuid-list').innerHTML=''; setStatus('uuid-status',''); }

/* ================================================
   11. RSA KEY PAIR
================================================ */
async function genRSA() {
  const size=parseInt($('rsa-size').value);
  setStatus('rsa-status',`Generating ${size}-bit RSA key pair...`,'warn');
  $('rsa-priv').textContent='Generating...';
  $('rsa-pub').textContent='Generating...';
  try {
    const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:size,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const privDer = await crypto.subtle.exportKey('pkcs8',kp.privateKey);
    const pubDer = await crypto.subtle.exportKey('spki',kp.publicKey);
    const toPEM=(der,type)=>{
      const b64=btoa(String.fromCharCode(...new Uint8Array(der)));
      const lines=b64.match(/.{1,64}/g).join('\n');
      return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
    };
    $('rsa-priv').textContent=toPEM(privDer,'PRIVATE KEY');
    $('rsa-pub').textContent=toPEM(pubDer,'PUBLIC KEY');
    setStatus('rsa-status',`${size}-bit RSA key pair generated`,'ok');
  } catch(e) { setStatus('rsa-status','Error: '+e.message,'err'); }
}
function rsaClear() { $('rsa-priv').textContent='Generate keys to see output...'; $('rsa-pub').textContent='Generate keys to see output...'; setStatus('rsa-status',''); }


/* ================================================
   12. REGEX TESTER
================================================ */
function runRegex() {
  const pat=$('re-pattern').value, flags=$('re-flags').value, input=$('re-input').value;
  if (!pat) return setStatus('re-status','Enter a pattern.');
  let re;
  try { re=new RegExp(pat,flags); } catch(e) { return setStatus('re-status','Invalid regex: '+e.message,'err'); }
  const matches=[];
  if (flags.includes('g')) {
    let m; while((m=re.exec(input))!==null) { matches.push({index:m.index,val:m[0],groups:m.slice(1)}); if(m[0].length===0)re.lastIndex++; }
  } else { const m=re.exec(input); if(m) matches.push({index:m.index,val:m[0],groups:m.slice(1)}); }
  const out=$('re-output');
  if (!matches.length) { out.textContent='No matches found.'; setStatus('re-status','0 matches','err'); }
  else {
    out.textContent=matches.map((m,i)=>`Match ${i+1}: "${m.val}" at index ${m.index}${m.groups.length?'\n  Groups: '+m.groups.map((g,j)=>`[${j+1}] ${g||'undefined'}`).join(', '):''}`).join('\n\n');
    setStatus('re-status',`${matches.length} match${matches.length>1?'es':''}`,'ok');
  }
  // highlight
  const hl=$('re-highlight');
  try {
    const hr=new RegExp(pat,flags.includes('g')?flags:'g'+flags.replace('g',''));
    let last=0,result='';
    let hm;
    while((hm=hr.exec(input))!==null) {
      result+=esc(input.slice(last,hm.index))+'<mark>'+esc(hm[0])+'</mark>';
      last=hm.index+hm[0].length;
      if(hm[0].length===0)hr.lastIndex++;
      if(!flags.includes('g'))break;
    }
    result+=esc(input.slice(last));
    hl.innerHTML=result||'&nbsp;';
  } catch(e){hl.textContent=input;}
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function regexClear(){ $('re-pattern').value=''; $('re-input').value=''; $('re-output').textContent=''; $('re-highlight').innerHTML=''; setStatus('re-status','');}

/* ================================================
   13. DIFF CHECKER
================================================ */
function runDiff() {
  const a=$('diff-a').value, b=$('diff-b').value;
  if (!a && !b) return setStatus('diff-status','Enter text in both panes.');
  const aLines=a.split('\n'), bLines=b.split('\n');
  const lcs=computeLCS(aLines,bLines);
  let out=''; let ai=0,bi=0,li=0;
  const lcsFull=lcs.full;
  while(ai<aLines.length||bi<bLines.length){
    if(ai<aLines.length&&bi<bLines.length&&lcsFull[ai]===bi){
      out+=`<span class="diff-eq">  ${esc(aLines[ai])}\n</span>`;
      ai++;bi++;
    } else if(bi<bLines.length&&(ai>=aLines.length||!lcs.usedA.has(ai))){
      out+=`<span class="diff-add">+ ${esc(bLines[bi])}\n</span>`;
      bi++;
    } else {
      out+=`<span class="diff-del">- ${esc(aLines[ai])}\n</span>`;
      ai++;
    }
  }
  $('diff-out').innerHTML=out;
  const adds=(out.match(/class="diff-add"/g)||[]).length, dels=(out.match(/class="diff-del"/g)||[]).length;
  setStatus('diff-status',`+${adds} additions · -${dels} deletions`,'ok');
}
function computeLCS(a,b){
  const m=a.length,n=b.length, dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const usedA=new Set(), full={};
  let i=m,j=n;
  while(i>0&&j>0){ if(a[i-1]===b[j-1]){usedA.add(i-1);full[i-1]=j-1;i--;j--;}else if(dp[i-1][j]>dp[i][j-1])i--;else j--; }
  return {usedA,full};
}
function diffClear(){ $('diff-a').value=''; $('diff-b').value=''; $('diff-out').innerHTML=''; setStatus('diff-status',''); }

/* ================================================
   14. LOREM IPSUM GENERATOR
================================================ */
const LOREM_WORDS=['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit','voluptate','velit','esse','cillum','eu','fugiat','nulla','pariatur','excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt','mollit','anim','id','est','laborum','cras','mattis','consectetur','purus','sem','scelerisque','accumsan','iaculis'];
function rword(){return LOREM_WORDS[Math.floor(Math.random()*LOREM_WORDS.length)];}
function rSentence(){const n=8+Math.floor(Math.random()*12);const words=Array.from({length:n},rword);words[0]=words[0].charAt(0).toUpperCase()+words[0].slice(1);return words.join(' ')+'.';}
function rParagraph(){const n=3+Math.floor(Math.random()*5);return Array.from({length:n},rSentence).join(' ');}
function genLorem(){
  const type=$('lorem-type').value, count=Math.min(50,parseInt($('lorem-count').value)||3), start=$('lorem-start').checked;
  let text='';
  if(type==='words'){
    text=Array.from({length:count},rword).join(' ');
    if(start) text='Lorem ipsum '+text.slice(text.indexOf(' ')+1);
  } else if(type==='sentences'){
    text=Array.from({length:count},rSentence).join(' ');
    if(start) text='Lorem ipsum dolor sit amet. '+text.slice(text.indexOf('.')+2);
  } else {
    const paragraphs=Array.from({length:count},rParagraph);
    if(start) paragraphs[0]='Lorem ipsum dolor sit amet, consectetur adipiscing elit. '+paragraphs[0].slice(paragraphs[0].indexOf('.')+2);
    text=paragraphs.join('\n\n');
  }
  $('lorem-out').textContent=text;
  setStatus('lorem-status',`Generated ${count} ${type}`,'ok');
}
function loremCopy(){copyText($('lorem-out').textContent,'lorem-status','Copied!');}
function loremClear(){$('lorem-out').textContent=''; setStatus('lorem-status','');}

/* ================================================
   15. CASE CONVERTER
================================================ */
const caseFns = {
  'UPPER CASE': s=>s.toUpperCase(),
  'lower case': s=>s.toLowerCase(),
  'Title Case': s=>s.replace(/\w\S*/g,t=>t[0].toUpperCase()+t.slice(1).toLowerCase()),
  'Sentence case': s=>{const t=s.toLowerCase();return t.charAt(0).toUpperCase()+t.slice(1);},
  'camelCase': s=>s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g,(_,c)=>c.toUpperCase()),
  'PascalCase': s=>s.replace(/[^a-zA-Z0-9]+(.)/g,(_,c)=>c.toUpperCase()).replace(/^./,c=>c.toUpperCase()),
  'snake_case': s=>s.replace(/\s+/g,'_').replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,'').replace(/_+/g,'_'),
  'kebab-case': s=>s.replace(/\s+/g,'-').replace(/([A-Z])/g,'-$1').toLowerCase().replace(/^-/,'').replace(/-+/g,'-'),
  'CONSTANT_CASE': s=>s.replace(/\s+/g,'_').replace(/([A-Z])/g,'_$1').toUpperCase().replace(/^_/,'').replace(/_+/g,'_'),
  'dot.case': s=>s.replace(/\s+/g,'.').replace(/([A-Z])/g,'.$1').toLowerCase().replace(/^\./,''),
  'Train-Case': s=>s.split(/[\s_-]+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join('-'),
  'aLtErNaTiNg': s=>[...s].map((c,i)=>i%2===0?c.toLowerCase():c.toUpperCase()).join(''),
};
function buildCaseGrid(val=''){
  const grid=$('case-grid'); grid.innerHTML='';
  Object.entries(caseFns).forEach(([name,fn])=>{
    const result=val?fn(val):'';
    const card=document.createElement('div'); card.className='case-card';
    card.innerHTML=`<div class="case-card-hdr">${name} <button class="btn ghost sm" onclick="copyText('${result.replace(/'/g,"\\'")}', 'case-status','Copied ${name}!')">Copy</button></div><div class="case-val">${result||'<span style="color:var(--text3)">Enter text above</span>'}</div>`;
    grid.appendChild(card);
  });
}
$('case-in').addEventListener('input',()=>buildCaseGrid($('case-in').value));
buildCaseGrid();
function caseClear(){ $('case-in').value=''; buildCaseGrid(); setStatus('case-status',''); }

/* ================================================
   16. URL ENCODER / DECODER
================================================ */
function urlEncode(){ const r=$('url-in').value; $('url-out').textContent=encodeURIComponent(r); setStatus('url-status','Encoded','ok'); }
function urlDecode(){ try{ $('url-out').textContent=decodeURIComponent($('url-in').value); setStatus('url-status','Decoded','ok'); } catch(e){ setStatus('url-status',e.message,'err'); } }
function urlCopy(){ copyText($('url-out').textContent,'url-status','Output copied!'); }
function urlClear(){ $('url-in').value=''; $('url-out').textContent=''; setStatus('url-status',''); }

/* ================================================
   17. MARKDOWN PREVIEWER
================================================ */
function renderMD(src) {
  let html=src;
  html=html.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');
  html=html.replace(/`([^`]+)`/g,'<code>$1</code>');
  html=html.replace(/^#{6} (.+)$/gm,'<h6>$1</h6>');
  html=html.replace(/^#{5} (.+)$/gm,'<h5>$1</h5>');
  html=html.replace(/^#{4} (.+)$/gm,'<h4>$1</h4>');
  html=html.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  html=html.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  html=html.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  html=html.replace(/\*(.+?)\*/g,'<em>$1</em>');
  html=html.replace(/~~(.+?)~~/g,'<del>$1</del>');
  html=html.replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>');
  html=html.replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>');
  html=html.replace(/^---$/gm,'<hr>');
  html=html.replace(/^\* (.+)$/gm,'<li>$1</li>');
  html=html.replace(/^- (.+)$/gm,'<li>$1</li>');
  html=html.replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>');
  html=html.replace(/^\d+\. (.+)$/gm,'<oli>$1</oli>');
  html=html.replace(/<oli>(.*?)<\/oli>/gs,'<li>$1</li>');
  html=html.replace(/\n\n/g,'</p><p>');
  html='<p>'+html+'</p>';
  html=html.replace(/<p>(<h[1-6]>)/g,'$1').replace(/(<\/h[1-6]>)<\/p>/g,'$1');
  html=html.replace(/<p>(<ul>)/g,'$1').replace(/(<\/ul>)<\/p>/g,'$1');
  html=html.replace(/<p>(<pre>)/g,'$1').replace(/(<\/pre>)<\/p>/g,'$1');
  html=html.replace(/<p>(<blockquote>)/g,'$1').replace(/(<\/blockquote>)<\/p>/g,'$1');
  html=html.replace(/<p>(<hr>)<\/p>/g,'$1');
  return html;
}
$('md-in').addEventListener('input',()=>{
  $('md-out').innerHTML=renderMD($('md-in').value);
  setStatus('md-status',`${$('md-in').value.split('\n').length} lines`);
});
function mdClear(){ $('md-in').value=''; $('md-out').innerHTML=''; setStatus('md-status',''); }


/* ================================================
   18. URL PARSER & BUILDER
================================================ */
function parseURL() {
  const raw=$('urlp-in').value.trim();
  if (!raw) return setStatus('urlp-status','Enter a URL above.');
  try {
    const u=new URL(raw);
    const grid=$('urlp-out'); grid.innerHTML='';
    const fields=[
      {key:'Protocol',val:u.protocol},
      {key:'Host',val:u.hostname},
      {key:'Port',val:u.port||'(default)'},
      {key:'Path',val:u.pathname},
      {key:'Hash/Fragment',val:u.hash||'(none)'},
      {key:'Origin',val:u.origin},
    ];
    if (u.username||u.password) {
      fields.push({key:'Username',val:u.username||'(none)'});
      fields.push({key:'Password',val:u.password||'(none)'});
    }
    fields.forEach(f=>{
      const c=document.createElement('div'); c.className='urlp-card';
      c.innerHTML=`<div class="urlp-key">${f.key}</div><div class="urlp-val">${esc(f.val)}</div>`;
      grid.appendChild(c);
    });
    if (u.search) {
      const params=document.createElement('div'); params.className='urlp-card urlp-params';
      let html='<div class="urlp-key">Query Parameters</div>';
      u.searchParams.forEach((v,k)=>{ html+=`<div class="param-row"><div class="param-key">${esc(k)}</div><div class="param-val">${esc(v)}</div></div>`; });
      params.innerHTML=html;
      grid.appendChild(params);
    }
    setStatus('urlp-status','URL parsed successfully','ok');
  } catch(e) { setStatus('urlp-status','Invalid URL: '+e.message,'err'); }
}
function urlparseClear(){ $('urlp-in').value=''; $('urlp-out').innerHTML=''; setStatus('urlp-status',''); }
$('urlp-in').addEventListener('keydown',e=>{ if(e.key==='Enter') parseURL(); });

/* ================================================
   19. HTTP STATUS CODE REFERENCE
================================================ */
const HTTP_CODES=[
  {code:100,name:'Continue',desc:'Initial part of request received, client should continue.',group:'1xx'},
  {code:101,name:'Switching Protocols',desc:'Server is switching protocols as requested.',group:'1xx'},
  {code:102,name:'Processing',desc:'Server has received and is processing the request.',group:'1xx'},
  {code:103,name:'Early Hints',desc:'Used to preload resources while the server prepares a response.',group:'1xx'},
  {code:200,name:'OK',desc:'Request succeeded.',group:'2xx'},
  {code:201,name:'Created',desc:'Request succeeded and resource was created.',group:'2xx'},
  {code:202,name:'Accepted',desc:'Request received but not yet acted upon.',group:'2xx'},
  {code:203,name:'Non-Authoritative Information',desc:'Returned metadata is not from the origin server.',group:'2xx'},
  {code:204,name:'No Content',desc:'No content to return, but headers may be useful.',group:'2xx'},
  {code:205,name:'Reset Content',desc:'Tells client to reset the document view.',group:'2xx'},
  {code:206,name:'Partial Content',desc:'Partial GET request fulfilled.',group:'2xx'},
  {code:207,name:'Multi-Status',desc:'Multiple status codes for multiple operations (WebDAV).',group:'2xx'},
  {code:208,name:'Already Reported',desc:'Members of DAV binding already enumerated.',group:'2xx'},
  {code:226,name:'IM Used',desc:'Server fulfilled GET request with instance manipulation.',group:'2xx'},
  {code:300,name:'Multiple Choices',desc:'Multiple options for the resource.',group:'3xx'},
  {code:301,name:'Moved Permanently',desc:'URL permanently changed to a new one.',group:'3xx'},
  {code:302,name:'Found',desc:'URI temporarily changed.',group:'3xx'},
  {code:303,name:'See Other',desc:'Client should GET another URL to find the response.',group:'3xx'},
  {code:304,name:'Not Modified',desc:'Response has not been modified, use cached version.',group:'3xx'},
  {code:307,name:'Temporary Redirect',desc:'URI temporarily changed, same method should be used.',group:'3xx'},
  {code:308,name:'Permanent Redirect',desc:'URI permanently changed, same method must be used.',group:'3xx'},
  {code:400,name:'Bad Request',desc:'Server could not understand the request due to invalid syntax.',group:'4xx'},
  {code:401,name:'Unauthorized',desc:'Authentication required.',group:'4xx'},
  {code:402,name:'Payment Required',desc:'Reserved for future use.',group:'4xx'},
  {code:403,name:'Forbidden',desc:'Client does not have access rights to the content.',group:'4xx'},
  {code:404,name:'Not Found',desc:'Server cannot find the requested resource.',group:'4xx'},
  {code:405,name:'Method Not Allowed',desc:'Request method is not supported.',group:'4xx'},
  {code:406,name:'Not Acceptable',desc:'No content conforms to the criteria given by the user agent.',group:'4xx'},
  {code:407,name:'Proxy Authentication Required',desc:'Authentication by a proxy is required.',group:'4xx'},
  {code:408,name:'Request Timeout',desc:'Server would like to shut down this unused connection.',group:'4xx'},
  {code:409,name:'Conflict',desc:'Request conflict with current state of server.',group:'4xx'},
  {code:410,name:'Gone',desc:'Requested content has been permanently deleted.',group:'4xx'},
  {code:411,name:'Length Required',desc:'Content-Length header field is required.',group:'4xx'},
  {code:412,name:'Precondition Failed',desc:'Client has indicated preconditions which the server does not meet.',group:'4xx'},
  {code:413,name:'Content Too Large',desc:'Request entity is larger than limits defined by server.',group:'4xx'},
  {code:414,name:'URI Too Long',desc:'URI requested by client is longer than the server will interpret.',group:'4xx'},
  {code:415,name:'Unsupported Media Type',desc:'Media format not supported by the server.',group:'4xx'},
  {code:416,name:'Range Not Satisfiable',desc:'Range specified in Range header field can\'t be fulfilled.',group:'4xx'},
  {code:417,name:'Expectation Failed',desc:'Expectation indicated by the Expect header can\'t be met.',group:'4xx'},
  {code:418,name:'I\'m a Teapot',desc:'Server refuses to brew coffee because it is a teapot.',group:'4xx'},
  {code:421,name:'Misdirected Request',desc:'Request was directed at a server unable to produce a response.',group:'4xx'},
  {code:422,name:'Unprocessable Content',desc:'Unable to process contained instructions.',group:'4xx'},
  {code:423,name:'Locked',desc:'Resource being accessed is locked (WebDAV).',group:'4xx'},
  {code:424,name:'Failed Dependency',desc:'Request failed due to failure of a previous request.',group:'4xx'},
  {code:425,name:'Too Early',desc:'Server unwilling to risk processing a request that might be replayed.',group:'4xx'},
  {code:426,name:'Upgrade Required',desc:'Client should switch to a different protocol.',group:'4xx'},
  {code:428,name:'Precondition Required',desc:'Origin server requires the request to be conditional.',group:'4xx'},
  {code:429,name:'Too Many Requests',desc:'User has sent too many requests in a given amount of time.',group:'4xx'},
  {code:431,name:'Request Header Fields Too Large',desc:'Server unwilling to process request due to large headers.',group:'4xx'},
  {code:451,name:'Unavailable For Legal Reasons',desc:'User requested an illegal resource.',group:'4xx'},
  {code:500,name:'Internal Server Error',desc:'Server has encountered a situation it doesn\'t know how to handle.',group:'5xx'},
  {code:501,name:'Not Implemented',desc:'Request method is not supported by the server.',group:'5xx'},
  {code:502,name:'Bad Gateway',desc:'Server got an invalid response while working as a gateway.',group:'5xx'},
  {code:503,name:'Service Unavailable',desc:'Server is not ready to handle the request.',group:'5xx'},
  {code:504,name:'Gateway Timeout',desc:'Server acting as gateway did not get response in time.',group:'5xx'},
  {code:505,name:'HTTP Version Not Supported',desc:'HTTP version used in the request is not supported.',group:'5xx'},
  {code:506,name:'Variant Also Negotiates',desc:'Server has an internal configuration error.',group:'5xx'},
  {code:507,name:'Insufficient Storage',desc:'Method could not be performed, server unable to store representation.',group:'5xx'},
  {code:508,name:'Loop Detected',desc:'Server detected an infinite loop while processing the request.',group:'5xx'},
  {code:510,name:'Not Extended',desc:'Further extensions to the request are required.',group:'5xx'},
  {code:511,name:'Network Authentication Required',desc:'Client needs to authenticate to gain network access.',group:'5xx'},
];
function buildHTTPList(filter=''){
  const list=$('http-list'); list.innerHTML='';
  const grouped={'1xx':[],'2xx':[],'3xx':[],'4xx':[],'5xx':[]};
  HTTP_CODES.filter(c=>!filter||c.code.toString().includes(filter)||c.name.toLowerCase().includes(filter.toLowerCase())||c.desc.toLowerCase().includes(filter.toLowerCase()))
    .forEach(c=>grouped[c.group].push(c));
  const groupNames={'1xx':'1xx Informational','2xx':'2xx Success','3xx':'3xx Redirection','4xx':'4xx Client Errors','5xx':'5xx Server Errors'};
  const colorClass={'1xx':'s1xx','2xx':'s2xx','3xx':'s3xx','4xx':'s4xx','5xx':'s5xx'};
  Object.entries(grouped).forEach(([g,codes])=>{
    if(!codes.length) return;
    const hdr=document.createElement('div'); hdr.className='http-group-hdr'; hdr.textContent=groupNames[g]; list.appendChild(hdr);
    codes.forEach(c=>{
      const item=document.createElement('div'); item.className='http-item';
      item.innerHTML=`<div class="http-code ${colorClass[c.group]}">${c.code}</div><div><div class="http-name">${c.name}</div><div class="http-desc">${c.desc}</div></div>`;
      list.appendChild(item);
    });
  });
}
function filterHTTP(){ buildHTTPList($('http-search').value); }
buildHTTPList();

/* ================================================
   20. CORS HEADER ANALYZER
================================================ */
const CORS_INFO={
  'access-control-allow-origin':{desc:'Specifies which origins are allowed to access the resource.',check:v=>v==='*'?{type:'warn',msg:'Wildcard (*) allows all origins — avoid with credentials'}:{type:'ok',msg:'Specific origin: '+v}},
  'access-control-allow-methods':{desc:'HTTP methods allowed when accessing the resource.',check:v=>{const methods=v.split(',').map(m=>m.trim());return methods.includes('*')?{type:'warn',msg:'All methods allowed'}:{type:'ok',msg:methods.length+' methods: '+methods.join(', ')};}},
  'access-control-allow-headers':{desc:'Headers that can be used when making the actual request.',check:v=>({type:'ok',msg:'Allowed headers: '+v})},
  'access-control-allow-credentials':{desc:'Indicates whether or not the response can be exposed when credentials flag is true.',check:v=>v.toLowerCase()==='true'?{type:'warn',msg:'Credentials allowed — ensure Allow-Origin is not *'}:{type:'ok',msg:'Credentials not exposed'}},
  'access-control-max-age':{desc:'How long results of a preflight request can be cached.',check:v=>({type:'ok',msg:`Cached for ${v} seconds (${Math.round(parseInt(v)/3600)} hours)`})},
  'access-control-expose-headers':{desc:'Indicates which headers can be exposed as part of the response.',check:v=>({type:'ok',msg:'Exposed: '+v})},
};
function analyzeCORS(){
  const raw=$('cors-in').value.trim();
  if(!raw) return setStatus('cors-status','Paste headers above.');
  const lines=raw.split('\n').filter(l=>l.includes(':'));
  const headers={};
  lines.forEach(l=>{
    const idx=l.indexOf(':');
    const k=l.slice(0,idx).trim().toLowerCase();
    const v=l.slice(idx+1).trim();
    headers[k]=v;
  });
  const out=$('cors-out'); out.innerHTML='';
  const corsHeaders=Object.keys(headers).filter(k=>k.startsWith('access-control'));
  if(!corsHeaders.length){ out.innerHTML='<div style="color:var(--text2);padding:10px">No CORS headers found in input.</div>'; return; }
  corsHeaders.forEach(k=>{
    const v=headers[k];
    const info=CORS_INFO[k]||{desc:'CORS header',check:()=>({type:'ok',msg:v})};
    const check=info.check(v);
    const row=document.createElement('div'); row.className='cors-row';
    row.innerHTML=`<div class="cors-hdr-name">${k} <span class="cors-badge cors-${check.type}">${check.type.toUpperCase()}</span></div><div class="cors-hdr-val">${esc(v)}</div><div class="cors-desc">${info.desc}<br><span style="color:var(--${check.type==='ok'?'green':check.type==='warn'?'amber':'red'})">${check.msg}</span></div>`;
    out.appendChild(row);
  });
  setStatus('cors-status',`${corsHeaders.length} CORS headers analyzed`,'ok');
}
function corsClear(){ $('cors-in').value=''; $('cors-out').innerHTML=''; setStatus('cors-status',''); }

/* ================================================
   21. IP / CIDR CALCULATOR
================================================ */
function calcCIDR(){
  const raw=$('cidr-in').value.trim();
  if(!raw) return setStatus('cidr-status','Enter an IP or CIDR notation.');
  const out=$('cidr-out'); out.innerHTML='';
  try {
    if(raw.includes('/')) {
      const [ip,prefix]=raw.split('/');
      const pLen=parseInt(prefix);
      if(pLen<0||pLen>32) throw new Error('Prefix must be 0–32');
      const ipInt=ipToInt(ip);
      const mask=pLen===0?0:(-1<<(32-pLen))>>>0;
      const network=ipInt&mask;
      const broadcast=network|(~mask>>>0);
      const hosts=pLen>=31?Math.pow(2,32-pLen):Math.pow(2,32-pLen)-2;
      const cards=[
        {key:'Network Address',val:intToIp(network)},
        {key:'Broadcast Address',val:intToIp(broadcast)},
        {key:'Subnet Mask',val:intToIp(mask)},
        {key:'Wildcard Mask',val:intToIp(~mask>>>0)},
        {key:'First Usable Host',val:pLen<31?intToIp(network+1):intToIp(network)},
        {key:'Last Usable Host',val:pLen<31?intToIp(broadcast-1):intToIp(broadcast)},
        {key:'Usable Hosts',val:hosts.toLocaleString()},
        {key:'CIDR Notation',val:`${intToIp(network)}/${pLen}`},
        {key:'Prefix Length',val:`/${pLen}`},
        {key:'Total Addresses',val:Math.pow(2,32-pLen).toLocaleString()},
        {key:'IP Class',val:getIPClass(intToIp(network))},
        {key:'IP Type',val:isPrivate(intToIp(network))?'Private':'Public'},
      ];
      cards.forEach(c=>{ const el=document.createElement('div'); el.className='cidr-card'; el.innerHTML=`<div class="cidr-key">${c.key}</div><div class="cidr-val">${c.val}</div>`; out.appendChild(el); });
      setStatus('cidr-status','CIDR calculated','ok');
    } else {
      const cards=[
        {key:'Input IP',val:raw},
        {key:'Integer',val:ipToInt(raw).toString()},
        {key:'Hex',val:'0x'+ipToInt(raw).toString(16).toUpperCase().padStart(8,'0')},
        {key:'Binary',val:ipToBinary(raw)},
        {key:'Reverse DNS',val:raw.split('.').reverse().join('.')+'.in-addr.arpa'},
        {key:'Class',val:getIPClass(raw)},
        {key:'Type',val:isPrivate(raw)?'Private / RFC1918':'Public'},
      ];
      cards.forEach(c=>{ const el=document.createElement('div'); el.className='cidr-card'; el.innerHTML=`<div class="cidr-key">${c.key}</div><div class="cidr-val">${c.val}</div>`; out.appendChild(el); });
      setStatus('cidr-status','IP analyzed','ok');
    }
  } catch(e) { setStatus('cidr-status',e.message,'err'); }
}
function ipToInt(ip){ const p=ip.split('.').map(Number); if(p.some(x=>x<0||x>255||isNaN(x))) throw new Error('Invalid IP'); return ((p[0]<<24)|(p[1]<<16)|(p[2]<<8)|p[3])>>>0; }
function intToIp(n){ return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.'); }
function ipToBinary(ip){ return ip.split('.').map(p=>parseInt(p).toString(2).padStart(8,'0')).join('.'); }
function getIPClass(ip){ const f=parseInt(ip.split('.')[0]); if(f<128)return 'A'; if(f<192)return 'B'; if(f<224)return 'C'; if(f<240)return 'D (Multicast)'; return 'E (Reserved)'; }
function isPrivate(ip){ const p=ip.split('.').map(Number); return(p[0]===10)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===127); }
function cidrClear(){ $('cidr-in').value=''; $('cidr-out').innerHTML=''; setStatus('cidr-status',''); }
$('cidr-in').addEventListener('keydown',e=>{ if(e.key==='Enter') calcCIDR(); });

/* ================================================
   22. CRON PARSER
================================================ */
const CRON_PRESETS_DATA=[
  {expr:'* * * * *',desc:'Every minute'},
  {expr:'*/5 * * * *',desc:'Every 5 minutes'},
  {expr:'0 * * * *',desc:'Every hour'},
  {expr:'0 0 * * *',desc:'Every day at midnight'},
  {expr:'0 9 * * *',desc:'Every day at 9 AM'},
  {expr:'0 9 * * 1-5',desc:'Weekdays at 9 AM'},
  {expr:'0 0 * * 0',desc:'Every Sunday midnight'},
  {expr:'0 0 1 * *',desc:'First of every month'},
  {expr:'0 0 1 1 *',desc:'Every New Year'},
  {expr:'*/15 9-17 * * 1-5',desc:'Every 15 min, business hours'},
  {expr:'0 0,12 * * *',desc:'Twice daily (midnight + noon)'},
  {expr:'0 0 * * 1',desc:'Every Monday midnight'},
];
function buildCronPresets(){
  const grid=$('cron-presets'); grid.innerHTML='';
  CRON_PRESETS_DATA.forEach(p=>{
    const btn=document.createElement('button'); btn.className='preset-btn';
    btn.innerHTML=`<div class="preset-expr">${p.expr}</div><div class="preset-desc">${p.desc}</div>`;
    btn.onclick=()=>{ $('cron-in').value=p.expr; parseCron(); };
    grid.appendChild(btn);
  });
}
buildCronPresets();
function parseCron(){
  const expr=$('cron-in').value.trim();
  if(!expr) return setStatus('cron-status','Enter a cron expression.');
  const parts=expr.split(/\s+/);
  if(parts.length<5||parts.length>6) return setStatus('cron-status','Cron needs 5 fields: min hour day month weekday','err');
  const [min,hour,day,month,weekday]=parts.slice(-5);
  const out=$('cron-out');
  const human=explainCron(min,hour,day,month,weekday);
  out.innerHTML=`<div class="cron-human">${human}</div>
    <div class="cron-parts">
      <div class="cron-part"><strong>Minute</strong>${min}</div>
      <div class="cron-part"><strong>Hour</strong>${hour}</div>
      <div class="cron-part"><strong>Day</strong>${day}</div>
      <div class="cron-part"><strong>Month</strong>${month}</div>
      <div class="cron-part"><strong>Weekday</strong>${weekday}</div>
    </div>
    <div class="cron-next">Next 5 runs: ${getNextRuns(min,hour,day,month,weekday,5).map(d=>d.toLocaleString()).join('  ·  ')}</div>`;
  setStatus('cron-status','Parsed','ok');
}
function explainCron(min,hour,day,month,weekday){
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let parts=[];
  if(min==='*') parts.push('every minute');
  else if(min.startsWith('*/')) parts.push(`every ${min.slice(2)} minutes`);
  else parts.push(`at minute ${min}`);
  if(hour!=='*'){
    if(hour.startsWith('*/')) parts.push(`every ${hour.slice(2)} hours`);
    else if(hour.includes(',')) parts.push(`at hours ${hour}`);
    else { const h=parseInt(hour); parts.push(`at ${h===0?'midnight':h===12?'noon':h<12?h+' AM':(h-12)+' PM'}`); }
  }
  if(weekday!=='*'){ if(weekday.includes('-')){ const[a,b]=weekday.split('-'); parts.push(`on ${days[a]}–${days[b]}`); } else parts.push(`on ${weekday.split(',').map(d=>days[parseInt(d)]).join(', ')}`); }
  if(day!=='*') parts.push(`on day ${day} of the month`);
  if(month!=='*'){ if(month.includes('-')){ const[a,b]=month.split('-'); parts.push(`in ${months[a-1]}–${months[b-1]}`); } else parts.push(`in ${month.split(',').map(m=>months[parseInt(m)-1]).join(', ')}`); }
  return parts.join(', ');
}
function getNextRuns(min,hour,day,month,weekday,count){
  const results=[];
  const d=new Date(); d.setSeconds(0); d.setMilliseconds(0); d.setMinutes(d.getMinutes()+1);
  let attempts=0;
  while(results.length<count&&attempts<10000){
    attempts++;
    if(matchCronField(d.getMonth()+1,month) && matchCronField(d.getDate(),day) && matchCronField(d.getDay(),weekday) && matchCronField(d.getHours(),hour) && matchCronField(d.getMinutes(),min)){
      results.push(new Date(d));
    }
    d.setMinutes(d.getMinutes()+1);
  }
  return results;
}
function matchCronField(val,expr){
  if(expr==='*') return true;
  if(expr.startsWith('*/')) return val%(parseInt(expr.slice(2)))===0;
  if(expr.includes('-')){ const[a,b]=expr.split('-'); return val>=parseInt(a)&&val<=parseInt(b); }
  return expr.split(',').map(Number).includes(val);
}
function cronClear(){ $('cron-in').value=''; $('cron-out').innerHTML=''; setStatus('cron-status',''); }


/* ================================================
   23. COLOR CONVERTER
================================================ */
let currentColor={h:220,s:90,l:63};
function hexToRGB(hex){ hex=hex.replace('#',''); const n=parseInt(hex,16); return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
function rgbToHex(r,g,b){ return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }
function rgbToHSL(r,g,b){ r/=255;g/=255;b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h,s,l=(max+min)/2; if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}}return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)}; }
function hslToRGB(h,s,l){ s/=100;l/=100; const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2; let r=0,g=0,b=0; if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;} return{r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)}; }
function rgbToCMYK(r,g,b){ r/=255;g/=255;b/=255; const k=1-Math.max(r,g,b); if(k===1) return{c:0,m:0,y:0,k:100}; return{c:Math.round((1-r-k)/(1-k)*100),m:Math.round((1-g-k)/(1-k)*100),y:Math.round((1-b-k)/(1-k)*100),k:Math.round(k*100)}; }
function updateColorUI(hex){
  const rgb=hexToRGB(hex);
  const hsl=rgbToHSL(rgb.r,rgb.g,rgb.b);
  const cmyk=rgbToCMYK(rgb.r,rgb.g,rgb.b);
  $('color-swatch').style.background=hex;
  $('color-pick').value=hex.length===7?hex:'#000000';
  const inputs=$('color-inputs');
  inputs.innerHTML='';
  const rows=[
    {label:'HEX',val:hex,id:'c-hex'},
    {label:'RGB',val:`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,id:'c-rgb'},
    {label:'HSL',val:`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,id:'c-hsl'},
    {label:'CMYK',val:`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,id:'c-cmyk'},
    {label:'R',val:rgb.r,id:'c-r'},{label:'G',val:rgb.g,id:'c-g'},{label:'B',val:rgb.b,id:'c-b'},
    {label:'H',val:hsl.h,id:'c-hh'},{label:'S',val:hsl.s+'%',id:'c-ss'},{label:'L',val:hsl.l+'%',id:'c-ll'},
  ];
  rows.forEach(row=>{
    const el=document.createElement('div'); el.className='color-input-row';
    el.innerHTML=`<div class="color-label">${row.label}</div><input class="color-inp" id="${row.id}" value="${row.val}" readonly/><button class="color-cp" onclick="copyText('${row.val}','color-status','${row.label} copied!')">Copy</button>`;
    inputs.appendChild(el);
  });
  buildPalette(hex);
  setStatus('color-status',`HEX: ${hex} · RGB(${rgb.r},${rgb.g},${rgb.b}) · HSL(${hsl.h},${hsl.s}%,${hsl.l}%)`);
}
function buildPalette(hex){
  const rgb=hexToRGB(hex);
  const hsl=rgbToHSL(rgb.r,rgb.g,rgb.b);
  const pal=$('color-palette');
  const sections=[
    {label:'Tints (lighter)',colors:Array.from({length:8},(_,i)=>{const l=Math.min(95,hsl.l+(95-hsl.l)*((i+1)/9));const r=hslToRGB(hsl.h,hsl.s,Math.round(l));return rgbToHex(r.r,r.g,r.b);})},
    {label:'Shades (darker)',colors:Array.from({length:8},(_,i)=>{const l=Math.max(5,hsl.l*(1-(i+1)/9));const r=hslToRGB(hsl.h,hsl.s,Math.round(l));return rgbToHex(r.r,r.g,r.b);})},
    {label:'Complementary & Analogous',colors:[-180,-60,-30,0,30,60,120,180].map(d=>{const r=hslToRGB((hsl.h+d+360)%360,hsl.s,hsl.l);return rgbToHex(r.r,r.g,r.b);})},
  ];
  pal.innerHTML=sections.map(s=>`<div class="palette-section"><div class="palette-label">${s.label}</div><div class="palette-swatches">${s.colors.map(c=>`<button class="swatch-btn" style="background:${c}" title="${c}" onclick="updateColorUI('${c}');document.getElementById('color-pick').value='${c}'"></button>`).join('')}</div></div>`).join('');
}
function colorFromPicker(){ updateColorUI($('color-pick').value); }
updateColorUI('#4f8ef7');

/* ================================================
   24. EPOCH CONVERTER
================================================ */
function epochToDate(){
  const ts=$('ep-ts').value.trim(), unit=$('ep-unit').value;
  if(!ts) return;
  const ms=unit==='s'?parseFloat(ts)*1000:parseFloat(ts);
  if(isNaN(ms)) return setStatus('ep-status','Invalid timestamp','err');
  const d=new Date(ms);
  $('ep-result').innerHTML=`<div><span>UTC:</span> ${d.toUTCString()}</div><div><span>Local:</span> ${d.toLocaleString()}</div><div><span>ISO 8601:</span> ${d.toISOString()}</div><div><span>Relative:</span> ${timeAgo(d)}</div>`;
  setStatus('ep-status','Converted','ok');
}
function dateToEpoch(){
  const val=$('ep-date').value;
  if(!val) return;
  const d=new Date(val);
  $('ep-date-result').innerHTML=`<div><span>Unix (s):</span> ${Math.floor(d.getTime()/1000)}</div><div><span>Unix (ms):</span> ${d.getTime()}</div>`;
  setStatus('ep-status','Converted','ok');
}
function epochNow(){ $('ep-ts').value=Math.floor(Date.now()/1000); $('ep-unit').value='s'; epochToDate(); }
function timeAgo(d){ const diff=Date.now()-d.getTime(),abs=Math.abs(diff),fut=diff<0; const s=Math.floor(abs/1000),m=Math.floor(s/60),h=Math.floor(m/60),dy=Math.floor(h/24); let l=dy>0?dy+'d':h>0?h+'h':m>0?m+'m':s+'s'; return fut?l+' from now':l+' ago'; }
function updateClock(){
  const el=$('ep-clock'); if(!el) return;
  const n=new Date();
  el.innerHTML=`<div class="clk-item"><div class="clk-lbl">Unix Timestamp</div><div class="clk-val">${Math.floor(n/1000)}</div></div><div class="clk-item"><div class="clk-lbl">Milliseconds</div><div class="clk-val">${n.getTime()}</div></div><div class="clk-item"><div class="clk-lbl">UTC</div><div class="clk-val">${n.toUTCString()}</div></div><div class="clk-item"><div class="clk-lbl">Local</div><div class="clk-val">${n.toLocaleString()}</div></div>`;
}
setInterval(updateClock,1000); updateClock();
const nowLocal=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
$('ep-date').value=nowLocal;

/* ================================================
   25A. NUMBER BASE CONVERTER
================================================ */
let nbLocked=false;
function nbConvert(src){
  if(nbLocked) return; nbLocked=true;
  try {
    let dec;
    const base=parseInt($('nb-base').value)||32;
    if(src==='d'){ dec=parseInt($('nb-d').value); }
    else if(src==='b'){ dec=parseInt($('nb-b').value,2); }
    else if(src==='h'){ dec=parseInt($('nb-h').value,16); }
    else if(src==='o'){ dec=parseInt($('nb-o').value,8); }
    else { dec=parseInt($('nb-c').value,base); }
    if(!isNaN(dec)){
      if(src!=='d') $('nb-d').value=dec.toString(10);
      if(src!=='b') $('nb-b').value=dec.toString(2);
      if(src!=='h') $('nb-h').value=dec.toString(16).toUpperCase();
      if(src!=='o') $('nb-o').value=dec.toString(8);
      if(src!=='c') $('nb-c').value=dec.toString(base);
      setStatus('nb-status',`Decimal: ${dec} · Hex: ${dec.toString(16).toUpperCase()} · Binary: ${dec.toString(2)} · Octal: ${dec.toString(8)}`,'ok');
    }
  } catch(e) { setStatus('nb-status','Invalid input','err'); }
  nbLocked=false;
}

/* ================================================
   25B. QR CODE GENERATOR
================================================ */
$('qr-size').addEventListener('input',()=>{ $('qr-size-val').textContent=$('qr-size').value+'px'; });
function genQR(){
  const text=$('qr-in').value.trim();
  if(!text) return setStatus('qr-status','Enter text or URL above.');
  const size=parseInt($('qr-size').value);
  const ec=$('qr-ec').value;
  const canvas=$('qr-canvas');
  try {
    if(typeof QRCode==='undefined') { setStatus('qr-status','QR library not loaded. Run: npm install && copy qrcode.min.js to libs/ folder.','err'); return; }
    QRCode.toCanvas(canvas,text,{width:size,color:{dark:'#000000',light:'#ffffff'},errorCorrectionLevel:ec});
    canvas.style.width=size+'px'; canvas.style.height=size+'px';
    setStatus('qr-status',`QR generated · ${text.length} chars · EC: ${ec}`,'ok');
  } catch(e) { setStatus('qr-status','Error: '+e.message,'err'); }
}
function qrDownload(){
  const canvas=$('qr-canvas');
  if(!canvas.width) return;
  const a=document.createElement('a'); a.download='qrcode.png'; a.href=canvas.toDataURL(); a.click();
}
function qrClear(){ $('qr-in').value=''; const c=$('qr-canvas'); const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); setStatus('qr-status',''); }

/* ================================================
   25C. IMAGE → BASE64
================================================ */
function imgLoad(e){ const f=e.target.files[0]; if(f) processImg(f); }
function imgDrop(e){ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith('image/')) processImg(f); }
function processImg(file){
  const reader=new FileReader();
  reader.onload=ev=>{
    const b64=ev.target.result;
    $('img-b64-out').textContent=b64;
    $('img-info').textContent=`${file.name} · ${file.type} · ${(file.size/1024).toFixed(1)} KB · Base64: ${Math.round(b64.length/1024)} KB`;
    const wrap=$('img-preview-wrap');
    const existing=wrap.querySelector('img');
    if(existing) existing.remove();
    const img=document.createElement('img'); img.src=b64; wrap.appendChild(img);
    setStatus('img-status',`Encoded: ${file.name}`,'ok');
  };
  reader.readAsDataURL(file);
}
function imgCopyB64(){ const v=$('img-b64-out').textContent; if(v) copyText(v,'img-status','Base64 copied!'); }
function imgCopyCSS(){ const v=$('img-b64-out').textContent; if(v) copyText(`url("${v}")`,'img-status','CSS url() copied!'); }
function imgClear(){ $('img-b64-out').textContent=''; $('img-info').textContent=''; const wrap=$('img-preview-wrap'); const img=wrap.querySelector('img'); if(img) img.remove(); setStatus('img-status',''); }

