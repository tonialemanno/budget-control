import assert from 'node:assert/strict';
import { categorySpending, monthSeries, primaryOperatingAccount } from '../assets/js/app/finance-insights.js';
import { renderCashflowChart, renderExpenseDonut } from '../assets/js/app/charts.js';

const now=new Date('2026-10-03T12:00:00Z');
const categories=[
  {id:'food',name:'Lebensmittel',parent_id:null},
  {id:'supermarket',name:'Supermarkt',parent_id:'food'},
  {id:'rent',name:'Wohnen',parent_id:null},
  {id:'fun',name:'Freizeit',parent_id:null},
  {id:'salary',name:'Lohn',kind:'income',parent_id:null},
];
const accounts=[
  {account_id:'salary-account',name:'UBS LohnKonto',account_type:'checking',currency:'CHF',current_balance:-1048.97,is_archived:false},
  {account_id:'savings',name:'Sparkonto',account_type:'savings',currency:'CHF',current_balance:4125,is_archived:false},
  {account_id:'eur',name:'Eurokonto',account_type:'checking',currency:'EUR',current_balance:51.32,is_archived:false},
];
const recurringRules=[
  {direction:'income',active:true,account_id:'salary-account',amount:6412.05},
  {direction:'transfer',active:true,account_id:'salary-account',amount:525},
];
assert.equal(primaryOperatingAccount(accounts,recurringRules,'CHF')?.account_id,'salary-account');
assert.equal(primaryOperatingAccount(accounts,[],'CHF')?.account_id,'salary-account');

const tx=[
  {id:'t1',status:'booked',occurred_at:'2026-10-01T12:00:00Z',amount:-50,currency:'CHF',category_id:'supermarket',cashflow_type:'standard',transfer_group_id:null},
  {id:'t2',status:'booked',occurred_at:'2026-10-02T12:00:00Z',amount:-30,currency:'CHF',category_id:'rent',cashflow_type:'standard',transfer_group_id:null},
  {id:'t3',status:'booked',occurred_at:'2026-10-03T10:00:00Z',amount:-20,currency:'CHF',category_id:'fun',cashflow_type:'standard',transfer_group_id:null},
  {id:'t4',status:'booked',occurred_at:'2026-10-03T10:30:00Z',amount:200,currency:'CHF',category_id:'salary',categories:{id:'salary',name:'Lohn',kind:'income'},semantic_type:'earned_income',cashflow_type:'standard',transfer_group_id:null},
];

const breakdown=categorySpending({
  transactions:tx,debtPayments:[],categories,baseCurrency:'CHF',now,limit:2,includeOther:true,
});
assert.equal(breakdown.length,3);
assert.equal(breakdown[0].label,'Lebensmittel');
assert.equal(breakdown[0].value,50);
assert.equal(breakdown[0].share,50);
assert.equal(breakdown[1].share,30);
assert.equal(breakdown[2].label,'Sonstiges');
assert.equal(breakdown[2].value,20);
assert.equal(breakdown[2].share,20);
assert.equal(breakdown[0].total,100);

const series=monthSeries({transactions:tx,debtPayments:[],baseCurrency:'CHF',now,months:6});
assert.equal(series.length,6);
assert.equal(series.at(-1).income,200);
assert.equal(series.at(-1).expenses,100);

const cashflow=renderCashflowChart({series,currency:'CHF',locale:'de-CH'});
assert.match(cashflow,/<svg[^>]+cashflow-svg/);
assert.match(cashflow,/cashflow-bar--income/);
assert.match(cashflow,/cashflow-bar--expense/);
assert.match(cashflow,/Aktueller Finanzmonat · Einnahmen/);
assert.doesNotMatch(cashflow,/--bar-height/);
assert.doesNotMatch(cashflow,/NaN|undefined|\$\{/);

const donut=renderExpenseDonut({rows:breakdown,total:100,currency:'CHF',locale:'de-CH'});
assert.match(donut,/<svg[^>]+donut-svg/);
assert.match(donut,/donut-segment--0/);
assert.match(donut,/Lebensmittel/);
assert.match(donut,/Sonstiges/);
assert.doesNotMatch(donut,/NaN|undefined|\$\{/);

const emptyDonut=renderExpenseDonut({rows:[],total:0,currency:'CHF',locale:'de-CH'});
assert.match(emptyDonut,/Keine Ausgaben in diesem Finanzmonat/);

console.log('dashboard chart assertions OK');
