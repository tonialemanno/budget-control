import assert from 'node:assert/strict';
import { buildCategorizationGroups } from '../assets/js/app/categorization.js';

const categories=[{id:'food',name:'Lebensmittel',kind:'expense',parent_id:null}];
const accounts=[
  {account_id:'food-account',name:'Lebensmittel',currency:'CHF'},
  {account_id:'salary-account',name:'LohnKonto',currency:'CHF'},
];
const generic={
  id:'t1',status:'booked',transfer_group_id:null,cashflow_type:'standard',
  account_id:'food-account',amount:-40,description:'TWINT-Zahlung 29.09.26',
  counterparty:null,category_id:null,merchant_id:null,
};
const groups=buildCategorizationGroups({
  transactions:[generic],categories,accounts,merchants:[],aliases:[],rules:[],
});
assert.equal(groups.length,1);
assert.equal(groups[0].genericPaymentRail,true);
assert.equal(groups[0].merchantId,null);
assert.match(groups[0].name,/TWINT/);
assert.equal(groups[0].suggestion?.categoryId,'food');
assert.equal(groups[0].suggestion?.source,'account');
assert.equal(groups[0].suggestion?.safe,true);

const unknownOnSalary=buildCategorizationGroups({
  transactions:[{...generic,id:'t2',account_id:'salary-account'}],
  categories,accounts,merchants:[],aliases:[],rules:[],
});
assert.equal(unknownOnSalary[0].suggestion,null);

console.log('categorization-learning-tests: ok');
