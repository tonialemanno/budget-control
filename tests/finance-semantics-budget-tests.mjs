import assert from 'node:assert/strict';
import { semanticType } from '../assets/js/app/finance-semantics.js';
import { buildBudgetPatterns, calculateBudgetSummary } from '../assets/js/app/budget-engine.js';

const categories=[
  {id:'income',name:'Lohn',kind:'income',parent_id:null},
  {id:'housing',name:'Wohnen',kind:'expense',parent_id:null},
  {id:'utilities',name:'Nebenkosten',kind:'expense',parent_id:null},
  {id:'insurance',name:'Krankenkasse',kind:'expense',parent_id:null},
  {id:'saving',name:'Sparen',kind:'expense',parent_id:null},
  {id:'tax',name:'Steuern',kind:'expense',parent_id:null},
  {id:'other',name:'Sonstiges',kind:'expense',parent_id:null},
];

const merchants=[
  {id:'uzon',name:'Uzon Immobilien AG',normalized_key:'uzon immobilien ag'},
  {id:'app',name:'Kanton Appenzell A.Rh.',normalized_key:'kanton appenzell a rh'},
  {id:'avenir',name:'Groupe Mutuel / Avenir',normalized_key:'groupe mutuel avenir'},
];

const recurringRules=[
  {id:'salary-rule',active:true,direction:'income',amount:6400,currency:'CHF',cadence:'monthly',category_id:'income',description:'Abacus Umantis AG'},
  {id:'avenir-rule',active:true,direction:'expense',amount:448.75,currency:'CHF',cadence:'monthly',merchant_id:'avenir',category_id:'insurance',description:'Avenir Assurance'},
];

const txBase={status:'booked',currency:'CHF',cashflow_type:'standard',transfer_group_id:null};

assert.equal(semanticType({...txBase,amount:6400,category_id:'income',categories:{id:'income',name:'Lohn',kind:'income'}},{categories,recurringRules}),'earned_income');
assert.equal(semanticType({...txBase,amount:100,category_id:'insurance',categories:{id:'insurance',name:'Krankenkasse',kind:'expense'}},{categories,recurringRules}),'refund');
assert.equal(semanticType({...txBase,amount:100,category_id:null,categories:null},{categories,recurringRules}),'unclassified_inflow');
assert.equal(semanticType({...txBase,amount:-525,category_id:'saving',categories:{id:'saving',name:'Sparen',kind:'expense'}},{categories,recurringRules}),'saving');
assert.equal(semanticType({...txBase,amount:-800,category_id:'tax',categories:{id:'tax',name:'Steuern',kind:'expense'}},{categories,recurringRules}),'tax_payment');
assert.equal(semanticType({...txBase,amount:-448.75,merchant_id:'avenir',category_id:'insurance',description:'Avenir Assurance'},{categories,recurringRules}),'fixed_expense');

const transactions=[];
for(let i=0;i<12;i+=1){
  const d=new Date(2025,9+i,25,12);
  transactions.push({
    ...txBase,id:`app-${i}`,occurred_at:d.toISOString(),amount:-150,
    merchant_id:i===0?null:'app',
    category_id:'other',
    description:'Kanton Appenzell A.Rh.;9100 Herisau; CH',
    categories:{id:'other',name:'Sonstiges',kind:'expense'},
  });
}
for(let i=0;i<12;i+=1){
  const d=new Date(2025,9+i,25,12);
  transactions.push({
    ...txBase,id:`rent-${i}`,occurred_at:d.toISOString(),amount:-1514,
    merchant_id:'uzon',category_id:'housing',description:'Uzon Immobilien AG',
    categories:{id:'housing',name:'Wohnen',kind:'expense'},
  });
}
transactions.push({
  ...txBase,id:'utility-1',occurred_at:new Date(2026,8,25,12).toISOString(),amount:-732.70,
  merchant_id:'uzon',category_id:'utilities',description:'Uzon Immobilien AG',
  categories:{id:'utilities',name:'Nebenkosten',kind:'expense'},
});
transactions.push({
  ...txBase,id:'utility-2',occurred_at:new Date(2025,11,1,12).toISOString(),amount:-672.90,
  merchant_id:'uzon',category_id:'utilities',description:'Uzon Immobilien AG',
  categories:{id:'utilities',name:'Nebenkosten',kind:'expense'},
});
transactions.push({
  ...txBase,id:'avenir-current',occurred_at:new Date(2026,8,25,12).toISOString(),amount:-448.75,
  merchant_id:'avenir',category_id:'insurance',description:'Avenir Assurance',
  categories:{id:'insurance',name:'Krankenkasse',kind:'expense'},
});

const patterns=buildBudgetPatterns({
  transactions,categories,merchants,recurringRules,debtPayments:[],baseCurrency:'CHF',
  now:new Date(2026,9,4,12),minTransactions:2,
});
const appenzell=patterns.find((row)=>row.merchant?.id==='app');
assert.ok(appenzell,'Appenzell pattern missing');
assert.equal(appenzell.rows.length,12);
assert.equal(appenzell.cadence?.key,'monthly');
assert.equal(Math.round(appenzell.monthly),150);

const uzonRows=patterns.filter((row)=>row.merchant?.id==='uzon');
assert.equal(uzonRows.length,2,'Rent and utilities must remain separate series');
const rent=uzonRows.find((row)=>row.category.id==='housing');
assert.equal(rent.rows.length,12);
assert.equal(Math.round(rent.monthly),1514);

const budgets=[
  {id:'b-saving',month_start:'2026-09-01',amount:525,currency:'CHF',category_id:'saving',merchant_id:null,categories:{name:'Sparen'}},
  {id:'b-avenir',month_start:'2026-09-01',amount:380,currency:'CHF',category_id:null,merchant_id:'avenir',merchants:{name:'Groupe Mutuel / Avenir'}},
  {id:'b-other',month_start:'2026-09-01',amount:300,currency:'CHF',category_id:'other',merchant_id:null,categories:{name:'Sonstiges'}},
];

const summary=calculateBudgetSummary({
  budgets,transactions,debtPayments:[],categories,merchants,recurringRules,baseCurrency:'CHF',
  now:new Date(2026,9,4,12),fallbackDay:25,
});
assert.equal(summary.allStoredCount,3);
assert.equal(summary.count,1,'Only true variable budgets may drive the budget percentage');
assert.equal(summary.fixedRows.length,1);
assert.equal(summary.savingRows.length,1);
assert.equal(summary.fixedPlanned,448.75);
assert.equal(summary.total,300);

console.log('finance semantics and full-history budget assertions OK');
