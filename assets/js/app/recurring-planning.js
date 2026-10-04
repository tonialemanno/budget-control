import { effectiveNextDate } from './recurrence.js';

export function recurrenceMonths(rule = {}) {
  if (rule.cadence === 'monthly') return Math.max(1, Number(rule.interval_months || 1));
  if (rule.cadence === 'quarterly') return 3;
  if (rule.cadence === 'semiannual') return 6;
  if (rule.cadence === 'annual') return 12;
  return 0;
}

export function recurringMonthlyFactor(rule = {}) {
  if (rule.cadence === 'weekly') return 52 / 12;
  const months=recurrenceMonths(rule);
  return months > 0 ? 1 / months : 0;
}

export function plannedMonthlyAmount(rule = {}) {
  return Math.max(0, Number(rule.amount || 0)) * recurringMonthlyFactor(rule);
}

export function calendarMonthsUntil(date, reference = new Date()) {
  if (!date) return 1;
  const target=date instanceof Date ? date : new Date(String(date).slice(0,10) + 'T12:00:00');
  const ref=reference instanceof Date ? reference : new Date(reference);
  if (Number.isNaN(target.getTime()) || Number.isNaN(ref.getTime())) return 1;
  const diff=(target.getFullYear()-ref.getFullYear())*12 + target.getMonth()-ref.getMonth();
  return Math.max(1,diff);
}

export function reserveMonthlyAmount(rule = {}, accounts = [], reference = new Date()) {
  if (!rule.reserve_enabled || rule.direction !== 'expense' || !rule.reserve_account_id) return 0;
  const expected=Math.max(0,Number(rule.amount||0));
  if (!expected) return 0;
  const reserve=accounts.find((account)=>account.account_id===rule.reserve_account_id || account.id===rule.reserve_account_id);
  const balance=Math.max(0,Number(reserve?.current_balance ?? reserve?.balance_anchor_amount ?? 0));
  const next=effectiveNextDate(rule,reference);
  if (!next) return plannedMonthlyAmount(rule);
  const remaining=Math.max(0,expected-balance);
  if (!remaining) return 0;
  return remaining / calendarMonthsUntil(next,reference);
}

export function cadenceLabel(rule = {}) {
  if(rule.cadence==='monthly' && Number(rule.interval_months||1)>1) return `Alle ${Number(rule.interval_months)} Monate`;
  return ({weekly:'Wöchentlich',monthly:'Monatlich',quarterly:'Quartalsweise',semiannual:'Halbjährlich',annual:'Jährlich'})[rule.cadence] || rule.cadence || '—';
}
