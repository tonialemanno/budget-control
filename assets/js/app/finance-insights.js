import { localMonthKey } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';
import { financeCycles, inFinanceCycle, resolveFinanceCycle } from './finance-cycle.js';

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
    const income = rows.filter((tx)=>Number(tx.amount)>0 && tx.cashflow_type!=='receivable_principal')
      .reduce((sum,tx)=>sum+base(tx.amount,tx.currency,baseCurrency,fxRates),0);
    const expenses = rows.reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),0);
    result.push({ key, date, income, expenses, net: income-expenses });
  }
  return result;
}

export function financeCycleSeries({
  transactions=[],
  debtPayments=[],
  recurringRules=[],
  baseCurrency='CHF',
  fxRates=null,
  now=new Date(),
  cycles=6,
  fallbackDay=25,
}={}) {
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const periods=financeCycles({transactions,recurringRules,now,fallbackDay,count:cycles});
  return periods.map((cycle)=>{
    const rows=transactions.filter((tx)=>{
      const occurred=new Date(tx.occurred_at);
      return tx.status==='booked'&&!tx.transfer_group_id&&occurred<=now&&inFinanceCycle(tx,cycle);
    });
    const income=rows
      .filter((tx)=>Number(tx.amount)>0&&tx.cashflow_type!=='receivable_principal')
      .reduce((sum,tx)=>sum+base(tx.amount,tx.currency,baseCurrency,fxRates),0);
    const expenses=rows.reduce(
      (sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),
      0
    );
    return {
      key:cycle.budgetMonth,
      date:cycle.start,
      start:cycle.start,
      endExclusive:cycle.endExclusive,
      source:cycle.source,
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
  baseCurrency='CHF',
  fxRates=null,
  now=new Date(),
  fallbackDay=25,
}={}) {
  const cycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay});
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const rows=transactions.filter((tx)=>{
    const occurred=new Date(tx.occurred_at);
    return tx.status==='booked'&&!tx.transfer_group_id&&occurred<=now&&inFinanceCycle(tx,cycle);
  });
  const income=rows
    .filter((tx)=>Number(tx.amount)>0&&tx.cashflow_type!=='receivable_principal')
    .reduce((sum,tx)=>sum+base(tx.amount,tx.currency,baseCurrency,fxRates),0);
  const expenses=rows.reduce(
    (sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),
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
  transactions = [], debtPayments = [], categories = [], baseCurrency = 'CHF', fxRates = null,
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
    const value = consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
    if (!(value>0)) continue;
    const category = parentById.get(tx.category_id);
    const parent = category?.parent_id ? parentById.get(category.parent_id) : category;
    const key = parent?.id || 'uncategorized';
    const label = parent?.name || 'Ohne Kategorie';
    totals.set(key,{ key,label,value:(totals.get(key)?.value||0)+value });
  }

  const allRows=[...totals.values()].sort((a,b)=>b.value-a.value);
  const total=allRows.reduce((sum,row)=>sum+row.value,0);
  const visible=allRows.slice(0,Math.max(1,limit));
  const hidden=allRows.slice(visible.length);
  if (includeOther && hidden.length) {
    visible.push({
      key:'other',
      label:'Sonstiges',
      value:hidden.reduce((sum,row)=>sum+row.value,0),
    });
  }

  return visible.map((row)=>({...row,share:total>0?row.value/total*100:0,total}));
}

export function effectiveBudgetSet(budgets = [], month) {
  const target=String(month||'').slice(0,7);
  const current=budgets
    .filter((row)=>String(row.month_start||'').slice(0,7)===target)
    .map((row)=>({...row,_inherited:false}));

  const previousMonths=[...new Set(
    budgets
      .map((row)=>String(row.month_start||'').slice(0,7))
      .filter((value)=>/^\d{4}-\d{2}$/.test(value)&&value<target)
  )].sort().reverse();
  const sourceMonth=previousMonths[0]||null;
  if(!sourceMonth) return { rows:current, sourceMonth:target, inherited:false, inheritedCount:0 };

  const scopeKey=(row)=>row.merchant_id ? `merchant:${row.merchant_id}` : `category:${row.category_id||''}`;
  const currentScopes=new Set(current.map(scopeKey));
  const inheritedRows=budgets
    .filter((row)=>String(row.month_start||'').slice(0,7)===sourceMonth&&!currentScopes.has(scopeKey(row)))
    .map((row)=>({...row,_inherited:true}));

  return {
    rows:[...current,...inheritedRows],
    sourceMonth,
    inherited:inheritedRows.length>0,
    inheritedCount:inheritedRows.length,
  };
}

export function budgetSummary({
  budgets = [], transactions = [], debtPayments = [], categories = [], merchants = [],
  recurringRules = [], baseCurrency='CHF', fxRates=null, now=new Date(), fallbackDay=25,
}={}) {
  const cycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay});
  const effective=effectiveBudgetSet(budgets,cycle.budgetMonth);
  const rows=effective.rows;
  const total=rows.reduce((sum,b)=>sum+base(Number(b.amount||0),b.currency||baseCurrency,baseCurrency,fxRates),0);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  let spent=0;
  for(const tx of transactions){
    const occurred=new Date(tx.occurred_at);
    if(tx.status!=='booked'||tx.transfer_group_id||occurred>now||!inFinanceCycle(tx,cycle)) continue;
    const amount=consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
    if(!(amount>0)) continue;
    const category=categories.find((row)=>row.id===tx.category_id);
    const covered=rows.some((budget)=>budget.merchant_id
      ? budget.merchant_id===tx.merchant_id
      : budget.category_id===tx.category_id || budget.category_id===category?.parent_id);
    if(covered) spent+=amount;
  }
  return {
    total,
    spent,
    remaining:Math.max(0,total-spent),
    percent:total>0?clampPercent(spent/total*100):0,
    count:rows.length,
    sourceMonth:effective.sourceMonth,
    inherited:effective.inherited,
    inheritedCount:effective.inheritedCount||0,
    cycle,
  };
}

export function goalSummaries(goals = []) {
  return goals.filter((goal)=>goal.status==='active').map((goal)=>{
    const target=Number(goal.target_amount||0);
    const current=Number(goal.current_amount||0);
    return {...goal, progressPercent:target>0?clampPercent(current/target*100):0, remaining:Math.max(0,target-current)};
  }).sort((a,b)=>b.progressPercent-a.progressPercent);
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
