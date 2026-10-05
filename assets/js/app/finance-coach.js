import { convertAmount } from './fx.js';
import { addMonthsClamped, effectiveNextDate, nextOccurrenceDate } from './recurrence.js';
import { calculateBudgetSummary } from './budget-engine.js';
import { categoryLineage, matchingRecurringRule, semanticExpenseBase, semanticType } from './finance-semantics.js';
import { plannedMonthlyAmount, reserveMonthlyAmount } from './recurring-planning.js';

const DAY=24*60*60*1000;

function clamp(value,min=0,max=1){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function atNoon(value){
  if(value instanceof Date){
    const copy=new Date(value);
    copy.setHours(12,0,0,0);
    return Number.isNaN(copy.getTime())?null:copy;
  }
  const text=String(value||'').slice(0,10);
  if(!text) return null;
  const date=new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime())?null:date;
}

function dayDistance(left,right){
  const a=atNoon(left);
  const b=atNoon(right);
  if(!a||!b) return Number.POSITIVE_INFINITY;
  return Math.abs(a-b)/DAY;
}

function base(value,currency,target,fxRates){
  return convertAmount(Number(value||0),currency||target,target,fxRates)??0;
}

function ruleActive(rule,now){
  const today=String(now.toISOString()).slice(0,10);
  return rule?.active!==false && (!rule?.end_date || String(rule.end_date).slice(0,10)>=today);
}

function occurrenceSatisfied(rule,date,{transactions=[],categories=[],recurringRules=[],now=new Date()}={}){
  const direction=rule.direction;
  return transactions.some((tx)=>{
    const occurred=new Date(tx.occurred_at);
    if(tx.status!=='booked'||tx.transfer_group_id||Number.isNaN(occurred.getTime())||occurred>now||dayDistance(tx.occurred_at,date)>3) return false;
    if(direction==='expense'&&Number(tx.amount)>=0) return false;
    if(direction==='income'&&Number(tx.amount)<=0) return false;
    if(tx.recurring_rule_id===rule.id) return true;
    return matchingRecurringRule(tx,recurringRules,categories,direction)?.id===rule.id;
  });
}

function remainingRuleValue(rule,{
  now,endExclusive,transactions,categories,recurringRules,baseCurrency,fxRates,
}={}){
  if(!ruleActive(rule,now)||!rule?.next_date) return 0;
  let date=effectiveNextDate(rule,now);
  if(!date) return 0;
  const end=new Date(endExclusive);
  let total=0;
  let guard=0;
  while(date<end&&guard<120){
    if(!occurrenceSatisfied(rule,date,{transactions,categories,recurringRules,now})){
      total+=base(Math.abs(Number(rule.amount||0)),rule.currency,baseCurrency,fxRates);
    }
    date=nextOccurrenceDate(date,rule.cadence,rule.interval_months);
    guard+=1;
  }
  return total;
}

function parentCategory(tx,categories=[]){
  const lineage=categoryLineage(tx,categories);
  return lineage.at(-1)||lineage[0]||tx.categories||null;
}

function variableSpendByCategory({
  transactions=[],debtPayments=[],categories=[],recurringRules=[],baseCurrency='CHF',fxRates=null,start,end,
}={}){
  const rows=new Map();
  for(const tx of transactions){
    const date=new Date(tx.occurred_at);
    if(tx.status!=='booked'||Number.isNaN(date.getTime())||date<start||date>=end) continue;
    if(semanticType(tx,{categories,recurringRules})!=='variable_expense') continue;
    const value=semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates});
    if(!(value>0)) continue;
    const category=parentCategory(tx,categories);
    const key=category?.id||tx.category_id||'uncategorized';
    const row=rows.get(key)||{key,label:category?.name||tx.categories?.name||'Ohne Kategorie',value:0,count:0};
    row.value+=value;
    row.count+=1;
    rows.set(key,row);
  }
  return rows;
}

function spendingAnomaly(options={}){
  const now=options.now||new Date();
  const recentStart=new Date(now);
  recentStart.setDate(recentStart.getDate()-7);
  const baselineStart=new Date(recentStart);
  baselineStart.setDate(baselineStart.getDate()-28);
  const recent=variableSpendByCategory({...options,start:recentStart,end:new Date(now.getTime()+1000)});
  const baseline=variableSpendByCategory({...options,start:baselineStart,end:recentStart});
  const candidates=[];
  for(const row of recent.values()){
    if(row.count<2) continue;
    const prior=baseline.get(row.key);
    if(!prior || prior.count<2) continue;
    const weekly=prior.value/4;
    const delta=row.value-weekly;
    if(row.value>=Math.max(weekly*1.6,weekly+30)&&delta>=30){
      candidates.push({...row,baselineWeekly:weekly,delta,ratio:weekly>0?row.value/weekly:0});
    }
  }
  return candidates.sort((a,b)=>b.delta-a.delta)[0]||null;
}

