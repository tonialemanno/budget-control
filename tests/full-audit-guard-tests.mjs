import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}

const jsFiles=walk(path.join(root,'assets','js')).filter((file)=>file.endsWith('.js'));
const versionedInternalImports=[];
const staleReleaseRefs=[];
const misspelledBrand=[];
for(const file of jsFiles){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/(?:from\s+|import\s*\()\s*['\"]([^'\"]+)['\"]/g)){
    if(match[1].includes('?v=')) versionedInternalImports.push(path.relative(root,file)+': '+match[1]);
  }
  if(/2026100\d-r(?:[0-6]\d)|2026\.10\.0\d-r(?:[0-6]\d)/.test(source)){
    staleReleaseRefs.push(path.relative(root,file));
  }
  if(source.includes('ALEMANN0')) misspelledBrand.push(path.relative(root,file));
}
assert.deepEqual(versionedInternalImports,[],'internal ES modules must have one canonical URL so stateful modules cannot split');
assert.deepEqual(staleReleaseRefs,[],'runtime JS must not keep old hard-coded release ids');
assert.deepEqual(misspelledBrand,[],'ALEMANNO must never be spelled with a zero');

const index=read('index.html');
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.match(index,/apple-touch-icon[^>]+apple-touch-icon\.png/,'iPhone home-screen icon must use a real PNG');
assert.equal(fs.existsSync(path.join(root,'assets/brand/apple-touch-icon.png')),true,'Apple touch PNG must exist');
assert.equal(manifest.name.includes('ALEMANNO'),true);
assert.equal(JSON.stringify(manifest).includes('ALEMANN0'),false);

const router=read('assets/js/app/router.js');
for(const route of ['overview','review','money','accounts','transactions','imports','documents','projects','debts','receivables','legal','planning','budget','fixed-costs','recurring','bills','sales-documents','goals','tax-advisor','family','wealth','property','vehicles','insurance','investments','pension','intelligence','profile','settings','categories','merchants','setup','admin']){
  assert.ok(router.includes("route:'"+route+"'"),'route missing: '+route);
}

console.log('full audit guard assertions OK');
