import { cadenceMonthlyFactor, localMonthKey } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';
import { occurrenceNear } from './recurrence.js';

function isActiveRecurring(rule, today) {
  return rule?.active !== false && (!rule?.end_date || String(rule.end_date).slice(0,10) >= today);
}

function normalizedText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
}

function dateDistanceDays(left, right) {
  const a=new Date(left);
  const b=new Date(right);
  if(Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(a.getTime()-b.getTime())/86400000;
}

export function matchesRecurringExpense(tx, rules) {
  const txAmount=Math.abs(Number(tx.amount||0));
  const txText=normalizedText(`${tx.description||''} ${tx.counterparty||''}`);
  return rules.some((rule)=>{
    if(rule.direction!=='expense') return false;
    if(rule.account_id && rule.account_id!==tx.account_id) return false;
    if(rule.merchant_id && tx.merchant_id && rule.merchant_id!==tx.merchant_id) return false;
    if((rule.currency||tx.currency)!==tx.currency) return false;
    if(Math.abs(Number(rule.amount||0)-txAmount)>0.01) return false;
    if(rule.next_date && !occurrenceNear(rule,tx.occurred_at,3)) return false;
    const ruleText=normalizedText(`${rule.description||''} ${rule.counterparty||''}`);
    const merchantMatch=Boolean(rule.merchant_id && tx.merchant_id && rule.merchant_id===tx.merchant_id);
    const categoryMatch=Boolean(rule.category_id && tx.category_id && (rule.category_id===tx.category_id || rule.category_id===tx.categories?.parent_id));
    const textMatch=Boolean(ruleText && txText && (txText.includes(ruleText)||ruleText.includes(txText)));
    return merchantMatch || categoryMatch || textMatch;
  });
}

export function budgetCoversTransaction(tx, budgets) {
  return budgets.some((budget)=>{
    if(budget.merchant_id) return Boolean(tx.merchant_id && budget.merchant_id===tx.merchant_id);
    if(budget.category_id) return Boolean(tx.category_id && (budget.category_id===tx.category_id || budget.category_id===tx.categories?.parent_id));
    return false;
  });
}

export function isFixedBudget(budget, activeRecurringRules) {
  if(!budget?.merchant_id) return false;
  return activeRecurringRules.some((rule)=>
    rule.direction==='expense'
    && Boolean(rule.merchant_id)
    && rule.merchant_id===budget.merchant_id
  );
}

function billTransactionShape(bill) {
  return {
    account_id:bill.account_id||null,
    category_id:bill.category_id||null,
    merchant_id:null,
    occurred_at:bill.due_date,
    amount:-Math.abs(Number(bill.amount||0)),
    currency:bill.currency,
    description:bill.name||'',
    counterparty:bill.provider||'',
  };
}

function billMatchesRecurring(bill, rules) {
  return matchesRecurringExpense(billTransactionShape(bill),rules);
}

function billMatchesFutureTransaction(bill, transactions) {
  const amount=Math.abs(Number(bill.amount||0));
  const currency=bill.currency;
  const billText=normalizedText(`${bill.name||''} ${bill.provider||''}`);
  return transactions.some((tx)=>{
    if(Number(tx.amount)>=0 || tx.transfer_group_id) return false;
    if((tx.currency||currency)!==currency) return false;
    if(Math.abs(Math.abs(Number(tx.amount||0))-amount)>0.01) return false;
    if(bill.account_id && tx.account_id && bill.account_id!==tx.account_id) return false;
    if(dateDistanceDays(bill.due_date,tx.occurred_at)>3) return false;
    const categoryMatch=Boolean(bill.category_id && tx.category_id && bill.category_id===tx.category_id);
    const txText=normalizedText(`${tx.description||''} ${tx.counterparty||''}`);
    const textMatch=Boolean(billText && txText && (txText.includes(billText)||billText.includes(txText)));
    return categoryMatch || textMatch;
  });
}

export function buildFinanceSnapshot({
  accounts = [],
  transactions = [],
  debtPayments = [],
  recurringRules = [],
  budgets = [],
  bills = [],
  debts = [],
  receivables = [],
  assets = [],
  properties = [],
  vehicles = [],
  investments = [],
  pensions = [],
  household,
  fxRates,
  now = new Date(),
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const today = now.toISOString().slice(0,10);
  const monthKey = localMonthKey(now);
  const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
  const inBase = (value, sourceCurrency = currency) => convertAmount(value, sourceCurrency || currency, currency, fxRates) ?? 0;

  const liquidTypes = new Set(['checking','savings','cash','wallet']);
  const cash = accounts
    .filter((account)=>liquidTypes.has(account.account_type))
    .reduce((sum,account)=>sum+inBase(account.current_balance,account.currency),0);

  const activeRecurring = recurringRules.filter((rule)=>isActiveRecurring(rule,today));
  const recurringMonthly = (direction) => activeRecurring
    .filter((rule)=>rule.direction===direction)
    .reduce((sum,rule)=>sum+inBase(Number(rule.amount||0)*cadenceMonthlyFactor(rule.cadence),rule.currency),0);

  const plannedIncomeRecurring = recurringMonthly('income');
  const fixedExpensesMonthly = recurringMonthly('expense');
  const fixedTransfersMonthly = recurringMonthly('transfer');

  const monthBudgets = budgets.filter((budget)=>String(budget.month_start).slice(0,7)===monthKey);
  const variableBudgets = monthBudgets.filter((budget)=>!isFixedBudget(budget,activeRecurring));
  const variableBudgetMonthly = variableBudgets.reduce((sum,budget)=>sum+inBase(Number(budget.amount||0),budget.currency||currency),0);

  const paymentMap = buildDebtPaymentTransactionMap(debtPayments);
  const bookedMonth = transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return tx.status==='booked'
      && localMonthKey(tx.occurred_at)===monthKey
      && !tx.transfer_group_id
      && !Number.isNaN(date.getTime())
      && date<=now;
  });

  const actualIncomeMonth = bookedMonth
    .filter((tx)=>Number(tx.amount)>0 && tx.cashflow_type!=='receivable_principal')
    .reduce((sum,tx)=>sum+inBase(tx.amount,tx.currency),0);

  const actualExpensesMonth = bookedMonth
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);

  const actualVariableTransactions = bookedMonth.filter((tx)=>
    Number(tx.amount)<0
    && consumptionExpenseBase(tx,paymentMap,currency,fxRates)>0
    && !matchesRecurringExpense(tx,activeRecurring)
  );
  const actualVariableExpensesMonth = actualVariableTransactions
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
  const budgetedActualVariableExpensesMonth = actualVariableTransactions
    .filter((tx)=>budgetCoversTransaction(tx,variableBudgets))
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
  const unbudgetedActualVariableExpensesMonth = actualVariableExpensesMonth-budgetedActualVariableExpensesMonth;

  const futureExpenseTransactions = transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return ['booked','pending'].includes(tx.status)
      && !tx.transfer_group_id
      && tx.cashflow_type!=='debt_payment'
      && Number(tx.amount)<0
      && localMonthKey(tx.occurred_at)===monthKey
      && !Number.isNaN(date.getTime())
      && date>now;
  });
  const plannedFutureExpenses = futureExpenseTransactions.filter((tx)=>!matchesRecurringExpense(tx,activeRecurring));
  const plannedFutureExpensesMonth = plannedFutureExpenses
    .reduce((sum,tx)=>sum+inBase(Math.abs(Number(tx.amount||0)),tx.currency),0);
  const budgetedFutureExpensesMonth = plannedFutureExpenses
    .filter((tx)=>budgetCoversTransaction(tx,variableBudgets))
    .reduce((sum,tx)=>sum+inBase(Math.abs(Number(tx.amount||0)),tx.currency),0);
  const unbudgetedFutureExpensesMonth = plannedFutureExpensesMonth-budgetedFutureExpensesMonth;

  const openBillsRows=bills.filter((bill)=>['open','overdue'].includes(bill.status));
  const openBills=openBillsRows.reduce((sum,bill)=>sum+inBase(bill.amount,bill.currency),0);
  const dueOpenBills=openBillsRows.filter((bill)=>{
    const due=new Date(`${String(bill.due_date||'').slice(0,10)}T12:00:00`);
    return !Number.isNaN(due.getTime()) && due<=monthEnd;
  });
  const distinctDueBills=dueOpenBills.filter((bill)=>!billMatchesFutureTransaction(bill,futureExpenseTransactions));
  const variableDueBills=distinctDueBills.filter((bill)=>{
    const billMonth=String(bill.due_date||'').slice(0,7);
    return billMonth!==monthKey || !billMatchesRecurring(bill,activeRecurring);
  });
  const budgetedOpenBillsMonth=variableDueBills
    .filter((bill)=>String(bill.due_date||'').slice(0,7)===monthKey && budgetCoversTransaction(billTransactionShape(bill),variableBudgets))
    .reduce((sum,bill)=>sum+inBase(bill.amount,bill.currency),0);
  const unbudgetedOpenBillsMonth=variableDueBills
    .filter((bill)=>!(String(bill.due_date||'').slice(0,7)===monthKey && budgetCoversTransaction(billTransactionShape(bill),variableBudgets)))
    .reduce((sum,bill)=>sum+inBase(bill.amount,bill.currency),0);

  const budgetTrackedPlanMonth=Math.max(
    variableBudgetMonthly,
    budgetedActualVariableExpensesMonth+budgetedFutureExpensesMonth+budgetedOpenBillsMonth
  );
  const plannedVariableMonthly =
    budgetTrackedPlanMonth
    + unbudgetedActualVariableExpensesMonth
    + unbudgetedFutureExpensesMonth
    + unbudgetedOpenBillsMonth;

  const remainingVariableBudgetMonth=Math.max(0,budgetTrackedPlanMonth-budgetedActualVariableExpensesMonth);
  const remainingPlannedExpensesMonth=
    remainingVariableBudgetMonth
    + unbudgetedFutureExpensesMonth
    + unbudgetedOpenBillsMonth;

  const incomePlanMonthly = plannedIncomeRecurring>0 ? plannedIncomeRecurring : actualIncomeMonth;
  const incomePlanSource = plannedIncomeRecurring>0 ? 'recurring' : 'booked';
  const plannedCommitmentsMonthly = fixedExpensesMonthly + plannedVariableMonthly + fixedTransfersMonthly;
  const plannedFreeMonthly = incomePlanMonthly - plannedCommitmentsMonthly;
  const cashAfterOpenBills = cash-openBills;

  const ninety = new Date(now);
  ninety.setDate(ninety.getDate()-90);
  const trailingExpenses = transactions
    .filter((tx)=>{
      const date=new Date(tx.occurred_at);
      return tx.status==='booked'
        && !tx.transfer_group_id
        && !Number.isNaN(date.getTime())
        && date>=ninety
        && date<=now;
    })
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
  const avgMonthlyExpenses = trailingExpenses/3;
  const runwayMonths = avgMonthlyExpenses>0 ? cash/avgMonthlyExpenses : 0;

  const actualCashflowMonth = actualIncomeMonth-actualExpensesMonth;
  const savingsRate = actualIncomeMonth>0 ? actualCashflowMonth/actualIncomeMonth*100 : 0;
  const fixedCostRatio = incomePlanMonthly>0 ? fixedExpensesMonthly/incomePlanMonthly*100 : 0;

  const value = (rows,field) => rows.reduce((sum,row)=>sum+inBase(row[field],row.currency),0);
  const receivablesOutstanding = receivables
    .filter((row)=>!['paid','written_off'].includes(row.status))
    .reduce((sum,row)=>sum+inBase(row.outstanding_amount,row.currency),0);
  const totalAssets =
    cash
    + value(assets,'current_value')
    + value(properties,'current_value')
    + value(vehicles,'current_value')
    + value(investments,'current_value')
    + value(pensions,'current_value')
    + receivablesOutstanding;
  const debtValue = debts
    .filter((debt)=>debt.status!=='paid')
    .reduce((sum,debt)=>sum+inBase(debt.outstanding_amount,debt.currency),0);
  const netWorth = totalAssets-debtValue;
  const debtRatio = totalAssets>0 ? debtValue/totalAssets*100 : 0;

  return {
    currency,
    monthKey,
    today,
    cash,
    openBills,
    cashAfterOpenBills,
    plannedIncomeRecurring,
    incomePlanMonthly,
    incomePlanSource,
    fixedExpensesMonthly,
    variableBudgetMonthly,
    budgetTrackedPlanMonth,
    actualVariableExpensesMonth,
    budgetedActualVariableExpensesMonth,
    unbudgetedActualVariableExpensesMonth,
    plannedFutureExpensesMonth,
    budgetedFutureExpensesMonth,
    unbudgetedFutureExpensesMonth,
    budgetedOpenBillsMonth,
    unbudgetedOpenBillsMonth,
    remainingVariableBudgetMonth,
    remainingPlannedExpensesMonth,
    plannedVariableMonthly,
    fixedTransfersMonthly,
    plannedCommitmentsMonthly,
    plannedFreeMonthly,
    actualIncomeMonth,
    actualExpensesMonth,
    actualCashflowMonth,
    savingsRate,
    avgMonthlyExpenses,
    runwayMonths,
    fixedCostRatio,
    receivablesOutstanding,
    totalAssets,
    debtValue,
    netWorth,
    debtRatio,
    activeRecurringCount: activeRecurring.length,
    monthBudgetCount: monthBudgets.length,
    variableBudgetCount: variableBudgets.length,
  };
}
