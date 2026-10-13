import assert from 'node:assert/strict';
import { accountShare } from '../assets/js/app/finance-insights.js';
import { renderStatistics } from '../assets/js/views/statistics.js';
import { renderOverview } from '../assets/js/views/overview.js';

const accounts=[
  {account_id:'ch',name:'Lohnkonto',account_type:'checking',currency:'CHF',current_balance:100},
  {account_id:'de',name:'Eurokonto',account_type:'savings',currency:'EUR',current_balance:100},
];

const missing=accountShare(accounts,'CHF',null);
assert.equal(missing.find((row)=>row.account.account_id==='ch').value,100);
assert.equal(missing.find((row)=>row.account.account_id==='de').value,null,
  'An unavailable EUR/CHF rate must not silently turn the EUR balance into 0 CHF');
assert.ok(missing.every((row)=>row.share===null),
  'Account shares cannot be trusted if an FX rate is missing');

const incompleteHtml=renderStatistics({
  accounts,household:{base_currency:'CHF'},profile:{locale:'de-CH'},fxRates:null,
});
assert.match(incompleteHtml,/Nicht berechenbar/);
assert.match(incompleteHtml,/Für mindestens ein Konto fehlt ein Wechselkurs/);
assert.match(incompleteHtml,/Anteil nicht berechenbar/);

const validFx={rates:{CHF:1,EUR:1.1}};
const converted=accountShare(accounts,'CHF',validFx);
assert.ok(Math.abs(converted.find((row)=>row.account.account_id==='de').value-110)<0.0001);
assert.ok(converted.every((row)=>typeof row.share==='number'));
assert.ok(Math.abs(converted.reduce((sum,row)=>sum+row.share,0)-100)<0.0001);

const completeHtml=renderStatistics({
  accounts,household:{base_currency:'CHF'},profile:{locale:'de-CH'},fxRates:validFx,
});
assert.doesNotMatch(completeHtml,/Für mindestens ein Konto fehlt ein Wechselkurs/);
assert.doesNotMatch(completeHtml,/Anteil nicht berechenbar/);
const incompleteDashboard=renderOverview({
  accounts,household:{id:'h1',base_currency:'CHF',country_code:'CH'},
  profile:{locale:'de-CH'},fxRates:null,
});
assert.match(incompleteDashboard,/Für mindestens ein Konto fehlt ein Wechselkurs/);
assert.match(incompleteDashboard,/Andere liquide Konten <strong>Nicht berechenbar/);
assert.match(incompleteDashboard,/Nettovermögen <strong>Nicht berechenbar/);
assert.match(incompleteDashboard,/Anteil nicht berechenbar/);

const completeDashboard=renderOverview({
  accounts,household:{id:'h1',base_currency:'CHF',country_code:'CH'},
  profile:{locale:'de-CH'},fxRates:validFx,
});
assert.doesNotMatch(completeDashboard,/Für mindestens ein Konto fehlt ein Wechselkurs/);

console.log('Statistics and overview FX completeness tests passed');
