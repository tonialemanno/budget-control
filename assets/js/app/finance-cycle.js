const DAY=24*60*60*1000;

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

function normalized(value) {
  return String(value||'').toLowerCase().replace(/[^a-z0-9äöüà-ÿ]+/gi,' ').trim().replace(/\s+/g,' ');
}

function cadenceFactor(cadence) {
  return ({weekly:52/12,biweekly:26/12,monthly:1,quarterly:1/3,semiannual:1/6,yearly:1/12})[cadence]||1;
}

function primaryIncomeRule(recurringRules=[]) {
  return recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='income')
    .slice()
    .sort((a,b)=>(Number(b.amount||0)*cadenceFactor(b.cadence))-(Number(a.amount||0)*cadenceFactor(a.cadence)))[0]||null;
}

function isBookedIncome(tx) {
  return tx?.status==='booked'
    && Number(tx.amount)>0
    && !tx.transfer_group_id
    && tx.cashflow_type!=='receivable_principal';
}

function incomeMatchScore(tx,rule) {
  if(!isBookedIncome(tx)) return 0;
  if(!rule) return tx.categories?.kind==='income'?1:0;

  let score=0;
  if(rule.merchant_id&&tx.merchant_id===rule.merchant_id) score+=8;

  const haystack=normalized([tx.description,tx.counterparty,tx.merchants?.name].filter(Boolean).join(' '));
  const needles=[rule.description,rule.counterparty].map(normalized).filter((value)=>value.length>=5);
  if(needles.some((needle)=>haystack.includes(needle)||needle.includes(haystack))) score+=6;

  const expected=Math.abs(Number(rule.amount||0));
  const actual=Math.abs(Number(tx.amount||0));
  if(expected>0&&Math.abs(expected-actual)<=Math.max(1,expected*.02)) score+=4;
  if(rule.category_id&&tx.category_id===rule.category_id) score+=2;
  if(tx.categories?.kind==='income') score+=1;
  return score;
}

function nominalStartFor(now,fallbackDay) {
  const today=startOfLocalDay(now);
  const thisMonth=addMonthsOnDay(new Date(today.getFullYear(),today.getMonth(),1),0,fallbackDay);
  return today>=thisMonth?thisMonth:addMonthsOnDay(thisMonth,-1,fallbackDay);
}

function incomeNear(transactions,rule,nominal,now,windowDays=7) {
  const earliest=new Date(nominal.getTime()-windowDays*DAY);
  const latest=new Date(Math.min(
    new Date(nominal.getTime()+windowDays*DAY+DAY-1).getTime(),
    now.getTime()
  ));
  return transactions
    .map((tx)=>({tx,score:incomeMatchScore(tx,rule),occurred:new Date(tx.occurred_at)}))
    .filter((row)=>row.score>0&&!Number.isNaN(row.occurred.getTime())&&row.occurred>=earliest&&row.occurred<=latest)
    .sort((a,b)=>{
      if(b.score!==a.score) return b.score-a.score;
      const aDistance=Math.abs(a.occurred.getTime()-nominal.getTime());
      const bDistance=Math.abs(b.occurred.getTime()-nominal.getTime());
      if(aDistance!==bDistance) return aDistance-bDistance;
      return b.occurred-a.occurred;
    })[0]?.tx||null;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export function resolveFinanceCycle({
  transactions=[],
  recurringRules=[],
  now=new Date(),
  fallbackDay=25,
}={}) {
  const currentNow=now instanceof Date?new Date(now):new Date(now);
  const nominal=nominalStartFor(currentNow,fallbackDay);
  const rule=primaryIncomeRule(recurringRules);
  const income=incomeNear(transactions,rule,nominal,currentNow);
  const start=income?startOfLocalDay(income.occurred_at):nominal;
  const nextNominal=addMonthsOnDay(nominal,1,fallbackDay);
  const endExclusive=nextNominal;
  return {
    start,
    endExclusive,
    budgetMonth:monthKey(start),
    source:income?'income':'fallback',
    sourceTransactionId:income?.id||null,
    primaryIncomeRuleId:rule?.id||null,
    fallbackDay,
  };
}

export function financeCycles({
  transactions=[],
  recurringRules=[],
  now=new Date(),
  fallbackDay=25,
  count=6,
}={}) {
  const currentNow=now instanceof Date?new Date(now):new Date(now);
  const currentNominal=nominalStartFor(currentNow,fallbackDay);
  const rule=primaryIncomeRule(recurringRules);
  const starts=[];

  for(let back=count-1;back>=0;back-=1){
    const nominal=addMonthsOnDay(currentNominal,-back,fallbackDay);
    const maxDate=back===0?currentNow:new Date(addMonthsOnDay(nominal,1,fallbackDay).getTime()-1);
    const income=incomeNear(transactions,rule,nominal,maxDate);
    const start=income?startOfLocalDay(income.occurred_at):nominal;
    starts.push({start,nominal,source:income?'income':'fallback',sourceTransactionId:income?.id||null});
  }

  return starts.map((row,index)=>{
    const next=starts[index+1]?.start||currentNow;
    return {
      ...row,
      date:row.start,
      budgetMonth:monthKey(row.start),
      endExclusive:index===starts.length-1?new Date(currentNow.getTime()+1):next,
    };
  });
}

export function financeCycleLabel(cycle,locale='de-CH') {
  if(!cycle?.start) return '';
  const end=new Date(cycle.endExclusive.getTime()-1);
  try {
    const fmt=new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit'});
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
