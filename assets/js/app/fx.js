export function fxRate(fx, currency) {
  if (!currency) return null;
  if (currency === 'CHF') return 1;
  const value = Number(fx?.rates?.[currency]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function convertAmount(value, fromCurrency, toCurrency, fx) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  const from = fromCurrency || 'CHF';
  const to = toCurrency || 'CHF';
  if (from === to) return amount;
  const fromChf = fxRate(fx, from);
  const toChf = fxRate(fx, to);
  if (!fromChf || !toChf) return null;
  return amount * fromChf / toChf;
}

export function sumInCurrency(rows, valueSelector, currencySelector, targetCurrency, fx) {
  let total = 0;
  let complete = true;
  for (const row of rows || []) {
    const converted = convertAmount(valueSelector(row), currencySelector(row), targetCurrency, fx);
    if (converted === null) { complete = false; continue; }
    total += converted;
  }
  return { total, complete };
}

export function fxLabel(fx, targetCurrency = 'CHF') {
  if (!fx?.rates) return 'Kein verlässlicher FX-Kurs geladen.';
  const asOf = fx.as_of ? String(fx.as_of) : 'unbekannt';
  if (targetCurrency === 'CHF') return `SNB Monatsmittel · Stand ${asOf}`;
  return `SNB Monatsmittel via CHF · Stand ${asOf}`;
}
