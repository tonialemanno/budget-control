import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.localStorage={
  getItem(){ return null; },
  setItem(){},
  removeItem(){},
};
globalThis.window={
  setTimeout,
  clearTimeout,
};

const { financeApi }=await import('../assets/js/app/finance-api.js');
const { backend }=await import('../assets/js/app/backend.js');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else if(entry.name.endsWith('.js')) files.push(full);
  }
}
walk(path.join(root,'assets','js'));

const missingFinance=new Map();
const missingBackend=new Map();
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/\bfinanceApi\.([A-Za-z_$][\w$]*)/g)){
    const method=match[1];
    if(typeof financeApi[method]!=='function'){
      if(!missingFinance.has(method)) missingFinance.set(method,[]);
      missingFinance.get(method).push(path.relative(root,file));
    }
  }
  for(const match of source.matchAll(/\bbackend\.([A-Za-z_$][\w$]*)/g)){
    const method=match[1];
    if(typeof backend[method]!=='function'){
      if(!missingBackend.has(method)) missingBackend.set(method,[]);
      missingBackend.get(method).push(path.relative(root,file));
    }
  }
}

assert.deepEqual([...missingFinance],[],'every financeApi call must resolve to a method');
assert.deepEqual([...missingBackend],[],'every backend call must resolve to a method');

console.log(`API wiring assertions OK (${Object.keys(financeApi).length} finance methods, ${Object.keys(backend).length} backend methods)`);
