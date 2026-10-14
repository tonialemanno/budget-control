import assert from 'node:assert/strict';
import { buildSavingsCompass } from '../assets/js/app/savings-compass.js';
import { renderSavingsCompass } from '../assets/js/views/savings-compass.js';

const now=new Date('2026-10-14T12:00:00');
const cycle={start:new Date('2026-09-25T00:00:00'),endExclusive:new Date('2026-10-25T00:00:00')};
const snapshot={currency:'EUR',financeCycle:cycle,unbudgetedActualVariableExpensesMonth:0};
const primaryAccount={account_id:'ing',currency:'EUR',current_balance:1000};
const coach={daysRemaining:11,protectedUntilCycleEnd:350,
  budget:{count:1,total:400,remaining:300},insights:[]};
const recurringRules=[
 {id:'income',direction:'income',currency:'EUR',active:true,amount:1900},
 {id:'rent',direction:'expense',currency:'EUR',active:true,amount:250},
];
const make=(override={})=>buildSavingsCompass({
 snapshot,coach,primaryAccount,accounts:[primaryAccount],recurringRules,now,
 ...override,
});
const plan=make();
assert.equal(plan.ready,true);
assert.equal(plan.commitments,350);
assert.equal(plan.uncommitted,650);
assert.equal(plan.cushion,65);
assert.equal(plan.spendable,300,'limited by variable budget, not by cash balance');
assert.equal(plan.recommendedSpend,240,'scenario spends 80% of remaining discretionary allowance');
assert.equal(plan.extraByReducing,60,'only the incremental 20% is a saving opportunity');
assert.equal(plan.remainingAfterPlan,345,'end balance projection nets out commitments and cushion');
assert.equal(plan.daily,27.27);
assert.match(renderSavingsCompass({plan,locale:'de-DE'}),/Sparmodus: 20 % weniger ausgeben/);
assert.doesNotMatch(renderSavingsCompass({plan,locale:'de-DE',privacyEnabled:true}),/345,00/);
assert.equal(make({coach:{...coach,protectedUntilCycleEnd:1100}}).spendable,0,'shortfall is not spendable');
assert.equal(make({coach:{...coach,protectedUntilCycleEnd:1100}}).extraByReducing,0);
assert.equal(make({coach:{...coach,budget:{count:0,total:0,remaining:0}}}).reason,'budget');
assert.equal(make({recurringRules:[recurringRules[0]]}).reason,'fixed');
assert.equal(make({recurringRules:[recurringRules[1]]}).reason,'income');
assert.equal(make({primaryAccount:null}).reason,'account');
assert.equal(make({transactions:[{status:'booked',currency:'CHF',amount:-20,occurred_at:'2026-10-09T12:00:00'}]}).reason,'fx');
assert.equal(make({primaryAccount:{...primaryAccount,currency:'CHF',current_balance:1000},fxRates:null}).reason,'fx');
assert.equal(make({coach:{...coach,protectedUntilCycleEnd:900,budget:{count:1,total:400,remaining:300}}}).remainingAfterPlan,0);
const subscription=make({coach:{...coach,subscriptions:{count:2,monthly:33},insights:[]}});
assert.equal(subscription.tips[0].type,'subscriptions');
assert.match(renderSavingsCompass({plan:subscription}),/Abos überprüfen/);
const s=renderSavingsCompass({plan:make({recurringRules:[recurringRules[0]]})});
assert.match(s,/Noch nicht verlässlich berechenbar/);
assert.doesNotMatch(s,/Noch flexibel ausgeben/);
console.log('Saving compass cash, obligations, buffer, scenarios, FX, privacy and setup checks OK');
