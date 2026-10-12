import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTransactions } from '../assets/js/views/transactions.js';
import { renderFixedCosts } from '../assets/js/views/fixed-costs.js';
import { renderCashflowChart } from '../assets/js/app/charts.js';

const merchants=[
  {id:'z',name:'Zalando',normalized_key:'zalando'},
  {id:'a',name:'Aldi',normalized_key:'aldi'},
  {id:'m',name:'Migros',normalized_key:'migros'},
];

const txHtml=renderTransactions({
  accounts:[{account_id:'ing',name:'ING',currency:'EUR',account_type:'checking'}],
  categories:[{id:'food',name:'Lebensmittel',kind:'expense'}],
  transactions:[],
  debtPayments:[],
  bills:[],
  household:{id:'h',base_currency:'EUR',country_code:'DE'},
  profile:{locale:'de-DE',preferences:{}},
  canWrite:true,
  merchants,
  merchantAliases:[],
  counterparties:[],
  transactionContexts:[],
  vehicles:[],
  recurringRules:[],
  categorizationRules:[],
  documents:[],
  transactionDuplicateIgnores:[],
});
assert.match(txHtml,/transactionCreateMerchantSearch/);
assert.match(txHtml,/transactionEditMerchantSearch/);
assert.ok(txHtml.indexOf('>Aldi<') < txHtml.indexOf('>Migros<'));
assert.ok(txHtml.indexOf('>Migros<') < txHtml.indexOf('>Zalando<'));

const fixedHtml=renderFixedCosts({
  accounts:[{account_id:'ing',name:'ING',currency:'EUR',account_type:'checking'}],
  categories:[
    {id:'rent',name:'Miete',kind:'expense'},
    {id:'salary',name:'Gehalt',kind:'income'},
  ],
  merchants,
  recurringRules:[],
  household:{id:'h',base_currency:'EUR',country_code:'DE'},
  profile:{locale:'de-DE',preferences:{}},
  canWrite:true,
  fxRates:[],
});
assert.ok(fixedHtml.indexOf('value="Aldi"') < fixedHtml.indexOf('value="Migros"'));
assert.ok(fixedHtml.indexOf('value="Migros"') < fixedHtml.indexOf('value="Zalando"'));

const chart=renderCashflowChart({
  series:[
    {start:new Date('2026-08-25T00:00:00'),endExclusive:new Date('2026-09-25T00:00:00'),income:3000,expenses:2200,coverage:'full'},
    {start:new Date('2026-09-25T00:00:00'),endExclusive:new Date('2026-10-25T00:00:00'),income:3200,expenses:2500,coverage:'full'},
  ],
  currency:'EUR',
  locale:'de-DE',
  interactive:true,
});
assert.match(chart,/cashflow-period-list/);
assert.match(chart,/data-drilldown="transactions-range"/);
assert.match(chart,/Einnahmen/);
assert.match(chart,/Ausgaben/);

const overview=fs.readFileSync('assets/js/views/overview.js','utf8');
const main=fs.readFileSync('assets/js/main.js','utf8');
assert.match(overview,/Budget nach Bereichen/);
assert.match(overview,/overview-drilldown-budget/);
assert.match(main,/filterMerchantSelect/);
assert.match(main,/transactionCreateMerchantSearch/);
assert.match(main,/overview-drilldown-budget/);

console.log('Merchant search and dashboard drilldown assertions OK');
