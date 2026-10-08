import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  analyzeImportRows,
  cashWithdrawalInfo,
  filterImportDuplicates,
  rowToTransaction,
  suggestKnownCategoryCandidates,
} from '../assets/js/app/csv-import.js';

const mapping={
  date:'Buchungsdatum',description:'Beschreibung1',counterparty:'',
  counterpartyAccount:'',bankReference:'',sourcePage:'',rawData:'',
  debit:'Belastung',credit:'Gutschrift',amount:'',
};

const domesticRow={
  Buchungsdatum:'2025-03-24',
  Beschreibung1:'EINKAUFSZENTRUM NEUMARKT',
  Beschreibung2:'19052875-0 05/27; Bezug Bancomat',
  Beschreibung3:'Kosten: Bargeldbezug am Bancomat anderer Banken/Postomat in der Schweiz; Transaktions-Nr. 123',
  Belastung:'-40.00',Gutschrift:'',Saldo:'100.00',
};
const domestic=rowToTransaction(domesticRow,mapping);
assert.ok(domestic);
assert.deepEqual(cashWithdrawalInfo({...domestic,currency:'CHF'}),{
  foreign:false,originalAmount:null,originalCurrency:null,targetCurrency:'CHF',sourceAmount:40,
});

const foreignRow={
  Buchungsdatum:'2025-04-28',
  Beschreibung1:'POSTE ITALIANE;00000 ALLISTE',
  Beschreibung2:'19052875-0 04/28; Bezug Bancomat',
  Beschreibung3:'Kartentransaktionsbetrag: -350.00 EUR; Devisenkurs: 0.958361; Kosten: Bargeldbezug am Bancomat im Ausland -5.00 CHF; Transaktions-Nr. 456',
  Belastung:'-340.43',Gutschrift:'',Saldo:'6481.73',
};
const foreign=rowToTransaction(foreignRow,mapping);
assert.deepEqual(cashWithdrawalInfo({...foreign,currency:'CHF'}),{
  foreign:true,originalAmount:350,originalCurrency:'EUR',targetCurrency:'EUR',sourceAmount:340.43,
});

const profile=analyzeImportRows([
  domesticRow,
  foreignRow,
  {...domesticRow,Buchungsdatum:'2025-03-25',Beschreibung1:'Migros',Beschreibung2:'19052875-0 05/27; Zahlung Debitkarte',Beschreibung3:'Transaktions-Nr. 789',Belastung:'-12.00'},
],mapping);
assert.equal(profile.valid,3);
assert.equal(profile.bankLike,3);
assert.equal(profile.atm,2);
assert.equal(profile.earliest,'2025-03-24');
assert.equal(profile.latest,'2025-04-28');

assert.deepEqual(suggestKnownCategoryCandidates({description:'Agrola Tankstelle;9320 Arbon',amount:-42}),['Tanken']);
assert.deepEqual(suggestKnownCategoryCandidates({description:'Rossmann 2739;79224 Umkirch',amount:-20}),['Shopping']);
assert.equal(suggestKnownCategoryCandidates({description:'KIM NGOC TAKE AWAY; Zahlung UBS TWINT',amount:-18.5})[0],'Restaurant & Café');
assert.deepEqual(suggestKnownCategoryCandidates({description:'Cityparking Brühltor;9004 St. Gallen',amount:-4}),['Parken']);
assert.deepEqual(suggestKnownCategoryCandidates({description:'Dr. med. dent. Muster',amount:-200}),['Arzt & Zahnarzt']);

const existing=[{
  id:'old-1',status:'booked',source:'import',import_batch_id:'pdf-old',
  account_id:'lohn',currency:'CHF',amount:-58.15,
  occurred_at:'2026-03-07T12:00:00.000Z',
  description:'Migros M Neudorf;9016 St. Gallen 07.03.2026',
  merchant_id:'migros-old',
  merchants:{name:'Migros',normalized_key:'migros'},
}];
const incoming=[
  {
    id:'new-a',account_id:'lohn',currency:'CHF',amount:-58.15,
    occurred_at:'2026-03-07T12:00:00.000Z',
    description:'Migros M Neudorf;9016 St. Gallen',
    merchant_id:'migros-new',merchant_key:'migros',
  },
  {
    id:'new-b',account_id:'lohn',currency:'CHF',amount:-58.15,
    occurred_at:'2026-03-07T12:00:00.000Z',
    description:'Migros M Neudorf;9016 St. Gallen',
    merchant_id:'migros-new',merchant_key:'migros',
  },
];
const filtered=filterImportDuplicates(incoming,existing);
assert.equal(filtered.duplicates.length,1,'One existing bank row may consume only one matching incoming row.');
assert.equal(filtered.accepted.length,1,'A second real same-day same-amount transaction must survive.');

const different=filterImportDuplicates([{
  account_id:'lohn',currency:'CHF',amount:-58.15,occurred_at:'2026-03-07T12:00:00.000Z',
  description:'SBB MOBILE',merchant_id:'sbb',merchant_key:'sbb',
}],existing);
assert.equal(different.duplicates.length,0,'Same date and amount alone must not delete a different merchant.');

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/account\.account_type==='cash'/);
assert.match(main,/sieht wie ein Bankkontoauszug aus/);
assert.match(main,/filterImportDuplicates\(prepared,importDuplicatePool\)/);
assert.match(main,/reconcileImportedCashWithdrawals/);
assert.match(main,/Bargeldbezug Ausland · Originalbetrag prüfen/);
assert.match(main,/Zeitraum \$\{earliest\}–\$\{latest\}/);

console.log('R58 import intelligence assertions OK');
