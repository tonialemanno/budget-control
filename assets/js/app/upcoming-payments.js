import { effectiveNextDate, nextOccurrenceDate, localDateValue } from './recurrence.js';
import { taxInstallmentSchedule } from './tax-installments.js';

function dateKey(value) {
  return localDateValue(value);
}
function cents(value) {
  return Math.round(Number(value || 0) * 100);
}
function calendarDayDifference(a,b){
  const left=Date.parse(dateKey(a)+'T12:00:00Z');
  const right=Date.parse(dateKey(b)+'T12:00:00Z');
  return Number.isFinite(left)&&Number.isFinite(right)?Math.abs(left-right)/86400000:Infinity;
}
function shiftDay(date,days){
  const copy=new Date(dateKey(date)+'T12:00:00Z');
  copy.setUTCDate(copy.getUTCDate()+days);
  return copy.toISOString().slice(0,10);
}
function horizonEnd(now,months) {
  const date=new Date(dateKey(now)+'T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth()+Math.max(1,Math.min(24,Math.round(months||3))));
  return date.toISOString().slice(0,10);
}
function validExpenseRule(rule){
  return rule?.active!==false && rule?.direction==='expense' && Number(rule?.amount)>0 && Boolean(rule?.next_date);
}
function linkedPaymentCents(rule,due,transactions){
  const scheduled=cents(rule.amount);
  const matched=(transactions||[]).filter((tx)=>
    tx.recurring_rule_id===rule.id &&
    tx.status==='booked' &&
    !tx.transfer_group_id &&
    Number(tx.amount)<0 &&
    tx.currency===rule.currency &&
    (!rule.account_id||tx.account_id===rule.account_id) &&
    cents(-Number(tx.amount))<=scheduled &&
    calendarDayDifference(tx.occurred_at,due)<=3
  );
  return Math.min(scheduled,matched.reduce((sum,tx)=>sum+cents(-Number(tx.amount)),0));
}
function taxPlanForRule(rule,plans,taxCases){
  const match=String(rule.description||'').trim().match(/^(?:steuern?|tax(?:es)?)\s*(20\d{2})\s*$/i);
  if(!match)return null;
  return plans.find((plan)=>plan.status==='active'&&taxCases.some((c)=>c.id===plan.tax_case_id&&Number(c.tax_year)===Number(match[1])))||null;
}

/**
 * Read-only, cross-module payment timeline. Reuses existing economic records:
 * recurring rules, open bills, non-recurring contracts/debts and tax installments.
 * An installment is never inserted as an extra bill or recurring expense.
 */
export function buildUpcomingPayments({
  now=new Date(),months=3,pastDays=7,
  recurringRules=[],transactions=[],bills=[],contracts=[],debts=[],
  taxInstallmentPlans=[],taxObligations=[],taxCases=[],taxPayments=[],household=null,
}={}){
  const today=dateKey(now);
  if(!today)throw new Error('Ungültiges Referenzdatum.');
  const from=shiftDay(today,-Math.max(0,Math.round(pastDays)));
  const until=horizonEnd(today,months);
  const rows=[];
  const warnings=[];
  const householdId=household?.id;

  const currentTaxPlans=taxInstallmentPlans.filter((p)=>p.status==='active'&&(!householdId||p.household_id===householdId));
  const activeRules=recurringRules.filter(validExpenseRule);
  const activeRuleIds=new Set(activeRules.map((r)=>r.id));

  for(const rule of activeRules){
    const duplicateTaxPlan=taxPlanForRule(rule,currentTaxPlans,taxCases);
    if(duplicateTaxPlan){
      warnings.push({
        kind:'overlapping-tax-rule',ruleId:rule.id,
        description:rule.description,amount:Number(rule.amount),
        currency:rule.currency,planId:duplicateTaxPlan.id,
        planRate:Number(duplicateTaxPlan.installment_amount),
      });
      continue;
    }
    let date=effectiveNextDate(rule,from);
    let guard=0;
    while(date&&dateKey(date)<=until&&guard<260){
      const due=dateKey(date);
      const paid=linkedPaymentCents(rule,due,transactions);
      const left=Math.max(0,cents(rule.amount)-paid);
      if(left>0) rows.push({
        id:'recurring:'+rule.id+':'+due,
        due,label:rule.description||rule.counterparty||'Wiederkehrende Zahlung',
        amount:left/100,currency:rule.currency||household?.base_currency||'CHF',
        source:'Wiederkehrend',href:'#/recurring',
        status:due<today?'overdue':paid>0?'partial':'open',
      });
      date=nextOccurrenceDate(date,rule.cadence,rule.interval_months);
      if(rule.end_date&&dateKey(date)>dateKey(rule.end_date))break;
      guard++;
    }
  }

  for(const bill of bills){
    if(['paid','cancelled'].includes(bill.status)||!bill.due_date)continue;
    const due=dateKey(bill.due_date);
    if(due<from||due>until)continue;
    const amount=cents(bill.amount);
    if(amount<=0)continue;
    rows.push({
      id:'bill:'+bill.id,due,label:bill.name||'Rechnung',
      amount:amount/100,currency:bill.currency||household?.base_currency||'CHF',
      source:'Rechnung',href:'#/bills',status:due<today?'overdue':'open',
    });
  }

  for(const contract of contracts){
    if(contract.status!=='active'||contract.recurring_rule_id&&activeRuleIds.has(contract.recurring_rule_id))continue;
    const due=dateKey(contract.next_payment_date);
    if(!due||due<from||due>until||cents(contract.amount)<=0)continue;
    rows.push({
      id:'contract:'+contract.id,due,label:contract.name||'Vertrag',
      amount:cents(contract.amount)/100,currency:contract.currency||household?.base_currency||'CHF',
      source:'Vertrag',href:'#/bills',status:due<today?'overdue':'open',
    });
  }

  for(const debt of debts){
    if(['paid','cancelled','closed'].includes(debt.status)||
      (debt.recurring_rule_id&&activeRuleIds.has(debt.recurring_rule_id))||
      (debt.billing_recurring_rule_id&&activeRuleIds.has(debt.billing_recurring_rule_id)))continue;
    const due=dateKey(debt.next_payment_date);
    const left=cents(debt.outstanding_amount);
    const rate=cents(debt.installment_amount);
    if(!due||due<from||due>until||left<=0||rate<=0)continue;
    rows.push({
      id:'debt:'+debt.id,due,label:debt.name||debt.creditor||'Schuldenrate',
      amount:Math.min(left,rate)/100,currency:debt.currency||household?.base_currency||'CHF',
      source:'Schuldenrate',href:'#/debts',status:due<today?'overdue':'open',
    });
  }

  for(const plan of currentTaxPlans){
    const claim=taxObligations.find((item)=>item.id===plan.obligation_id&&item.tax_case_id===plan.tax_case_id);
    if(!claim||claim.status==='cancelled')continue;
    const taxCase=taxCases.find((item)=>item.id===plan.tax_case_id);
    const schedule=taxInstallmentSchedule(plan,taxPayments,now);
    for(const installment of schedule.rows){
      const due=installment.dueDate;
      if(due<from||due>until||installment.open<=0)continue;
      rows.push({
        id:'tax:'+plan.id+':'+due,due,
        label:(claim.label||'Steuern')+(taxCase?.tax_year?' · '+taxCase.tax_year:''),
        amount:installment.open,currency:plan.currency||household?.base_currency||'CHF',
        source:'Steuerrate',href:'#/tax-advisor',
        status:due<today?'overdue':installment.paid>0?'partial':'open',
      });
    }
  }
  rows.sort((a,b)=>a.due.localeCompare(b.due)||a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
  return {rows,warnings,from,until};
}
