export const APP_CONFIG = Object.freeze({
  appName: 'Finance',
  version: '2.3.0-beta-1',
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
  { route: 'overview', label: 'Übersicht', icon: 'home', group: 'Finance Core', module: 'core', mobile: true },
  { route: 'accounts', label: 'Konten', icon: 'wallet', group: 'Finance Core', module: 'money', mobile: true },
  { route: 'transactions', label: 'Transaktionen', icon: 'list', group: 'Finance Core', module: 'money', mobile: true },
  { route: 'imports', label: 'Datenimport', icon: 'arrow-down-left', group: 'Finance Core', module: 'money' },
  { route: 'recurring', label: 'Wiederkehrend', icon: 'repeat', group: 'Finance Core', module: 'money' },
  { route: 'documents', label: 'Dokumente', icon: 'receipt', group: 'Finance Core', module: 'core' },

  { route: 'budget', label: 'Budget', icon: 'chart', group: 'Planung', module: 'budget', mobile: true },
  { route: 'bills', label: 'Rechnungen & Verträge', icon: 'receipt', group: 'Planung', module: 'bills', mobile: true },
  { route: 'goals', label: 'Sparziele', icon: 'target', group: 'Planung', module: 'goals' },
  { route: 'tax-advisor', label: 'Steuerberater', icon: 'receipt', group: 'Planung', module: 'tax' },

  { route: 'debts', label: 'Schulden & Kredite', icon: 'credit-card', group: 'Verbindlichkeiten', module: 'debts' },
  { route: 'legal', label: 'Mahnung / Betreibung', icon: 'shield', group: 'Verbindlichkeiten', module: 'legal' },

  { route: 'family', label: 'Familie & Haushalt', icon: 'heart-pulse', group: 'Haushalt', module: 'family' },

  { route: 'wealth', label: 'Vermögen', icon: 'sparkles', group: 'Vermögen', module: 'wealth' },
  { route: 'property', label: 'Immobilien', icon: 'home', group: 'Vermögen', module: 'property' },
  { route: 'vehicles', label: 'Fahrzeuge', icon: 'train', group: 'Vermögen', module: 'vehicles' },
  { route: 'insurance', label: 'Versicherungen', icon: 'shield', group: 'Vermögen', module: 'insurance' },
  { route: 'investments', label: 'Investments', icon: 'chart', group: 'Vermögen', module: 'investments' },
  { route: 'pension', label: 'Vorsorge', icon: 'piggy-bank', group: 'Vermögen', module: 'pension' },

  { route: 'intelligence', label: 'Finance Intelligence', icon: 'sparkles', group: 'Analyse', module: 'intelligence' },
  { route: 'admin', label: 'Admin', icon: 'shield', group: 'Administration', module: 'admin', adminOnly: true },
]);

export const PAGE_META = Object.freeze({
  overview: { title: 'Übersicht', eyebrow: 'Finance Core' },
  accounts: { title: 'Konten', eyebrow: 'Mein Geld' },
  transactions: { title: 'Transaktionen', eyebrow: 'Mein Geld' },
  categories: { title: 'Kategorien & Regeln', eyebrow: 'Einstellungen' },
  imports: { title: 'Datenimport', eyebrow: 'Mein Geld' },
  'import-history': { title: 'Import-Historie', eyebrow: 'Mein Geld' },
  recurring: { title: 'Wiederkehrende Zahlungen', eyebrow: 'Mein Geld' },
  documents: { title: 'Dokumente', eyebrow: 'Finance Core' },
  budget: { title: 'Budget', eyebrow: 'Budget & Planung' },
  bills: { title: 'Rechnungen & Verträge', eyebrow: 'Rechnungen & Verträge' },
  goals: { title: 'Sparziele', eyebrow: 'Sparen & Ziele' },
  'tax-advisor': { title: 'Steuerberater', eyebrow: 'Steuern & Export' },
  debts: { title: 'Schulden & Kredite', eyebrow: 'Schulden & Kredite' },
  legal: { title: 'Mahnung / Betreibung', eyebrow: 'Forderungen' },
  family: { title: 'Familie & Haushalt', eyebrow: 'Haushalt' },
  wealth: { title: 'Vermögen', eyebrow: 'Vermögen' },
  property: { title: 'Immobilien', eyebrow: 'Vermögen' },
  vehicles: { title: 'Fahrzeuge', eyebrow: 'Vermögen' },
  insurance: { title: 'Versicherungen', eyebrow: 'Vermögen' },
  investments: { title: 'Investments', eyebrow: 'Vermögen' },
  pension: { title: 'Vorsorge', eyebrow: 'Vermögen' },
  intelligence: { title: 'Finance Intelligence', eyebrow: 'Analyse' },
  settings: { title: 'Einstellungen', eyebrow: 'Finance Core' },
  admin: { title: 'Administration', eyebrow: 'System' },
});
