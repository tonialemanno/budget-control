import { APP_CONFIG } from './config.js';

export function money(value, {
  sign = false,
  decimals = 2,
  currency = APP_CONFIG.currency,
  locale = APP_CONFIG.locale,
} = {}) {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: sign ? 'exceptZero' : 'auto',
  });
  return formatter.format(Number(value || 0)).replace(/\u00a0/g, ' ');
}

export function percent(value, decimals = 0) {
  return new Intl.NumberFormat(APP_CONFIG.locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

export function shortDate(date = new Date()) {
  return new Intl.DateTimeFormat(APP_CONFIG.locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function dateLabel(value, locale = APP_CONFIG.locale) {
  if (!value) return '';
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function dateTimeLocalValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
  if (!target) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}
