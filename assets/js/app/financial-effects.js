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

function linkedPayment(tx,paymentMap){
  return tx?.id ? paymentMap?.get(tx.id) || null : null;
}

export function consumptionExpenseBase(tx, paymentMap, baseCurrency, fxRates) {
  if (!tx || tx.status !== 'booked' || tx.transfer_group_id || Number(tx.amount) >= 0) return 0;
  if (tx.cashflow_type === 'receivable_principal') return 0;

  const payment=linkedPayment(tx,paymentMap);
  if (tx.cashflow_type === 'debt_payment') {
    if (!payment) return 0;
    const cost = Number(payment.interest_amount || 0) + Number(payment.fee_amount || 0);
    return Math.max(0, convertAmount(cost, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
  }

  const cashOutflow=cashOutflowBase(tx,baseCurrency,fxRates);
  if(payment?.source!=='linked_transaction_component') return cashOutflow;

  // A provider bill may contain a debt installment (e.g. device leasing inside
  // a mobile bill). Only principal is a balance-sheet movement; service, fees
  // and interest remain consumption expense inside the one real bank movement.
  const principal=Math.max(0,convertAmount(
    payment.principal_amount,
    payment.currency||tx.currency,
    baseCurrency,
    fxRates
  )??0);
  return Math.max(0,cashOutflow-principal);
}

export function debtPrincipalBase(tx, paymentMap, baseCurrency, fxRates) {
  const payment=linkedPayment(tx,paymentMap);
  if (!payment) return 0;
  if (tx?.cashflow_type !== 'debt_payment' && payment.source !== 'linked_transaction_component') return 0;
  return Math.max(0, convertAmount(payment.principal_amount, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
}

export function debtCostBase(tx, paymentMap, baseCurrency, fxRates) {
  const payment=linkedPayment(tx,paymentMap);
  if (!payment) return 0;
  if (tx?.cashflow_type !== 'debt_payment' && payment.source !== 'linked_transaction_component') return 0;
  const cost = Number(payment.interest_amount || 0) + Number(payment.fee_amount || 0);
  return Math.max(0, convertAmount(cost, payment.currency || tx.currency, baseCurrency, fxRates) ?? 0);
}
