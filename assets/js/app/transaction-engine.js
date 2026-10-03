function required(value, message) {
  if (value === null || value === undefined || value === '') throw new Error(message);
  return value;
}

function positive(value, message) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(message);
  return amount;
}

export function merchantDefaultCategory(merchantId, explicitCategoryId, merchants = []) {
  if (explicitCategoryId) return explicitCategoryId;
  if (!merchantId) return null;
  return merchants.find((merchant)=>merchant.id===merchantId)?.default_category_id || null;
}

export function signedAmount(direction, amount) {
  const value = positive(amount, 'Der Betrag muss grösser als 0 sein.');
  if (direction === 'expense') return -value;
  if (direction === 'income') return value;
  throw new Error('Unbekannte Buchungsrichtung.');
}

export function taxPaymentDirection(paymentType) {
  return ['refund','interest_credit'].includes(paymentType) ? 'income' : 'expense';
}

export function taxPaymentTreatment(paymentType) {
  return ['refund','interest_credit'].includes(paymentType) ? 'tax_refund' : 'tax_payment';
}

export async function createEconomicTransaction({
  api,
  householdId,
  account,
  direction,
  amount,
  categoryId = null,
  merchantId = null,
  merchants = [],
  occurredAt,
  description,
  counterparty = null,
  note = null,
  source = 'manual',
  status = 'booked',
  tax = null,
}) {
  required(api, 'Finance API fehlt.');
  required(householdId, 'Haushalt fehlt.');
  required(account?.account_id, 'Bitte ein Konto auswählen.');
  const resolvedCategoryId = merchantDefaultCategory(merchantId, categoryId, merchants);
  const payload = {
    household_id: householdId,
    account_id: account.account_id,
    category_id: resolvedCategoryId,
    merchant_id: merchantId || null,
    occurred_at: required(occurredAt, 'Datum fehlt.'),
    amount: signedAmount(direction, amount),
    currency: account.currency,
    description: required(String(description || '').trim(), 'Beschreibung fehlt.'),
    counterparty: counterparty || null,
    note: note || null,
    status,
    source,
  };
  if (tax?.enabled) {
    payload.tax_relevant = true;
    payload.tax_category = tax.category || null;
    payload.tax_year = tax.year || new Date(occurredAt).getFullYear();
    payload.tax_treatment = tax.treatment || (direction === 'income' ? 'income' : 'deduction');
    payload.tax_section_key = tax.sectionKey || (direction === 'income' ? 'income' : 'work_expenses');
  } else if (tax) {
    payload.tax_relevant = false;
    payload.tax_category = null;
    payload.tax_year = null;
    payload.tax_treatment = null;
    payload.tax_section_key = null;
  }
  return api.createTransaction(payload);
}

export async function createEconomicTransfer({
  api, householdId, fromAccount, toAccount, fromAmount, toAmount = null, occurredAt, description = 'Umbuchung',
}) {
  required(fromAccount?.account_id, 'Quellkonto fehlt.');
  required(toAccount?.account_id, 'Zielkonto fehlt.');
  if (fromAccount.account_id === toAccount.account_id) throw new Error('Quell- und Zielkonto müssen unterschiedlich sein.');
  const debit = positive(fromAmount, 'Der Abgangsbetrag muss grösser als 0 sein.');
  const credit = fromAccount.currency === toAccount.currency
    ? debit
    : positive(toAmount, 'Bei einem Währungswechsel muss der Zielbetrag angegeben werden.');
  return api.createTransfer({
    p_household_id: householdId,
    p_from_account_id: fromAccount.account_id,
    p_to_account_id: toAccount.account_id,
    p_from_amount: debit,
    p_to_amount: credit,
    p_occurred_at: occurredAt,
    p_description: description || 'Umbuchung',
  });
}

export async function recordDebtMovement({
  api, householdId, debt, amount, principalAmount, interestAmount = 0, feeAmount = 0,
  paidAt, source, paymentAccountId = null, transactionId = null, note = null, advanceNextDate = false,
}) {
  required(debt?.id, 'Schuld wurde nicht gefunden.');
  const total = positive(amount, 'Bitte einen gültigen Zahlungsbetrag eingeben.');
  const principal = Number(principalAmount);
  const interest = Number(interestAmount || 0);
  const fee = Number(feeAmount || 0);
  if (![principal,interest,fee].every(Number.isFinite) || principal < 0 || interest < 0 || fee < 0) throw new Error('Bitte gültige Zahlungsbeträge eingeben.');
  if (Math.abs(total - (principal + interest + fee)) > 0.005) throw new Error('Zahlung gesamt muss Tilgung + Zins + Gebühren entsprechen.');
  if (principal > Number(debt.outstanding_amount || 0) + 0.005) throw new Error('Die Tilgung ist höher als die Restschuld.');
  if (source === 'created_transaction') required(paymentAccountId, 'Bitte ein Zahlungskonto auswählen.');
  if (source === 'linked_transaction') required(transactionId, 'Bitte eine bestehende Buchung auswählen.');
  if (!['created_transaction','linked_transaction','history_only'].includes(source)) throw new Error('Unbekannte Zahlungsart.');
  return api.createDebtPayment({
    household_id: householdId,
    debt_id: debt.id,
    paid_at: paidAt,
    amount: total,
    principal_amount: principal,
    interest_amount: interest,
    fee_amount: fee,
    currency: debt.currency,
    source,
    payment_account_id: source === 'created_transaction' ? paymentAccountId : null,
    transaction_id: source === 'linked_transaction' ? transactionId : null,
    note,
    advance_next_date: Boolean(advanceNextDate),
  });
}

