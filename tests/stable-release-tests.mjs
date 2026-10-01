import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const config=read('assets/js/app/config.js');
const index=read('index.html');
const ci=read('.github/workflows/ci.yml');
const main=read('assets/js/main.js');
const bills=read('assets/js/views/bills.js');
const settings=read('assets/js/views/settings.js');

assert.match(config,/version:\s*'2\.3\.0'/);
assert.doesNotMatch(config,/beta/i);
assert.match(index,/<title>Finance<\/title>/);
assert.match(index,/Stable 2\.3/);
assert.doesNotMatch(index,/Working Beta/);
assert.match(ci,/\- stable/);
assert.match(ci,/finance-v2\.3\.0-stable\.zip/);
assert.doesNotMatch(bills,/\\`/,'bills view must not contain escaped template delimiters');
assert.doesNotMatch(bills,/\\\$\{/,'bills view must not contain escaped template interpolation');
assert.doesNotMatch(main,/const\s+_v\d+\w*\s*=|renderAll\s*=\s*function/,'stable must not reintroduce patch-wrapper chains');
assert.doesNotMatch(read('assets/js/app/receipt-controller.js'),/new MutationObserver\(syncVersionLabel\)/);
assert.match(settings,/Region & Format/);
assert.match(read('assets/js/views/budget.js'),/Davon verbraucht/);
assert.match(read('assets/js/views/budget.js'),/Ausserhalb Budget/);
assert.match(read('assets/js/app/recurrence.js'),/effectiveNextDate/);
assert.match(read('assets/js/views/recurring.js'),/Nächster Plantermin/);
assert.match(read('assets/js/views/fixed-costs.js'),/Nächster Plantermin/);
assert.match(main,/Diese Planung ist verknüpft mit/);
assert.match(main,/Diese Schuld hat eine Zahlungshistorie/);

console.log('Stable release guard assertions OK');

assert.match(main,/allowed\.add\('merchants'\)/,'settings merchant route must be reachable even when hidden from primary navigation');
