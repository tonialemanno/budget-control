import { localMonthKey } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';

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

export function categorySpending({
  transactions = [], debtPayments = [], categories = [], baseCurrency = 'CHF', fxRates = null, now = new Date(), limit = 5,
} = {}) {
  const paymentMap = buildDebtPaymentTransactionMap(debtPayments);
  const month = localMonthKey(now);
  const parentById = new Map(categories.map((c)=>[c.id,c]));
  const totals = new Map();
  for (const tx of transactions) {
    const occurred = new Date(tx.occurred_at);
    if (tx.status!=='booked' || tx.transfer_group_id || occurred>now || localMonthKey(tx.occurred_at)!==month) continue;
    const value = consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
    if (!(value>0)) continue;
    const category = parentById.get(tx.category_id);
    const parent = category?.parent_id ? parentById.get(category.parent_id) : category;
    const key = parent?.id || 'uncategorized';
    const label = parent?.name || 'Ohne Kategorie';
    totals.set(key,{ key,label,value:(totals.get(key)?.value||0)+value });
  }
  const rows=[...totals.values()].sort((a,b)=>b.value-a.value).slice(0,limit);
  const total=rows.reduce((sum,row)=>sum+row.value,0);
  return rows.map((row)=>({...row,share:total>0?row.value/total*100:0}));
}

export function budgetSummary({ budgets = [], transactions = [], debtPayments = [], categories = [], merchants = [], baseCurrency='CHF', fxRates=null, now=new Date() }={}) {
  const month=localMonthKey(now);
  const rows=budgets.filter((b)=>String(b.month_start||'').slice(0,7)===month);
  const total=rows.reduce((sum,b)=>sum+base(Number(b.amount||0),b.currency||baseCurrency,baseCurrency,fxRates),0);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  let spent=0;
  for(const tx of transactions){
    const occurred=new Date(tx.occurred_at);
    if(tx.status!=='booked'||tx.transfer_group_id||occurred>now||localMonthKey(tx.occurred_at)!==month) continue;
    const amount=consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates);
    if(!(amount>0)) continue;
    const covered=rows.some((budget)=>budget.merchant_id ? budget.merchant_id===tx.merchant_id : budget.category_id===tx.category_id);
    if(covered) spent+=amount;
  }
  return { total, spent, remaining:Math.max(0,total-spent), percent:total>0?clampPercent(spent/total*100):0, count:rows.length };
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
