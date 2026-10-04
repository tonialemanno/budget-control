import { addMonthsClamped, occurrenceCount } from './recurrence.js';
import { plannedMonthlyAmount, reserveMonthlyAmount } from './recurring-planning.js';

function addMonthsFromToday(months) {
  const now=new Date();
  now.setHours(12,0,0,0);
  return addMonthsClamped(now,months);
}

function dateAtNoon(value) {
  const text=String(value||'').slice(0,10);
  if(!text) return null;
  const date=new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildAccountProjection(account, recurringRules = []) {
  const today=new Date(); today.setHours(12,0,0,0);
  const rules=(recurringRules||[]).filter((rule)=>
    rule.active
    && rule.direction==='transfer'
    && (!rule.end_date || dateAtNoon(rule.end_date) >= today)
    && (rule.account_id===account.account_id || rule.destination_account_id===account.account_id)
  );
  const reserveRules=(recurringRules||[]).filter((rule)=>
    rule.active
    && rule.direction==='expense'
    && rule.reserve_enabled
    && rule.reserve_account_id
    && (!rule.end_date || dateAtNoon(rule.end_date) >= today)
    && (rule.account_id===account.account_id || rule.reserve_account_id===account.account_id)
  );
  if(!rules.length&&!reserveRules.length) return null;

  const allProjectionRules=[...rules,...reserveRules];
  const allFinite=allProjectionRules.every((rule)=>Boolean(rule.end_date));
  const finiteEnds=allProjectionRules.map((rule)=>dateAtNoon(rule.end_date)).filter(Boolean);
  const targetDate=allFinite && finiteEnds.length
    ? new Date(Math.max(...finiteEnds.map((date)=>date.getTime())))
    : addMonthsFromToday(12);

  let plannedNet=0;
  let monthlyNet=0;
  for(const rule of rules) {
    const incoming=rule.destination_account_id===account.account_id;
    const sign=incoming ? 1 : -1;
    const amount=Number(rule.amount||0);
    plannedNet += sign * amount * occurrenceCount(rule,today,targetDate);
    monthlyNet += sign * plannedMonthlyAmount(rule);
  }
  for(const rule of reserveRules){
    const amount=reserveMonthlyAmount(rule,[],today);
    if(!amount) continue;
    const incoming=rule.reserve_account_id===account.account_id;
    const sign=incoming?1:-1;
    monthlyNet += sign*amount;
    plannedNet += sign*amount*12;
  }

  return {
    targetDate,
    projectedBalance:Number(account.current_balance||0)+plannedNet,
    plannedNet,
    monthlyNet,
    ruleCount:rules.length+reserveRules.length,
  };
}
