import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=new URL('../',import.meta.url);
const config=fs.readFileSync(new URL('../assets/js/app/config.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const i18n=fs.readFileSync(new URL('../assets/js/app/i18n.js',import.meta.url),'utf8');
const icons=fs.readFileSync(new URL('../assets/js/app/icons.js',import.meta.url),'utf8');

assert.match(config,/appName:\s*'Spendy'/);
assert.match(index,/<title>Spendy<\/title>/);
assert.match(index,/>Spendy<\/span>/);
assert.match(index,/spendy-mark\.svg/);
assert.match(icons,/spendy:/);
assert.match(i18n,/'Spendy durchsuchen':'Cerca in Spendy'/);
assert.match(i18n,/'Spendy durchsuchen':'Search Spendy'/);
assert.match(i18n,/'Spendy Intelligence':'Spendy Intelligence'/);

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}
const runtimeFiles=[new URL('../index.html',import.meta.url).pathname,...walk(new URL('../assets/js/',import.meta.url).pathname).filter((file)=>file.endsWith('.js'))];
const leftovers=[];
for(const file of runtimeFiles){
  const content=fs.readFileSync(file,'utf8');
  if(/\bFinance\b/.test(content)) leftovers.push(path.relative(new URL('../',import.meta.url).pathname,file));
}
assert.deepEqual(leftovers,[],`Standalone legacy brand name remains in runtime files: ${leftovers.join(', ')}`);

console.log('Spendy branding assertions OK');
