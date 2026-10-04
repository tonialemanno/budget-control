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
  {id:'f1',merchant_id:'fixed',account_id:'a1',occurred_at:month(1),amount:-448.75,currency:'CHF',description:'Group Mutuel',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:{name:'Krankenkasse'}},
  {id:'f2',merchant_id:'fixed',account_id:'a1',occurred_at:month(2),amount:-448.75,currency:'CHF',description:'Group Mutuel',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:{name:'Krankenkasse'}},
  {id:'v1',merchant_id:'variable',account_id:'a1',occurred_at:month(1),amount:-180,currency:'CHF',description:'Tabak',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:{name:'Tabak'}},
  {id:'v2',merchant_id:'variable',account_id:'a1',occurred_at:month(2),amount:-270,currency:'CHF',description:'Tabak',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:{name:'Tabak'}},
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
  budgetExpandedMerchantId:'merchant:variable|category:Tabak',
});

assert.equal(html.includes('Ausgabenmuster'),true);
assert.equal(html.includes('Group Mutuel'),true,'known fixed cost should remain inspectable');
assert.equal(html.includes('Bekannte Verpflichtung'),true,'known fixed cost must be clearly marked');
assert.equal(html.includes('Tabak Shop'),true,'variable merchant should receive a budget pattern');
assert.equal(html.includes('data-amount="230"'),true,'450 CHF over the full observed two-month span should suggest 230 CHF after transparent rounding');
assert.equal(html.includes('Gesamte Historie: 2 Monate'),true,'pattern must explain that the complete observed history is used');
assert.equal(html.includes('data-action="budget-transaction-edit" data-id="v1"'),true,'expanded pattern must expose source transactions for correction');
assert.equal(html.includes('Letzte 3 vollständige Monate'),false);

console.log('Explainable budget pattern assertions OK');
