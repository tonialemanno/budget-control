import assert from 'node:assert/strict';
import { base, tests } from './render-rich.mjs';

function ids(html){
  return [...String(html).matchAll(/(?:^|\s)id="([^"]+)"/g)].map((m)=>m[1]);
}
function targets(html){
  return [...String(html).matchAll(/data-target="([^"]+)"/g)].map((m)=>m[1]);
}

for(const [name,render] of Object.entries(tests)){
  const html=render(base);
  assert.equal(/\b(?:undefined|NaN)\b/.test(html),false,`${name} rendered undefined/NaN`);
  assert.equal(html.includes('[object Object]'),false,`${name} rendered object text`);
  const pageIds=ids(html);
  const duplicates=[...new Set(pageIds.filter((id,index)=>pageIds.indexOf(id)!==index))];
  assert.deepEqual(duplicates,[],`${name} has duplicate DOM ids`);
  const set=new Set(pageIds);
  const missingTargets=targets(html).filter((id)=>!set.has(id));
  assert.deepEqual([...new Set(missingTargets)],[],`${name} has show-form targets without matching ids`);
}

console.log('render DOM integrity assertions OK');
