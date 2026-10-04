import assert from 'node:assert/strict';
import { renderBudget } from '../assets/js/views/budget.js';

const household={base_currency:'CHF'};
const profile={locale:'de-CH'};
const categories=[
  {id:'health',name:'Krankenkasse',kind:'expense',parent_id:null},
  {id:'tobacco',name:'Tabak',kind:'expense',parent_id:null},
];
const merchants=[
  {id:'fixed',name:'Group Mutuel',normalized_key:'group mutuel',default_category_id:'health'},
  {id:'variable',name:'Tabak Shop',normalized_key:'tabak shop',default_category_id:'tobacco'},
];
const transactions=[
  {id:'f1',merchant_id:'fixed',category_id:'health',account_id:'a1',occurred_at:'2026-08-25T12:00:00',amount:-448.75,currency:'CHF',description:'Group Mutuel',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:categories[0],merchants:merchants[0]},
  {id:'v1',merchant_id:'variable',category_id:'tobacco',account_id:'a1',occurred_at:'2026-07-10T12:00:00',amount:-180,currency:'CHF',description:'Tabak',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:categories[1],merchants:merchants[1]},
  {id:'v2',merchant_id:'variable',category_id:'tobacco',account_id:'a1',occurred_at:'2026-08-10T12:00:00',amount:-270,currency:'CHF',description:'Tabak',status:'booked',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'UBS'},categories:categories[1],merchants:merchants[1]},
];
const recurringRules=[{
  id:'r1',direction:'expense',merchant_id:'fixed',category_id:'health',
  description:'Krankenkasse',counterparty:'Group Mutuel',amount:448.75,currency:'CHF',cadence:'monthly',active:true,
}];

const html=renderBudget({
  household,profile,merchants,transactions,recurringRules,
  budgets:[],categories,debtPayments:[],accounts:[],canWrite:true,
  budgetExpandedMerchantId:'merchant:variable|category:tobacco',
});

assert.match(html,/Variable Ausgabenmuster/);
assert.match(html,/vollständigen verfügbaren Historie/);
assert.match(html,/Tabak Shop · Tabak/);
assert.match(html,/Budgetvorschlag:/);
assert.match(html,/data-action="budget-transaction-edit" data-id="v1"/);
assert.doesNotMatch(html,/Letzte 3 vollständige Monate/);
assert.doesNotMatch(html,/Group Mutuel · Krankenkasse/,'known fixed cost must not be offered as a variable budget suggestion');

console.log('Explainable full-history budget assertions OK');
