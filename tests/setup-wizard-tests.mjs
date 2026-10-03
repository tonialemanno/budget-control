import assert from 'node:assert/strict';
import { buildSetupStatus, setupReviewed } from '../assets/js/app/setup-model.js';

const base={
  household:{country_code:'CH',base_currency:'CHF'},
  profile:{locale:'de-CH',preferences:{}},
  accounts:[{account_id:'a1',balance_anchor_amount:1000,balance_anchor_at:'2026-10-03T10:00:00Z'}],
  categories:[
    {id:'c1',name:'Wohnen',parent_id:null},
    {id:'c2',name:'Lebensmittel',parent_id:null},
    {id:'c3',name:'Mobilität',parent_id:null},
    {id:'c4',name:'Gesundheit',parent_id:null},
    {id:'c5',name:'Freizeit',parent_id:null},
    {id:'s1',name:'Supermarkt',parent_id:'c2'},
    {id:'s2',name:'Tanken',parent_id:'c3'},
    {id:'s3',name:'Apotheke',parent_id:'c4'},
  ],
  merchants:[
    {id:'m1',default_category_id:'s1'},
    {id:'m2',default_category_id:'s1'},
    {id:'m3',default_category_id:'s2'},
  ],
  categorizationRules:[],
  recurringRules:[
    {id:'r1',active:true,direction:'income'},
    {id:'r2',active:true,direction:'expense'},
  ],
  budgets:[],
  goals:[],
  debts:[],
  receivables:[],
  taxCases:[],
};

const ready=buildSetupStatus({...base,profile:{...base.profile,preferences:{setup_reviewed:['modules']}}});
assert.equal(ready.requiredDone,6);
assert.equal(ready.states.basis,true);
assert.equal(ready.states.accounts,true);
assert.equal(ready.states.balances,true);
assert.equal(ready.states.categories,true);
assert.equal(ready.states.subcategories,true);
assert.equal(ready.states.automation,true);
assert.equal(ready.states.recurring,true);
assert.equal(ready.states.modules,true);
assert.equal(ready.ready,true);
assert.equal(ready.firstOpen,'finish');

const noAccount=buildSetupStatus({...base,accounts:[]});
assert.equal(noAccount.states.accounts,false);
assert.equal(noAccount.states.balances,false);
assert.equal(noAccount.firstOpen,'accounts');

const missingAnchor=buildSetupStatus({...base,accounts:[{account_id:'a1',balance_anchor_amount:1000,balance_anchor_at:null}]});
assert.equal(missingAnchor.states.accounts,true);
assert.equal(missingAnchor.states.balances,false);
assert.equal(missingAnchor.firstOpen,'balances');

const optionalPending=buildSetupStatus({...base,recurringRules:[]});
assert.equal(optionalPending.requiredDone,6);
assert.equal(optionalPending.states.recurring,false);
assert.equal(optionalPending.states.modules,false);
assert.equal(optionalPending.ready,false);
assert.equal(optionalPending.firstOpen,'recurring');

const skipped=buildSetupStatus({
  ...base,
  recurringRules:[],
  profile:{...base.profile,preferences:{setup_reviewed:['recurring','modules']}},
});
assert.deepEqual(setupReviewed(skipped.completed?{}:{preferences:{setup_reviewed:['recurring','modules']}}),['recurring','modules']);
assert.equal(skipped.states.recurring,true);
assert.equal(skipped.states.modules,true);
assert.equal(skipped.ready,true);

const moduleData=buildSetupStatus({...base,budgets:[{id:'b1'}],profile:base.profile});
assert.equal(moduleData.states.modules,true);

const completed=buildSetupStatus({
  ...base,
  profile:{...base.profile,onboarding_completed_at:'2026-10-03T12:00:00Z',preferences:{setup_reviewed:['modules']}},
});
assert.equal(completed.completed,true);

console.log('full onboarding status assertions OK');
