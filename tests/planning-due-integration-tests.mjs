import assert from 'node:assert/strict';
import { renderPlanning } from '../assets/js/views/planning.js';
import { base } from './render-rich.mjs';

const rule={id:'divorce',description:'Scheidung',active:true,direction:'expense',amount:150,currency:'CHF',
  next_date:'2026-10-25',end_date:'2027-02-25',cadence:'monthly',interval_months:1,account_id:'a1'};
const oldTax={id:'old-tax-rule',description:'Steuern 2026',active:true,direction:'expense',
  amount:675,currency:'CHF',next_date:'2026-10-25',cadence:'monthly',account_id:'a1'};
const paid={id:'divorce-bank',occurred_at:'2026-10-23T10:00:00Z',
  amount:-150,currency:'CHF',account_id:'a1',recurring_rule_id:'divorce',status:'booked',transfer_group_id:null};
const taxPlan={id:'tax-plan',household_id:'h1',tax_case_id:'case-2026',obligation_id:'claim-2026',
  balance_as_of:'2026-10-28',starting_balance:5444.95,first_due_date:'2026-11-25',
  installment_amount:605,currency:'CHF',status:'active'};
const result=renderPlanning({...base,planningNow:'2026-10-28',recurringRules:[rule,oldTax],
  transactions:[paid],bills:[],contracts:[],debts:[],
  taxInstallmentPlans:[taxPlan],
  taxCases:[{id:'case-2026',household_id:'h1',tax_year:2026}],
  taxObligations:[{id:'claim-2026',household_id:'h1',tax_case_id:'case-2026',label:'Steuerrechnung',status:'partial',amount:7550}],
  taxPayments:[]});
assert.match(result,/Was muss ich wann bezahlen\?/);
assert.match(result,/>Scheidung<\/a>/);
assert.match(result,/CHF 150\.00/);
assert.match(result,/CHF 605\.00/);
assert.match(result,/2026/);
assert.match(result,/Automatik prüfen/);
assert.doesNotMatch(result,/>Steuern 2026<\/a>/);
const onlyRecurring=renderPlanning({...base,planningNow:'2026-10-28',recurringRules:[rule],
  transactions:[paid],bills:[],contracts:[],debts:[],taxInstallmentPlans:[]});
assert.match(onlyRecurring,/>Scheidung<\/a>/);
assert.match(onlyRecurring,/CHF 150\.00/);
console.log('planning R98: existing divorce commitment visible with tax installment and no duplicate old tax rule');
