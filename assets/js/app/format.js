import { APP_CONFIG } from './config.js';

export function money(value, { sign = false, decimals = 2 } = {}) {
  const formatter = new Intl.NumberFormat(APP_CONFIG.locale, {
    style: 'currency',
    currency: APP_CONFIG.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: sign ? 'exceptZero' : 'auto',
  });
  return formatter.format(value).replace(/\u00a0/g, ' ');
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

export function progress(current, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}
