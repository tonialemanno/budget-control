import { cadenceMonthlyFactor } from './format.js';

function atNoon(value) {
  const text=String(value||'').slice(0,10);
  const date=new Date(text ? `${text}T12:00:00` : Date.now());
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonthsClamped(date, months) {
  const next=new Date(date);
  const day=next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth()+months);
  const last=new Date(next.getFullYear(),next.getMonth()+1,0,12).getDate();
  next.setDate(Math.min(day,last));
  return next;
}

function nextOccurrence(date,cadence) {
  const next=new Date(date);
  if(cadence==='weekly') { next.setDate(next.getDate()+7); return next; }
  if(cadence==='quarterly') return addMonthsClamped(next,3);
  if(cadence==='semiannual') return addMonthsClamped(next,6);
  if(cadence==='annual') return addMonthsClamped(next,12);
  return addMonthsClamped(next,1);
}

function occurrenceCount(rule, from, until) {
  let date=atNoon(rule.next_date);
  if(!date) return 0;
  const hardEnd=rule.end_date ? atNoon(rule.end_date) : null;
  const limit=hardEnd && hardEnd < until ? hardEnd : until;
  let guard=0;
  while(date < from && guard < 1000) { date=nextOccurrence(date,rule.cadence); guard+=1; }
  let count=0;
  while(date <= limit && guard < 2000) {
    count+=1;
    date=nextOccurrence(date,rule.cadence);
    guard+=1;
  }
  return count;
}

function addMonthsFromToday(months) {
  const now=new Date();
  now.setHours(12,0,0,0);
  return addMonthsClamped(now,months);
}

export function buildAccountProjection(account, recurringRules = []) {
  const today=new Date(); today.setHours(12,0,0,0);
  const rules=(recurringRules||[]).filter((rule)=>
    rule.active
    && rule.direction==='transfer'
    && (!rule.end_date || atNoon(rule.end_date) >= today)
    && (rule.account_id===account.account_id || rule.destination_account_id===account.account_id)
  );
  if(!rules.length) return null;

  const allFinite=rules.every((rule)=>Boolean(rule.end_date));
  const finiteEnds=rules.map((rule)=>atNoon(rule.end_date)).filter(Boolean);
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
