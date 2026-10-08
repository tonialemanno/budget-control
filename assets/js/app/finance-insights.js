import { localMonthKey } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap } from './financial-effects.js';
import { financeCycles, inFinanceCycle, resolveFinanceCycle } from './finance-cycle.js';
import { calculateBudgetSummary, effectiveBudgetSet } from './budget-engine.js';
import { matchingRecurringRule, semanticExpenseBase, semanticIncomeBase, semanticType } from './finance-semantics.js';

function base(value, currency, target, fxRates) {
  return convertAmount(value, currency || target, target, fxRates) ?? 0;
}

export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function monthSeries({
  transactions = [], debtPayments = [], baseCurrency = 'CHF', fxRates = null, now = new Date(), months = 6,
} = {}) {
  const paymentMap = buildDebtPaymentTransactionMap(debtPayments);
  const result = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1, 12);
    const key = localMonthKey(date);
    const rows = transactions.filter((tx)=>{
      const occurred = new Date(tx.occurred_at);
      return tx.status === 'booked' && !tx.transfer_group_id && localMonthKey(tx.occurred_at) === key && occurred <= now;
    });
    const income = rows.reduce((sum,tx)=>sum+semanticIncomeBase(tx,{baseCurrency,fxRates}),0);
    const expenses = rows.reduce((sum,tx)=>sum+semanticExpenseBase(tx,{debtPayments:paymentMap,baseCurrency,fxRates}),0);
    result.push({ key, date, income, expenses, net: income-expenses });
  }
  return result;
}


function startOfDay(value){
  const d=value instanceof Date?new Date(value):new Date(value);
  return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0);
}

function fallbackNextStart(start,fallbackDay=25){
  const base=new Date(start.getFullYear(),start.getMonth()+1,1,0,0,0,0);
  const last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
  base.setDate(Math.min(fallbackDay,last));
  return base;
}

function salaryAnchors({transactions=[],recurringRules=[],categories=[],now=new Date()}={}){
  const monthlyIncomeRules=recurringRules.filter((rule)=>
    rule.active!==false && rule.direction==='income' && rule.cadence==='monthly'
  );
  if(!monthlyIncomeRules.length) return [];
  const rows=[];
  for(const tx of transactions){
    const occurred=new Date(tx.occurred_at);
    if(tx.status!=='booked'||Number(tx.amount)<=0||tx.transfer_group_id||Number.isNaN(occurred.getTime())||occurred>now) continue;
    const rule=matchingRecurringRule(tx,monthlyIncomeRules,categories,'income');
    if(!rule||rule.cadence!=='monthly') continue;
    const expected=Math.abs(Number(rule.amount||0));
    const actual=Math.abs(Number(tx.amount||0));
    const linked=Boolean(tx.recurring_rule_id&&tx.recurring_rule_id===rule.id);
    const amountClose=expected>0&&Math.abs(actual-expected)<=Math.max(10,expected*.20);
    const normalize=(value)=>String(value||'').toLowerCase().replace(/[^a-z0-9äöüß]+/g,' ').trim();
    const txText=normalize([tx.description,tx.counterparty,tx.merchants?.name].filter(Boolean).join(' '));
    const ruleTexts=[rule.description,rule.counterparty,rule.merchants?.name].map(normalize).filter((value)=>value.length>=4);
    const textMatch=ruleTexts.some((value)=>txText.includes(value)||value.includes(txText));
    if(!linked&&!amountClose&&!textMatch) continue;
    rows.push({date:startOfDay(occurred),amount:Number(tx.amount||0),txId:tx.id,ruleId:rule.id});
  }
  rows.sort((a,b)=>a.date-b.date);
  const byMonth=new Map();
  for(const row of rows){
    const key=localMonthKey(row.date);
    const current=byMonth.get(key);
    if(!current||row.amount>current.amount) byMonth.set(key,row);
  }
  return [...byMonth.values()].sort((a,b)=>a.date-b.date);
}

