import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ROUTE_REGISTRY, NAV_ITEMS, PAGE_META,
  routeDefinition, routeFromPath, routeHref, legacyHashToHref, currentRouteLocation,
} from '../assets/js/app/router.js';

const routes=new Set();
const paths=new Set();
for(const row of ROUTE_REGISTRY){
  assert.ok(row.route);
  assert.ok(row.path.startsWith('/'));
  assert.ok(row.title);
  assert.ok(row.eyebrow);
  assert.equal(routes.has(row.route),false,`duplicate route ${row.route}`);
  assert.equal(paths.has(row.path),false,`duplicate path ${row.path}`);
  routes.add(row.route);
  paths.add(row.path);
  assert.equal(PAGE_META[row.route].path,row.path);
}

assert.equal(routeHref('overview'),'/');
assert.equal(routeHref('profile'),'/selfservice/profile');
assert.equal(routeHref('settings'),'/selfservice/settings');
assert.equal(routeHref('transactions'),'/finance/transactions');
assert.equal(routeHref('sales-documents'),'/planning/invoices');
assert.equal(routeHref('admin'),'/admin');
assert.equal(routeHref('transactions',{create:'expense',account:'abc'}),'/finance/transactions?create=expense&account=abc');

assert.equal(routeFromPath('/overview')?.route,'overview');
assert.equal(routeFromPath('/money')?.route,'money');
assert.equal(routeFromPath('/admin/users')?.route,'admin');
assert.equal(routeFromPath('/planning/sales-documents')?.route,'sales-documents');

assert.equal(legacyHashToHref('#/transactions?create=income'),'/finance/transactions?create=income');
const current=currentRouteLocation({pathname:'/finance/accounts',search:'?x=1',hash:''});
assert.equal(current.route,'accounts');
assert.equal(current.definition,routeDefinition('accounts'));
assert.equal(current.pathname,'/finance/accounts');
assert.equal(current.search,'?x=1');
assert.equal(current.params.get('x'),'1');
assert.equal(current.legacy,false);
assert.equal(current.href,'/finance/accounts?x=1');

for(const item of NAV_ITEMS){
  assert.ok(routeDefinition(item.route),`nav item ${item.route} must exist in registry`);
}

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.doesNotMatch(index,/href="#\//);
assert.match(index,/href="\/assets\/brand\/financeapp-mark\.svg/);
assert.match(index,/src="\/assets\/js\/main\.js/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.doesNotMatch(main,/location\.hash\s*=/);
assert.doesNotMatch(main,/href="#\//);
assert.match(main,/window\.addEventListener\('popstate'/);
assert.match(main,/handleAppRouteLink/);
assert.match(main,/rewriteLegacyRouteLinks/);

const redirects=fs.readFileSync(new URL('../_redirects',import.meta.url),'utf8');
assert.match(redirects,/\/\* \/index\.html 200/);

console.log(`central router assertions OK (${ROUTE_REGISTRY.length} routes)`);
