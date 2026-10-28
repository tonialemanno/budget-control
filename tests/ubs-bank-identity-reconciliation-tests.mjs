import assert from 'node:assert/strict';
import { parseCsv,guessMapping,rowToTransaction,bankPostingId,
  filterImportDuplicates,transactionFingerprint } from '../assets/js/app/csv-import.js';

const header='Buchungsdatum;Beschreibung1;Beschreibung2;Transaktions-Nr.;Belastung;Gutschrift;Saldo';
const oldText=header+'\n2026-10-23;Dauerauftrag;Scheidung;9903296LK7678403;-150.00;;4273.62';
const newText=header+'\n2026-10-23;Kanton Appenzell A.Rh.;SCHEIDUNG;9903296LK7678403;-150.00;;4253.62';
function rows(input){
  const parsed=parseCsv(input);const mapping=guessMapping(parsed.headers);
  return parsed.rows.map((row)=>rowToTransaction(row,mapping));
}
const old=rows(oldText)[0],fresh=rows(newText)[0];
assert.equal(old.amount,-150);
assert.equal(old.bank_reference,'UBS:9903296LK7678403');
assert.equal(bankPostingId(old),'9903296LK7678403');
assert.equal(bankPostingId(fresh),'9903296LK7678403');
const [h1,h2]=await Promise.all([transactionFingerprint('salary',old),transactionFingerprint('salary',fresh)]);
assert.equal(h1,h2,'Changing the bank description must not alter fingerprint');
const prior={...old,account_id:'salary',currency:'CHF',source:'import',status:'booked',id:'old'};
const incoming={...fresh,account_id:'salary',currency:'CHF',source:'import',status:'booked',id:'new'};
assert.equal(filterImportDuplicates([incoming],[prior]).accepted.length,0);
assert.equal(filterImportDuplicates([incoming],[prior]).duplicates.length,1);
assert.equal(filterImportDuplicates([incoming,incoming],[]).accepted.length,1);
assert.equal(filterImportDuplicates([incoming,incoming],[]).duplicates.length,1);
const actualSecond={...incoming,bank_reference:'UBS:DIFFERENT1234',import_raw_data:{
 row:{...incoming.import_raw_data.row,'Transaktions-Nr.':'9903296LK7678404'}
}};
assert.equal(filterImportDuplicates([actualSecond],[prior]).accepted.length,1,
  'Two same-day same-amount bank postings must never be collapsed');
assert.equal(filterImportDuplicates([incoming],[{...prior,account_id:'other'}]).accepted.length,1);
assert.throws(()=>filterImportDuplicates([{...incoming,amount:-151}],[prior]),/widersprüchlichen Beträgen/);

// The UBS CSV carries a running account balance but that is never an independent ledger posting.
assert.equal(fresh.import_raw_data.row.Saldo,'4253.62');
console.log('Bank ID based deduplication: enhanced UBS export safe; repeated amounts preserved');
