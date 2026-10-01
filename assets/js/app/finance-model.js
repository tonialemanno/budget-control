import { cadenceMonthlyFactor, localMonthKey } from './format.js';
import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './financial-effects.js';

function isActiveRecurring(rule, today) {
  return rule?.active !== false && (!rule?.end_date || String(rule.end_date).slice(0,10) >= today);
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

  const fixedCategoryIds = new Set(
    activeRecurring
      .filter((rule)=>rule.direction==='expense' && rule.category_id)
      .map((rule)=>rule.category_id)
  );

  const monthBudgets = budgets.filter((budget)=>String(budget.month_start).slice(0,7)===monthKey);
  const plannedVariableMonthly = monthBudgets
    .filter((budget)=>!budget.category_id || !fixedCategoryIds.has(budget.category_id))
    .reduce((sum,budget)=>sum+Number(budget.amount||0),0);

  const paymentMap = buildDebtPaymentTransactionMap(debtPayments);
  const bookedMonth = transactions.filter((tx)=>
    tx.status==='booked'
    && localMonthKey(tx.occurred_at)===monthKey
    && !tx.transfer_group_id
  );
  const actualIncomeMonth = bookedMonth
    .filter((tx)=>Number(tx.amount)>0 && tx.cashflow_type!=='receivable_principal')
    .reduce((sum,tx)=>sum+inBase(tx.amount,tx.currency),0);
  const actualExpensesMonth = bookedMonth
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);

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
    .filter((tx)=>tx.status==='booked' && !tx.transfer_group_id && new Date(tx.occurred_at)>=ninety)
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
  };
}
