function parseIsoDate(value) {
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return null;
  const year=Number(match[1]), month=Number(match[2]), day=Number(match[3]);
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day) return null;
  return date;
}

function isoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

function addCalendarMonths(date,months) {
  const year=date.getUTCFullYear(), month=date.getUTCMonth(), day=date.getUTCDate();
  const targetIndex=month+months;
  const targetYear=year+Math.floor(targetIndex/12);
  const targetMonth=((targetIndex%12)+12)%12;
  const lastDay=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,targetMonth,Math.min(day,lastDay)));
}

export function normalizeGoalDuration(value) {
  if(value===null||value===undefined||value==='') return null;
  const months=Number(value);
  if(!Number.isInteger(months)||months<1||months>600) throw new Error('Die Laufzeit muss zwischen 1 und 600 Monaten liegen.');
  return months;
}

export function calculateGoalTargetDate(startDate,durationMonths) {
  const start=parseIsoDate(startDate);
  const months=normalizeGoalDuration(durationMonths);
  if(!start||!months) return null;
  const exclusiveEnd=addCalendarMonths(start,months);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate()-1);
  return isoDate(exclusiveEnd);
}

export function resolveGoalSchedule({startDate=null,durationMonths=null,targetDate=null}={}) {
  const start=parseIsoDate(startDate);
  const months=normalizeGoalDuration(durationMonths);
  const target=parseIsoDate(targetDate);

  if(months&&!start) throw new Error('Für eine Laufzeit in Monaten bitte auch ein Startdatum angeben.');

  const resolvedTarget=start&&months ? calculateGoalTargetDate(startDate,months) : (target?isoDate(target):null);
  if(start&&resolvedTarget){
    const resolved=parseIsoDate(resolvedTarget);
    if(resolved<start) throw new Error('Der Zieltermin darf nicht vor dem Startdatum liegen.');
  }

  return {
    startDate:start?isoDate(start):null,
    durationMonths:months,
    targetDate:resolvedTarget,
  };
}

export function goalPlanningMonths(goal,{now=new Date()}={}) {
  const explicit=Number(goal?.duration_months||0);
  if(Number.isInteger(explicit)&&explicit>0) return explicit;

  const target=parseIsoDate(goal?.target_date);
  if(!target) return null;

  const configuredStart=parseIsoDate(goal?.start_date);
  const nowDate=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  const start=configuredStart&&configuredStart>nowDate?configuredStart:nowDate;
  if(target<start) return 1;

  const months=(target.getUTCFullYear()-start.getUTCFullYear())*12+(target.getUTCMonth()-start.getUTCMonth());
  const inclusive=months+(target.getUTCDate()>=start.getUTCDate()?1:0);
  return Math.max(1,inclusive);
}

export function goalStartsInFuture(goal,{now=new Date()}={}) {
  const start=parseIsoDate(goal?.start_date);
  if(!start) return false;
  const today=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  return start>today;
}