function anchoredFinanceCycles({
  transactions=[],recurringRules=[],categories=[],now=new Date(),count=6,fallbackDay=25,
}={}){
  const anchors=salaryAnchors({transactions,recurringRules,categories,now});
  if(anchors.length<2) return [];
  const incomeRuleDates=recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='income'&&rule.cadence==='monthly'&&rule.next_date)
    .map((rule)=>startOfDay(rule.next_date))
    .filter((date)=>!Number.isNaN(date.getTime()));
  const periods=anchors.map((anchor,index)=>{
    let endExclusive=anchors[index+1]?.date||null;
    if(!endExclusive){
      const futureRuleDate=incomeRuleDates.filter((date)=>date>anchor.date).sort((a,b)=>a-b)[0]||null;
      endExclusive=futureRuleDate||fallbackNextStart(anchor.date,fallbackDay);
      if(endExclusive<=anchor.date) endExclusive=fallbackNextStart(anchor.date,fallbackDay);
    }
    return {
      start:anchor.date,
      endExclusive,
      budgetMonth:localMonthKey(anchor.date),
      source:'income_anchor',
      sourceTransactionId:anchor.txId,
      primaryIncomeRuleId:anchor.ruleId,
      fallbackDay,
      mode:'day_25',
    };
  });
  return periods.slice(-Math.max(1,count));
}

export function financeCycleSeries({
  transactions=[],
  debtPayments=[],
  recurringRules=[],
  categories=[],
  baseCurrency='CHF',
  fxRates=null,
  now=new Date(),
  cycles=6,
  fallbackDay=25,
  financeMonthMode='day_25',
}={}) {
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const anchored=financeMonthMode==='day_25'
    ? anchoredFinanceCycles({transactions,recurringRules,categories,now,count:cycles,fallbackDay})
    : [];
  const periods=anchored.length?anchored:financeCycles({now,fallbackDay,mode:financeMonthMode,count:cycles});
  const bookedDates=transactions
    .filter((tx)=>tx.status==='booked')
    .map((tx)=>new Date(tx.occurred_at))
    .filter((date)=>!Number.isNaN(date.getTime())&&date<=now);
  const dataStart=bookedDates.length?new Date(Math.min(...bookedDates.map((date)=>date.getTime()))):null;
  return periods.map((cycle)=>{
    const rows=transactions.filter((tx)=>{
      const occurred=new Date(tx.occurred_at);
      return tx.status==='booked'&&!tx.transfer_group_id&&occurred<=now&&inFinanceCycle(tx,cycle);
    });
    const income=rows.reduce(
      (sum,tx)=>sum+semanticIncomeBase(tx,{categories,recurringRules,baseCurrency,fxRates}),
      0
    );
    const expenses=rows.reduce(
      (sum,tx)=>sum+semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}),
      0
    );
    const coverage=!dataStart
      ? 'none'
      : dataStart>=cycle.endExclusive
        ? 'none'
        : dataStart>cycle.start
          ? 'partial'
          : 'full';
    return {
      key:cycle.budgetMonth,
      date:cycle.start,
      start:cycle.start,
      endExclusive:cycle.endExclusive,
      source:cycle.source,
      coverage,
      dataStart,
      income,
      expenses,
      net:income-expenses,
    };
  });
}

export function currentFinanceCycleTotals({
  transactions=[],
  debtPayments=[],
  recurringRules=[],
  categories=[],
  baseCurrency='CHF',
  fxRates=null,
  now=new Date(),
  fallbackDay=25,
  financeMonthMode='day_25',
}={}) {
  const cycle=resolveFinanceCycle({now,fallbackDay,mode:financeMonthMode});
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const rows=transactions.filter((tx)=>{
    const occurred=new Date(tx.occurred_at);
    return tx.status==='booked'&&!tx.transfer_group_id&&occurred<=now&&inFinanceCycle(tx,cycle);
  });
  const income=rows.reduce(
    (sum,tx)=>sum+semanticIncomeBase(tx,{categories,recurringRules,baseCurrency,fxRates}),
    0
  );
  const expenses=rows.reduce(
    (sum,tx)=>sum+semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}),
    0
  );
  const savings=income-expenses;
  return {
    cycle,
    income,
    expenses,
    savings,
    savingsRate:income>0?savings/income*100:0,
    transactionCount:rows.length,
  };
}

