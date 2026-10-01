import assert from 'node:assert/strict';
import { renderBudget } from '../assets/js/views/budget.js';

const now=new Date();
const month=(back)=>{
  const d=new Date(now.getFullYear(),now.getMonth()-back,10,12);
  return d.toISOString();
};

const household={base_currency:'CHF'};
const profile={locale:'de-CH'};
const merchants=[
  {id:'fixed',name:'Group Mutuel'},
  {id:'variable',name:'Tabak Shop'},
];
const transactions=[
  {id:'f1',merchant_id:'fixed',occurred_at:month(1),amount:-448.75,currency:'CHF',status:'booked',transfer_group_id:null,cashflow_type:'standard'},
  {id:'f2',merchant_id:'fixed',occurred_at:month(2),amount:-448.75,currency:'CHF',status:'booked',transfer_group_id:null,cashflow_type:'standard'},
  {id:'v1',merchant_id:'variable',occurred_at:month(1),amount:-180,currency:'CHF',status:'booked',transfer_group_id:null,cashflow_type:'standard'},
  {id:'v2',merchant_id:'variable',occurred_at:month(2),amount:-270,currency:'CHF',status:'booked',transfer_group_id:null,cashflow_type:'standard'},
];
const recurringRules=[{
  id:'r1',
  direction:'expense',
  description:'Krankenkasse',
  counterparty:'Group Mutuel',
  amount:448.75,
  currency:'CHF',
  cadence:'monthly',
  active:true,
}];

const html=renderBudget({
  household,profile,merchants,transactions,recurringRules,
  budgets:[],categories:[],debtPayments:[],accounts:[],canWrite:true,
});

assert.equal(html.includes('Variable Budgetvorschläge'),true);
assert.equal(
  html.includes('<div class="suggestion-card"><div><strong>Group Mutuel</strong>'),
  false,
  'known fixed-cost merchant must not receive a variable budget suggestion',
);
assert.equal(
  html.includes('<div class="suggestion-card"><div><strong>Tabak Shop</strong>'),
  true,
  'variable merchant should receive a budget suggestion',
);
assert.equal(
  html.includes('data-amount="150"'),
  true,
  '450 CHF over three full months should suggest 150 CHF without hidden 10% buffer',
);
assert.equal(html.includes('Wiederkehrende Händlerausgaben der letzten 90 Tage'),false);

console.log('Variable budget suggestion assertions OK');
