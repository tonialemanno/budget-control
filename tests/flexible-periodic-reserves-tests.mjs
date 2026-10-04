import assert from 'node:assert/strict';
import fs from 'node:fs';
import { effectiveNextDate, occurrenceCount } from '../assets/js/app/recurrence.js';
import { cadenceLabel, plannedMonthlyAmount, reserveMonthlyAmount } from '../assets/js/app/recurring-planning.js';
import { monthlyRuleAmount, semanticType } from '../assets/js/app/finance-semantics.js';
import { buildFinanceSnapshot } from '../assets/js/app/finance-model.js';
import { calculateBudgetSummary } from '../assets/js/app/budget-engine.js';

const electricity={
  id:'electricity',
  active:true,
  household_id:'h',
  account_id:'main',
  merchant_id:'energy',
  category_id:'utilities',
  direction:'expense',
  description:'Strom',
  amount:155,
  amount_mode:'variable',
  currency:'CHF',
  cadence:'monthly',
  interval_months:2,
  next_date:'2026-12-15',
  end_date:null,
  reserve_enabled:false,
  reserve_account_id:null,
};
assert.equal(plannedMonthlyAmount(electricity),77.5);
assert.equal(monthlyRuleAmount(electricity,'CHF',null),77.5);
assert.equal(cadenceLabel(electricity),'Alle 2 Monate');
assert.equal(effectiveNextDate({...electricity,next_date:'2026-08-15'},new Date('2026-10-04T12:00:00'))?.toISOString().slice(0,10),'2026-10-15');
assert.equal(occurrenceCount({...electricity,next_date:'2026-10-15'},new Date('2026-10-01T12:00:00'),new Date('2027-03-31T12:00:00')),3);

const categories=[{id:'utilities',name:'Strom / Energie',kind:'expense',parent_id:null}];
const actualElectricity={
  id:'tx-electricity',
  status:'booked',
  account_id:'main',
  merchant_id:'energy',
  category_id:'utilities',
  categories:{id:'utilities',name:'Strom / Energie',kind:'expense'},
  description:'Stromrechnung',
  amount:-181.40,
  currency:'CHF',
  occurred_at:'2026-12-15T12:00:00Z',
  cashflow_type:'standard',
  transfer_group_id:null,
};
assert.equal(semanticType(actualElectricity,{categories,recurringRules:[electricity]}),'fixed_expense','A variable recurring cost must still match when the actual amount differs from its estimate.');

const accounts=[
  {account_id:'main',account_type:'checking',currency:'CHF',current_balance:5000,is_archived:false},
  {account_id:'reserve',account_type:'savings',currency:'CHF',current_balance:200,is_archived:false},
];
const annual={
  id:'household-insurance',
  active:true,
  household_id:'h',
  account_id:'main',
  category_id:'utilities',
  direction:'expense',
  description:'Hausrat',
  amount:480,
  amount_mode:'fixed',
  currency:'CHF',
  cadence:'annual',
  interval_months:1,
  next_date:'2027-02-15',
  end_date:null,
  reserve_enabled:true,
  reserve_account_id:'reserve',
  reserve_strategy:'monthly',
};
assert.equal(plannedMonthlyAmount(annual),40);
assert.equal(reserveMonthlyAmount(annual,accounts,new Date('2026-10-04T12:00:00')),70,'CHF 280 missing with four months to go should require CHF 70/month.');
assert.equal(reserveMonthlyAmount(annual,[accounts[0],{...accounts[1],current_balance:480}],new Date('2026-10-04T12:00:00')),0,'A fully funded pot needs no further catch-up before the due date.');

const salary={
  id:'salary',active:true,account_id:'main',direction:'income',description:'Lohn',amount:6400,amount_mode:'fixed',
  currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-25',end_date:null,reserve_enabled:false,
};
const snapshot=buildFinanceSnapshot({
  accounts,
  transactions:[],
  debtPayments:[],
  recurringRules:[salary,electricity,annual],
  budgets:[],
  categories,
  merchants:[],
  bills:[],debts:[],receivables:[],assets:[],properties:[],vehicles:[],investments:[],pensions:[],
  household:{base_currency:'CHF'},
  fxRates:null,
  now:new Date('2026-10-04T12:00:00'),
});
assert.equal(snapshot.fixedExpensesMonthly,77.5,'The annual reserve must not be counted again as a monthly fixed expense.');
assert.equal(snapshot.reserveTransfersMonthly,70);
assert.equal(snapshot.fixedTransfersMonthly,70);
assert.equal(snapshot.plannedCommitmentsMonthly,147.5);

const budget=calculateBudgetSummary({
  budgets:[],transactions:[],debtPayments:[],categories,merchants:[],recurringRules:[electricity,annual],accounts,
  baseCurrency:'CHF',fxRates:null,now:new Date('2026-10-04T12:00:00'),fallbackDay:25,
});
assert.equal(budget.fixedPlanned,77.5);
assert.equal(budget.savingPlanned,70,'Monthly reserve must be treated as a saving/transfer commitment, not another expense.');

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_flexible_periodic_reserves.sql',import.meta.url),'utf8');
for(const token of ['interval_months','amount_mode','reserve_enabled','reserve_account_id','recurring_rules_reserve_shape_check']){
  assert.match(migration,new RegExp(token));
}
const fixedView=fs.readFileSync(new URL('../assets/js/views/fixed-costs.js',import.meta.url),'utf8');
assert.match(fixedView,/Monatlich Rücklage bilden/);
assert.match(fixedView,/Variabel · Richtwert/);
assert.match(fixedView,/Monatsintervall/);

console.log('flexible-periodic-reserves-tests: ok');
