import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTransactions } from '../assets/js/views/transactions.js';
import { buildCategorizationGroups } from '../assets/js/app/categorization.js';
import { CH } from '../assets/js/country/ch.js';

const categories=[
  {id:'food',name:'Lebensmittel',kind:'expense',is_archived:false},
  {id:'repair',name:'Wartung & Reparatur',kind:'expense',is_archived:false},
  {id:'salary',name:'Lohn',kind:'income',is_archived:false},
  {id:'refund',name:'Rückzahlung',kind:'income',is_archived:false},
  {id:'other-income',name:'Sonstige Einnahmen',kind:'income',is_archived:false},
];

const transactions=[
  {id:'t1',household_id:'h1',account_id:'salary-account',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-01T12:00:00Z',amount:-100,currency:'CHF',description:'Antonio Giuseppe Alemanno',counterparty:'Antonio Giuseppe Alemanno',note:'Sparrate erhöht',accounts:{name:'Lohnkonto'}},
  {id:'t1b',household_id:'h1',account_id:'save',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-01T12:05:00Z',amount:100,currency:'CHF',description:'Umbuchung Eingang',counterparty:'Antonio Giuseppe Alemanno',accounts:{name:'Sparen'}},
  {id:'t2',household_id:'h1',account_id:'salary-account',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-02T12:00:00Z',amount:-250,currency:'CHF',description:'Antonio Giuseppe Alemanno',counterparty:'Antonio Giuseppe Alemanno',accounts:{name:'Lohnkonto'}},
  {id:'income1',household_id:'h1',account_id:'salary-account',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-03T12:00:00Z',amount:80,currency:'CHF',description:'Private Rückzahlung',counterparty:'Mamma',accounts:{name:'Lohnkonto'}},
];

const html=renderTransactions({
  accounts:[
    {account_id:'salary-account',name:'Lohnkonto',currency:'CHF',account_type:'checking',is_archived:false},
    {account_id:'zak',name:'ZAK Essen',currency:'CHF',account_type:'checking',is_archived:false},
    {account_id:'save',name:'Sparen',currency:'CHF',account_type:'savings',is_archived:false},
  ],
  categories,
  transactions,
  debtPayments:[],
  bills:[],
  household:{id:'h1',base_currency:'CHF'},
  profile:{locale:'de-CH'},
  canWrite:true,
  merchants:[],
  merchantAliases:[],
  counterparties:[],
  transactionContexts:[],
  vehicles:[],
  categorizationRules:[],
  recurringRules:[],
  categorizationOpen:true,
  categorizationFilter:'action',
  categorizationPage:1,
  categorizationGroupKey:'expense:antonio giuseppe alemanno',
});

assert.match(html,/Auswahl bearbeiten|Auswahl offen/);
assert.match(html,/data-categorization-select/);
assert.match(html,/Alle markieren/);
assert.match(html,/Auswahl speichern/);
assert.match(html,/Auswahl als interne Umbuchung \/ Sparen/);
assert.match(html,/Auswahl als Umbuchung verbuchen/);
assert.match(html,/Von Konto:/);
assert.match(html,/Lohnkonto/);
assert.match(html,/Gegenpartei:/);
assert.match(html,/Banktext:/);
assert.match(html,/Notiz \/ Zweck:/);
assert.match(html,/Sparrate erhöht/);
assert.match(html,/Mögliche Umbuchung:/);
assert.match(html,/Sparen/);
assert.match(html,/Lohn/);
assert.match(html,/Rückzahlung/);
assert.match(html,/Sonstige Einnahmen/);
assert.match(html,/Nur noch zu bearbeiten/);

const completedMixed=[
  {id:'m1',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:'food',occurred_at:'2026-09-01T12:00:00Z',amount:-40,currency:'CHF',description:'Mamma',counterparty:'Mamma'},
  {id:'m2',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:'repair',occurred_at:'2026-09-02T12:00:00Z',amount:-452.37,currency:'CHF',description:'Mamma',counterparty:'Mamma'},
];
const mixedGroup=buildCategorizationGroups({transactions:completedMixed,categories,merchants:[],aliases:[],rules:[]})
  .find((group)=>group.name==='Mamma');
assert.equal(mixedGroup?.mixed,true);
assert.equal(mixedGroup?.unassignedCount,0);
assert.equal(mixedGroup?.needsAttention,false,'already categorized mixed groups must not remain in the open work list');

assert.ok(CH.starterCategories.some(([name,kind])=>name==='Lohn'&&kind==='income'));
assert.ok(CH.starterCategories.some(([name,kind])=>name==='Rückzahlung'&&kind==='income'));
assert.ok(CH.starterCategories.some(([name,kind])=>name==='Sonstige Einnahmen'&&kind==='income'));

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/categorizationSelectedIds/);
assert.match(main,/categorization-apply-selected-category/);
assert.match(main,/categorization-apply-selected-transfer/);
assert.match(main,/convertCategorizationSelectionToTransfers/);
assert.match(main,/uniqueBulkTransferCandidate/);
assert.match(main,/convertTransactionToTransferV2/);
assert.match(main,/Keine feste Regel angelegt/);
assert.match(main,/missingIncomeCategories/);
assert.match(main,/Sammelumbuchungen funktionieren nur bei gleicher Währung/);

console.log('categorization bulk selection assertions OK');

assert.doesNotMatch(main,/missingStarter=\(cfg\.starterCategories/,'categorization must not reinstall every missing starter category');
