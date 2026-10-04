import assert from 'node:assert/strict';
import { buildExpenseSeries, variableBudgetSuggestions } from '../assets/js/app/budget-intelligence.js';
import { budgetSummary, annualIncomeSummary } from '../assets/js/app/finance-insights.js';
import { consumptionExpenseBase } from '../assets/js/app/financial-effects.js';
import { inferredIncomeKind, needsIncomeReview } from '../assets/js/app/finance-semantics.js';

const now=new Date('2026-10-04T12:00:00');
const categories=[
  {id:'repay',name:'Rückzahlung',kind:'expense',parent_id:null},
  {id:'misc',name:'Sonstiges',kind:'expense',parent_id:null},
  {id:'housing',name:'Wohnen',kind:'expense',parent_id:null},
  {id:'utilities',name:'Nebenkosten',kind:'expense',parent_id:null},
  {id:'health',name:'Krankenkasse',kind:'expense',parent_id:null},
  {id:'food',name:'Lebensmittel',kind:'expense',parent_id:null},
  {id:'save',name:'Sparen',kind:'expense',parent_id:null},
  {id:'salary',name:'Lohn',kind:'income',parent_id:null},
  {id:'side',name:'Nebenverdienst',kind:'income',parent_id:null},
];
const merchantAppenzell={id:'app',name:'Kanton Appenzell A.Rh.;9100 Herisau; CH',normalized_key:'kanton appenzell a rh 9100 herisau ch',default_category_id:'repay'};
const merchantUzon={id:'uzon',name:'Uzon Immobilien AG',normalized_key:'uzon immobilien ag',default_category_id:'housing'};
const merchantAvenir={id:'avenir',name:'Groupe Mutuel / Avenir',normalized_key:'groupe mutuel avenir',default_category_id:'health'};
const merchantCoop={id:'coop',name:'Coop',normalized_key:'coop',default_category_id:'food'};
const merchants=[merchantAppenzell,merchantUzon,merchantAvenir,merchantCoop];

const months=[];
for(let i=0;i<12;i++){
  const d=new Date(2025,8+i,25,12);
  months.push(d.toISOString());
}
const appenzellTx=months.map((occurred_at,index)=>({
  id:`app-${index}`,status:'booked',occurred_at,amount:-150,currency:'CHF',
  account_id:'a1',merchant_id:index===10?null:'app',
  category_id:index===10?'misc':'repay',
  description:'Kanton Appenzell A.Rh.;9100 Herisau; CH',
  transfer_group_id:null,cashflow_type:'standard',
  categories:index===10?categories[1]:categories[0],
  merchants:index===10?null:merchantAppenzell,
}));
const appSeries=buildExpenseSeries({
  transactions:appenzellTx,categories,merchants,recurringRules:[],debtPayments:[],
  baseCurrency:'CHF',now,
}).filter((row)=>row.merchantId==='app');
assert.equal(appSeries.length,1,'historical row without merchant id should rejoin the known merchant series');
assert.equal(appSeries[0].bookingCount,12);
assert.equal(appSeries[0].categoryId,'repay');
assert.equal(appSeries[0].total,1800);
assert.ok(Math.abs(appSeries[0].historicalMonthly-150)<2,'full available history should resolve to about CHF 150/month');

const uzonTx=[
  ['rent1','2026-06-25',-1514,'housing'],
  ['rent2','2026-07-24',-1514,'housing'],
  ['rent3','2026-08-25',-1514,'housing'],
  ['nk1','2026-06-10',-672.90,'utilities'],
  ['nk2','2026-08-10',-732.70,'utilities'],
].map(([id,date,amount,categoryId])=>({
  id,status:'booked',occurred_at:`${date}T12:00:00`,amount,currency:'CHF',account_id:'a1',
  merchant_id:'uzon',category_id:categoryId,description:'Uzon Immobilien AG',
  transfer_group_id:null,cashflow_type:'standard',
  categories:categories.find((row)=>row.id===categoryId),merchants:merchantUzon,
}));
const uzonSeries=buildExpenseSeries({
  transactions:uzonTx,categories,merchants,recurringRules:[],debtPayments:[],baseCurrency:'CHF',now,
}).filter((row)=>row.merchantId==='uzon');
assert.equal(uzonSeries.length,2,'rent and ancillary costs at the same merchant must remain separate economic series');
assert.deepEqual(new Set(uzonSeries.map((row)=>row.categoryId)),new Set(['housing','utilities']));

