import assert from 'node:assert/strict';
import { primaryOperatingAccount } from '../assets/js/app/finance-insights.js';
import { primaryAccountPreferenceId, withPrimaryAccountPreference } from '../assets/js/app/user-preferences.js';

const accounts=[
  {account_id:'cler',name:'Cler',account_type:'checking',currency:'CHF',is_archived:false},
  {account_id:'salary',name:'UBS Lohnkonto',account_type:'checking',currency:'CHF',is_archived:false},
  {account_id:'savings',name:'Sparkonto',account_type:'savings',currency:'CHF',is_archived:false},
];

assert.equal(
  primaryOperatingAccount(accounts,[],'CHF')?.account_id,
  'salary',
  'Without a saved preference, an explicit salary account name must beat alphabetical account order.',
);

assert.equal(
  primaryOperatingAccount(accounts,[],'CHF','cler')?.account_id,
  'cler',
  'A saved personal primary account must override every fallback heuristic.',
);

const householdId='household-1';
const preferences=withPrimaryAccountPreference({privacy_enabled:true},householdId,'salary');
const profile={preferences};
assert.equal(primaryAccountPreferenceId(profile,householdId,accounts),'salary');
assert.equal(preferences.privacy_enabled,true);
assert.equal(preferences.primary_account_by_household[householdId],'salary');

const changed=withPrimaryAccountPreference(preferences,householdId,'cler');
assert.equal(primaryAccountPreferenceId({preferences:changed},householdId,accounts),'cler');
assert.equal(preferences.primary_account_by_household[householdId],'salary','Preference updates must be immutable.');

assert.equal(
  primaryAccountPreferenceId({preferences:{primary_account_by_household:{[householdId]:'missing'}}},householdId,accounts),
  '',
  'A removed or inaccessible account must not remain an effective primary account.',
);

console.log('primary-account-tests: ok');
