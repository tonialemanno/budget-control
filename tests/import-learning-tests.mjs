import assert from 'node:assert/strict';
import fs from 'node:fs';
import { merchantFromTransaction, suggestKnownCategoryCandidates } from '../assets/js/app/csv-import.js';

const salarySep=merchantFromTransaction({description:'Abacus Umantis AG 25.09.2026',amount:6412.05});
const salaryOct=merchantFromTransaction({description:'Abacus Umantis AG 25.10.2026',amount:6412.05});
assert.equal(salarySep.name,'Abacus Umantis AG');
assert.equal(salaryOct.name,'Abacus Umantis AG');
assert.equal(salarySep.key,'abacus umantis ag');
assert.equal(salaryOct.key,'abacus umantis ag');
assert.notEqual(salarySep.aliasKey,salaryOct.aliasKey,'Raw dated variants should remain distinct aliases while sharing one canonical merchant.');
assert.equal(salarySep.rawName,'Abacus Umantis AG 25.09.2026');

const rentSep=merchantFromTransaction({description:'Uzon Immobilien AG 25.09.2026',amount:-1576});
const rentOct=merchantFromTransaction({description:'Uzon Immobilien AG 25.10.2026',amount:-1576});
assert.equal(rentSep.key,rentOct.key);
assert.equal(rentSep.name,'Uzon Immobilien AG');

const sumup=merchantFromTransaction({description:'SUMUP *LADMANN CATERING 03.10.2026',amount:-20});
assert.equal(sumup.name,'LADMANN CATERING');
assert.equal(sumup.key,'ladmann catering');
assert.equal(sumup.paymentProcessor,'SumUp');

const edeka=merchantFromTransaction({description:'EDK*HAFERKATER STORES 05.07.2026',amount:-42.7});
assert.equal(edeka.name,'EDEKA');
assert.equal(edeka.key,'edeka');
assert.deepEqual(
  suggestKnownCategoryCandidates({description:'EDK*HAFERKATER STORES 05.07.2026',amount:-42.7}),
  ['Lebensmittel'],
  'Supermarket merchants must use the spending purpose Lebensmittel rather than a merchant-type category.',
);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/async function applyImportGroupLearning/);
assert.match(main,/merchantFromTransaction\(row\)/);
assert.match(main,/bulkUpdateTransactions\(candidates\.map/);
assert.match(main,/requestAnimationFrame\(\(\)=>window\.scrollTo/);
assert.doesNotMatch(main,/for \(const id of ids\) await financeApi\.updateTransaction\(id,\{category_id:categoryId\}\)/);

const imports=fs.readFileSync(new URL('../assets/js/views/imports.js',import.meta.url),'utf8');
assert.match(imports,/merchantFromTransaction/);
assert.match(imports,/stableKey/);

console.log('import-learning-tests: ok');
