import assert from 'node:assert/strict';
import fs from 'node:fs';
import { categorySpending } from '../assets/js/app/finance-insights.js';
import { buildStatisticsModel } from '../assets/js/app/statistics-model.js';
import { renderExpenseDonut } from '../assets/js/app/charts.js';
import { renderStatistics } from '../assets/js/views/statistics.js';
import { resolveFinanceCycle } from '../assets/js/app/finance-cycle.js';

const now=new Date();
now.setHours(12,0,0,0);
const date=now.toISOString();
const cycle=resolveFinanceCycle({now,fallbackDay:25,mode:'day_25'});
const categories=[
  {id:'food',name:'Lebensmittel',kind:'expense'},
  {id:'supermarket',name:'Supermarkt',kind:'expense',parent_id:'food'},
  {id:'cafe',name:'Restaurant & Café',kind:'expense',parent_id:'food'},
];
const transactions=[
  {id:'super',status:'booked',occurred_at:date,amount:-40,currency:'EUR',category_id:'supermarket',semantic_type:'variable_expense'},
  {id:'cafe',status:'booked',occurred_at:date,amount:-20,currency:'EUR',category_id:'cafe',semantic_type:'variable_expense'},
  {id:'transfer',status:'booked',occurred_at:date,amount:-500,currency:'EUR',category_id:'food',transfer_group_id:'own'},
];
const rows=categorySpending({transactions,categories,baseCurrency:'EUR',now,rangeStart:cycle.start,rangeEnd:cycle.endExclusive,limit:5});
assert.equal(rows.length,1);
assert.equal(rows[0].value,60,'internal transfer must not appear as spending');
assert.deepEqual(new Set(rows[0].transactionIds),new Set(['super','cafe']));
assert.deepEqual(new Set(rows[0].subcategories.flatMap((item)=>item.transactionIds)),new Set(['super','cafe']));
const donut=renderExpenseDonut({rows,total:60,currency:'EUR',locale:'de-DE',rangeStart:cycle.start,rangeEnd:cycle.endExclusive});
assert.match(donut,/data-transaction-ids="super,cafe"/);
assert.match(donut,/data-from="\d{4}-\d{2}-\d{2}"/);
assert.match(donut,/data-to="\d{4}-\d{2}-\d{2}"/);

const household={id:'house',base_currency:'CHF',country_code:'CH'};
const fxRates={rates:{EUR:0.95},as_of:'2026-10'};
const budgets=[{id:'budget',month_start:`${cycle.budgetMonth}-01`,category_id:'food',currency:'EUR',amount:100}];
const accounts=[{account_id:'cash',name:'Cash',account_type:'checking',currency:'CHF',current_balance:1000}];
const model=buildStatisticsModel({accounts,transactions,categories,budgets,recurringRules:[],debtPayments:[],merchants:[],household,profile:{locale:'de-CH'},fxRates,now,cycles:6});
assert.equal(model.budgetRows.length,1);
assert.ok(Math.abs(model.budgetRows[0].amount-(100*0.95))<0.001,'budget limit must be converted to household currency');
assert.deepEqual(new Set(model.budgetRows[0].transactionIds),new Set(['super','cafe']));
const rendered=renderStatistics({accounts,transactions,categories,budgets,recurringRules:[],debtPayments:[],merchants:[],household,profile:{locale:'de-CH'},fxRates});
assert.match(rendered,/Unterkategorien und Buchungen anzeigen/);
assert.match(rendered,/data-action="statistics-drilldown-budget"/);
assert.match(rendered,/data-transaction-ids="super,cafe"/);
assert.match(rendered,/statistics-category-group/);
assert.doesNotMatch(rendered,/\bNaN\b|\bundefined\b|\$\{/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/uiState.transactionIds=exactIds/);
assert.match(main,/target.dataset.from\|\|''/);
assert.match(main,/if\(!transactionIds.length\)\{ goToRoute\('budget'\); return; \}/);
console.log('statistics scope, FX and category drilldown assertions OK');
