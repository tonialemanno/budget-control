export const INCOME_KINDS = Object.freeze({
  salary:'Lohn',
  side_income:'Nebenverdienst',
  refund:'Rückerstattung',
  repayment:'Rückzahlung',
  sale:'Verkauf',
  gift:'Geschenk',
  other:'Sonstiges',
  not_income:'Keine Einnahme',
  unknown:'Ungeklärt',
});

function normalized(value) {
  return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
}

export function isSavingsLikeTransaction(tx) {
  if (!tx || Number(tx.amount)>=0) return false;
  const category=normalized(tx.categories?.name);
  const description=normalized(tx.description);
  return category==='sparen'
    || category==='rücklagen'
    || category==='sparziel'
    || /\b(sparkonto|sondertopf|sparen)\b/.test(description);
}

export function inferredIncomeKind(tx) {
  if (!tx || Number(tx.amount)<=0) return null;
  if (tx.analytics_excluded===true) return 'not_income';
  if (tx.transfer_group_id) return 'not_income';
  if (tx.cashflow_type==='receivable_principal') return 'repayment';
  if (tx.income_kind) return tx.income_kind;

  const categoryName=normalized(tx.categories?.name);
  const categoryKind=tx.categories?.kind;
  if (categoryKind==='income') {
    if (/\b(lohn|gehalt|salary|stipendio|salario)\b/.test(categoryName)) return 'salary';
    return 'side_income';
  }
  if (categoryKind==='expense') return 'refund';
  return 'unknown';
}

export function incomeKindLabel(kind) {
  return INCOME_KINDS[kind]||INCOME_KINDS.unknown;
}

export function countsAsEarnedIncome(tx) {
  const kind=inferredIncomeKind(tx);
  return !tx?.analytics_excluded && ['salary','side_income','sale','gift','other'].includes(kind);
}

export function countsAsCashIncome(tx) {
  if (!tx || tx.status!=='booked' || Number(tx.amount)<=0 || tx.transfer_group_id || tx.analytics_excluded===true) return false;
  return inferredIncomeKind(tx)!=='not_income';
}

export function needsIncomeReview(tx) {
  return Boolean(
    tx
    && tx.status==='booked'
    && Number(tx.amount)>0
    && !tx.transfer_group_id
    && tx.cashflow_type!=='receivable_principal'
    && tx.analytics_excluded!==true
    && inferredIncomeKind(tx)==='unknown'
  );
}

export function incomeSourceLabel(tx) {
  return tx?.merchants?.name || tx?.counterparty || tx?.description || 'Unbekannt';
}