function reserveStatus(rule,accounts=[],now=new Date()){
  if(!rule.reserve_enabled||!rule.reserve_account_id) return null;
  const account=accounts.find((row)=>row.account_id===rule.reserve_account_id||row.id===rule.reserve_account_id);
  const target=Math.max(0,Number(rule.amount||0));
  const balance=Math.max(0,Number(account?.current_balance??account?.balance_anchor_amount??0));
  const next=effectiveNextDate(rule,now);
  return {
    id:rule.id,
    label:rule.description||rule.counterparty||'Rücklage',
    target,
    balance,
    fundedPercent:target>0?clamp(balance/target,0,1)*100:0,
    nextDate:next,
    monthly:reserveMonthlyAmount(rule,accounts,now),
    currency:rule.currency,
  };
}

function priority(type){
  return ({cash_shortfall:100,budget_risk:85,spending_spike:80,uncategorized:70,freed_commitment:65,reserve_gap:60,unbudgeted:55,no_budget:45,subscriptions:40,on_track:10})[type]||0;
}

function subscriptionSummary({recurringRules=[],categories=[],baseCurrency='CHF',fxRates=null,now=new Date()}={}){
  const categoryById=new Map(categories.map((row)=>[row.id,row]));
  const rows=recurringRules.filter((rule)=>{
    if(!ruleActive(rule,now)||rule.direction!=='expense'||rule.reserve_enabled) return false;
    const category=categoryById.get(rule.category_id);
    const text=`${rule.description||''} ${rule.counterparty||''} ${category?.name||''}`
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\b(abo|abonnement|subscription|stream|netflix|spotify|disney|youtube|prime|icloud|dropbox|adobe|microsoft\s*365|fitness|gym)\b/.test(text);
  });
  if(rows.length<2) return null;
  const monthly=rows.reduce((sum,rule)=>sum+base(plannedMonthlyAmount(rule),rule.currency,baseCurrency,fxRates),0);
  if(!(monthly>0)) return null;
  return {count:rows.length,monthly,annual:monthly*12};
}

