import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jsRoot=path.join(root,'assets','js');

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?walk(full):[full];
  });
}

const files=walk(jsRoot).filter((file)=>file.endsWith('.js'));
const failures=[];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0) failures.push({file:path.relative(root,file),error:result.stderr||result.stdout});
}
assert.deepEqual(failures,[],`JavaScript syntax failures:\n${failures.map((f)=>`${f.file}: ${f.error}`).join('\n')}`);

const fallback=fs.readFileSync(path.join(root,'assets/js/boot-fallback.js'),'utf8');
const main=fs.readFileSync(path.join(root,'assets/js/main.js'),'utf8');
assert.match(fallback,/__FINANCE_BOOT_COMPLETE__/);
assert.match(main,/window\.__FINANCE_BOOT_COMPLETE__ = true/);

console.log(`javascript syntax assertions OK (${files.length} files)`);
