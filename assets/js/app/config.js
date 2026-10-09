function releaseChannel() {
  if (typeof location === 'undefined') return 'stable';
  const host = String(location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  if (host.startsWith('beta.')) return 'beta';
  if (host.endsWith('.aione-test.pages.dev') && host !== 'aione-test.pages.dev') return 'beta';
  return 'stable';
}

export const APP_CONFIG = Object.freeze({
  appName: 'ALEMANNO BUCHHALTUNG',
  version: '2.4.10',
  releaseId: '2026.10.09-r66',
  schemaVersion: 2026100802,
  releaseChannel: releaseChannel(),
  defaultCountry: 'CH',
  defaultCurrency: 'CHF',
  defaultLocale: 'de-CH',
});

export const MODULES = Object.freeze({
  core: { label: 'ALEMANNO BUCHHALTUNG', locked: true },
  money: { label: 'Mein Geld', locked: true },
  budget: { label: 'Budget & Planung' },
  bills: { label: 'Rechnungen & Verträge' },
  goals: { label: 'Sparen & Ziele' },
  tax: { label: 'Steuern & Steuerberater' },
  debts: { label: 'Schulden & Kredite' },
  legal: { label: 'Mahnung / Betreibung / Inkasso' },
  family: { label: 'Familie & Haushalt' },
  wealth: { label: 'Vermögen' },
  property: { label: 'Immobilien' },
  vehicles: { label: 'Fahrzeuge / Mobilität' },
  insurance: { label: 'Versicherungen' },
  investments: { label: 'Investments' },
  pension: { label: 'Vorsorge' },
  intelligence: { label: 'ALEMANNO BUCHHALTUNG Intelligence' },
  admin: { label: 'Administration' },
});

export { ROUTE_REGISTRY, NAV_ITEMS, PAGE_META } from './router.js';
