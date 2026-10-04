import assert from 'node:assert/strict';
import fs from 'node:fs';
import { merchantFromTransaction, suggestKnownCategoryName } from '../assets/js/app/csv-import.js';
import { merchantDuplicateGroups, matchingRecurringRules, personCandidateFromTransaction } from '../assets/js/app/merchant-intelligence.js';
import { renderTransactions } from '../assets/js/views/transactions.js';

const swisslos={description:'SWISSLOS E-COMMERCE; Zahlung UBS TWINT',counterparty:null,amount:-20,currency:'CHF'};
assert.deepEqual({name:merchantFromTransaction(swisslos).name,key:merchantFromTransaction(swisslos).key,category:suggestKnownCategoryName(swisslos)},{name:'Swisslos',key:'swisslos',category:'Lotterie & Gewinnspiele'});

const edekaA=merchantFromTransaction({description:'EDEKA BRAND;00000 FREIBURG'});
const edekaB=merchantFromTransaction({description:'EDEKA BRAND BACKSHOP;00000 FREIBURG'});
assert.equal(edekaA.name,'EDEKA');
assert.equal(edekaB.name,'EDEKA');
assert.equal(edekaA.key,edekaB.key);
assert.equal(suggestKnownCategoryName({description:'EDEKA BRAND BACKSHOP;00000 FREIBURG',amount:-12}),'Supermarkt');

const sumup=merchantFromTransaction({description:'SUMUP  *PIZZERIA ALPENBL;0000 ARBON',amount:-29,currency:'CHF'});
assert.equal(sumup.name,'PIZZERIA ALPENBL');
assert.equal(sumup.key,'pizzeria alpenbl');
assert.equal(sumup.paymentProcessor,'SumUp');
assert.equal(suggestKnownCategoryName({description:'SUMUP  *PIZZERIA ALPENBL;0000 ARBON',amount:-29}),'Restaurant & Café');

const mirco=personCandidateFromTransaction({description:'PISANELLO, MIRCO; Belastung UBS TWINT'});
assert.equal(mirco?.name,'Mirco Pisanello');
assert.equal(mirco?.kind,'person');
assert.equal(personCandidateFromTransaction({description:'McDonalds AG; Belastung UBS TWINT'}),null);

const duplicates=merchantDuplicateGroups([{id:'a',name:'EDEKA',normalized_key:'edeka'},{id:'b',name:'EDEKA BRAND',normalized_key:'edeka brand'},{id:'c',name:'Migros',normalized_key:'migros'}]);
assert.equal(duplicates.length,1);
assert.equal(duplicates[0].rows.length,2);

const matches=matchingRecurringRules({account_id:'ubs',merchant_id:'m1',category_id:'c1',amount:-46,currency:'CHF',description:'Yallo iPhone Rate',occurred_at:'2026-10-05T10:00:00Z'},[{id:'r1',active:true,direction:'expense',account_id:'ubs',merchant_id:'m1',category_id:'c1',amount:46,currency:'CHF',description:'Yallo iPhone Rate',next_date:'2026-10-05'}]);
assert.equal(matches[0]?.rule?.id,'r1');

const html=renderTransactions({accounts:[{account_id:'ubs',name:'UBS',currency:'CHF',account_type:'checking'},{account_id:'cash',name:'Kasse CHF',currency:'CHF',account_type:'cash'}],categories:[],transactions:[],debtPayments:[],bills:[],household:{base_currency:'CHF'},profile:{locale:'de-CH'},canWrite:true,merchants:[],merchantAliases:[],counterparties:[{id:'p1',name:'Mamma',kind:'person'}],transactionContexts:[{id:'ctx1',name:'Ferien Italien 2026',context_type:'trip'}],vehicles:[{id:'v1',name:'Scooter Italien'}],categorizationRules:[],recurringRules:[]});
assert.match(html,/Bargeldbezug → Kasse/);
assert.match(html,/Gegenpartei \/ Person/);
assert.match(html,/Kontext \/ Projekt/);
assert.match(html,/Ferien Italien 2026/);
assert.match(html,/Scooter Italien/);
assert.match(html,/transactionRecurringMatch/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_canonical_merchants_contexts.sql',import.meta.url),'utf8');
assert.match(migration,/merchant_aliases/);
assert.match(migration,/counterparties/);
assert.match(migration,/transaction_contexts/);
assert.match(migration,/merge_merchant_records/);
assert.match(migration,/update public\.transactions set merchant_id=v_target\.id/);

const ch=fs.readFileSync(new URL('../assets/js/country/ch.js',import.meta.url),'utf8');
for(const label of ['Restaurant & Café','Lotterie & Gewinnspiele','Haushaltsabgaben','Mietfahrzeug','Fahrzeugkauf','Wartung & Reparatur','Geschenke & Gedenken']) assert.ok(ch.includes(label),`missing CH master-data label: ${label}`);

console.log('merchant, context, cash and recurring intelligence assertions OK');
