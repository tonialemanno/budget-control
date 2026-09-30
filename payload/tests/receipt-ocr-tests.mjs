import assert from 'node:assert/strict';
import { parseReceiptText, findReceiptMatches } from '../assets/js/app/receipt-ocr.js';

const sample = `
McDonald's St. Gallen
30.09.2026 08:42
Big Mac Menu 16.90
McFlurry 7.90
TOTAL CHF 24.80
VISA 24.80
`;

const parsed = parseReceiptText(sample,{fallbackCurrency:'CHF'});
assert.equal(parsed.merchant,"McDonald's");
assert.equal(parsed.suggestedCategoryName,'Restaurant');
assert.equal(parsed.amount,24.8);
assert.equal(parsed.currency,'CHF');
assert.equal(parsed.date,'2026-09-30');

const matches = findReceiptMatches({
  amount:24.8,
  currency:'CHF',
  date:'2026-09-30',
  merchant:"McDonald's",
  transactions:[{
    id:'t1',status:'booked',amount:-24.8,currency:'CHF',occurred_at:'2026-09-30T08:43:00+02:00',
    transfer_group_id:null,cashflow_type:'standard',description:'MCDONALDS ST GALLEN',counterparty:"McDonald's",merchants:{name:"McDonald's"},
  }],
});
assert.equal(matches.length,1);
assert.equal(matches[0].tx.id,'t1');
assert.equal(matches[0].highConfidence,true);
console.log('receipt OCR assertions OK');
