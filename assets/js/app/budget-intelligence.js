import { cadenceMonthlyFactor } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';
import { resolveFinanceCycle } from './finance-cycle.js';

function normalized(value) {
  return String(value||'')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9äöü]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function monthsBetweenInclusive(start,end) {
  const a=start instanceof Date?start:new Date(start);
  const b=end instanceof Date?end:new Date(end);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<a) return 1;
  return Math.max(1,(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth())+1);
}

function moneyBase(value,currency,baseCurrency,fxRates){
  return convertAmount(Number(value||0),currency||baseCurrency,baseCurrency,fxRates)??0;
}

function merchantText(merchant){
  return normalized(`${merchant?.name||''} ${merchant?.normalized_key||''}`);
}

export function resolveHistoricalMerchant(tx,merchants=[]){
  if(tx?.merchant_id){
    return merchants.find((row)=>row.id===tx.merchant_id)||tx.merchants||null;
  }
  const text=normalized(`${tx?.description||''} ${tx?.counterparty||''}`);
  if(!text) return null;
  const candidates=merchants
    .map((merchant)=>{
      const names=[normalized(merchant.name),normalized(merchant.normalized_key)].filter((value)=>value.length>=5);
      const score=Math.max(0,...names.map((name)=>text.includes(name)||name.includes(text)?name.length:0));
      return {merchant,score};
    })
    .filter((row)=>row.score>0)
    .sort((a,b)=>b.score-a.score);
  return candidates[0]?.merchant||null;
}

function recurringRuleScore(series,rule){
  if(!rule||rule.active===false||rule.direction!=='expense') return 0;
  let score=0;
  if(rule.merchant_id&&series.merchantId===rule.merchant_id) score+=12;

  const ruleText=normalized(`${rule.description||''} ${rule.counterparty||''} ${rule.merchants?.name||''}`);
  const seriesText=normalized(`${series.name||''} ${series.categoryName||''}`);
  if(ruleText&&seriesText&&(ruleText.includes(seriesText)||seriesText.includes(ruleText))) score+=7;

  if(rule.category_id&&series.categoryId===rule.category_id) score+=3;

  const expected=Math.abs(Number(rule.amount||0));
  if(expected>0&&series.rows.some((row)=>Math.abs(Math.abs(Number(row.amount||0))-expected)<=Math.max(1,expected*.03))) score+=4;
  return score;
}

export function matchingRecurringRule(series,recurringRules=[]){
  return recurringRules
    .map((rule)=>({rule,score:recurringRuleScore(series,rule)}))
    .filter((row)=>row.score>=7 || (row.score>=4&&row.rule.merchant_id))
    .sort((a,b)=>b.score-a.score)[0]?.rule||null;
}

export function buildExpenseSeries({
  transactions=[],
  categories=[],
  merchants=[],
  recurringRules=[],
  debtPayments=[],
  baseCurrency='CHF',
  fxRates=null,
  now=new Date(),
  fallbackDay=25,
}={}){
  const cycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay});
  const historyEnd=new Date(cycle.start.getTime()-1);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const categoryById=new Map(categories.map((row)=>[row.id,row]));
  const groups=new Map();

  for(const tx of transactions){
    const occurred=new Date(tx.occurred_at);
    if(tx.status!=='booked'||Number.isNaN(occurred.getTime())||occurred>historyEnd) continue;
    const value=consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
    if(!(value>0)) continue;

    const resolvedMerchant=resolveHistoricalMerchant(tx,merchants);
    const category=categoryById.get(tx.category_id)||tx.categories||null;
    const categoryId=tx.category_id||null;
    const categoryName=category?.name||'Ohne Kategorie';
    const sourceKey=resolvedMerchant?.id
      ? `merchant:${resolvedMerchant.id}`
      : `text:${normalized(tx.counterparty||tx.description||'unbekannt')}`;
    const key=`${sourceKey}|category:${categoryId||'none'}`;
    const name=resolvedMerchant?.name||tx.counterparty||tx.description||'Unbekannt';

    const row=groups.get(key)||{
      key,name,merchantId:resolvedMerchant?.id||null,categoryId,categoryName,
      rows:[],total:0,firstDate:occurred,lastDate:occurred,
    };
    row.rows.push(tx);
    row.total+=value;
    if(occurred<row.firstDate) row.firstDate=occurred;
    if(occurred>row.lastDate) row.lastDate=occurred;
    groups.set(key,row);
  }

  return [...groups.values()].map((series)=>{
    const monthsCovered=monthsBetweenInclusive(series.firstDate,historyEnd);
    const historicalMonthly=series.total/monthsCovered;
    const recurringRule=matchingRecurringRule(series,recurringRules);
    const recurringMonthly=recurringRule
      ? moneyBase(Number(recurringRule.amount||0)*cadenceMonthlyFactor(recurringRule.cadence),recurringRule.currency||baseCurrency,baseCurrency,fxRates)
      : null;
    return {
      ...series,
      rows:series.rows.slice().sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))),
      monthsCovered,
      bookingCount:series.rows.length,
      historicalMonthly,
      recurringRule,
      recurringMonthly,
      monthlyValue:recurringMonthly??historicalMonthly,
      source:recurringRule?'recurring':'history',
      firstDate:series.firstDate,
      lastDate:series.lastDate,
      historyEnd,
    };
  }).sort((a,b)=>b.monthlyValue-a.monthlyValue);
}

export function variableBudgetSuggestions(options={}){
  const series=buildExpenseSeries(options);
  return series.filter((row)=>!row.recurringRule && row.bookingCount>=2 && row.total>=50);
}

export function fixedCommitmentSeries(options={}){
  return buildExpenseSeries(options).filter((row)=>Boolean(row.recurringRule));
}

export function budgetExplanation(row){
  if(!row) return '';
  if(row.recurringRule){
    return `Bekannte Verpflichtung: ${row.recurringRule.description||row.name} · ${row.recurringRule.cadence||'monthly'}`;
  }
  return `${row.bookingCount} Buchungen seit ${row.firstDate.toISOString().slice(0,10)} · ${row.monthsCovered} berücksichtigte Monate`;
}
