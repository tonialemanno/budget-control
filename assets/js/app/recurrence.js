function toLocalNoon(value) {
  if (value instanceof Date) {
    const copy = new Date(value);
    copy.setHours(12,0,0,0);
    return Number.isNaN(copy.getTime()) ? null : copy;
  }
  const text=String(value||'').slice(0,10);
  if(!text) return null;
  const date=new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addMonthsClamped(date, months) {
  const next=new Date(date);
  const day=next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth()+months);
  const last=new Date(next.getFullYear(),next.getMonth()+1,0,12).getDate();
  next.setDate(Math.min(day,last));
  return next;
}

export function nextOccurrenceDate(date, cadence, intervalMonths=1) {
  const next=new Date(date);
  if(cadence==='weekly') { next.setDate(next.getDate()+7); return next; }
  if(cadence==='quarterly') return addMonthsClamped(next,3);
  if(cadence==='semiannual') return addMonthsClamped(next,6);
  if(cadence==='annual') return addMonthsClamped(next,12);
  return addMonthsClamped(next,Math.max(1,Number(intervalMonths||1)));
}

export function effectiveNextDate(rule, reference=new Date()) {
  let date=toLocalNoon(rule?.next_date);
  if(!date) return null;
  const ref=toLocalNoon(reference) || new Date();
  const end=toLocalNoon(rule?.end_date);
  let guard=0;
  while(date < ref && guard < 2000) {
    date=nextOccurrenceDate(date,rule?.cadence,rule?.interval_months);
    guard+=1;
  }
  if(end && date>end) return null;
  return date;
}

export function occurrenceNear(rule, targetDate, toleranceDays=3) {
  const target=toLocalNoon(targetDate);
  if(!target) return false;
  const start=new Date(target);
  start.setDate(start.getDate()-Math.max(0,Number(toleranceDays)||0));
  const candidate=effectiveNextDate(rule,start);
  if(!candidate) return false;
  return Math.abs(candidate.getTime()-target.getTime())/86400000 <= toleranceDays;
}

export function occurrenceCount(rule, from, until) {
  const start=toLocalNoon(from);
  const finish=toLocalNoon(until);
  if(!start || !finish || finish<start) return 0;
  let date=effectiveNextDate(rule,start);
  if(!date) return 0;
  const hardEnd=toLocalNoon(rule?.end_date);
  const limit=hardEnd && hardEnd<finish ? hardEnd : finish;
  let count=0;
  let guard=0;
  while(date<=limit && guard<2000) {
    count+=1;
    date=nextOccurrenceDate(date,rule?.cadence,rule?.interval_months);
    guard+=1;
  }
  return count;
}

export function localDateValue(value) {
  const date=toLocalNoon(value);
  if(!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
