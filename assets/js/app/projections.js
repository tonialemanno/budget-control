import { cadenceMonthlyFactor } from './format.js';
import { addMonthsClamped, occurrenceCount } from './recurrence.js';

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
  if(!rules.length) return null;

  const allFinite=rules.every((rule)=>Boolean(rule.end_date));
  const finiteEnds=rules.map((rule)=>dateAtNoon(rule.end_date)).filter(Boolean);
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
    monthlyNet += sign * amount * cadenceMonthlyFactor(rule.cadence);
  }

  return {
    targetDate,
    projectedBalance:Number(account.current_balance||0)+plannedNet,
    plannedNet,
    monthlyNet,
    ruleCount:rules.length,
  };
}
