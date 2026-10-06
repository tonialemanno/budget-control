import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  merchantFromTransaction,
  resolveCanonicalMerchant,
  suggestKnownCategoryCandidates,
} from '../assets/js/app/csv-import.js';
import { semanticExpenseBase, semanticType } from '../assets/js/app/finance-semantics.js';
import { renderTransactions } from '../assets/js/views/transactions.js';
import { renderMerchants } from '../assets/js/views/merchants.js';
import { CH } from '../assets/js/country/ch.js';

const swisslos=merchantFromTransaction({description:'SWISSLOS E-COMMERCE; Zahlung UBS TWINT'});
assert.equal(swisslos.name,'Swisslos');
assert.equal(swisslos.key,'swisslos');
assert.deepEqual(suggestKnownCategoryCandidates({description:'SWISSLOS E-COMMERCE; Zahlung UBS TWINT'}),['Lotterie & Gewinnspiele','Freizeit']);

const edekaA=merchantFromTransaction({description:'EDEKA BRAND;00000 FREIBURG'});
const edekaB=merchantFromTransaction({description:'EDEKA BRAND BACKSHOP'});
assert.equal(edekaA.name,'EDEKA');
assert.equal(edekaA.key,'edeka');
assert.equal(edekaB.key,'edeka');
const edekaC=merchantFromTransaction({description:'EDK*HAFERKATER STORES 05.07.2026'});
assert.equal(edekaC.name,'EDEKA');
assert.equal(edekaC.key,'edeka');
assert.deepEqual(
  suggestKnownCategoryCandidates({description:'EDK*HAFERKATER STORES 05.07.2026'}),
  ['Supermarkt','Lebensmittel']
);

const sumup=merchantFromTransaction({description:'bezug SUMUP *KEBAB HUSLI IMBI;0000 ARBON'});
assert.equal(sumup.paymentProcessor,'SumUp');
assert.equal(sumup.key,'kebab husli imbi');
assert.match(sumup.name,/KEBAB HUSLI IMBI/i);

const otherSumup=merchantFromTransaction({description:'SUMUP *PLAZA CAFE RESTA'});
assert.notEqual(otherSumup.key,sumup.key);
assert.equal(otherSumup.paymentProcessor,'SumUp');

assert.deepEqual(
  suggestKnownCategoryCandidates({description:'Elvetino AG'}),
  ['Restaurant & Café','Restaurant','Freizeit']
);
assert.deepEqual(
  suggestKnownCategoryCandidates({description:'SERAFE AG'}),
  ['Haushaltsabgaben','Wohnen']
);
assert.deepEqual(
  suggestKnownCategoryCandidates({description:'Garage Rossi riparazione scooter'}),
  ['Wartung & Reparatur','Mobilität']
);
assert.deepEqual(
  suggestKnownCategoryCandidates({description:'Überweisung an Mirco',note:'Blumen für Grab und Gedenken'}),
  ['Geschenke & Gedenken','Freizeit']
);

const canonical={id:'m1',name:'EDEKA',normalized_key:'edeka',default_category_id:'supermarkt'};
const resolved=resolveCanonicalMerchant(
  {name:'EDEKA BRAND',key:'edeka brand',aliasKey:'edeka brand'},
  {merchants:[canonical],aliases:[{merchant_id:'m1',normalized_key:'edeka brand'}]}
);
assert.equal(resolved?.id,'m1');

const categories=[{id:'mob',name:'Mobilität',kind:'expense',parent_id:null}];
const assetTx={
  status:'booked',amount:-2500,currency:'CHF',semantic_type:'asset_acquisition',
  cashflow_type:'standard',transfer_group_id:null,
};
assert.equal(semanticType(assetTx,{categories,recurringRules:[]}),'asset_acquisition');
assert.equal(semanticExpenseBase(assetTx,{categories,recurringRules:[],debtPayments:[],baseCurrency:'CHF'}),0);

