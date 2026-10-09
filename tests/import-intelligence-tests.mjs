import assert from 'node:assert/strict';
import { suggestImportSemantic } from '../assets/js/app/import-intelligence.js';

assert.equal(suggestImportSemantic({amount:5000,description:'LOHN Oktober'}).value,'earned_income');
assert.equal(suggestImportSemantic({amount:42,description:'Refund Bestellung'}).value,'refund');
assert.equal(suggestImportSemantic({amount:-850,description:'Staatssteuer 2026'}).value,'tax_payment');
assert.equal(suggestImportSemantic({amount:-700,description:'Darlehensrate'}).value,'debt_repayment');
assert.equal(suggestImportSemantic({amount:-1200,description:'Restaurant'}),null);

console.log('import movement intelligence assertions OK');