export async function createReceivableMovement({
  api, householdId, debtor, reason, amount, currency, lentAt, dueDate = null, notes = null, sourceAccountId = null,
}) {
  const value = positive(amount, 'Bitte einen gültigen Forderungsbetrag eingeben.');
  return api.createReceivable({
    householdId,
    debtor: required(String(debtor || '').trim(), 'Person fehlt.'),
    reason: required(String(reason || '').trim(), 'Grund fehlt.'),
    originalAmount: value,
    currency,
    lentAt,
    dueDate,
    notes,
    sourceAccountId,
    createTransaction: Boolean(sourceAccountId),
  });
}

export async function recordReceivableMovement({
  api, householdId, receivable, amount, paidAt, note = null, paymentAccountId = null, createTransaction = true,
}) {
  required(receivable?.id, 'Forderung wurde nicht gefunden.');
  const value = positive(amount, 'Bitte einen gültigen Rückzahlungsbetrag eingeben.');
  if (value > Number(receivable.outstanding_amount || 0) + 0.005) throw new Error('Die Rückzahlung ist höher als der offene Betrag.');
  if (createTransaction) required(paymentAccountId, 'Bitte ein Zahlungskonto auswählen.');
  return api.recordReceivablePayment({
    householdId,
    receivableId: receivable.id,
    amount: value,
    paidAt,
    note,
    paymentAccountId: createTransaction ? paymentAccountId : null,
    createTransaction: Boolean(createTransaction),
  });
}

export async function recordBillMovement({
  api, householdId, bill, source, paidAt = null, accountId = null, transactionId = null,
}) {
  required(bill?.id, 'Rechnung wurde nicht gefunden.');
  if (source === 'created_transaction') required(accountId || bill.account_id, 'Bitte ein Zahlungskonto auswählen.');
  if (source === 'linked_transaction') required(transactionId, 'Bitte eine bestehende Buchung auswählen.');
  if (!['created_transaction','linked_transaction'].includes(source)) throw new Error('Unbekannte Zahlungsart.');
  return api.payBill({ householdId, billId: bill.id, source, paidAt, accountId, transactionId });
}

export async function recordTaxMovement({
  api,
  householdId,
  taxCase,
  obligationId = null,
  paymentType = 'payment',
  amount,
  paidAt,
  reference = null,
  notes = null,
  source = 'created_transaction',
  account = null,
  transaction = null,
}) {
  required(taxCase?.id, 'Steuerfall wurde nicht gefunden.');
  const value = positive(amount, 'Bitte einen gültigen Steuerbetrag eingeben.');
  const currency = taxCase.currency || 'CHF';
  const treatment = taxPaymentTreatment(paymentType);
  let transactionId = null;
  let createdTransactionId = null;

  if (source === 'created_transaction') {
    required(account?.account_id, 'Bitte ein Zahlungskonto auswählen.');
    if (account.currency !== currency) throw new Error('Steuerfall und Zahlungskonto müssen dieselbe Währung haben.');
    const direction = taxPaymentDirection(paymentType);
    const tx = await createEconomicTransaction({
      api,
      householdId,
      account,
      direction,
      amount: value,
      occurredAt: String(paidAt).length === 10 ? `${paidAt}T12:00:00` : paidAt,
      description: treatment === 'tax_refund' ? `Steuerrückerstattung ${taxCase.tax_year}` : `Steuerzahlung ${taxCase.tax_year}`,
      counterparty: 'Steuerverwaltung',
      note: reference || notes || null,
      tax: {
        enabled: true,
        year: Number(taxCase.tax_year),
        treatment,
        sectionKey: 'tax_account',
        category: treatment === 'tax_refund' ? 'Steuerrückerstattung' : 'Steuerzahlung',
      },
    });
    transactionId = tx?.id || null;
    createdTransactionId = transactionId;
    if (!transactionId) throw new Error('Kontobuchung konnte nicht erstellt werden.');
  } else if (source === 'linked_transaction') {
    required(transaction?.id, 'Bitte eine bestehende Buchung auswählen.');
    if (transaction.currency !== currency) throw new Error('Steuerfall und Buchung müssen dieselbe Währung haben.');
    const expectedSign = taxPaymentDirection(paymentType) === 'income' ? 1 : -1;
    if (Math.sign(Number(transaction.amount)) !== expectedSign) throw new Error('Die Richtung der Buchung passt nicht zur Steuerzahlung.');
    if (Math.abs(Math.abs(Number(transaction.amount)) - value) > 0.005) throw new Error('Betrag der Buchung und Steuerzahlung müssen übereinstimmen.');
    transactionId = transaction.id;
    await api.updateTransaction(transaction.id, {
      tax_relevant: true,
      tax_year: Number(taxCase.tax_year),
      tax_treatment: treatment,
      tax_section_key: 'tax_account',
      tax_category: treatment === 'tax_refund' ? 'Steuerrückerstattung' : 'Steuerzahlung',
    });
  } else if (source !== 'history_only') {
    throw new Error('Unbekannte Zahlungsart.');
  }

  try {
    return await api.createTaxPayment({
      household_id: householdId,
      tax_case_id: taxCase.id,
      obligation_id: obligationId || null,
      payment_type: paymentType,
      amount: value,
      currency,
      paid_at: paidAt,
      transaction_id: transactionId,
      reference,
      notes,
    });
  } catch (error) {
    if (createdTransactionId) {
      try { await api.deleteTransaction(createdTransactionId); } catch {}
    }
    throw error;
  }
}
