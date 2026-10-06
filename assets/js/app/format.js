import { APP_CONFIG } from './config.js';

export function moneyText(value, {
  sign = false,
  decimals = 2,
  currency = APP_CONFIG.defaultCurrency,
  locale = APP_CONFIG.defaultLocale,
} = {}) {
  const requestedDecimals=Number.isFinite(Number(decimals))?Number(decimals):2;
  const moneyDecimals=Math.max(2,requestedDecimals);
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: moneyDecimals,
    maximumFractionDigits: moneyDecimals,
    signDisplay: sign ? 'exceptZero' : 'auto',
  });
  return formatter.format(Number(value || 0)).replace(/\u00a0/g, ' ');
}

export function money(value, options = {}) {
  return `<span class="privacy-value">${moneyText(value, options)}</span>`;
}

export function percent(value, decimals = 0, locale = APP_CONFIG.defaultLocale) {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0) / 100);
  return `<span class="privacy-value">${formatted}</span>`;
}

export function shortDate(date = new Date(), locale = APP_CONFIG.defaultLocale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function dateLabel(value, locale = APP_CONFIG.defaultLocale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export function monthLabel(value, locale = APP_CONFIG.defaultLocale) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 7)}-01T12:00:00`);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

export function dateTimeLocalValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function dateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function financeEventTimestamp(value, now = new Date()) {
  const raw = String(value || '').trim();
  if (!raw) return now.toISOString();

  const day = raw.slice(0, 10);
  const today = dateInputValue(now);

  // datetime-local fields carry a real user-selected time. Preserve it, except
  // when the value is effectively "now" (inputs only have minute precision):
  // using the actual current instant avoids falling a few seconds before a
  // freshly-created account balance anchor.
  if (raw.includes('T')) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return now.toISOString();
    if (day === today && Math.abs(now.getTime() - date.getTime()) < 5 * 60_000) {
      return now.toISOString();
    }
    return date.toISOString();
  }

  // Date-only finance events entered for today are real immediately. Historical
  // and future dates use local noon to stay on the selected calendar day.
  if (day === today) return now.toISOString();
  const date = new Date(`${day}T12:00:00`);
  return Number.isNaN(date.getTime()) ? now.toISOString() : date.toISOString();
}

export function localMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export function monthInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 7);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function progress(current, target) {
  if (!Number(target)) return 0;
  return Math.max(0, Math.min(100, (Number(current || 0) / Number(target)) * 100));
}

export function cadenceMonthlyFactor(cadence) {
  return ({ monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12, weekly: 52 / 12, oneoff: 0, manual: 0 })[cadence] ?? 0;
}

export function sum(rows, selector) {
  return (rows || []).reduce((total, row) => total + Number(selector(row) || 0), 0);
}
