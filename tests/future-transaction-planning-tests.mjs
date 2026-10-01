import assert from 'node:assert/strict';
import { buildFinanceSnapshot } from '../assets/js/app/finance-model.js';

const now = new Date('2026-10-01T14:11:00.000Z');
const household = { base_currency:'CHF' };
const accounts = [{ account_id:'ubs', account_type:'checking', current_balance:1000, currency:'CHF' }];
const futureTx = {
  id:'future-1',
  account_id:'ubs',
  category_id:'cat-variable',
  merchant_id:null,
  occurred_at:'2026-10-25T10:00:00.000Z',
  amount:-243.25,
  currency:'CHF',
  description:'Admicrn',
  counterparty:'Admicrn',
  status:'booked',
  transfer_group_id:null,
  cashflow_type:'standard',
};

const base = buildFinanceSnapshot({
  accounts,
  transactions:[futureTx],
  household,
  now,
});
assert.equal(base.actualExpensesMonth,0,'future transaction must not count as actual expense');
assert.equal(base.plannedFutureExpensesMonth,243.25,'future transaction must be visible as planned expense');
assert.equal(base.unbudgetedFutureExpensesMonth,243.25);
assert.equal(base.plannedVariableMonthly,243.25,'future unbudgeted transaction must increase planned variable expenses');

const withBudget = buildFinanceSnapshot({
  accounts,
  transactions:[futureTx],
  budgets:[{ month_start:'2026-10-01', category_id:'cat-variable', merchant_id:null, amount:500 }],
  household,
  now,
});
assert.equal(withBudget.plannedFutureExpensesMonth,243.25);
assert.equal(withBudget.unbudgetedFutureExpensesMonth,0,'future transaction already covered by category budget must not be added twice');
assert.equal(withBudget.plannedVariableMonthly,500);

const withRecurring = buildFinanceSnapshot({
  accounts,
  transactions:[futureTx],
  recurringRules:[{
    id:'rule-1',
    account_id:'ubs',
    category_id:'cat-variable',
    direction:'expense',
    description:'Admicrn',
    amount:243.25,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-10-25',
    end_date:null,
    active:true,
  }],
  household,
  now,
});
assert.equal(withRecurring.fixedExpensesMonthly,243.25);
assert.equal(withRecurring.plannedFutureExpensesMonth,0,'future transaction matching fixed recurring rule must not be double-counted as variable');
assert.equal(withRecurring.plannedVariableMonthly,0);

console.log('Future transaction planning assertions OK');

const merchantTx={...futureTx,merchant_id:'merchant-fixed',category_id:null,description:'Andere Beschreibung',counterparty:'Andere Gegenpartei'};
const merchantLinked=buildFinanceSnapshot({
  accounts,
  transactions:[merchantTx],
  recurringRules:[{
    id:'rule-merchant',
    account_id:'ubs',
    category_id:null,
    merchant_id:'merchant-fixed',
    direction:'expense',
    description:'Miete',
    counterparty:'Uzon Immobilien AG',
    amount:243.25,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-10-25',
    end_date:null,
    active:true,
  }],
  household,
  now,
});
assert.equal(merchantLinked.plannedFutureExpensesMonth,0,'merchant-linked fixed cost must not be double-counted even when booking text differs');
console.log('Merchant-linked fixed cost assertions OK');

const actualUnbudgetedTx={...futureTx,id:'actual-1',occurred_at:'2026-10-01T08:00:00.000Z',amount:-75};
const actualUnbudgeted=buildFinanceSnapshot({
  accounts,
  transactions:[actualUnbudgetedTx],
  household,
  now,
});
assert.equal(actualUnbudgeted.actualVariableExpensesMonth,75,'actual variable spend must be separated from fixed costs');
assert.equal(actualUnbudgeted.unbudgetedActualVariableExpensesMonth,75,'actual unbudgeted variable spend must enter the monthly plan');
assert.equal(actualUnbudgeted.plannedVariableMonthly,75,'monthly plan must not forget already-spent unbudgeted money');

const staleRecurring=buildFinanceSnapshot({
  accounts,
  transactions:[merchantTx],
  recurringRules:[{
    id:'rule-stale',
    account_id:'ubs',
    category_id:null,
    merchant_id:'merchant-fixed',
    direction:'expense',
    description:'Miete',
    counterparty:'Uzon Immobilien AG',
    amount:243.25,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-09-25',
    end_date:null,
    active:true,
  }],
  household,
  now,
});
assert.equal(staleRecurring.plannedFutureExpensesMonth,0,'a stale recurring anchor must roll forward and still match the October occurrence');

