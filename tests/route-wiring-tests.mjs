import assert from 'node:assert/strict';
import { NAV_ITEMS, PAGE_META, MODULES } from '../assets/js/app/config.js';
import { base, tests } from './render-rich.mjs';

const knownRoutes=new Set(Object.keys(tests));
for(const item of NAV_ITEMS){
  assert.ok(PAGE_META[item.route],`NAV route ${item.route} needs PAGE_META`);
  assert.ok(knownRoutes.has(item.route),`NAV route ${item.route} needs a renderer`);
  assert.ok(MODULES[item.module],`NAV route ${item.route} references unknown module ${item.module}`);
}

for(const route of ['settings','categories','merchants','import-history']){
  assert.ok(PAGE_META[route],`internal route ${route} needs PAGE_META`);
  assert.ok(knownRoutes.has(route),`internal route ${route} needs a renderer`);
}

const missingLinks=[];
for(const [view,render] of Object.entries(tests)){
  const html=render(base);
  for(const match of html.matchAll(/href="#\/([^"?]+)(?:\?[^"]*)?"/g)){
    const route=match[1];
    if(!knownRoutes.has(route)) missingLinks.push(`${view} -> ${route}`);
  }
}
assert.deepEqual([...new Set(missingLinks)],[],'every internal route link must resolve');

console.log(`route wiring assertions OK (${knownRoutes.size} renderers)`);
