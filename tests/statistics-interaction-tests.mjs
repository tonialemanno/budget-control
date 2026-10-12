import assert from 'node:assert/strict';
import fs from 'node:fs';
import { categorySpending } from '../assets/js/app/finance-insights.js';
import { renderCashflowChart, renderExpenseDonut } from '../assets/js/app/charts.js';
import { renderFinanceMonthSummary, renderCategoryDetails, renderBudgetProgress } from '../assets/js/views/statistics-panels.js';
import { renderStatistics } from '../assets/js/views/statistics.js';
import { routeFromPath, routeHref } from '../assets/js/app/router.js';

const now=new Date();
now.setHours(12,0,0,0);
const occurredAt=now.toISOString();
const cycle={start:new Date(now.getFullYear(),now.getMonth(),1),endExclusive:new Date(now.getFullYear(),now.getMonth()+1,1)};
const categories=[
  {id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
  {id:'supermarket',name:'Supermarkt',kind:'expense',parent_id:'food'},
  {id:'cafe',name:'Café',kind:'expense',parent_id:'food'},
  {id:'rent',name:'Wohnen',kind:'expense',parent_id:null},
  {id:'salary',name:'Gehalt',kind:'income',parent_id:null},
];
const tx=[
  {id:'s1',status:'booked',occurred_at:occurredAt,amount:-40,currency:'EUR',category_id:'supermarket',semantic_type:'variable_expense'},
  {id:'s2',status:'booked',occurred_at:occurredAt,amount:-20,currency:'EUR',category_id:'cafe',semantic_type:'variable_expense'},
  {id:'s3',status:'booked',occurred_at:occurredAt,amount:-400,currency:'EUR',category_id:'rent',semantic_type:'fixed_expense'},
  {id:'salary',status:'booked',occurred_at:occurredAt,amount:1900,currency:'EUR',category_id:'salary',semantic_type:'earned_income'},
  {id:'transfer-out',status:'booked',occurred_at:occurredAt,amount:-250,currency:'EUR',category_id:'food',transfer_group_id:'tr'},
  {id:'transfer-in',status:'booked',occurred_at:occurredAt,amount:250,currency:'EUR',transfer_group_id:'tr'},
  {id:'refund',status:'booked',occurred_at:occurredAt,amount:50,currency:'EUR',semantic_type:'refund'},
];
const rows=categorySpending({transactions:tx,categories,baseCurrency:'EUR',now,rangeStart:cycle.start,rangeEnd:cycle.endExclusive,limit:1});
assert.equal(rows.length,2);
assert.equal(rows[0].label,'Lebensmittel');
assert.equal(rows[0].value,60);
assert.deepEqual(new Set(rows[0].transactionIds),new Set(['s1','s2']));
assert.equal(rows[1].label,'Sonstiges');
assert.equal(rows[1].value,400);
assert.deepEqual(rows[1].transactionIds,['s3']);
assert.deepEqual(new Set(rows[0].subcategories.flatMap((r)=>r.transactionIds)),new Set(['s1','s2']));
assert.equal(rows[0].total,460,'cash transfer must not inflate consumption spending');

const donut=renderExpenseDonut({rows,total:460,currency:'EUR',locale:'de-DE'});
assert.match(donut,/data-transaction-ids="s1,s2"/);
assert.match(donut,/data-transaction-ids="s3"/);
const expandable=renderCategoryDetails({rows,currency:'EUR',locale:'de-DE',cycle});
assert.match(expandable,/data-action="overview-drilldown-expense"/);
assert.match(expandable,/Supermarkt/);
assert.match(expandable,/Café/);
assert.match(expandable,/data-transaction-ids="s1"/);
assert.match(expandable,/data-transaction-ids="s2"/);
const monthly=renderFinanceMonthSummary({totals:{cycle,income:1900,expenses:460,savings:1440},currency:'EUR',locale:'de-DE'});
assert.match(monthly,/data-direction="income"/);
assert.match(monthly,/data-direction="expense"/);
assert.match(monthly,/data-direction="all"/);
assert.match(monthly,/Monatsbilanz/);

const budgets=renderBudgetProgress({budget:{cycle,variableRows:[{id:'b',amount:100,currency:'EUR',spent:60,transactionIds:['s1','s2'],categories:{name:'Lebensmittel'}}],uncoveredVariable:0},currency:'EUR',locale:'de-DE'});
assert.match(budgets,/60 % verbraucht/);
assert.match(budgets,/data-transaction-ids="s1,s2"/);
const privacy=renderFinanceMonthSummary({totals:{cycle,income:1900,expenses:460,savings:1440},currency:'EUR',locale:'de-DE',privacy:true});
assert.doesNotMatch(privacy,/1\.900|1900/);
const series=[{start:cycle.start,endExclusive:cycle.endExclusive,date:cycle.start,coverage:'full',income:1900,expenses:460}];
const bars=renderCashflowChart({series,currency:'EUR',locale:'de-DE'});
assert.equal((bars.match(/data-action="overview-drilldown-period"/g)||[]).length,2);
assert.match(bars,/data-direction="income"/);
assert.match(bars,/data-direction="expense"/);
const absent=renderCashflowChart({series:[{...series[0],coverage:'none'}],currency:'EUR',locale:'de-DE'});
assert.doesNotMatch(absent,/data-action="overview-drilldown-period"/);
assert.match(absent,/Keine Daten/);

assert.equal(routeFromPath('/finance/statistics')?.route,'statistics');
assert.equal(routeHref('statistics'),'/finance/statistics');
const html=renderStatistics({
  household:{id:'house',base_currency:'EUR',country_code:'DE'},
  profile:{locale:'de-DE'},accounts:[{account_id:'ing',name:'ING',currency:'EUR',current_balance:1900,account_type:'checking'}],
  transactions:tx,categories,recurringRules:[],budgets:[],debtPayments:[],merchants:[],fxRates:null,
});
assert.match(html,/Monatsbilanz/);
assert.match(html,/Ausgaben nach Kategorien/);
assert.match(html,/Budgetfortschritt/);
assert.match(html,/Einnahmequellen/);
assert.doesNotMatch(html,/NaN|undefined|\$\{/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/statistics: renderStatistics/);
assert.match(main,/overview-drilldown-period/);
assert.match(main,/uiState.transactionIds=exactIds/);
assert.match(main,/target.dataset.from\|\|''/);
console.log('statistics interaction, semantic filtering and navigation assertions OK');