const txHtml=renderTransactions({
  accounts:[
    {account_id:'ubs',name:'UBS',currency:'CHF',account_type:'checking'},
    {account_id:'cash',name:'Bargeld CHF',currency:'CHF',account_type:'cash'},
  ],
  categories:[],
  transactions:[],
  debtPayments:[],
  bills:[],
  household:{base_currency:'CHF'},
  profile:{locale:'de-CH'},
  canWrite:true,
  merchants:[],
  merchantAliases:[],
  counterparties:[{id:'p1',name:'Mamma',kind:'person'}],
  transactionContexts:[{id:'c1',name:'Ferien Italien 2026',context_type:'trip',is_archived:false}],
  vehicles:[{id:'v1',name:'Roller Italien',vehicle_type:'motorcycle'}],
  categorizationRules:[],
  recurringRules:[],
});
assert.match(txHtml,/value="cash_withdrawal">Bargeldbezug/);
assert.match(txHtml,/Bargeld-Wallet automatisch anlegen/);
assert.match(txHtml,/Gegenpartei-Typ/);
assert.match(txHtml,/Ferien Italien 2026/);
assert.match(txHtml,/Roller Italien/);
assert.match(txHtml,/Vermögenskauf \/ Fahrzeugkauf/);
assert.match(txHtml,/transactionContextFilter/);
assert.match(txHtml,/transactionVehicleFilter/);

const merchantHtml=renderMerchants({
  merchants:[
    {id:'e1',name:'EDEKA BRAND',normalized_key:'edeka brand',default_category_id:null},
    {id:'e2',name:'EDEKA BRAND;00000 FREIBURG',normalized_key:'edeka brand 00000 freiburg',default_category_id:'food'},
  ],
  merchantAliases:[],
  categories:[{id:'food',name:'Lebensmittel',kind:'expense'}],
  transactions:[{merchant_id:'e2'}],
  recurringRules:[],
  budgets:[],
  canWrite:true,
  household:{country_code:'CH'},
  countryMasterMerchants:[],
});
assert.match(merchantHtml,/Mögliche Händler-Dubletten/);
assert.match(merchantHtml,/data-action="merchant-merge"/);

assert.ok(CH.starterSubcategories.some(([name,parent])=>name==='Haushaltsabgaben'&&parent==='Wohnen'));
assert.ok(CH.starterSubcategories.some(([name,parent])=>name==='Lotterie & Gewinnspiele'&&parent==='Freizeit'));
assert.ok(CH.starterMerchantCategories.some(([merchant,category])=>merchant==='Swisslos'&&category==='Lotterie & Gewinnspiele'));
assert.ok(CH.starterSubcategories.some(([name,parent])=>name==='Restaurant & Café'&&parent==='Freizeit'));
assert.ok(CH.starterSubcategories.some(([name,parent])=>name==='Fahrzeugkauf'&&parent==='Mobilität'));
assert.ok(CH.starterSubcategories.some(([name,parent])=>name==='Wartung & Reparatur'&&parent==='Mobilität'));

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/ensureCashAccount/);
assert.match(main,/cash_withdrawal/);
assert.match(main,/resolveCounterpartyFromForm/);
assert.match(main,/resolveContextFromForm/);
assert.match(main,/resolveVehicleFromForm/);
assert.match(main,/recurring_rule_id:recurringRule\?\.id\|\|null/);
assert.match(main,/bereits vorhandenen wiederkehrenden Zahlung verknüpft/);

const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
assert.match(api,/listMerchantAliases/);
assert.match(api,/mergeMerchants/);
assert.match(api,/listCounterparties/);
assert.match(api,/listTransactionContexts/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_transaction_entities_and_context.sql',import.meta.url),'utf8');
assert.match(migration,/create table if not exists public\.merchant_aliases/);
assert.match(migration,/create table if not exists public\.counterparties/);
assert.match(migration,/create table if not exists public\.transaction_contexts/);
assert.match(migration,/recurring_rule_id uuid/);
assert.match(migration,/merge_merchants_v2/);

console.log('canonical merchant, context, cash and vehicle assertions OK');
