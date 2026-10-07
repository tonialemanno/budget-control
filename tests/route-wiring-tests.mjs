import assert from 'node:assert/strict';
import { NAV_ITEMS, PAGE_META, MODULES } from '../assets/js/app/config.js';
import { ROUTE_REGISTRY, legacyHashToHref, routeDefinition, routeFromPath } from '../assets/js/app/router.js';
import { base, tests } from './render-rich.mjs';

const knownRoutes=new Set(Object.keys(tests));
for(const item of NAV_ITEMS){
  assert.ok(PAGE_META[item.route],`NAV route ${item.route} needs PAGE_META`);
  assert.ok(knownRoutes.has(item.route),`NAV route ${item.route} needs a renderer`);
  assert.ok(MODULES[item.module],`NAV route ${item.route} references unknown module ${item.module}`);
  assert.ok(routeDefinition(item.route)?.path,`NAV route ${item.route} needs a real URL path`);
}

for(const route of ['settings','profile','setup','categories','merchants','import-history']){
  assert.ok(PAGE_META[route],`internal route ${route} needs PAGE_META`);
  assert.ok(knownRoutes.has(route),`internal route ${route} needs a renderer`);
  assert.ok(routeDefinition(route)?.path,`internal route ${route} needs a path`);
}

for(const route of ROUTE_REGISTRY){
  assert.ok(knownRoutes.has(route.route),`route registry entry ${route.route} needs a renderer`);
  assert.equal(routeFromPath(route.path)?.route,route.route,`path ${route.path} must resolve to ${route.route}`);
}

const missingLinks=[];
for(const [view,render] of Object.entries(tests)){
  const html=render(base);
  for(const match of html.matchAll(/href="#\/([^"?]+)(?:\?[^"]*)?"/g)){
    const route=match[1];
    if(!knownRoutes.has(route) || !legacyHashToHref(match[0].match(/href="([^"]+)"/)?.[1]||'')) {
      missingLinks.push(`${view} -> ${route}`);
    }
  }
}
assert.deepEqual([...new Set(missingLinks)],[],'every internal route link must resolve to a real path');

console.log(`route wiring assertions OK (${knownRoutes.size} renderers)`);
