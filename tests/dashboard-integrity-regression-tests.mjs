import assert from 'node:assert/strict';
import fs from 'node:fs';
import { base } from './render-rich.mjs';
import { dashboardPeriodEvidence, recurringPlanComplete } from '../assets/js/app/dashboard-integrity.js';
import { renderDashboards } from '../assets/js/views/dashboards.js';
import { renderCashflowChart } from '../assets/js/app/charts.js';
import { money } from '../assets/js/app/format.js';
import { goalPlan } from '../assets/js/views/goals.js';

const ts=new Date(), start=new Date(ts.getFullYear(),ts.getMonth(),1), end=new Date(ts.getFullYear(),ts.getMonth()+1,1);
const evidence=dashboardPeriodEvidence({...base,baseCurrency:'CHF',start,endExclusive:end,now:ts});
assert.deepEqual(evidence.incomeIds,['t1'],'Only earned income, never transfers');
assert.deepEqual(evidence.expenseIds,['t2','t3'],'Consumption expense plus debt interest/fee, not principal/transfer');
assert.deepEqual(evidence.allIds,['t1','t2','t3']);
assert.equal(evidence.complete,true);

const incomeEuro={...base.transactions[0],id:'foreign-income',currency:'EUR',amount:100,occurred_at:ts.toISOString()};
const expenseEuro={...base.transactions[1],id:'foreign-expense',currency:'EUR',amount:-50,occurred_at:ts.toISOString()};
const badIncome=dashboardPeriodEvidence({...base,transactions:[...base.transactions,incomeEuro],fxRates:null,baseCurrency:'CHF',start,endExclusive:end,now:ts});
assert.equal(badIncome.incomeComplete,false);
assert.equal(badIncome.expenseComplete,true);
assert.ok(badIncome.incomeIds.includes('foreign-income'));
const badExpense=dashboardPeriodEvidence({...base,transactions:[...base.transactions,expenseEuro],fxRates:null,baseCurrency:'CHF',start,endExclusive:end,now:ts});
assert.equal(badExpense.incomeComplete,true);
assert.equal(badExpense.expenseComplete,false);
assert.ok(badExpense.expenseIds.includes('foreign-expense'));

const cockpit=renderDashboards({...base,dashboardView:'cockpit'});
assert.match(cockpit,/data-transaction-ids="t1"/);
assert.match(cockpit,/data-transaction-ids="t2,t3"/);
assert.match(cockpit,/data-transaction-ids="t1,t2,t3"/);
assert.doesNotMatch(cockpit,/data-transaction-ids="t4/);

const fxCockpit=renderDashboards({...base,transactions:[...base.transactions,incomeEuro],fxRates:null,dashboardView:'cockpit'});
assert.match(fxCockpit,/Nicht berechenbar/);
assert.match(fxCockpit,/data-transaction-ids="t1,foreign-income"/);
const fxExpenses=renderDashboards({...base,transactions:[...base.transactions,expenseEuro],fxRates:null,dashboardView:'expenses'});
assert.match(fxExpenses,/Ausgabenkategorien sind nicht berechenbar/);
assert.doesNotMatch(fxExpenses,/class="donut-svg"/);
const fxBudget=renderDashboards({...base,transactions:[...base.transactions,expenseEuro],fxRates:null,dashboardView:'budget'});
assert.match(fxBudget,/Budgetwerte können unvollständig sein/);
assert.doesNotMatch(fxBudget,/class="dash-budget"/);

const chart=renderCashflowChart({series:[{date:start,start,endExclusive:end,income:120,expenses:25,incomeIds:['t1'],expenseIds:['t2','t3'],coverage:'full'}],interactive:true});
assert.match(chart,/data-transaction-ids="t1"/);
assert.match(chart,/data-transaction-ids="t2,t3"/);

const linkedGoal={...base.goals[0],account_id:'a2',current_amount:2500};
const data={...base,goals:[linkedGoal],dashboardView:'goals'};
const goalHtml=renderDashboards(data);
assert.match(goalHtml,/href="\/planning\/goals\?goal=goal1"/);
assert.ok(goalHtml.includes(money(2000,{currency:'CHF',locale:'de-CH'})),'Goal balance must reflect linked savings account');
assert.ok(goalHtml.includes(money(400,{currency:'CHF',locale:'de-CH'})),'Goal monthly plan must include fixed funding sources');
const plan=goalPlan(linkedGoal,{...base,baseCurrency:'CHF'});
assert.equal(plan.total,400);
assert.equal(plan.account.account_id,'a2');

const foreignRule={id:'foreign-plan',amount:300,currency:'EUR',active:true,direction:'expense',cadence:'monthly'};
assert.equal(recurringPlanComplete({recurringRules:[foreignRule],fxRates:null,baseCurrency:'CHF'}),false);
const fxPlan=renderDashboards({...base,recurringRules:[...base.recurringRules,foreignRule],fxRates:null,dashboardView:'goals'});
assert.match(fxPlan,/Der Monatsplan ist nicht berechenbar/);

const hidden={...base,moduleAccess:{...base.moduleAccess,budget:false,goals:false,wealth:false,debts:false},hiddenModules:[],dashboardView:'wealth',canWrite:false};
const noWealth=renderDashboards(hidden);
assert.doesNotMatch(noWealth,/href="\/planning\/wealth"/);
assert.doesNotMatch(noWealth,/href="\/finance\/debts"/);
assert.doesNotMatch(noWealth,/data-drilldown="account-edit"/);
assert.match(noWealth,/href="\/finance\/accounts"/);
const noBudget=renderDashboards({...hidden,dashboardView:'budget'});
assert.match(noBudget,/Dieses Modul ist nicht aktiviert/);
assert.doesNotMatch(noBudget,/href="\/planning\/budget"/);
const noGoals=renderDashboards({...hidden,dashboardView:'goals'});
assert.doesNotMatch(noGoals,/href="\/planning\/goals"/);

const source=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(source,/uiState\.transactionIds=String\(target\.dataset\.transactionIds/);
assert.match(source,/overview-drilldown-expense','overview-drilldown-income','statistics-drilldown-budget/);
assert.match(source,/route==='goals'&&goalId/);
assert.match(source,/item\?\.scrollIntoView/);
console.log('Dashboard R90: semantic transactions, FX, linked goals, viewer and module-access checks OK');
