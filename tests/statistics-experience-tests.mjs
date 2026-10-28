import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderStatistics } from '../assets/js/views/statistics.js';

const currentCycleDate=new Date();
currentCycleDate.setHours(0,0,0,0);
const currentCycleIso=currentCycleDate.toISOString();

const html=renderStatistics({
  accounts:[
    {account_id:'ing',name:'ING',account_type:'checking',currency:'EUR',current_balance:2450,is_archived:false},
    {account_id:'cash',name:'Bargeld',account_type:'cash',currency:'EUR',current_balance:120,is_archived:false},
  ],
  transactions:[
    {id:'income',status:'booked',occurred_at:currentCycleIso,amount:3200,currency:'EUR',category_id:'salary',semantic_type:'earned_income',cashflow_type:'standard',transfer_group_id:null,categories:{id:'salary',name:'Gehalt',kind:'income'}},
    {id:'food',status:'booked',occurred_at:currentCycleIso,amount:-240,currency:'EUR',category_id:'food',semantic_type:'variable_expense',cashflow_type:'standard',transfer_group_id:null,categories:{id:'food',name:'Lebensmittel',kind:'expense'}},
    {id:'rent',status:'booked',occurred_at:currentCycleIso,amount:-900,currency:'EUR',category_id:'rent',semantic_type:'fixed_expense',cashflow_type:'standard',transfer_group_id:null,categories:{id:'rent',name:'Miete',kind:'expense'}},
  ],
  debtPayments:[],
  recurringRules:[],
  budgets:[],
  categories:[
    {id:'salary',name:'Gehalt',kind:'income',parent_id:null},
    {id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
    {id:'rent',name:'Miete',kind:'expense',parent_id:null},
  ],
  merchants:[],
  household:{id:'h',base_currency:'EUR',country_code:'DE'},
  profile:{locale:'de-DE',preferences:{}},
  fxRates:null,
  privacyEnabled:false,
});

assert.match(html,/Monatsbilanz auf einen Blick/);
assert.match(html,/statistics-balance-total/);
assert.match(html,/Liquide Kontostände/);
assert.match(html,/Einnahmen &amp; Ausgaben|Einnahmen & Ausgaben/);
assert.match(html,/Ausgaben nach Kategorien/);
assert.match(html,/Budgetfortschritt/);
assert.match(html,/data-drilldown="transactions-range"/);
assert.match(html,/data-action="overview-drilldown-expense"/);
assert.match(html,/Statistik/);

const css=fs.readFileSync(new URL('../assets/css/components.css',import.meta.url),'utf8');
assert.match(css,/\.statistics-balance-layout/);
assert.match(css,/\.statistics-balance-total/);
assert.match(css,/\.statistics-balance-rows/);

console.log('statistics finance picture assertions OK');
