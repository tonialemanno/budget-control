function releaseChannel() {
  if (typeof location === 'undefined') return 'stable';
  const host = String(location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  if (host.startsWith('beta.')) return 'beta';
  if (host.endsWith('.aione-test.pages.dev') && host !== 'aione-test.pages.dev') return 'beta';
  return 'stable';
}

export const APP_CONFIG = Object.freeze({
  appName: 'Finance',
  version: '2.4.6',
  releaseId: '2026.10.06-r32',
  schemaVersion: 2026100504,
  releaseChannel: releaseChannel(),
  defaultCountry: 'CH',
  defaultCurrency: 'CHF',
  defaultLocale: 'de-CH',
});

export const MODULES = Object.freeze({
  core: { label: 'Finance Core', locked: true },
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
  intelligence: { label: 'Finance Intelligence' },
  admin: { label: 'Administration' },
});

export const NAV_ITEMS = Object.freeze([
  { route: 'overview', label: 'Übersicht', mobileLabel: 'Übersicht', icon: 'home', group: 'Start', module: 'core', primary: true, section: 'overview' },
  { route: 'review', label: 'Prüfen', mobileLabel: 'Prüfen', icon: 'check-circle', group: 'Start', module: 'core', primary: true, section: 'review' },
  { route: 'money', label: 'Geld', mobileLabel: 'Geld', icon: 'wallet', group: 'Start', module: 'core', primary: true, section: 'money' },
  { route: 'planning', label: 'Planung', mobileLabel: 'Planung', icon: 'target', group: 'Start', module: 'core', primary: true, section: 'planning' },

  { route: 'accounts', label: 'Konten', icon: 'wallet', group: 'Geld', module: 'money', section: 'money' },
  { route: 'transactions', label: 'Transaktionen', icon: 'list', group: 'Geld', module: 'money', section: 'money' },
  { route: 'imports', label: 'Datenimport', icon: 'arrow-down-left', group: 'Geld', module: 'money', section: 'money' },
  { route: 'documents', label: 'Dokumente', icon: 'receipt', group: 'Geld', module: 'core', section: 'money' },
  { route: 'projects', label: 'Anlässe & Projekte', icon: 'folder', group: 'Geld', module: 'core', section: 'money' },
  { route: 'debts', label: 'Schulden & Kredite', icon: 'credit-card', group: 'Geld', module: 'debts', section: 'money' },
  { route: 'receivables', label: 'Forderungen', icon: 'banknote', group: 'Geld', module: 'debts', section: 'money' },
  { route: 'legal', label: 'Mahnung / Betreibung', icon: 'shield', group: 'Geld', module: 'legal', section: 'money' },

  { route: 'budget', label: 'Budget', icon: 'chart', group: 'Planung', module: 'budget', section: 'planning' },
  { route: 'fixed-costs', label: 'Feste Zahlungen', icon: 'receipt', group: 'Planung', module: 'money', section: 'planning' },
  { route: 'recurring', label: 'Automatik im Detail', icon: 'repeat', group: 'Planung', module: 'money', section: 'planning' },
  { route: 'bills', label: 'Rechnungen & Verträge', icon: 'receipt', group: 'Planung', module: 'bills', section: 'planning' },
  { route: 'goals', label: 'Sparziele', icon: 'target', group: 'Planung', module: 'goals', section: 'planning' },
  { route: 'tax-advisor', label: 'Steuern', icon: 'receipt', group: 'Planung', module: 'tax', section: 'planning' },
  { route: 'family', label: 'Familie & Haushalt', icon: 'heart-pulse', group: 'Weitere Bereiche', module: 'family', section: 'planning' },
  { route: 'wealth', label: 'Vermögen', icon: 'sparkles', group: 'Weitere Bereiche', module: 'wealth', section: 'planning' },
  { route: 'property', label: 'Immobilien', icon: 'home', group: 'Weitere Bereiche', module: 'property', section: 'planning' },
  { route: 'vehicles', label: 'Fahrzeuge', icon: 'train', group: 'Weitere Bereiche', module: 'vehicles', section: 'planning' },
  { route: 'insurance', label: 'Versicherungen', icon: 'shield', group: 'Weitere Bereiche', module: 'insurance', section: 'planning' },
  { route: 'investments', label: 'Investments', icon: 'chart', group: 'Weitere Bereiche', module: 'investments', section: 'planning' },
  { route: 'pension', label: 'Vorsorge', icon: 'piggy-bank', group: 'Weitere Bereiche', module: 'pension', section: 'planning' },
  { route: 'intelligence', label: 'Finance Intelligence', icon: 'sparkles', group: 'Weitere Bereiche', module: 'intelligence', section: 'planning' },

  { route: 'admin', label: 'Admin', icon: 'shield', group: 'Administration', module: 'admin', adminOnly: true, section: 'settings' },
]);

export const PAGE_META = Object.freeze({
  overview: { title: 'Übersicht', eyebrow: 'Finance' },
  review: { title: 'Zu prüfen', eyebrow: 'Finance' },
  search: { title: 'Suchen', eyebrow: 'Finance' },
  projects: { title: 'Anlässe & Projekte', eyebrow: 'Geld' },
  money: { title: 'Geld', eyebrow: 'Finance' },
  planning: { title: 'Planung', eyebrow: 'Finance' },
  setup: { title: 'Einrichtung', eyebrow: 'Finance' },
  profile: { title: 'Mein Profil', eyebrow: 'Finance' },
  accounts: { title: 'Konten', eyebrow: 'Geld' },
  transactions: { title: 'Transaktionen', eyebrow: 'Geld' },
  categories: { title: 'Kategorien & Regeln', eyebrow: 'Einstellungen' },
  merchants: { title: 'Händler', eyebrow: 'Einstellungen' },
  imports: { title: 'Datenimport', eyebrow: 'Geld' },
  'import-history': { title: 'Import-Historie', eyebrow: 'Geld' },
  recurring: { title: 'Automatik im Detail', eyebrow: 'Planung' },
  'fixed-costs': { title: 'Feste Zahlungen', eyebrow: 'Planung' },
  documents: { title: 'Dokumente', eyebrow: 'Geld' },
  budget: { title: 'Budget', eyebrow: 'Planung' },
  bills: { title: 'Rechnungen & Verträge', eyebrow: 'Planung' },
  goals: { title: 'Sparziele', eyebrow: 'Planung' },
  'tax-advisor': { title: 'Steuern', eyebrow: 'Planung' },
  debts: { title: 'Schulden & Kredite', eyebrow: 'Geld' },
  receivables: { title: 'Forderungen', eyebrow: 'Geld' },
  legal: { title: 'Mahnung / Betreibung', eyebrow: 'Geld' },
  family: { title: 'Familie & Haushalt', eyebrow: 'Planung' },
  wealth: { title: 'Vermögen', eyebrow: 'Planung' },
  property: { title: 'Immobilien', eyebrow: 'Planung' },
  vehicles: { title: 'Fahrzeuge', eyebrow: 'Planung' },
  insurance: { title: 'Versicherungen', eyebrow: 'Planung' },
  investments: { title: 'Investments', eyebrow: 'Planung' },
  pension: { title: 'Vorsorge', eyebrow: 'Planung' },
  intelligence: { title: 'Finance Intelligence', eyebrow: 'Planung' },
  settings: { title: 'Einstellungen', eyebrow: 'Finance' },
  admin: { title: 'Administration', eyebrow: 'System' },
});
