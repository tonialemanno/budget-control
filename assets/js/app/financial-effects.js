import { convertAmount } from './fx.js';

export function buildDebtPaymentTransactionMap(debtPayments = []) {
  const map = new Map();
  for (const payment of debtPayments) {
    if (!payment?.transaction_id || payment.reversed_at) continue;
    map.set(payment.transaction_id, payment);
  }
  return map;
}

export function cashOutflowBase(tx, baseCurrency, fxRates) {
  if (!tx || tx.status !== 'booked' || tx.transfer_group_id || Number(tx.amount) >= 0) return 0;
  return Math.abs(convertAmount(tx.amount, tx.currency, baseCurrency, fxRates) ?? 0);
}

export function consumptionExpenseBase(tx, paymentMap, baseCurrency, fxRates) {
  if (!tx || tx.status !== 'booked' || tx.transfer_group_id || Number(tx.amount) >= 0) return 0;
  if (tx.cashflow_type === 'receivable_principal') return 0;
  if (tx.cashflow_type !== 'debt_payment') return cashOutflowBase(tx, baseCurrency, fxRates);

  const payment = paymentMap?.get(tx.id);
  if (!payment) return 0;
  const cost = Number(payment.interest_amount || 0) + Number(payment.fee_amount || 0);
  return Math.max(0, convertAmount(cost, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
}

export function debtPrincipalBase(tx, paymentMap, baseCurrency, fxRates) {
  if (!tx || tx.cashflow_type !== 'debt_payment') return 0;
  const payment = paymentMap?.get(tx.id);
  if (!payment) return 0;
  return Math.max(0, convertAmount(payment.principal_amount, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
}

export function debtCostBase(tx, paymentMap, baseCurrency, fxRates) {
  if (!tx || tx.cashflow_type !== 'debt_payment') return 0;
  const payment = paymentMap?.get(tx.id);
  if (!payment) return 0;
  const cost = Number(payment.interest_amount || 0) + Number(payment.fee_amount || 0);
  return Math.max(0, convertAmount(cost, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
}
