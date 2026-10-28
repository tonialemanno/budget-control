import assert from 'node:assert/strict';
import { buildUpcomingPayments } from '../assets/js/app/upcoming-payments.js';

const household={id:'private',base_currency:'CHF'};
const divorce={
  id:'divorce',household_id:'private',description:'Scheidung',direction:'expense',amount:150,
  currency:'CHF',cadence:'monthly',interval_months:1,next_date:'2026-10-25',
  end_date:'2027-02-25',active:true,account_id:'salary',
};
const tx=(id,date,amount,ruleId='divorce',account='salary')=>({
  id,recurring_rule_id:ruleId,occurred_at:date,status:'booked',
  amount:-amount,currency:'CHF',account_id:account,transfer_group_id:null,
});
const paidOct=tx('bank-oct','2026-10-23T10:00:00Z',150);
const result=buildUpcomingPayments({now:'2026-10-28',months:5,household,
  recurringRules:[divorce],transactions:[paidOct]});
assert.deepEqual(result.rows.map((r)=>r.due),[
  '2026-11-25','2026-12-25','2027-01-25','2027-02-25']);
assert.ok(result.rows.every((r)=>r.amount===150&&r.source==='Wiederkehrend'));
assert.equal(result.rows.length,4,'October already paid; no March past end date');

const unpaid=buildUpcomingPayments({now:'2026-10-28',months:1,household,recurringRules:[divorce]});
assert.equal(unpaid.rows[0].due,'2026-10-25');
assert.equal(unpaid.rows[0].status,'overdue');
const wrongBank=buildUpcomingPayments({now:'2026-10-28',months:1,household,
  recurringRules:[divorce],transactions:[tx('wrong','2026-10-23',150,'divorce','wrong-bank')]});
assert.equal(wrongBank.rows[0].due,'2026-10-25','Wrong bank must not satisfy payment');
const wrongAmt=buildUpcomingPayments({now:'2026-10-28',months:1,household,
  recurringRules:[divorce],transactions:[tx('wrong','2026-10-25',152.65)]});
assert.equal(wrongAmt.rows[0].amount,150,'Mismatched amount cannot settle a recurring payment');
const earlyUnrelated=buildUpcomingPayments({now:'2026-09-26',months:1,household,
  recurringRules:[{...divorce,next_date:'2026-09-25'}],
  transactions:[tx('unrelated','2026-09-11',150)]});
assert.equal(earlyUnrelated.rows[0].due,'2026-09-25');

const plan={id:'tax-plan',household_id:'private',tax_case_id:'tax-case',obligation_id:'tax-claim',
  starting_balance:5444.95,balance_as_of:'2026-10-28',first_due_date:'2026-11-25',
  installment_amount:605,currency:'CHF',status:'active'};
const taxRule={id:'old-tax',description:'Steuern 2026',direction:'expense',amount:675,
  currency:'CHF',active:true,next_date:'2026-10-25',cadence:'monthly'};
const withTax=buildUpcomingPayments({now:'2026-10-28',months:1,household,recurringRules:[divorce,taxRule],
  transactions:[paidOct],taxInstallmentPlans:[plan],
  taxCases:[{id:'tax-case',tax_year:2026}],
  taxObligations:[{id:'tax-claim',tax_case_id:'tax-case',status:'partial',label:'Kantons- und Gemeindesteuer'}]});
assert.ok(withTax.rows.some((r)=>r.label==='Scheidung'&&r.amount===150));
assert.ok(withTax.rows.some((r)=>r.source==='Steuerrate'&&r.amount===605));
assert.ok(!withTax.rows.some((r)=>r.label==='Steuern 2026'),'Do not double-count the tax rule');
assert.equal(withTax.warnings[0].amount,675);
assert.equal(withTax.warnings[0].planRate,605);

const linkedDebt={id:'debt',name:'iPhone',status:'active',outstanding_amount:400,
  installment_amount:46.04,next_payment_date:'2026-11-25',recurring_rule_id:'debt-rule',currency:'CHF'};
const debtRule={id:'debt-rule',description:'iPhone Rate',direction:'expense',
  amount:46.04,next_date:'2026-11-25',active:true,currency:'CHF',cadence:'monthly'};
const withDebt=buildUpcomingPayments({now:'2026-10-28',months:1,household,
  debts:[linkedDebt],recurringRules:[debtRule]});
assert.equal(withDebt.rows.filter((r)=>r.amount===46.04).length,1);
const bill={id:'bill',name:'Zahnarzt',status:'open',due_date:'2026-11-15',amount:200,currency:'CHF'};
const withBill=buildUpcomingPayments({now:'2026-10-28',months:1,household,bills:[bill]});
assert.equal(withBill.rows.length,1);
assert.equal(withBill.rows[0].source,'Rechnung');
console.log('unified upcoming payments: recurring, settled, overdue, tax and debt deduplication OK');
