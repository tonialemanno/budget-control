import assert from 'node:assert/strict';
import { renderImports } from '../assets/js/views/imports.js';
import { detectOwnBankTransfer } from '../assets/js/app/own-bank-transfers.js';
import { bankCounterpartyIban } from '../assets/js/app/csv-import.js';

const household={id:'household-1',base_currency:'CHF'};
const accounts=[
 {account_id:'salary',name:'LohnKonto',currency:'CHF',account_type:'checking'},
 {account_id:'savings',name:'Sparkonto',currency:'CHF',account_type:'savings',external_account_ref:null},
];
const rule={id:'save',description:'Sparen',amount:525,currency:'CHF',active:true,direction:'transfer',
  account_id:'salary',destination_account_id:'savings',next_date:'2026-10-25',cadence:'monthly'};
const paid={
 id:'source-23',household_id:household.id,account_id:'salary',source:'import',status:'booked',
 cashflow_type:'standard',transfer_group_id:null,currency:'CHF',amount:-525,
 occurred_at:'2026-10-23T12:00:00Z',
 import_raw_data:{row:{
  Beschreibung2:'SPAREN F R SCHLECHTE TAG; Dauerauftrag',
  Beschreibung3:'Konto-Nr. IBAN: CH11 0020 3203 8604 15M1 M; Transaktions-Nr. 9903296LK7678439'
 }}
};
const historic=[
 {id:'old-source',account_id:'salary',status:'booked',amount:-525,currency:'CHF',transfer_group_id:'historic-pair'},
 {id:'old-target',account_id:'savings',status:'booked',amount:525,currency:'CHF',transfer_group_id:'historic-pair'},
];
const view=renderImports({
 accounts,household,profile:{locale:'de-CH'},canWrite:true,
 transactions:[paid,...historic],recurringRules:[rule],importBatches:[],categories:[],
});
assert.match(view,/Eigene Umbuchungen prüfen/);
assert.match(view,/IBAN bestätigen und umbuchen/);
assert.match(view,/data-action="confirm-own-bank-transfer" data-id="source-23"/);
assert.match(view,/Sparkonto/);
assert.match(view,/525/);
assert.match(view,/…5M1M/);
assert.doesNotMatch(view,/CH11 0020 3203 8604 15M1 M/,'Do not display the full unconfirmed beneficiary account number');
const readOnly=renderImports({
 accounts,household,profile:{locale:'de-CH'},canWrite:false,
 transactions:[paid,...historic],recurringRules:[rule],importBatches:[],
});
assert.doesNotMatch(readOnly,/data-action="confirm-own-bank-transfer"/);
const confirmed=detectOwnBankTransfer({transaction:paid,accounts:[
 accounts[0],{...accounts[1],external_account_ref:bankCounterpartyIban(paid.import_raw_data.row)}
],recurringRules:[rule],transactions:[paid,...historic]});
assert.equal(confirmed.requiresConfirmation,false);
const confirmedView=renderImports({
 accounts:[accounts[0],{...accounts[1],external_account_ref:bankCounterpartyIban(paid.import_raw_data.row)}],
 household,profile:{locale:'de-CH'},canWrite:true,
 transactions:[paid,...historic],recurringRules:[rule],importBatches:[],
});
assert.doesNotMatch(confirmedView,/IBAN bestätigen und umbuchen/,'Once IBAN confirmed do not ask again');
console.log('One-time user-verified own account transfer repair UI OK');