function normalizedRuleText(rule){
  return `${rule?.description||''} ${rule?.counterparty||''}`
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

export function buildFreedCommitmentSuggestion({
  recurringRules=[],accounts=[],baseCurrency='CHF',fxRates=null,now=new Date(),
}={}){
  const horizon=new Date(now);
  horizon.setMonth(horizon.getMonth()+18);

  const ending=recurringRules
    .filter((rule)=>{
      if(!ruleActive(rule,now)||rule.direction!=='expense'||rule.reserve_enabled||!rule.end_date) return false;
      const end=atNoon(rule.end_date);
      return end&&end>now&&end<=horizon;
    })
    .map((rule)=>({
      rule,
      endDate:atNoon(rule.end_date),
      monthly:base(plannedMonthlyAmount(rule),rule.currency,baseCurrency,fxRates),
    }))
    .filter((row)=>row.monthly>=10)
    .sort((a,b)=>a.endDate-b.endDate || b.monthly-a.monthly)[0]||null;

  if(!ending) return null;

  const savingRules=recurringRules
    .filter((rule)=>ruleActive(rule,now)&&rule.direction==='transfer')
    .map((rule)=>{
      const destination=accounts.find((account)=>account.account_id===rule.destination_account_id);
      const text=normalizedRuleText(rule);
      const savingSignal=destination?.account_type==='savings'||/(^|\b)(spar|save|saving|ruecklage|reserve)(\b|$)/.test(text);
      return {
        rule,
        destination,
        savingSignal,
        monthly:base(plannedMonthlyAmount(rule),rule.currency,baseCurrency,fxRates),
      };
    })
    .filter((row)=>row.savingSignal&&row.monthly>0)
    .sort((a,b)=>b.monthly-a.monthly);

  const target=savingRules[0]||null;
  const availableFrom=addMonthsClamped(ending.endDate,1);
  return {
    sourceRuleId:ending.rule.id,
    sourceLabel:ending.rule.description||ending.rule.counterparty||'Fixkosten',
    endDate:ending.endDate,
    availableFrom,
    freedMonthly:ending.monthly,
    savingRuleId:target?.rule?.id||null,
    savingLabel:target?.rule?.description||target?.destination?.name||'Sparen',
    currentSavings:target?.monthly||0,
    suggestedSavings:(target?.monthly||0)+ending.monthly,
  };
}

export function buildFinanceCoach({
  snapshot,
  primaryAccount=null,
  accounts=[],
  transactions=[],
  debtPayments=[],
  recurringRules=[],
  budgets=[],
  categories=[],
  merchants=[],
  household,
  fxRates=null,
  now=new Date(),
}={}){
  if(!snapshot) throw new Error('Finance snapshot is required.');
  const baseCurrency=snapshot.currency||household?.base_currency||'CHF';
  const cycle=snapshot.financeCycle;
  const cycleEnd=cycle?.endExclusive||now;
  const remainingMs=Math.max(0,new Date(cycleEnd)-now);
  const daysRemaining=Math.max(0,Math.ceil(remainingMs/DAY));
  const cycleMs=Math.max(DAY,new Date(cycleEnd)-new Date(cycle?.start||now));
  const elapsedRatio=clamp((now-new Date(cycle?.start||now))/cycleMs,0,1);

  const primaryBalance=primaryAccount
    ? base(primaryAccount.current_balance,primaryAccount.currency,baseCurrency,fxRates)
    : snapshot.cash;

  const fixedRemaining=recurringRules
    .filter((rule)=>rule.direction==='expense'&&!rule.reserve_enabled)
    .reduce((sum,rule)=>sum+remainingRuleValue(rule,{
      now,endExclusive:cycleEnd,transactions,categories,recurringRules,baseCurrency,fxRates,
    }),0);

  const transferRemaining=recurringRules
    .filter((rule)=>rule.direction==='transfer')
    .reduce((sum,rule)=>sum+remainingRuleValue(rule,{
      now,endExclusive:cycleEnd,transactions,categories,recurringRules,baseCurrency,fxRates,
    }),0);

  const reserveRemaining=recurringRules
    .filter((rule)=>rule.direction==='expense'&&rule.reserve_enabled&&ruleActive(rule,now))
    .reduce((sum,rule)=>sum+base(reserveMonthlyAmount(rule,accounts,now),rule.currency,baseCurrency,fxRates),0);

  const variableRemaining=Math.max(0,Number(snapshot.remainingPlannedExpensesMonth||0));
  const commitmentsRemaining=Math.max(0,fixedRemaining)+Math.max(0,transferRemaining)+Math.max(0,reserveRemaining)+variableRemaining;
  const freeUntilIncome=primaryBalance-commitmentsRemaining;
  const allowanceDays=Math.max(1,daysRemaining);
  const dailyAllowance=Math.max(0,freeUntilIncome)/allowanceDays;
  const weeklyAllowance=dailyAllowance*7;

  const budgetState=calculateBudgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,accounts,
    baseCurrency,fxRates,now,fallbackDay:25,
  });

  const budgetRisk=budgetState.variableRows
    .map((row)=>({
      row,
      ratio:Number(row.amount)>0?Number(row.spent||0)/Number(row.amount):0,
      paceGap:(Number(row.amount)>0?Number(row.spent||0)/Number(row.amount):0)-elapsedRatio,
    }))
    .filter(({row,ratio,paceGap})=>Number(row.spent||0)>=30&&ratio>=.65&&paceGap>=.18)
    .sort((a,b)=>b.paceGap-a.paceGap)[0]||null;

  const uncategorized=transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return tx.status==='booked'&&!tx.transfer_group_id&&!tx.category_id&&Number(tx.amount)<0&&!Number.isNaN(date.getTime())&&date<=now;
  });

  const anomaly=spendingAnomaly({
    transactions,debtPayments,categories,recurringRules,baseCurrency,fxRates,now,
  });

  const reserves=recurringRules
    .map((rule)=>reserveStatus(rule,accounts,now))
    .filter(Boolean)
    .sort((a,b)=>{
      const aDate=a.nextDate?.getTime()||Number.POSITIVE_INFINITY;
      const bDate=b.nextDate?.getTime()||Number.POSITIVE_INFINITY;
      return aDate-bDate;
    });
  const reserveGap=reserves.find((row)=>row.target>0&&row.balance<row.target&&row.monthly>0)||null;
  const subscriptions=subscriptionSummary({recurringRules,categories,baseCurrency,fxRates,now});
  const freedCommitment=buildFreedCommitmentSuggestion({recurringRules,accounts,baseCurrency,fxRates,now});

  const insights=[];
  if(freeUntilIncome<0){
    insights.push({type:'cash_shortfall',tone:'negative',amount:Math.abs(freeUntilIncome),href:'#/planning'});
  }
  if(budgetRisk){
    insights.push({
      type:'budget_risk',tone:'warning',
      label:budgetRisk.row.merchants?.name||budgetRisk.row.categories?.name||'Budget',
      spent:Number(budgetRisk.row.spent||0),
      amount:Number(budgetRisk.row.amount||0),
      href:'#/budget',
    });
  }
  if(anomaly){
    insights.push({
      type:'spending_spike',tone:'warning',label:anomaly.label,
      recent:anomaly.value,baseline:anomaly.baselineWeekly,delta:anomaly.delta,
      href:'#/transactions',
    });
  }
  if(uncategorized.length){
    insights.push({type:'uncategorized',tone:'neutral',count:uncategorized.length,href:'#/imports'});
  }
  if(freedCommitment){
    insights.push({type:'freed_commitment',tone:'positive',...freedCommitment,href:'#/planning'});
  }
  if(reserveGap){
    insights.push({
      type:'reserve_gap',tone:'neutral',label:reserveGap.label,
      monthly:base(reserveGap.monthly,reserveGap.currency,baseCurrency,fxRates),
      fundedPercent:reserveGap.fundedPercent,nextDate:reserveGap.nextDate,href:'#/fixed-costs',
    });
  }
  if(snapshot.unbudgetedActualVariableExpensesMonth>0&&budgetState.count>0){
    insights.push({
      type:'unbudgeted',tone:'neutral',amount:Number(snapshot.unbudgetedActualVariableExpensesMonth||0),href:'#/budget',
    });
  }
  if(!budgetState.count&&snapshot.actualVariableExpensesMonth>0){
    insights.push({type:'no_budget',tone:'neutral',href:'#/budget'});
  }
  if(subscriptions){
    insights.push({type:'subscriptions',tone:'neutral',...subscriptions,href:'#/recurring'});
  }
  if(!insights.some((row)=>['cash_shortfall','budget_risk','spending_spike'].includes(row.type))){
    insights.push({type:'on_track',tone:'positive',href:'#/budget'});
  }
  insights.sort((a,b)=>priority(b.type)-priority(a.type));

  const plannedIncome=Math.max(0,Number(snapshot.incomePlanMonthly||0));
  const fixed=Math.max(0,Number(snapshot.fixedExpensesMonthly||0));
  const reservesAndSaving=Math.max(0,Number(snapshot.fixedTransfersMonthly||0));
  const variable=Math.max(0,Number(snapshot.plannedVariableMonthly||0));
  const plannedFree=Math.max(0,plannedIncome-fixed-reservesAndSaving-variable);
  const plannedGap=Math.max(0,fixed+reservesAndSaving+variable-plannedIncome);

  return {
    baseCurrency,
    cycle,
    daysRemaining,
    elapsedRatio,
    primaryBalance,
    fixedRemaining,
    transferRemaining,
    reserveRemaining,
    variableRemaining,
    commitmentsRemaining,
    freeUntilIncome,
    dailyAllowance,
    weeklyAllowance,
    status:freeUntilIncome<0?'negative':dailyAllowance<=10?'warning':'positive',
    flow:{
      income:plannedIncome,
      fixed,
      reserves:reservesAndSaving,
      variable,
      free:plannedFree,
      gap:plannedGap,
    },
    budget:budgetState,
    reserves,
    anomaly,
    subscriptions,
    freedCommitment,
    insights:insights.slice(0,4),
  };
}


