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
    const categoryMatch=Boolean(rule.category_id && tx.category_id && rule.category_id===tx.category_id);
    const textMatch=Boolean(ruleText && txText && (txText.includes(ruleText)||ruleText.includes(txText)));
    return merchantMatch || categoryMatch || textMatch;
  });
}

export function budgetCoversTransaction(tx, budgets) {
  return budgets.some((budget)=>{
    if(budget.category_id) return budget.category_id===tx.category_id;
    if(budget.merchant_id) return budget.merchant_id===tx.merchant_id;
    return false;
  });
}

export function isFixedBudget(budget, activeRecurringRules) {
  return activeRecurringRules.some((rule)=>{
    if(rule.direction!=='expense') return false;
    if(budget.category_id && rule.category_id===budget.category_id) return true;
    if(budget.merchant_id && rule.merchant_id===budget.merchant_id) return true;
    return false;
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
  const variableBudgetMonthly = variableBudgets.reduce((sum,budget)=>sum+Number(budget.amount||0),0);

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
  const unbudgetedActualVariableExpensesMonth = actualVariableTransactions
    .filter((tx)=>!budgetCoversTransaction(tx,variableBudgets))
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);

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
  const unbudgetedFutureExpensesMonth = plannedFutureExpenses
    .filter((tx)=>!budgetCoversTransaction(tx,variableBudgets))
    .reduce((sum,tx)=>sum+inBase(Math.abs(Number(tx.amount||0)),tx.currency),0);

  const plannedVariableMonthly =
    variableBudgetMonthly
    + unbudgetedActualVariableExpensesMonth
    + unbudgetedFutureExpensesMonth;

  const incomePlanMonthly = plannedIncomeRecurring>0 ? plannedIncomeRecurring : actualIncomeMonth;
  const incomePlanSource = plannedIncomeRecurring>0 ? 'recurring' : 'booked';
  const plannedCommitmentsMonthly = fixedExpensesMonthly + plannedVariableMonthly + fixedTransfersMonthly;
  const plannedFreeMonthly = incomePlanMonthly - plannedCommitmentsMonthly;

  const openBills = bills
    .filter((bill)=>['open','overdue'].includes(bill.status))
    .reduce((sum,bill)=>sum+inBase(bill.amount,bill.currency),0);
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
    actualVariableExpensesMonth,
    unbudgetedActualVariableExpensesMonth,
    plannedFutureExpensesMonth,
    unbudgetedFutureExpensesMonth,
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