export function categorySpending({
  transactions = [], debtPayments = [], categories = [], recurringRules = [], baseCurrency = 'CHF', fxRates = null,
  now = new Date(), limit = 5, includeOther = true, periodDays = null,
  rangeStart = null, rangeEnd = null,
} = {}) {
  const paymentMap = buildDebtPaymentTransactionMap(debtPayments);
  const month = localMonthKey(now);
  const periodStart = rangeStart
    ? new Date(rangeStart)
    : periodDays
      ? new Date(now.getFullYear(),now.getMonth(),now.getDate()-Math.max(0,Number(periodDays)-1),0,0,0,0)
      : null;
  const periodEnd = rangeEnd ? new Date(rangeEnd) : null;
  const parentById = new Map(categories.map((c)=>[c.id,c]));
  const totals = new Map();

  for (const tx of transactions) {
    const occurred = new Date(tx.occurred_at);
    if (tx.status!=='booked' || tx.transfer_group_id || occurred>now) continue;
    if (periodStart ? occurred<periodStart : localMonthKey(tx.occurred_at)!==month) continue;
    if (periodEnd && occurred>=periodEnd) continue;
    const value = semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates});
    if (!(value>0)) continue;
    const category = parentById.get(tx.category_id);
    const parent = category?.parent_id ? parentById.get(category.parent_id) : category;
    const key = parent?.id || 'uncategorized';
    const label = parent?.name || 'Ohne Kategorie';
    const existing=totals.get(key)||{key,label,value:0,categoryIds:new Set()};
    existing.value+=value;
    if(category?.id) existing.categoryIds.add(category.id);
    if(parent?.id) existing.categoryIds.add(parent.id);
    totals.set(key,existing);
  }

  const allRows=[...totals.values()].map((row)=>({...row,categoryIds:[...row.categoryIds]})).sort((a,b)=>b.value-a.value);
  const total=allRows.reduce((sum,row)=>sum+row.value,0);
  const visible=allRows.slice(0,Math.max(1,limit));
  const hidden=allRows.slice(visible.length);
  if (includeOther && hidden.length) {
    visible.push({
      key:'other',
      label:'Sonstiges',
      value:hidden.reduce((sum,row)=>sum+row.value,0),
      categoryIds:[...new Set(hidden.flatMap((row)=>row.categoryIds||[]))],
    });
  }

  return visible.map((row)=>({...row,share:total>0?row.value/total*100:0,total}));
}

export function annualIncomeBreakdown({
  transactions=[],categories=[],recurringRules=[],baseCurrency='CHF',fxRates=null,year=new Date().getFullYear(),limit=6,
}={}) {
  const start=new Date(year,0,1);
  const end=new Date(year+1,0,1);
  const earned=new Map();
  let refunds=0;
  let repayments=0;
  let unclassified=0;
  let otherIncome=0;

  for(const tx of transactions){
    const date=new Date(tx.occurred_at);
    if(tx.status!=='booked'||Number.isNaN(date.getTime())||date<start||date>=end||Number(tx.amount)<=0) continue;
    const type=semanticType(tx,{categories,recurringRules});
    const value=Math.max(0,base(tx.amount,tx.currency,baseCurrency,fxRates));
    if(type==='earned_income'||type==='other_income'){
      const source=tx.merchants?.name||tx.counterparty||tx.description||'Sonstige Einnahmen';
      const key=String(source).trim()||'Sonstige Einnahmen';
      const current=earned.get(key)||{value:0,transactionIds:[]};
      current.value+=value;
      current.transactionIds.push(tx.id);
      earned.set(key,current);
      if(type==='other_income') otherIncome+=value;
    } else if(type==='refund'||type==='tax_refund') refunds+=value;
    else if(type==='receivable_repayment') repayments+=value;
    else if(type==='unclassified_inflow') unclassified+=value;
  }

  const allSources=[...earned.entries()].map(([label,row])=>({
    label,
    value:row.value,
    sourceNames:[label],
    transactionIds:row.transactionIds,
  })).sort((a,b)=>b.value-a.value);
  const top=allSources.slice(0,Math.max(1,limit));
  const hidden=allSources.slice(top.length);
  if(hidden.length) top.push({
    label:'Sonstige Verdienste',
    value:hidden.reduce((sum,row)=>sum+row.value,0),
    other:true,
    sourceNames:hidden.map((row)=>row.label),
    transactionIds:hidden.flatMap((row)=>row.transactionIds||[]),
  });
  const earnedTotal=allSources.reduce((sum,row)=>sum+row.value,0);
  return {
    year,
    earnedTotal,
    sources:top,
    refunds,
    repayments,
    unclassified,
    otherIncome,
    cashInflows:earnedTotal+refunds+repayments+unclassified,
  };
}

