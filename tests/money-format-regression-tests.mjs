import assert from 'node:assert/strict';
import fs from 'node:fs';
import { moneyText } from '../assets/js/app/format.js';

assert.equal(moneyText(3.8,{currency:'CHF',locale:'de-CH'}),'CHF 3.80');
assert.equal(moneyText(9,{currency:'CHF',locale:'de-CH'}),'CHF 9.00');
assert.equal(moneyText(-9,{currency:'CHF',locale:'de-CH'}),'CHF -9.00');
assert.equal(moneyText(3.8,{currency:'EUR',locale:'de-DE'}),'3,80 €');

for(const path of [
  '../assets/js/views/overview.js',
  '../assets/js/views/planning.js',
  '../assets/js/views/budget.js',
  '../assets/js/app/charts.js',
]){
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/money(?:Text)?\([^\n]*decimals\s*:\s*0/,`${path} must use standard two-decimal money output`);
}
console.log('money format regression assertions OK');
