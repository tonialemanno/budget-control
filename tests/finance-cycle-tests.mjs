import assert from 'node:assert/strict';
import { financeCycleLabel, resolveFinanceCycle } from '../assets/js/app/finance-cycle.js';
import {
  categorySpending,
  currentFinanceCycleTotals,
  effectiveBudgetSet,
  financeCycleSeries,
} from '../assets/js/app/finance-insights.js';

const now=new Date('2026-10-03T12:00:00');
const categories=[
  {id:'salary',name:'Lohn',kind:'income',parent_id:null},
  {id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
  {id:'tobacco',name:'Tabak',kind:'expense',parent_id:null},
];
const recurringRules=[{
  id:'income-rule',
  active:true,
  direction:'income',
  cadence:'monthly',
  amount:6400,
  category_id:'salary',
  description:'Arbeitgeber',
  counterparty:'Arbeitgeber',
}];
const transactions=[
  {
    id:'salary-sep',
    status:'booked',
    occurred_at:'2026-09-25T10:00:00',
    amount:6400,
    currency:'CHF',
    cashflow_type:'standard',
    transfer_group_id:null,
    category_id:'salary',
    categories:{name:'Lohn',kind:'income'},
    description:'Arbeitgeber',
    counterparty:'Arbeitgeber',
  },
  {
    id:'old-expense',
    status:'booked',
    occurred_at:'2026-09-24T18:00:00',
    amount:-90,
    currency:'CHF',
    cashflow_type:'standard',
    transfer_group_id:null,
    category_id:'food',
    categories:{name:'Lebensmittel',kind:'expense'},
  },
  {
    id:'expense-sep',
    status:'booked',
    occurred_at:'2026-09-27T18:00:00',
    amount:-100,
    currency:'CHF',
    cashflow_type:'standard',
    transfer_group_id:null,
    category_id:'food',
    categories:{name:'Lebensmittel',kind:'expense'},
  },
  {
    id:'refund-oct',
    status:'booked',
    occurred_at:'2026-10-01T09:00:00',
    amount:20,
    currency:'CHF',
    cashflow_type:'standard',
    transfer_group_id:null,
    category_id:null,
    categories:null,
    description:'Kleine Rückzahlung',
  },
  {
    id:'expense-oct',
    status:'booked',
    occurred_at:'2026-10-02T18:00:00',
    amount:-27.50,
    currency:'CHF',
    cashflow_type:'standard',
    transfer_group_id:null,
    category_id:'tobacco',
    categories:{name:'Tabak',kind:'expense'},
  },
];

const cycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay:25});
assert.equal(cycle.source,'fixed_day');
assert.equal(cycle.budgetMonth,'2026-09');
assert.equal(cycle.start.getFullYear(),2026);
assert.equal(cycle.start.getMonth(),8);
assert.equal(cycle.start.getDate(),25);
assert.equal(cycle.endExclusive.getMonth(),9);
assert.equal(cycle.endExclusive.getDate(),25);
assert.match(financeCycleLabel(cycle,'de-CH'),/25\.09.*24\.10/);

const fallback=resolveFinanceCycle({transactions:transactions.filter((tx)=>tx.id!=='salary-sep'),recurringRules,now,fallbackDay:25});
assert.equal(fallback.source,'fixed_day');
assert.equal(fallback.start.getMonth(),8);
assert.equal(fallback.start.getDate(),25);

const earlySalary=resolveFinanceCycle({
  transactions:[{...transactions[0],id:'salary-early',occurred_at:'2026-09-24T10:00:00'}],
  recurringRules,
  now,
  fallbackDay:25,
});
assert.equal(earlySalary.source,'fixed_day');
assert.equal(earlySalary.start.getDate(),25);

const totals=currentFinanceCycleTotals({
  transactions,debtPayments:[],recurringRules,baseCurrency:'CHF',fxRates:null,now,fallbackDay:25,
});
assert.equal(totals.income,6400);
assert.equal(totals.expenses,127.5);
assert.equal(totals.transactionCount,4);

const spending=categorySpending({
  transactions,debtPayments:[],categories,baseCurrency:'CHF',fxRates:null,now,
  rangeStart:cycle.start,rangeEnd:cycle.endExclusive,limit:5,
});
assert.equal(spending.reduce((sum,row)=>sum+row.value,0),127.5);
assert.equal(spending.find((row)=>row.label==='Lebensmittel')?.value,100);
assert.equal(spending.find((row)=>row.label==='Tabak')?.value,27.5);

const budgets=[
  {id:'sep-food',month_start:'2026-09-01',category_id:'food',merchant_id:null,amount:500},
  {id:'sep-tobacco',month_start:'2026-09-01',category_id:'tobacco',merchant_id:null,amount:100},
  {id:'oct-food',month_start:'2026-10-01',category_id:'food',merchant_id:null,amount:600},
];
const september=effectiveBudgetSet(budgets,'2026-09');
assert.equal(september.rows.length,2);
assert.equal(september.inherited,false);

const october=effectiveBudgetSet(budgets,'2026-10');
assert.equal(october.rows.length,2);
assert.equal(october.rows.find((row)=>row.category_id==='food')?.amount,600);
assert.equal(october.rows.find((row)=>row.category_id==='tobacco')?._inherited,true);
assert.equal(october.inheritedCount,1);

const series=financeCycleSeries({
  transactions,debtPayments:[],recurringRules,baseCurrency:'CHF',fxRates:null,now,cycles:2,fallbackDay:25,
});
assert.equal(series.length,2);
assert.equal(series.at(-1).key,'2026-09');
assert.equal(series.at(-1).income,6400);
assert.equal(series.at(-1).expenses,127.5);

const calendar=resolveFinanceCycle({now,mode:'calendar'});
assert.equal(calendar.source,'calendar');
assert.equal(calendar.start.getDate(),1);
assert.equal(calendar.start.getMonth(),9);
assert.equal(calendar.endExclusive.getDate(),1);
assert.equal(calendar.endExclusive.getMonth(),10);

console.log('fixed finance-cycle assertions OK');