const recurringAvenir={
  id:'r-avenir',active:true,direction:'expense',merchant_id:'avenir',category_id:'health',
  description:'Avenir Assurance',counterparty:'Groupe Mutuel / Avenir',amount:448.75,currency:'CHF',cadence:'monthly',
};
const avenirTx=['2026-06-25','2026-07-24','2026-08-25'].map((date,index)=>({
  id:`av-${index}`,status:'booked',occurred_at:`${date}T12:00:00`,amount:-448.75,currency:'CHF',
  account_id:'a1',merchant_id:'avenir',category_id:'health',description:'Avenir Assurance Maladie SA',
  transfer_group_id:null,cashflow_type:'standard',categories:categories[4],merchants:merchantAvenir,
}));
const fixedSeries=buildExpenseSeries({
  transactions:avenirTx,categories,merchants,recurringRules:[recurringAvenir],debtPayments:[],baseCurrency:'CHF',now,
}).find((row)=>row.recurringRule?.id==='r-avenir');
assert.equal(fixedSeries?.monthlyValue,448.75,'known recurring obligation must win over statistical average');
assert.equal(variableBudgetSuggestions({
  transactions:avenirTx,categories,merchants,recurringRules:[recurringAvenir],debtPayments:[],baseCurrency:'CHF',now,
}).length,0,'known fixed cost must not be proposed as variable budget');

const savingTx={id:'save1',status:'booked',occurred_at:'2026-09-25T12:00:00',amount:-525,currency:'CHF',category_id:'save',categories:categories[6],transfer_group_id:null,cashflow_type:'standard'};
assert.equal(consumptionExpenseBase(savingTx,new Map(),'CHF',null),0,'savings must not count as consumption expense');

const currentTransactions=[
  {id:'av-now',status:'booked',occurred_at:'2026-09-25T12:00:00',amount:-448.75,currency:'CHF',account_id:'a1',merchant_id:'avenir',category_id:'health',description:'Avenir Assurance',transfer_group_id:null,cashflow_type:'standard',categories:categories[4],merchants:merchantAvenir},
  savingTx,
  {id:'coop-now',status:'booked',occurred_at:'2026-09-26T12:00:00',amount:-15.80,currency:'CHF',account_id:'a1',merchant_id:'coop',category_id:'food',description:'Coop',transfer_group_id:null,cashflow_type:'standard',categories:categories[5],merchants:merchantCoop},
];
const summary=budgetSummary({
  budgets:[
    {id:'b-av',month_start:'2026-09-01',amount:380,currency:'CHF',merchant_id:'avenir',category_id:null,merchants:{name:'Groupe Mutuel / Avenir'}},
    {id:'b-save',month_start:'2026-09-01',amount:525,currency:'CHF',merchant_id:null,category_id:'save',categories:{name:'Sparen'}},
    {id:'b-coop',month_start:'2026-09-01',amount:80,currency:'CHF',merchant_id:'coop',category_id:null,merchants:{name:'Coop'}},
  ],
  transactions:currentTransactions,debtPayments:[],categories,merchants,recurringRules:[recurringAvenir],
  baseCurrency:'CHF',now,fallbackDay:25,
});
assert.equal(summary.count,1);
assert.equal(summary.excludedFixedCount,1);
assert.equal(summary.excludedSavingsCount,1);
assert.equal(summary.total,80);
assert.equal(summary.spent,15.8);
assert.ok(Math.abs(summary.rawPercent-19.75)<0.01);

const incomeRows=[
  {id:'salary1',status:'booked',occurred_at:'2026-01-23T12:00:00',amount:6412,currency:'CHF',category_id:'salary',categories:categories[7],transfer_group_id:null,cashflow_type:'standard',description:'Abacus Umantis AG'},
  {id:'side1',status:'booked',occurred_at:'2026-02-02T12:00:00',amount:500,currency:'CHF',category_id:'side',categories:categories[8],transfer_group_id:null,cashflow_type:'standard',description:'Egidas AG'},
  {id:'refund1',status:'booked',occurred_at:'2026-03-02T12:00:00',amount:390,currency:'CHF',category_id:'health',categories:categories[4],transfer_group_id:null,cashflow_type:'standard',description:'Sanitas'},
  {id:'repay1',status:'booked',occurred_at:'2026-04-02T12:00:00',amount:100,currency:'CHF',category_id:null,categories:null,transfer_group_id:null,cashflow_type:'receivable_principal',description:'Rückzahlung'},
  {id:'unknown1',status:'booked',occurred_at:'2026-05-02T12:00:00',amount:50,currency:'CHF',category_id:null,categories:null,transfer_group_id:null,cashflow_type:'standard',description:'Unbekannte Einzahlung'},
  {id:'hidden1',status:'booked',occurred_at:'2026-06-02T12:00:00',amount:1000,currency:'CHF',category_id:'salary',categories:categories[7],transfer_group_id:null,cashflow_type:'standard',description:'Ausgeblendet',analytics_excluded:true},
];
assert.equal(inferredIncomeKind(incomeRows[0]),'salary');
assert.equal(inferredIncomeKind(incomeRows[2]),'refund');
assert.equal(needsIncomeReview(incomeRows[4]),true);
const income=annualIncomeSummary({transactions:incomeRows,baseCurrency:'CHF',year:2026});
assert.equal(income.earned,6912);
assert.equal(income.refunds,390);
assert.equal(income.repayments,100);
assert.equal(income.unknown,50);
assert.equal(income.reviewCount,1);
assert.equal(income.totalCash,7452);

console.log('Finance intelligence regression assertions OK');
