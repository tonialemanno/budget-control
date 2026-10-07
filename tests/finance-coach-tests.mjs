import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFinanceCoach, buildBudgetDecisionGuide } from '../assets/js/app/finance-coach.js';

const now=new Date('2026-10-05T12:00:00');
const cycle={
  start:new Date('2026-09-25T00:00:00'),
  endExclusive:new Date('2026-10-25T00:00:00'),
  budgetMonth:'2026-09',
};

const snapshot={
  currency:'CHF',
  cash:1000,
  remainingPlannedExpensesMonth:300,
  fixedExpensesMonthly:200,
  fixedTransfersMonthly:100,
  plannedVariableMonthly:300,
  incomePlanMonthly:2000,
  reserveTransfersMonthly:0,
  unbudgetedActualVariableExpensesMonth:0,
  actualVariableExpensesMonth:0,
  financeCycle:cycle,
};

const primaryAccount={
  account_id:'main',
  account_type:'checking',
  currency:'CHF',
  current_balance:1000,
};

const recurringRules=[
  {id:'rent',active:true,direction:'expense',amount:200,currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-10',reserve_enabled:false},
  {id:'save',active:true,direction:'transfer',amount:100,currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-15',reserve_enabled:false},
];

const coach=buildFinanceCoach({
  snapshot,
  primaryAccount,
  accounts:[primaryAccount],
  transactions:[],
  debtPayments:[],
  recurringRules,
  budgets:[],
  categories:[],
  merchants:[],
  household:{base_currency:'CHF'},
  fxRates:null,
  now,
});

assert.equal(coach.fixedRemaining,200);
assert.equal(coach.transferRemaining,100);
assert.equal(coach.variableRemaining,300);
assert.equal(coach.commitmentsRemaining,600);
assert.equal(coach.freeUntilIncome,400);
assert.equal(coach.daysRemaining,20);
assert.equal(coach.dailyAllowance,20);
assert.equal(coach.weeklyAllowance,140);
assert.equal(coach.flow.income,2000);
assert.equal(coach.flow.fixed,200);
assert.equal(coach.flow.reserves,100);
assert.equal(coach.flow.variable,300);
assert.equal(coach.flow.free,1400);

const subscriptionCoach=buildFinanceCoach({
  snapshot,
  primaryAccount,
  accounts:[primaryAccount],
  transactions:[],
  debtPayments:[],
  recurringRules:[
    ...recurringRules,
    {id:'netflix',active:true,direction:'expense',amount:19,currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-20',reserve_enabled:false,description:'Netflix Abo'},
    {id:'spotify',active:true,direction:'expense',amount:13,currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-21',reserve_enabled:false,description:'Spotify Abo'},
  ],
  budgets:[],
  categories:[],
  merchants:[],
  household:{base_currency:'CHF'},
  fxRates:null,
  now,
});
assert.equal(subscriptionCoach.subscriptions.count,2);
assert.equal(subscriptionCoach.subscriptions.monthly,32);
assert.ok(subscriptionCoach.insights.some((row)=>row.type==='subscriptions'));

const coachWithFutureFixedTransaction=buildFinanceCoach({
  snapshot,
  primaryAccount,
  accounts:[primaryAccount],
  transactions:[{
    id:'future-rent',status:'booked',account_id:'main',category_id:null,merchant_id:null,
    amount:-200,currency:'CHF',occurred_at:'2026-10-10T12:00:00Z',
    description:'Rent',transfer_group_id:null,recurring_rule_id:'rent',
  }],
  debtPayments:[],
  recurringRules,
  budgets:[],
  categories:[],
  merchants:[],
  household:{base_currency:'CHF'},
  fxRates:null,
  now,
});
assert.equal(coachWithFutureFixedTransaction.fixedRemaining,200,'A future-dated planned transaction must not make the upcoming commitment disappear.');

const categories=[{id:'food',name:'Lebensmittel',kind:'expense',parent_id:null}];
const budgets=[{
  id:'budget-food',household_id:'h',category_id:'food',merchant_id:null,
  month_start:'2026-09-01',amount:350,categories:{name:'Lebensmittel',kind:'expense'},
}];
const transactions=[{
  id:'tx1',status:'booked',account_id:'main',category_id:'food',merchant_id:null,
  amount:-100,currency:'CHF',occurred_at:'2026-10-01T12:00:00Z',
  description:'Lebensmittel',transfer_group_id:null,cashflow_type:'standard',
  categories:{id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
}];

const guide=buildBudgetDecisionGuide({
  categoryId:'food',
  budgets,
  transactions,
  debtPayments:[],
  categories,
  merchants:[],
  recurringRules:[],
  accounts:[primaryAccount],
  household:{base_currency:'CHF'},
  fxRates:null,
  now,
});
assert.equal(guide.found,true);
assert.equal(guide.amount,350);
assert.equal(guide.spent,100);
assert.equal(guide.remaining,250);
assert.equal(Math.round(guide.percent),29);

const overview=fs.readFileSync(new URL('../assets/js/views/overview.js',import.meta.url),'utf8');
assert.match(overview,/Bis zum nächsten Lohn frei/);
assert.match(overview,/ALEMANNO BUCHHALTUNG hat bemerkt/);
assert.match(overview,/renderMoneyFlow/);
assert.match(overview,/Frei pro Tag/);

const transactionView=fs.readFileSync(new URL('../assets/js/views/transactions.js',import.meta.url),'utf8');
assert.match(transactionView,/transactionCreateBudgetCoach/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/syncTransactionBudgetCoach/);
assert.match(main,/buildBudgetDecisionGuide/);

console.log('finance-coach-tests: ok');
