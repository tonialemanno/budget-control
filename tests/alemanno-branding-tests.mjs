import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const config=fs.readFileSync(new URL('../assets/js/app/config.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const i18n=fs.readFileSync(new URL('../assets/js/app/i18n.js',import.meta.url),'utf8');
const icons=fs.readFileSync(new URL('../assets/js/app/icons.js',import.meta.url),'utf8');

assert.match(config,/appName:\s*'ALEMANNO BUCHHALTUNG'/);
assert.match(config,/releaseId:\s*'2026\.10\.08-r57'/);
assert.match(index,/<title>ALEMANNO BUCHHALTUNG<\/title>/);
assert.match(index,/>ALEMANNO BUCHHALTUNG<\/span>/);
assert.match(index,/alemanno-mark\.svg/);
assert.doesNotMatch(index,/spendy/i);
assert.match(icons,/alemanno:/);
assert.doesNotMatch(icons,/spendy:/i);
assert.match(i18n,/'ALEMANNO BUCHHALTUNG durchsuchen':'Cerca in ALEMANNO BUCHHALTUNG'/);
assert.match(i18n,/'ALEMANNO BUCHHALTUNG durchsuchen':'Search ALEMANNO BUCHHALTUNG'/);

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}
const rootPath=new URL('../',import.meta.url).pathname;
const runtimeFiles=[
  new URL('../index.html',import.meta.url).pathname,
  ...walk(new URL('../assets/js/',import.meta.url).pathname).filter((file)=>file.endsWith('.js')),
];
const spendyLeftovers=[];
for(const file of runtimeFiles){
  const content=fs.readFileSync(file,'utf8');
  if(/spendy/i.test(content)) spendyLeftovers.push(path.relative(rootPath,file));
}
assert.deepEqual(spendyLeftovers,[],`Obsolete Spendy branding remains in runtime files: ${spendyLeftovers.join(', ')}`);

console.log('ALEMANNO BUCHHALTUNG branding assertions OK');
