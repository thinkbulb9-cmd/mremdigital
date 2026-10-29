#!/usr/bin/env bash
# macOS one-folder video pilot. Runs on 127.0.0.1:3000, never on Vercel.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This helper must run on macOS." >&2; exit 1
fi
if [[ $# -ne 1 ]]; then
  echo 'Usage: bash scripts/mac-video-test.sh "/Volumes/YourDisk/NPTEL/OneCourse"' >&2
  echo 'For internal Mac folders, use a path such as "$HOME/Movies/NPTEL".' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo "Install Node.js 22 or newer before testing. See https://nodejs.org/" >&2; exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required; it is included with standard Node.js installations." >&2; exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MEDIA_ROOT="$(node -e 'const fs=require("node:fs"); const p=process.argv[1]; try{const q=fs.realpathSync(p);if(!fs.statSync(q).isDirectory())throw Error("Not a folder");process.stdout.write(q)}catch(e){console.error("Unable to read folder:",e.message);process.exit(1)}' "$1")"
# Prevent accidental 90 TB scans: require a subfolder rather than the mount root.
case "$MEDIA_ROOT" in
  /Volumes/*)
    PART="${MEDIA_ROOT#/Volumes/}"
    if [[ "$PART" != */* ]]; then
      echo 'Select a SMALL COURSE SUBFOLDER inside the external disk, not its entire mount root.' >&2
      echo 'Example: /Volumes/CollegeDrive/NPTEL/Computer Science/Algorithms' >&2
      exit 1
    fi
    ;;
esac

node - "$MEDIA_ROOT" <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const media=process.argv[2],file='.env.local';
let content=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
function replaceOrAdd(k,v){
 const line=k+'='+v;
 const rx=new RegExp('^'+k+'=.*$','m');
 content=rx.test(content)?content.replace(rx,line):(content.trimEnd()+'\n'+line+'\n');
}
function current(k){
 const m=content.match(new RegExp('^'+k+'=(.*)$','m'));
 return m?m[1].replace(/^["']|["']$/g,''):'';
}
replaceOrAdd('MREM_MAC_PILOT_ROOT',JSON.stringify(media));
if(!current('LOGIN_PASSWORD')||current('LOGIN_PASSWORD').startsWith('CHANGE_')){
 const pass=crypto.randomBytes(20).toString('hex');
 replaceOrAdd('LOGIN_PASSWORD',pass);
 console.log('\nNEW LOCAL PILOT PASSWORD: '+pass+'\nSave this privately; do not paste it into chat or GitHub.\n');
}
if(!current('SESSION_SECRET')||current('SESSION_SECRET').startsWith('CHANGE_'))replaceOrAdd('SESSION_SECRET',crypto.randomBytes(48).toString('hex'));
fs.writeFileSync(file,content,{mode:0o600});fs.chmodSync(file,0o600);
console.log('Local preview folder:',media);
console.log('Config stored securely in .env.local (not committed to GitHub).');
NODE

echo "Installing app dependencies if needed..."
npm install
echo "Starting MREM Digital Library on http://127.0.0.1:3000"
echo "Enter LOGIN_PASSWORD from .env.local. To stop, press Ctrl+C."
echo "Video, PDF and document files are READ ONLY; no database or file upload is needed."
npm run dev
