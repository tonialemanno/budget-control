import assert from 'node:assert/strict';
import { vehicleSpendingSnapshot } from '../assets/js/app/vehicle-costs.js';
import { merchantFromTransaction, suggestKnownCategoryCandidates } from '../assets/js/app/csv-import.js';
import { DE } from '../assets/js/country/de.js';
import { renderVehicles } from '../assets/js/views/vehicles.js';

const vehicle={id:'auto-1',name:'Anas Auto',currency:'EUR',current_value:4500,monthly_cost:100};
const categories=[
  {id:'tank',name:'Tanken',kind:'expense'},
  {id:'repair',name:'Wartung & Reparatur',kind:'expense'},
  {id:'purchase',name:'Fahrzeugkauf',kind:'expense'},
];
const tx=(id,amount,category_id,occurred_at='2026-10-08T12:00:00')=>({
  id,amount,category_id,occurred_at,vehicle_id:'auto-1',currency:'EUR',status:'booked',
});
const transactions=[
  tx('fuel',-60,'tank'),
  tx('repair',-240,'repair','2026-09-09T12:00:00'),
  {...tx('purchase',-900,'purchase'),semantic_type:'asset_acquisition'},
  {...tx('financing',-150,null),cashflow_type:'debt_payment'},
  {...tx('refund',40,'repair'),semantic_type:'refund'},
  {...tx('other',-100,'tank'),vehicle_id:'a-different-car'},
  {...tx('transfer',-500,'tank'),transfer_group_id:'group-id'},
  {...tx('future',-100,'tank','2026-12-08T12:00:00')},
  {...tx('ignored',-100,'tank'),exclude_from_reports:true},
];
const result=vehicleSpendingSnapshot({
  vehicle,transactions,categories,
  debtPayments:[{transaction_id:'financing',principal_amount:130,interest_amount:20,fee_amount:0,currency:'EUR'}],
  now:new Date('2026-10-14T21:00:00'),
});
assert.equal(result.spent,280,'running cost includes repair, fuel, finance interest, subtracts refund');
assert.equal(result.thisMonth,40,'October includes fuel, interest and refund, not September repair');
assert.equal(result.cashPaid,1310,'cash paid includes the purchase and full debt payment, minus refund');
assert.equal(result.fuel,60);
assert.equal(result.linkedCount,5,'excludes other car, transfer, future and hidden');
assert.equal(result.missingFx,0);
assert.deepEqual(result.categories.map(row=>row.name),['Wartung & Reparatur','Tanken','Finanzierungskosten']);

const fx=vehicleSpendingSnapshot({vehicle,transactions:[{...tx('foreign',-10,'tank'),currency:'GBP'}],
  categories,now:new Date('2026-10-14T21:00:00')});
assert.equal(fx.missingFx,1);
assert.equal(fx.spent,0,'do not make up conversion rates');

for(const [text,name,category] of [
  ['ARAL 4532 Freiburg','Aral','Tanken'],
  ['SHELL STATION 382 Freiburg','Shell','Tanken'],
  ['ARAL PULSE LADESTATION','Aral pulse','Laden / Strom'],
  ['SHELL RECHARGE STATION','Shell Recharge','Laden / Strom'],
]){
  assert.equal(merchantFromTransaction({description:text}).name,name,text);
  assert.equal(suggestKnownCategoryCandidates({description:text,amount:-55})[0],category,text);
}
assert.ok(DE.starterSubcategories.some(([n])=>n==='Laden / Strom'));
assert.ok(DE.starterSubcategories.some(([n])=>n==='Kfz-Steuer'));

const html=renderVehicles({vehicles:[vehicle],transactions,categories,debtPayments:[
  {transaction_id:'financing',principal_amount:130,interest_amount:20,fee_amount:0,currency:'EUR'},
],household:{base_currency:'EUR'},profile:{locale:'de-DE'},canWrite:true,fxRates:null});
assert.match(html,/Bisherige Betriebskosten/);
assert.match(html,/Tanken \/ Laden/);
assert.match(html,/Anas Auto/);
assert.match(html,/\/finance\/transactions\?vehicle=auto-1/);
assert.match(html,/Planwert/);
const unlinked={...tx('suggestion',-30,'tank'),vehicle_id:null,description:'ARAL Freiburg'};
const suggestionHtml=renderVehicles({vehicles:[vehicle],transactions:[unlinked],categories,
  household:{base_currency:'EUR'},profile:{locale:'de-DE'},canWrite:true});
assert.match(suggestionHtml,/Mögliche Fahrzeugzahlungen/);
assert.match(suggestionHtml,/data-action="vehicle-assign-transaction"/);
assert.match(suggestionHtml,/data-vehicle-id="auto-1"/);
const readonlyHtml=renderVehicles({vehicles:[vehicle],transactions:[unlinked],categories,
  household:{base_currency:'EUR'},profile:{locale:'de-DE'},canWrite:false});
assert.doesNotMatch(readonlyHtml,/data-action="vehicle-assign-transaction"/);
const main= (await import('node:fs')).readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/action==='vehicle-assign-transaction'/);
assert.match(main,/financeApi\.updateTransaction\(tx\.id,\{vehicle_id:vehicle\.id\}\)/);
console.log('DE vehicle spending, tank station matching and drilldown contracts OK');
