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
assert.equal(series[0].coverage,'partial');
assert.equal(series.at(-1).coverage,'full');

const noHistorySeries=financeCycleSeries({
  transactions:[],debtPayments:[],recurringRules,baseCurrency:'CHF',fxRates:null,now,cycles:2,fallbackDay:25,
});
assert.ok(noHistorySeries.every((row)=>row.coverage==='none'));

const salaryAnchorCategories=[
  {id:'salary',name:'Lohn',kind:'income',parent_id:null},
  {id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
];
const salaryAnchorRule={
  id:'salary-rule',active:true,direction:'income',cadence:'monthly',amount:6412.05,
  category_id:'salary',account_id:'main',description:'Abacus Umantis AG',counterparty:'Abacus Umantis AG',
  next_date:'2026-10-25',
};
const salaryAnchorTransactions=[
  {id:'s-apr',status:'booked',occurred_at:'2026-04-24T08:00:00',amount:6412.05,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 24.04.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null,recurring_rule_id:'salary-rule'},
  {id:'s-may',status:'booked',occurred_at:'2026-05-22T08:00:00',amount:6407.55,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 22.05.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null},
  {id:'bonus-may',status:'booked',occurred_at:'2026-05-04T08:00:00',amount:214.20,currency:'CHF',account_id:'main',category_id:'salary',description:'Egidas AG 04.05.2026',counterparty:'Egidas AG',transfer_group_id:null},
  {id:'s-jun',status:'booked',occurred_at:'2026-06-25T08:00:00',amount:6412.05,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 25.06.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null},
  {id:'s-jul',status:'booked',occurred_at:'2026-07-24T08:00:00',amount:6412.05,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 24.07.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null},
  {id:'s-aug',status:'booked',occurred_at:'2026-08-25T08:00:00',amount:6412.05,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 25.08.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null},
  {id:'s-sep',status:'booked',occurred_at:'2026-09-25T08:00:00',amount:6412.05,currency:'CHF',account_id:'main',category_id:'salary',description:'Abacus Umantis AG 25.09.2026',counterparty:'Abacus Umantis AG',transfer_group_id:null},
  {id:'e-may',status:'booked',occurred_at:'2026-05-10T18:00:00',amount:-1000,currency:'CHF',account_id:'main',category_id:'food',description:'Ausgaben',transfer_group_id:null},
  {id:'e-jun',status:'booked',occurred_at:'2026-06-10T18:00:00',amount:-1000,currency:'CHF',account_id:'main',category_id:'food',description:'Ausgaben',transfer_group_id:null},
  {id:'e-jul',status:'booked',occurred_at:'2026-07-10T18:00:00',amount:-1000,currency:'CHF',account_id:'main',category_id:'food',description:'Ausgaben',transfer_group_id:null},
];
const anchoredSeries=financeCycleSeries({
  transactions:salaryAnchorTransactions,debtPayments:[],recurringRules:[salaryAnchorRule],categories:salaryAnchorCategories,
  baseCurrency:'CHF',fxRates:null,now:new Date('2026-10-08T12:00:00'),cycles:6,fallbackDay:25,financeMonthMode:'day_25',
});
assert.equal(anchoredSeries.length,6);
assert.deepEqual(anchoredSeries.map((row)=>row.start.getDate()),[24,22,25,24,25,25]);
assert.ok(anchoredSeries.every((row)=>row.source==='income_anchor'));
assert.ok(anchoredSeries.every((row)=>row.income>=6400&&row.income<7000),'Each real salary cycle should contain one salary, not zero or two.');
assert.equal(anchoredSeries[0].income,6626.25,'Secondary income inside the salary cycle must still count as real income.');
assert.equal(anchoredSeries[1].income,6407.55);
assert.equal(anchoredSeries[0].endExclusive.getDate(),22);
assert.equal(anchoredSeries[1].endExclusive.getDate(),25);

const calendar=resolveFinanceCycle({now,mode:'calendar'});
assert.equal(calendar.source,'calendar');
assert.equal(calendar.start.getDate(),1);
assert.equal(calendar.start.getMonth(),9);
assert.equal(calendar.endExclusive.getDate(),1);
assert.equal(calendar.endExclusive.getMonth(),10);

console.log('fixed finance-cycle assertions OK');
