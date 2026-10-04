import { cadenceMonthlyFactor } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';
import { occurrenceNear } from './recurrence.js';

function norm(value) {
  return String(value||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function categoryMap(categories=[]) {
  return new Map(categories.map((row)=>[row.id,row]));
}

export function categoryLineage(tx,categories=[]) {
  const map=categoryMap(categories);
  const category=map.get(tx?.category_id)||tx?.categories||null;
  if(!category) return [];
  const rows=[category];
  let current=category;
  const seen=new Set([category.id]);
  while(current?.parent_id && !seen.has(current.parent_id)){
    const parent=map.get(current.parent_id);
    if(!parent) break;
    rows.push(parent);
    seen.add(parent.id);
    current=parent;
  }
  return rows;
}

function categoryText(tx,categories=[]) {
  return norm(categoryLineage(tx,categories).map((row)=>row?.name).filter(Boolean).join(' '));
}

function txText(tx) {
  return norm([tx?.merchants?.name,tx?.counterparty,tx?.description,tx?.note].filter(Boolean).join(' '));
}

function isSavingsCategory(tx,categories=[]) {
  const value=categoryText(tx,categories);
  return /(^| )(sparen|sparziel|ruecklage|ruecklagen|reserve|reserven)( |$)/.test(value);
}

function isTaxCategory(tx,categories=[]) {
  const value=categoryText(tx,categories);
  return /(^| )(steuer|steuern|tax)( |$)/.test(value);
}

function isRefundCategory(tx,categories=[]) {
  const category=categoryLineage(tx,categories)[0]||tx?.categories||null;
  if(Number(tx?.amount)>0 && category?.kind==='expense') return true;
  const value=categoryText(tx,categories);
  return /(rueckerstattung|rueckzahlung|gutschrift|refund)/.test(value);
}

function recurringRuleScore(tx,rule,categories=[]) {
  if(!tx||!rule||rule.active===false) return 0;
  if(rule.direction==='transfer') return 0;
  if(rule.currency&&tx.currency&&rule.currency!==tx.currency) return 0;
  let score=0;

  if(rule.account_id&&tx.account_id===rule.account_id) score+=2;
  if(rule.merchant_id&&tx.merchant_id===rule.merchant_id) score+=10;

  const txCategoryIds=new Set(categoryLineage(tx,categories).map((row)=>row?.id).filter(Boolean));
  if(rule.category_id&&txCategoryIds.has(rule.category_id)) score+=3;

  const haystack=txText(tx);
  const needles=[rule.description,rule.counterparty,rule.merchants?.name].map(norm).filter((value)=>value.length>=4);
  if(haystack.length>=4 && needles.some((needle)=>haystack.includes(needle)||needle.includes(haystack))) score+=7;

  const expected=Math.abs(Number(rule.amount||0));
  const actual=Math.abs(Number(tx.amount||0));
  if(expected>0 && Math.abs(expected-actual)<=Math.max(1,expected*.03)) score+=5;

  if(rule.next_date&&occurrenceNear(rule,tx.occurred_at,5)) score+=2;
  return score;
}

export function matchingRecurringRule(tx,recurringRules=[],categories=[],direction=null) {
  const candidates=recurringRules
    .filter((rule)=>rule.active!==false && (!direction||rule.direction===direction))
    .map((rule)=>({rule,score:recurringRuleScore(tx,rule,categories)}))
    .filter((row)=>row.score>=5)
    .sort((a,b)=>b.score-a.score);
  return candidates[0]?.rule||null;
}

export function semanticType(tx,{categories=[],recurringRules=[]}={}) {
  if(!tx) return 'unknown';
  if(tx.exclude_from_reports===true) return 'ignored';
  if(tx.semantic_type) return tx.semantic_type;

  if(tx.transfer_group_id) return 'internal_transfer';
  if(tx.cashflow_type==='receivable_principal') return Number(tx.amount)>=0?'receivable_repayment':'receivable_principal';
  if(tx.cashflow_type==='debt_payment') return 'debt_payment';

  if(Number(tx.amount)<0 && isSavingsCategory(tx,categories)) return 'saving';
  if(tx.tax_treatment==='tax_payment'||(Number(tx.amount)<0&&isTaxCategory(tx,categories))) return 'tax_payment';
  if(tx.tax_treatment==='tax_refund'||(Number(tx.amount)>0&&isTaxCategory(tx,categories))) return 'tax_refund';

  if(Number(tx.amount)>0){
    if(isRefundCategory(tx,categories)) return 'refund';
    const rule=matchingRecurringRule(tx,recurringRules,categories,'income');
    const kind=(categoryLineage(tx,categories)[0]||tx.categories)?.kind;
    if(rule||kind==='income') return 'earned_income';
    return 'unclassified_inflow';
  }

  if(Number(tx.amount)<0){
    const fixed=matchingRecurringRule(tx,recurringRules,categories,'expense');
    if(fixed) return 'fixed_expense';
    return 'variable_expense';
  }

  return 'neutral';
}

export function semanticExpenseBase(tx,{
  categories=[],recurringRules=[],debtPayments=[],baseCurrency='CHF',fxRates=null,
}={}) {
  if(!tx||tx.status!=='booked'||Number(tx.amount)>=0) return 0;
  const type=semanticType(tx,{categories,recurringRules});
  if(['ignored','internal_transfer','saving','receivable_principal','asset_acquisition'].includes(type)) return 0;
  const paymentMap=debtPayments instanceof Map?debtPayments:buildDebtPaymentTransactionMap(debtPayments);
  return consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
}

export function semanticIncomeBase(tx,{
  categories=[],recurringRules=[],baseCurrency='CHF',fxRates=null,includeOtherIncome=true,
}={}) {
  if(!tx||tx.status!=='booked'||Number(tx.amount)<=0) return 0;
  const type=semanticType(tx,{categories,recurringRules});
  if(type==='earned_income'||(includeOtherIncome&&type==='other_income')){
    return Math.max(0,convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0);
  }
  return 0;
}

export function monthlyRuleAmount(rule,baseCurrency='CHF',fxRates=null) {
  if(!rule) return 0;
  const native=Number(rule.amount||0)*cadenceMonthlyFactor(rule.cadence);
  return Math.max(0,convertAmount(native,rule.currency||baseCurrency,baseCurrency,fxRates)??0);
}

export function reportingBucket(tx,context={}) {
  const type=semanticType(tx,context);
  return ({
    earned_income:'income',
    other_income:'income',
    refund:'refund',
    tax_refund:'refund',
    receivable_repayment:'repayment',
    unclassified_inflow:'unclassified',
    fixed_expense:'fixed',
    variable_expense:'variable',
    tax_payment:'tax',
    saving:'saving',
    internal_transfer:'transfer',
    debt_payment:'debt',
    receivable_principal:'receivable',
    asset_acquisition:'asset',
    ignored:'ignored',
  })[type]||'other';
}
