import assert from 'node:assert/strict';
import { primaryOperatingAccount } from '../assets/js/app/finance-insights.js';
import { primaryAccountPreferenceId, withPrimaryAccountPreference } from '../assets/js/app/user-preferences.js';

const accounts=[
  {account_id:'zak',name:'Lebensmittel',institution_name:'ZAK',account_type:'checking',currency:'CHF',is_archived:false},
  {account_id:'salary',name:'LohnKonto',institution_name:'UBS',account_type:'checking',currency:'CHF',is_archived:false},
  {account_id:'savings',name:'Sparkonto',institution_name:'UBS',account_type:'savings',currency:'CHF',is_archived:false},
];

assert.equal(primaryOperatingAccount(accounts,[],'CHF')?.account_id,'salary');
assert.equal(primaryOperatingAccount(accounts,[],'CHF','zak')?.account_id,'zak');

const householdId='household-1';
const preferences=withPrimaryAccountPreference({setup_completed_version:2},householdId,'salary');
assert.equal(primaryAccountPreferenceId({preferences},householdId,accounts),'salary');
assert.equal(preferences.setup_completed_version,2);
assert.equal(preferences.primary_account_by_household[householdId],'salary');

const changed=withPrimaryAccountPreference(preferences,householdId,'zak');
assert.equal(primaryAccountPreferenceId({preferences:changed},householdId,accounts),'zak');
assert.equal(preferences.primary_account_by_household[householdId],'salary');

assert.equal(primaryAccountPreferenceId({preferences:{primary_account_by_household:{[householdId]:'missing'}}},householdId,accounts),'');

console.log('primary-account-tests: ok');
