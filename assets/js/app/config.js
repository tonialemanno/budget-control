export const APP_CONFIG = Object.freeze({
  appName: 'Finance',
  country: 'CH',
  currency: 'CHF',
  locale: 'de-CH',
  version: '1.0.0-style',
});

export const NAV_ITEMS = Object.freeze([
  { route: 'overview', label: 'Übersicht', icon: 'home', group: 'Finance Core', module: 'core', mobile: true },
  { route: 'accounts', label: 'Konten', icon: 'wallet', group: 'Finance Core', module: 'money', mobile: true },
  { route: 'transactions', label: 'Transaktionen', icon: 'list', group: 'Finance Core', module: 'money', mobile: false },
  { route: 'budget', label: 'Budget', icon: 'chart', group: 'Planung', module: 'budget', mobile: true },
  { route: 'bills', label: 'Rechnungen', icon: 'receipt', group: 'Planung', module: 'bills', mobile: true },
  { route: 'goals', label: 'Sparziele', icon: 'target', group: 'Planung', module: 'goals', mobile: false },
  { route: 'debts', label: 'Schulden', icon: 'credit-card', group: 'Vermögen', module: 'debts', mobile: false },
  { route: 'wealth', label: 'Vermögen', icon: 'sparkles', group: 'Vermögen', module: 'wealth', mobile: true },
]);

export const MODULES = Object.freeze({
  core: { label: 'Finance Core', enabled: true, locked: true },
  money: { label: 'Mein Geld', enabled: true },
  budget: { label: 'Budget & Planung', enabled: true },
  bills: { label: 'Rechnungen & Verträge', enabled: true },
  goals: { label: 'Sparen & Ziele', enabled: true },
  debts: { label: 'Schulden & Kredite', enabled: true },
  wealth: { label: 'Vermögen', enabled: true },
  investments: { label: 'Investments', enabled: false },
  intelligence: { label: 'Finance Intelligence', enabled: false },
});

export const PAGE_META = Object.freeze({
  overview: { title: 'Übersicht', eyebrow: 'Finance Core' },
  accounts: { title: 'Konten', eyebrow: 'Mein Geld' },
  transactions: { title: 'Transaktionen', eyebrow: 'Mein Geld' },
  budget: { title: 'Budget', eyebrow: 'Budget & Planung' },
  bills: { title: 'Rechnungen', eyebrow: 'Rechnungen & Verträge' },
  goals: { title: 'Sparziele', eyebrow: 'Sparen & Ziele' },
  debts: { title: 'Schulden', eyebrow: 'Schulden & Kredite' },
  wealth: { title: 'Vermögen', eyebrow: 'Vermögen' },
  settings: { title: 'Einstellungen', eyebrow: 'Finance Core' },
});
