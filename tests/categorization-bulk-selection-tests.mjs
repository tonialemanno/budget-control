import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTransactions } from '../assets/js/views/transactions.js';

const transactions=[
  {id:'t1',household_id:'h1',account_id:'salary',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-01T12:00:00Z',amount:-100,currency:'CHF',description:'Antonio Giuseppe Alemanno',counterparty:'Antonio Giuseppe Alemanno',accounts:{name:'Lohnkonto'}},
  {id:'t2',household_id:'h1',account_id:'salary',status:'booked',cashflow_type:'standard',transfer_group_id:null,category_id:null,occurred_at:'2026-10-02T12:00:00Z',amount:-250,currency:'CHF',description:'Antonio Giuseppe Alemanno',counterparty:'Antonio Giuseppe Alemanno',accounts:{name:'Lohnkonto'}},
];

const html=renderTransactions({
  accounts:[
    {account_id:'salary',name:'Lohnkonto',currency:'CHF',account_type:'checking',is_archived:false},
    {account_id:'zak',name:'ZAK Essen',currency:'CHF',account_type:'checking',is_archived:false},
    {account_id:'save',name:'Sparen',currency:'CHF',account_type:'savings',is_archived:false},
  ],
  categories:[
    {id:'food',name:'Lebensmittel',kind:'expense',is_archived:false},
    {id:'saving',name:'Sparen',kind:'expense',is_archived:false},
  ],
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
assert.match(html,/Kategorie auf Auswahl setzen/);
assert.match(html,/Auswahl als interne Umbuchung \/ Sparen/);
assert.match(html,/Auswahl als Umbuchung verbuchen/);
assert.match(html,/ZAK Essen · CHF · Zahlungskonto/);
assert.match(html,/Sparen · CHF · Sparkonto/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/categorizationSelectedIds/);
assert.match(main,/categorization-apply-selected-category/);
assert.match(main,/categorization-apply-selected-transfer/);
assert.match(main,/convertCategorizationSelectionToTransfers/);
assert.match(main,/uniqueBulkTransferCandidate/);
assert.match(main,/convertTransactionToTransferV2/);
assert.match(main,/Machine Learning lernt diese Auswahl künftig mit/);
assert.match(main,/Sammelumbuchungen funktionieren nur bei gleicher Währung/);

console.log('categorization bulk selection assertions OK');
