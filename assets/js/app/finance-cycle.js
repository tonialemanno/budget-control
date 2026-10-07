function startOfLocalDay(value) {
  const date=value instanceof Date?new Date(value):new Date(value);
  return new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0);
}

function addMonthsOnDay(value,months,day=25) {
  const date=value instanceof Date?value:new Date(value);
  const target=new Date(date.getFullYear(),date.getMonth()+months,1,0,0,0,0);
  const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
  target.setDate(Math.min(day,last));
  return target;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function normalizedMode(mode) {
  return mode==='calendar'?'calendar':'day_25';
}

function cycleStart(now,mode='day_25',fallbackDay=25) {
  const current=startOfLocalDay(now);
  if(normalizedMode(mode)==='calendar') return new Date(current.getFullYear(),current.getMonth(),1,0,0,0,0);
  const thisMonth=addMonthsOnDay(new Date(current.getFullYear(),current.getMonth(),1),0,fallbackDay);
  return current>=thisMonth?thisMonth:addMonthsOnDay(thisMonth,-1,fallbackDay);
}

function nextCycleStart(start,mode='day_25',fallbackDay=25) {
  if(normalizedMode(mode)==='calendar') return new Date(start.getFullYear(),start.getMonth()+1,1,0,0,0,0);
  return addMonthsOnDay(start,1,fallbackDay);
}

export function resolveFinanceCycle({
  now=new Date(),
  fallbackDay=25,
  mode='day_25',
}={}) {
  const normalized=normalizedMode(mode);
  const start=cycleStart(now,normalized,fallbackDay);
  const endExclusive=nextCycleStart(start,normalized,fallbackDay);
  return {
    start,
    endExclusive,
    budgetMonth:monthKey(start),
    source:normalized==='calendar'?'calendar':'fixed_day',
    sourceTransactionId:null,
    primaryIncomeRuleId:null,
    fallbackDay:normalized==='calendar'?1:fallbackDay,
    mode:normalized,
  };
}

export function previousFinanceCycle(cycle,{fallbackDay=25}={}) {
  const mode=normalizedMode(cycle?.mode);
  const endExclusive=cycle?.start?new Date(cycle.start):cycleStart(new Date(),mode,fallbackDay);
  const start=mode==='calendar'
    ? new Date(endExclusive.getFullYear(),endExclusive.getMonth()-1,1,0,0,0,0)
    : addMonthsOnDay(endExclusive,-1,fallbackDay);
  return {
    start,
    endExclusive,
    budgetMonth:monthKey(start),
    source:mode==='calendar'?'calendar':'fixed_day',
    fallbackDay:mode==='calendar'?1:fallbackDay,
    mode,
  };
}

export function financeCycles({
  now=new Date(),
  fallbackDay=25,
  mode='day_25',
  count=6,
}={}) {
  const current=resolveFinanceCycle({now,fallbackDay,mode});
  const rows=[];
  let cycle=current;
  for(let back=0;back<Math.max(1,count);back+=1){
    rows.unshift(cycle);
    cycle=previousFinanceCycle(cycle,{fallbackDay});
  }
  return rows;
}

export function financeCycleLabel(cycle,locale='de-CH') {
  if(!cycle?.start||!cycle?.endExclusive) return '';
  const end=new Date(cycle.endExclusive.getTime()-1);
  try {
    const fmt=new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'});
    return `${fmt.format(cycle.start)}–${fmt.format(end)}`;
  } catch {
    return `${cycle.start.toLocaleDateString()}–${end.toLocaleDateString()}`;
  }
}

export function inFinanceCycle(tx,cycle) {
  if(!cycle?.start||!cycle?.endExclusive) return false;
  const occurred=new Date(tx?.occurred_at);
  return !Number.isNaN(occurred.getTime())&&occurred>=cycle.start&&occurred<cycle.endExclusive;
}
