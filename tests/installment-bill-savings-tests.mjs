import assert from 'node:assert/strict';
import fs from 'node:fs';
import { debtEndDateValue, debtTermMonthsFromDates } from '../assets/js/app/debt-planning.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase, debtPrincipalBase } from '../assets/js/app/financial-effects.js';
import { buildFinanceCoach } from '../assets/js/app/finance-coach.js';

assert.equal(debtEndDateValue('2026-10-25',24),'2028-09-25');
assert.equal(debtEndDateValue('2026-01-31',12),'2026-12-31');
assert.equal(debtTermMonthsFromDates('2026-10-25','2028-09-25'),24);

const tx={
  id:'yallo-bill',status:'booked',amount:-90,currency:'CHF',
  transfer_group_id:null,cashflow_type:'standard',
};
const payments=[{
  id:'phone-part',transaction_id:'yallo-bill',source:'linked_transaction_component',
  principal_amount:46.04,interest_amount:0,fee_amount:0,currency:'CHF',reversed_at:null,
}];
const map=buildDebtPaymentTransactionMap(payments);
assert.equal(consumptionExpenseBase(tx,map,'CHF',null),43.96);
assert.equal(debtPrincipalBase(tx,map,'CHF',null),46.04);

const now=new Date('2026-10-05T12:00:00');
const cycle={start:new Date('2026-09-25T00:00:00'),endExclusive:new Date('2026-10-25T00:00:00'),budgetMonth:'2026-09'};
const snapshot={
  currency:'CHF',cash:3000,remainingPlannedExpensesMonth:350,fixedExpensesMonthly:2200,
  fixedTransfersMonthly:525,plannedVariableMonthly:350,incomePlanMonthly:6412,
  reserveTransfersMonthly:0,unbudgetedActualVariableExpensesMonth:0,actualVariableExpensesMonth:0,
  financeCycle:cycle,
};
const accounts=[
  {account_id:'main',account_type:'checking',currency:'CHF',current_balance:3000},
  {account_id:'save',account_type:'savings',currency:'CHF',current_balance:1000},
];
const rules=[
  {id:'salary',active:true,direction:'income',amount:6412,currency:'CHF',cadence:'monthly',next_date:'2026-10-25',description:'Lohn'},
  {id:'divorce',active:true,direction:'expense',amount:150,currency:'CHF',cadence:'monthly',next_date:'2026-10-25',end_date:'2027-02-25',description:'Scheidung',reserve_enabled:false},
  {id:'saving',active:true,direction:'transfer',amount:525,currency:'CHF',cadence:'monthly',next_date:'2026-10-25',description:'Sparen',destination_account_id:'save'},
];
const coach=buildFinanceCoach({
  snapshot,primaryAccount:accounts[0],accounts,transactions:[],debtPayments:[],recurringRules:rules,
  budgets:[],categories:[],merchants:[],household:{base_currency:'CHF'},fxRates:null,now,
});
assert.ok(coach.freedCommitment);
assert.equal(coach.freedCommitment.sourceLabel,'Scheidung');
assert.equal(coach.freedCommitment.freedMonthly,150);
assert.equal(coach.freedCommitment.currentSavings,525);
assert.equal(coach.freedCommitment.suggestedSavings,675);
assert.equal(coach.freedCommitment.availableFrom.toISOString().slice(0,10),'2027-03-25');
assert.ok(coach.insights.some((row)=>row.type==='freed_commitment'));

const debtPlanning=fs.readFileSync(new URL('../assets/js/app/debt-planning.js',import.meta.url),'utf8');
assert.match(debtPlanning,/\[12,24,36,48,60\]/);
const debts=fs.readFileSync(new URL('../assets/js/views/debts.js',import.meta.url),'utf8');
assert.match(debts,/In einer Anbieterrechnung enthalten/);
assert.match(debts,/linked_transaction_component/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/debtEndDateValue/);
assert.match(main,/payment_mode:paymentMode/);
assert.match(main,/paymentMode==='included_in_bill'/);

const budget=fs.readFileSync(new URL('../assets/js/views/budget.js',import.meta.url),'utf8');
assert.match(budget,/Deine variablen Budgets/);
assert.match(budget,/budget-active-grid/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261005_finance_debt_embedded_bill_terms.sql',import.meta.url),'utf8');
assert.match(migration,/linked_transaction_component/);
assert.match(migration,/payment_mode/);
assert.match(migration,/term_months/);

console.log('installment-bill-savings-tests: ok');