export { effectiveBudgetSet };

export function budgetSummary(options={}) {
  return calculateBudgetSummary(options);
}

export function goalSummaries(goals = []) {
  return goals.filter((goal)=>goal.status==='active').map((goal)=>{
    const target=Number(goal.target_amount||0);
    const current=Number(goal.current_amount||0);
    return {...goal, progressPercent:target>0?clampPercent(current/target*100):0, remaining:Math.max(0,target-current)};
  }).sort((a,b)=>b.progressPercent-a.progressPercent);
}

export function primaryOperatingAccount(accounts = [], recurringRules = [], baseCurrency='CHF', preferredAccountId='') {
  const eligible=accounts.filter((account)=>!account.is_archived);
  if(!eligible.length) return null;

  const preferred=preferredAccountId
    ? eligible.find((account)=>account.account_id===preferredAccountId)
    : null;
  if(preferred) return preferred;

  const namedSalaryAccount=eligible.find((account)=>
    account.account_type==='checking'
    && account.currency===baseCurrency
    && /(^|\b)(lohn|salary|gehalt)(\b|konto)/i.test(String(account.name||''))
  );
  if(namedSalaryAccount) return namedSalaryAccount;

  const incomeByAccount=new Map();
  recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='income'&&rule.account_id)
    .forEach((rule)=>{
      const amount=Math.max(0,Number(rule.amount||0));
      incomeByAccount.set(rule.account_id,(incomeByAccount.get(rule.account_id)||0)+amount);
    });

  const incomeCandidates=eligible
    .filter((account)=>incomeByAccount.has(account.account_id))
    .sort((a,b)=>{
      const currencyA=a.currency===baseCurrency?1:0;
      const currencyB=b.currency===baseCurrency?1:0;
      if(currencyA!==currencyB) return currencyB-currencyA;
      return (incomeByAccount.get(b.account_id)||0)-(incomeByAccount.get(a.account_id)||0);
    });
  if(incomeCandidates.length) return incomeCandidates[0];

  return eligible.find((account)=>account.account_type==='checking'&&account.currency===baseCurrency)
    || eligible.find((account)=>account.account_type==='checking')
    || eligible.find((account)=>account.currency===baseCurrency&&['cash','wallet'].includes(account.account_type))
    || eligible.find((account)=>account.currency===baseCurrency)
    || eligible[0];
}

export function accountShare(accounts = [], baseCurrency='CHF', fxRates=null) {
  const eligible=accounts.filter((a)=>['checking','savings','cash','wallet'].includes(a.account_type));
  const rows=eligible.map((account)=>({
    account,
    value:base(Number(account.current_balance||0),account.currency,baseCurrency,fxRates),
  }));
  const total=rows.reduce((sum,row)=>sum+Math.max(0,row.value),0);
  return rows.map((row)=>({...row,share:total>0?Math.max(0,row.value)/total*100:0})).sort((a,b)=>b.value-a.value);
}
