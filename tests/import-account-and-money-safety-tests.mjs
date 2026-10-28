import assert from 'node:assert/strict';
import { renderMoney } from '../assets/js/views/money.js';
import { renderImports } from '../assets/js/views/imports.js';
import { preferredImportAccountId, withImportAccountPreference } from '../assets/js/app/user-preferences.js';

const household={id:'privat-1',base_currency:'CHF'};
const profiles={preferences:{primary_account_by_household:{'privat-1':'salary'}}};
const accounts=[
  {account_id:'cash',name:'Bargeld CHF',account_type:'cash',currency:'CHF',current_balance:74.85},
  {account_id:'salary',name:'LohnKonto',account_type:'checking',currency:'CHF',current_balance:-3746.74},
  {account_id:'savings',name:'Sparkonto',account_type:'savings',currency:'CHF',current_balance:5402.68},
  {account_id:'euros',name:'Eurokonto',account_type:'savings',currency:'EUR',current_balance:51.32},
];
const batches=[
  {id:'old',account_id:'cash',status:'failed',created_at:'2026-10-28T13:00:00Z'},
  {id:'latest',account_id:'salary',status:'completed',created_at:'2026-10-28T12:00:00Z'},
  {id:'earlier',account_id:'cash',status:'completed',created_at:'2026-09-01T12:00:00Z'},
];
assert.equal(preferredImportAccountId(profiles,household.id,accounts,batches),'salary');
assert.equal(preferredImportAccountId(profiles,household.id,accounts,[]),'salary');
assert.equal(preferredImportAccountId({preferences:{}},household.id,accounts,batches),'salary');
const savedProfile={preferences:withImportAccountPreference(profiles.preferences,household.id,'savings')};
assert.equal(preferredImportAccountId(savedProfile,household.id,accounts,batches),'savings');
assert.equal(preferredImportAccountId({preferences:withImportAccountPreference(profiles.preferences,'other','cash')},household.id,accounts,batches),'salary');
assert.equal(preferredImportAccountId({preferences:{}},household.id,[accounts[0]],[]),'cash');
assert.equal(preferredImportAccountId({preferences:{}},household.id,[],[]),'');
assert.equal(preferredImportAccountId({preferences:{import_account_by_household:{'privat-1':'missing'}}},household.id,accounts,batches),'salary');

const imports=renderImports({accounts,importBatches:batches,household,profile:profiles,canWrite:true});
assert.match(imports,/value="salary" selected>LohnKonto · CHF/);
assert.doesNotMatch(imports,/value="cash" selected>Bargeld CHF/);
assert.match(imports,/Nach einem erfolgreichen Import merkt sich AIONE dein Konto/);

const money=renderMoney({accounts,household,profile:profiles,fxRates:{rates:{EUR:1.0},as_of:'2026-09'},canWrite:true});
assert.match(money,/Buchungssaldo Hauptkonto<\/span> · CHF/);
assert.match(money,/CHF(?:\s|&nbsp;|&#160;|\u00a0)*[−-]3['’]746\.74/);
assert.match(money,/Konten zusammen \(inkl\. Sparkonten &amp; Bargeld\)/);
assert.match(money,/Kein frei verfügbares Geld\./);
assert.doesNotMatch(money,/Verfügbar · CHF/);
assert.match(money,/SNB Monatsmittel · Stand 2026-09/);
const missingFx=renderMoney({accounts,household,profile:profiles,fxRates:null,canWrite:true});
assert.match(missingFx,/Währungsumrechnung unvollständig\./);
assert.match(missingFx,/Nicht berechenbar/);
console.log('R100 money truth and import account selection checks OK');