export function buildBudgetDecisionGuide({
  categoryId=null,
  merchantId=null,
  budgets=[],
  transactions=[],
  debtPayments=[],
  categories=[],
  merchants=[],
  recurringRules=[],
  accounts=[],
  household,
  fxRates=null,
  now=new Date(),
}={}){
  if(!categoryId&&!merchantId) return {found:false};

  const baseCurrency=household?.base_currency||'CHF';
  const budget=calculateBudgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,accounts,
    baseCurrency,fxRates,now,fallbackDay:25,
  });
  const lineageIds=new Set();
  if(categoryId){
    const byId=new Map(categories.map((row)=>[row.id,row]));
    let current=byId.get(categoryId)||null;
    const seen=new Set();
    while(current&&!seen.has(current.id)){
      lineageIds.add(current.id);
      seen.add(current.id);
      current=current.parent_id?byId.get(current.parent_id)||null:null;
    }
  }

  const row=budget.variableRows.find((item)=>merchantId&&item.merchant_id===merchantId)
    || budget.variableRows.find((item)=>item.category_id&&lineageIds.has(item.category_id))
    || null;
  if(!row) return {found:false,budget};

  const amount=Math.max(0,Number(row.amount||0));
  const spent=Math.max(0,Number(row.spent||0));
  const remaining=Math.max(0,amount-spent);
  return {
    found:true,
    label:row.merchants?.name||row.categories?.name||'Budget',
    amount,
    spent,
    remaining,
    percent:amount>0?Math.min(999,spent/amount*100):0,
    inherited:Boolean(row._inherited),
    budget,
  };
}