const fixedMerchantBudget=buildFinanceSnapshot({
  accounts,
  transactions:[],
  budgets:[{month_start:'2026-10-01',category_id:null,merchant_id:'merchant-fixed',amount:300}],
  recurringRules:[{
    id:'rule-fixed-budget',
    account_id:'ubs',
    category_id:null,
    merchant_id:'merchant-fixed',
    direction:'expense',
    description:'Miete',
    amount:300,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-10-25',
    active:true,
  }],
  household,
  now,
});
assert.equal(fixedMerchantBudget.variableBudgetMonthly,0,'a budget for a known fixed-cost merchant must not be counted as variable budget');
console.log('Stable monthly planning assertions OK');


const alreadySpent={...futureTx,id:'spent-1',occurred_at:'2026-10-01T08:00:00.000Z',amount:-75};
const spentSnapshot=buildFinanceSnapshot({
  accounts,
  transactions:[alreadySpent],
  household,
  now,
});
assert.equal(spentSnapshot.plannedVariableMonthly,75,'already-spent unbudgeted money stays in the full monthly plan');
assert.equal(spentSnapshot.remainingPlannedExpensesMonth,0,'already-spent money must not appear as still upcoming');

const categoryBudgetBesideFixed=buildFinanceSnapshot({
  accounts,
  transactions:[],
  budgets:[{month_start:'2026-10-01',category_id:'housing',merchant_id:null,amount:400}],
  recurringRules:[{
    id:'rent-rule',
    account_id:'ubs',
    category_id:'housing',
    merchant_id:'landlord',
    direction:'expense',
    description:'Miete',
    amount:1576,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-10-25',
    active:true,
  }],
  household,
  now,
});
assert.equal(categoryBudgetBesideFixed.variableBudgetMonthly,400,'a category budget must stay variable even if a fixed cost uses the same category');
assert.equal(categoryBudgetBesideFixed.remainingPlannedExpensesMonth,400);

const openBill={
  id:'bill-1',
  account_id:'ubs',
  category_id:'utilities',
  name:'Stromrechnung',
  provider:'Stadtwerke',
  amount:200,
  currency:'CHF',
  due_date:'2026-10-15',
  status:'open',
};
const billSnapshot=buildFinanceSnapshot({
  accounts,
  bills:[openBill],
  household,
  now,
});
assert.equal(billSnapshot.unbudgetedOpenBillsMonth,200,'a due open bill must enter remaining obligations');
assert.equal(billSnapshot.remainingPlannedExpensesMonth,200);
assert.equal(billSnapshot.plannedVariableMonthly,200);

const budgetedBillSnapshot=buildFinanceSnapshot({
  accounts,
  bills:[openBill],
  budgets:[{month_start:'2026-10-01',category_id:'utilities',merchant_id:null,amount:500}],
  household,
  now,
});
assert.equal(budgetedBillSnapshot.budgetedOpenBillsMonth,200);
assert.equal(budgetedBillSnapshot.unbudgetedOpenBillsMonth,0);
assert.equal(budgetedBillSnapshot.plannedVariableMonthly,500,'a bill already covered by its variable budget must not be added twice');
assert.equal(budgetedBillSnapshot.remainingPlannedExpensesMonth,500);

const futureForBill={
  ...futureTx,
  id:'future-bill',
  category_id:'utilities',
  occurred_at:'2026-10-15T10:00:00.000Z',
  amount:-200,
  description:'Stromrechnung',
  counterparty:'Stadtwerke',
};
const billAndFutureSnapshot=buildFinanceSnapshot({
  accounts,
  bills:[openBill],
  transactions:[futureForBill],
  household,
  now,
});
assert.equal(billAndFutureSnapshot.unbudgetedOpenBillsMonth,0,'an open bill represented by the same future transaction must not be counted twice');
assert.equal(billAndFutureSnapshot.unbudgetedFutureExpensesMonth,200);
assert.equal(billAndFutureSnapshot.remainingPlannedExpensesMonth,200);

const fixedBillSnapshot=buildFinanceSnapshot({
  accounts,
  bills:[openBill],
  recurringRules:[{
    id:'utilities-rule',
    account_id:'ubs',
    category_id:'utilities',
    direction:'expense',
    description:'Stromrechnung',
    counterparty:'Stadtwerke',
    amount:200,
    currency:'CHF',
    cadence:'monthly',
    next_date:'2026-10-15',
    active:true,
  }],
  household,
  now,
});
assert.equal(fixedBillSnapshot.fixedExpensesMonthly,200);
assert.equal(fixedBillSnapshot.unbudgetedOpenBillsMonth,0,'a current-month bill already represented by a fixed recurring rule must not be added again');
assert.equal(fixedBillSnapshot.remainingPlannedExpensesMonth,0);

console.log('Stable remaining-obligations assertions OK');
