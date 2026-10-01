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
