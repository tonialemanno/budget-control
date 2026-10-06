import { APP_CONFIG, MODULES, NAV_ITEMS, PAGE_META } from './app/config.js';
import { store } from './app/store.js';
import { backend } from './app/backend.js';
import { financeApi } from './app/finance-api.js';
import { dateInputValue, escapeHtml, dateTimeLocalValue, monthInputValue } from './app/format.js';
import { icon, hydrateStaticIcons } from './app/icons.js';
import { guessMapping, rowToTransaction, applyCategoryRules, transactionFingerprint, merchantFromTransaction, suggestKnownCategoryName } from './app/csv-import.js';
import { parseImportFile } from './app/import-file.js';
import { countryConfig } from './country/index.js';
import { convertAmount } from './app/fx.js';
import { buildCategorizationGroups } from './app/categorization.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './app/financial-effects.js';

import { renderOverview } from './views/overview.js';
import { renderAccounts } from './views/accounts.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderImports } from './views/imports.js';
import { renderImportHistory } from './views/import-history.js';
import { renderRecurring } from './views/recurring.js';
import { renderDocuments } from './views/documents.js';
import { renderBudget } from './views/budget.js';
import { renderBills } from './views/bills.js';
import { renderGoals } from './views/goals.js';
import { renderTaxAdvisor } from './views/tax-advisor.js';
import { renderDebts } from './views/debts.js';
import { renderReceivables } from './views/receivables.js';
import { renderLegal } from './views/legal.js';
import { renderFamily } from './views/family.js';
import { renderWealth } from './views/wealth.js';
import { renderProperty } from './views/property.js';
import { renderVehicles } from './views/vehicles.js';
import { renderInsurance } from './views/insurance.js';
import { renderInvestments } from './views/investments.js';
import { renderPension } from './views/pension.js';
import { renderIntelligence } from './views/intelligence.js';
import { renderSettings } from './views/settings.js';
import { renderAdmin } from './views/admin.js';

const views = {
  overview: renderOverview,
  accounts: renderAccounts,
  transactions: renderTransactions,
  categories: renderCategories,
  imports: renderImports,
  'import-history': renderImportHistory,
  recurring: renderRecurring,
  documents: renderDocuments,
  budget: renderBudget,
  bills: renderBills,
  goals: renderGoals,
  'tax-advisor': renderTaxAdvisor,
  debts: renderDebts,
  receivables: renderReceivables,
  legal: renderLegal,
  family: renderFamily,
  wealth: renderWealth,
  property: renderProperty,
  vehicles: renderVehicles,
  insurance: renderInsurance,
  investments: renderInvestments,
  pension: renderPension,
  intelligence: renderIntelligence,
  settings: renderSettings,
  admin: renderAdmin,
};

const runtime = {
  session: null,
  user: null,
  profile: null,
  household: null,
  householdRole: null,
  adminRole: null,
  moduleAccess: {},
  productModules: [],
  adminUsers: [],
  householdMembers: [],
  accounts: [],
  categories: [],
  categorizationRules: [],
  transactions: [],
  importBatches: [],
  merchants: [],
  recurringRules: [],
  budgets: [],
  bills: [],
  contracts: [],
  goals: [],
  goalSources: [],
  debts: [],
  debtPayments: [],
  receivables: [],
  receivablePayments: [],
  legalCases: [],
  legalEvents: [],
  assets: [],
  properties: [],
  vehicles: [],
  insurance: [],
  investments: [],
  investmentTransactions: [],
  pensions: [],
  documents: [],
  fxRates: null,
};

const importState = { file: null, parsed: null };
const uiState = { adminQuery: '', adminPage: 1, adminExpandedUserId: null, importQuery: '', importCategory: 'all', transactionView: 'summary', transactionPeriod: 'month', transactionQuery: '', transactionCategory: 'all', transactionAccount: 'all', transactionFrom: '', transactionTo: '', transactionPage: 1, categorizationOpen: false, categorizationFilter: 'action', categorizationPage: 1, debtExpandedId: null, receivableExpandedId: null, taxYear: new Date().getFullYear(), taxReceiptTxId: null };

const authGate = document.querySelector('#authGate');
const appShell = document.querySelector('#appShell');
const pageContent = document.querySelector('#pageContent');
const pageTitle = document.querySelector('#pageTitle');
const pageEyebrow = document.querySelector('#pageEyebrow');
const desktopNav = document.querySelector('#desktopNav');
const mobileNav = document.querySelector('#mobileNav');
const themeButton = document.querySelector('#themeButton');
const privacyButton = document.querySelector('#privacyButton');
const mobileMenuButton = document.querySelector('#mobileMenuButton');
const mobileScrim = document.querySelector('#mobileScrim');
const mobileLogoutButton = document.querySelector('#mobileLogoutButton');
const profileButton = document.querySelector('#profileButton');
const profileAvatar = document.querySelector('#profileAvatar');
const profileName = document.querySelector('#profileName');
const profileMeta = document.querySelector('#profileMeta');

function profilePreferences() {
  const value = runtime.profile?.preferences;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hiddenModuleKeys() {
  const value = profilePreferences().hidden_modules;
  return Array.isArray(value) ? value.filter((key)=>typeof key === 'string') : [];
}

function privacyEnabled() {
  return profilePreferences().privacy_enabled === true;
}

function moduleEntitled(moduleKey) {
  if (moduleKey === 'admin') return Boolean(runtime.adminRole);
  if (MODULES[moduleKey]?.locked) return true;
  return runtime.moduleAccess[moduleKey] === true;
}

function moduleEnabled(moduleKey) {
  if (!moduleEntitled(moduleKey)) return false;
  if (moduleKey === 'admin' || MODULES[moduleKey]?.locked) return true;
  return !hiddenModuleKeys().includes(moduleKey);
}

async function saveUserPreferences(patch) {
  const preferences = { ...profilePreferences(), ...patch };
  runtime.profile = await financeApi.updateProfile(runtime.user.id, { preferences });
  applyPrivacyUI();
  updateProfileUI();
  return preferences;
}

function applyPrivacyUI() {
  const enabled = privacyEnabled();
  document.documentElement.classList.toggle('privacy-mode', enabled);
  if (privacyButton) {
    privacyButton.innerHTML = icon(enabled ? 'eye' : 'eye-off');
    privacyButton.setAttribute('aria-label', enabled ? 'Finanzwerte anzeigen' : 'Finanzwerte verbergen');
    privacyButton.title = enabled ? 'Finanzwerte anzeigen' : 'Finanzwerte verbergen';
    privacyButton.setAttribute('aria-pressed', String(enabled));
  }
}

function canWriteHousehold() {
  return ['owner','admin','editor'].includes(runtime.householdRole);
}

function canAdminHousehold() {
  return ['owner','admin'].includes(runtime.householdRole);
}

function householdRoleLabel(role) {
  return ({ owner:'Owner', admin:'Haushalt-Admin', editor:'Editor', viewer:'Nur lesen' })[role] || 'Keine Rolle';
}

function enabledNavItems() {
  return NAV_ITEMS.filter((item) => moduleEnabled(item.module) && (!item.adminOnly || Boolean(runtime.adminRole)));
}

function renderNavigation() {
  const grouped = enabledNavItems().reduce((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  desktopNav.innerHTML = Object.entries(grouped).map(([group, links]) => `
    <div class="nav-group-label">${escapeHtml(group)}</div>
    ${links.map((item) => `<a class="nav-item" href="#/${item.route}" data-route="${item.route}">${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`).join('')}
  `).join('');

  mobileNav.innerHTML = enabledNavItems().filter((item) => item.mobile).slice(0, 5)
    .map((item) => `<a href="#/${item.route}" data-route="${item.route}">${icon(item.icon)}<span>${escapeHtml(item.mobileLabel || item.label)}</span></a>`).join('');
}

function resolveRoute() {
  const requested = (location.hash || '#/overview').replace(/^#\//, '').split('?')[0];
  const allowed = new Set([...enabledNavItems().map((item) => item.route), 'settings']);
  if (moduleEntitled('money')) { allowed.add('categories'); allowed.add('import-history'); }
  return allowed.has(requested) ? requested : 'overview';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const current = store.getState().theme;
  store.setState({ theme: order[(order.indexOf(current) + 1) % order.length] }, { persistPreferences: true });
}

function closeMobileNav() {
  document.body.classList.remove('mobile-nav-open');
  mobileMenuButton?.setAttribute('aria-expanded', 'false');
  if (mobileScrim) mobileScrim.hidden = true;
}

function syncMobileScrollState() {
  const compact = window.matchMedia('(max-width: 660px)').matches && window.scrollY > 46;
  document.body.classList.toggle('mobile-title-collapsed', compact);
}

function updateProfileUI() {
  const fallbackName = runtime.user?.email?.split('@')[0] || 'Privat';
  const name = runtime.profile?.display_name || fallbackName;
  profileAvatar.textContent = name.trim().charAt(0).toUpperCase() || 'F';
  profileName.textContent = name;
  profileMeta.textContent = runtime.user?.email || '';
  profileButton?.setAttribute('aria-label', `Konto und Zugriff – ${runtime.user?.email || name}`);
}

function profileMenuHtml() {
  const hidden = new Set(hiddenModuleKeys());
  const entitled = (runtime.productModules || []).filter((m)=>m.is_core || runtime.moduleAccess[m.key] === true);
  const available = (runtime.productModules || []).filter((m)=>!m.is_core && runtime.moduleAccess[m.key] !== true);
  const visible = entitled.filter((m)=>!hidden.has(m.key));
  return `<div class="profile-popover-card">
    <div class="profile-popover-head"><span class="profile-avatar">${escapeHtml((runtime.profile?.display_name || runtime.user?.email || 'F').charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(runtime.profile?.display_name || 'Finance Benutzer')}</strong><span>${escapeHtml(runtime.user?.email || '')}</span></div></div>
    <div class="profile-access-grid"><span>Haushaltsrolle<strong>${escapeHtml(householdRoleLabel(runtime.householdRole))}</strong></span><span>Systemrolle<strong>${escapeHtml(runtime.adminRole ? `App-${runtime.adminRole}` : 'Benutzer')}</strong></span></div>
    <div class="profile-module-section"><strong>Meine Navigation</strong><span class="profile-muted">${visible.length} sichtbar · ${entitled.length} freigeschaltet</span><div class="chip-row">${visible.map((m)=>`<span class="chip chip--active">${escapeHtml(m.label)}</span>`).join('')}</div></div>
    <div class="profile-module-section"><strong>Weitere Module</strong>${available.length?`<div class="chip-row">${available.map((m)=>`<span class="chip">${escapeHtml(m.label)}</span>`).join('')}</div>`:'<span class="profile-muted">Alle verfügbaren Module sind freigeschaltet.</span>'}</div>
    <div class="profile-popover-actions"><a class="action-button action-button--secondary" href="#/settings" data-action="profile-close">Einstellungen</a><button class="action-button action-button--secondary" type="button" data-action="logout">Abmelden</button></div>
  </div>`;
}

function closeProfileMenu() {
  document.querySelector('#profilePopover')?.remove();
  profileButton?.setAttribute('aria-expanded','false');
}

let presenceTimer = null;
let adminPresenceTimer = null;

function currentDeviceLabel() {
  const ua=navigator.userAgent||'';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return 'Browser';
}

async function pulsePresence() {
  if (!runtime.user || document.visibilityState === 'hidden') return;
  await financeApi.touchPresence({
    route:(location.hash||'#/overview').replace(/^#\//,'').split('?')[0],
    appVersion:APP_CONFIG.version,
    deviceLabel:currentDeviceLabel(),
  }).catch(()=>null);
}

function stopLiveTimers() {
  if (presenceTimer) window.clearInterval(presenceTimer);
  if (adminPresenceTimer) window.clearInterval(adminPresenceTimer);
  presenceTimer=null; adminPresenceTimer=null;
}

function startLiveTimers() {
  stopLiveTimers();
  void pulsePresence();
  presenceTimer=window.setInterval(()=>{ void pulsePresence(); },45000);
  adminPresenceTimer=window.setInterval(async()=>{
    if (!runtime.user || !runtime.adminRole || resolveRoute()!=='admin' || document.visibilityState==='hidden') return;
    if (document.activeElement?.matches('input,select,textarea')) return;
    try {
      runtime.adminUsers=(await backend.adminListUsers())?.users||[];
      const y=window.scrollY;
      render();
      window.scrollTo({top:y,left:0,behavior:'auto'});
    } catch {}
  },30000);
}

async function logoutCurrentUser() {
  stopLiveTimers();
  closeProfileMenu();
  closeMobileNav();
  await backend.signOut();
  runtime.session = null;
  runtime.user = null;
  runtime.profile = null;
  runtime.household = null;
  runtime.householdRole = null;
  runtime.adminRole = null;
  location.hash = '';
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  showAuth();
}

function toggleProfileMenu() {
  const existing = document.querySelector('#profilePopover');
  if (existing) { closeProfileMenu(); return; }
  const popover = document.createElement('div');
  popover.id = 'profilePopover';
  popover.className = 'profile-popover';
  popover.innerHTML = profileMenuHtml();
  // On iOS the topbar backdrop-filter can become the containing block for a
  // fixed descendant. Mount the phone bottom-sheet outside the topbar so its
  // actions (especially Abmelden) always stay inside the viewport.
  const host = window.matchMedia('(max-width: 660px)').matches
    ? appShell
    : document.querySelector('.topbar-actions');
  host?.appendChild(popover);
  profileButton?.setAttribute('aria-expanded','true');
}

function showToast(message, tone = 'success') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add('toast--visible'), 20);
  window.setTimeout(() => {
    toast.classList.remove('toast--visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 3400);
}

function humanError(error) {
  const message = String(error?.message || error || 'Unbekannter Fehler');
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist nicht korrekt.';
  if (/email not confirmed/i.test(message)) return 'Dieser Benutzer ist noch nicht freigeschaltet.';
  if (/duplicate key/i.test(message)) return 'Dieser Datensatz existiert bereits.';
  if (/row-level security/i.test(message)) return 'Du hast für diese Aktion keine Berechtigung.';
  if (/Payment total must equal principal plus interest plus fees/i.test(message)) return 'Zahlung gesamt muss Tilgung + Zins + Gebühren entsprechen.';
  if (/Principal payment exceeds outstanding debt/i.test(message)) return 'Die Tilgung ist höher als die aktuelle Restschuld.';
  if (/Only the latest active debt payment can be reversed/i.test(message)) return 'Es kann nur die zuletzt erfasste aktive Zahlung storniert werden.';
  if (/Linked transaction amount\/currency must match/i.test(message)) return 'Betrag und Währung der Bankbuchung müssen zur Schuldzahlung passen.';
  if (/Transaction is already linked to a debt payment/i.test(message)) return 'Diese Bankbuchung ist bereits mit einer Schuldzahlung verknüpft.';
  if (/Debt payment and account must use the same currency/i.test(message)) return 'Zahlungskonto und Schuld müssen für diese Beta dieselbe Währung haben.';
  if (/Debt payments are immutable/i.test(message)) return 'Erfasste Zahlungen werden nicht überschrieben. Storniere die letzte Zahlung und erfasse sie neu.';
  if (/Debt currency cannot be changed after payments exist/i.test(message)) return 'Die Währung kann nach der ersten erfassten Zahlung nicht mehr geändert werden.';
  if (/Debt was corrected after this payment/i.test(message)) return 'Restschuld oder Zahlungstermin wurden nach dieser Zahlung korrigiert. Eine automatische Stornierung wäre deshalb nicht mehr sicher.';
  if (/Active debt payment transactions must be reversed/i.test(message)) return 'Diese Kontobuchung gehört zu einer Schuldzahlung. Storniere sie im Zahlungsverlauf der Schuld.';
  if (/Active debt payment transaction financial fields are managed/i.test(message)) return 'Betrag, Konto und Datum einer Schuldzahlung werden im Schulden-Zahlungsverlauf verwaltet.';
  if (/Paid bills require a linked payment transaction/i.test(message)) return 'Eine bezahlte Rechnung benötigt eine verknüpfte Kontobuchung.';
  if (/Bill payment transaction does not belong/i.test(message)) return 'Die ausgewählte Kontobuchung gehört nicht zu diesem Haushalt.';
  if (/Bill payment amount\/currency must match/i.test(message)) return 'Betrag und Währung der Kontobuchung müssen exakt zur Rechnung passen.';
  if (/Only a booked outgoing transaction can be linked|Nur eine gebuchte Ausgangsbuchung/i.test(message)) return 'Es kann nur eine gebuchte Ausgangsbuchung als Zahlung verknüpft werden.';
  if (/Diese Buchung ist bereits mit einer anderen Rechnung/i.test(message)) return 'Diese Kontobuchung ist bereits mit einer anderen Rechnung verknüpft.';
  if (/Diese Buchung gehört bereits zu einer Schuldzahlung/i.test(message)) return 'Diese Kontobuchung ist bereits einer Schuldzahlung zugeordnet.';
  if (/Paid bill transactions must be unlinked/i.test(message)) return 'Diese Kontobuchung gehört zu einer bezahlten Rechnung. Nimm zuerst die Rechnungszahlung zurück.';
  if (/Paid bill transaction financial fields are managed/i.test(message)) return 'Betrag, Konto und Datum dieser Zahlung werden über die Rechnung verwaltet.';
  return message;
}

function showAuth() {
  appShell.hidden = true;
  authGate.hidden = false;
  authGate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">${icon('wallet')}</span><div><strong>Finance</strong><span>V2.3 · Beta 5.4</span></div></div>
      <div class="auth-copy"><span class="eyebrow">Finance Core</span><h1>Willkommen zurück</h1><p>Benutzer werden durch einen Administrator angelegt.</p></div>
      <form class="auth-form" id="authForm">
        <label class="field"><span>E-Mail</span><input class="text-control" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Passwort</span><input class="text-control" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <div class="auth-error" id="authError" hidden></div>
        <button class="action-button action-button--primary auth-submit" type="submit">Anmelden</button>
      </form>
    </div>`;

  document.querySelector('#authForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector('#authError');
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    submit.disabled = true;
    errorBox.hidden = true;
    try {
      const result = await backend.signIn({ email: String(data.get('email') || '').trim(), password: String(data.get('password') || '') });
      await enterApp({ ...result, user: result.user });
    } catch (error) {
      errorBox.textContent = humanError(error);
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

function showLoading(title = 'Daten werden geladen …') {
  pageContent.innerHTML = `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong></div>`;
}

async function loadFinanceData() {
  if (!runtime.household) return;
  const h = runtime.household.id;
  const results = await Promise.all([
    financeApi.listAccounts(h), financeApi.listCategories(h), financeApi.listCategorizationRules(h), financeApi.listTransactions(h),
    financeApi.listImportBatches(h), financeApi.listMerchants(h), financeApi.listRecurringRules(h), financeApi.listBudgets(h), financeApi.listBills(h), financeApi.listContracts(h),
    financeApi.listGoals(h), financeApi.listGoalSources(h), financeApi.listDebts(h), financeApi.listDebtPayments(h), financeApi.listReceivables(h), financeApi.listReceivablePayments(h), financeApi.listLegalCases(h), financeApi.listLegalEvents(h), financeApi.listAssets(h),
    financeApi.listProperties(h), financeApi.listVehicles(h), financeApi.listInsurance(h), financeApi.listInvestments(h), financeApi.listInvestmentTransactions(h), financeApi.listPensions(h),
    financeApi.listDocuments(h), financeApi.listHouseholdMembers(h), financeApi.getFxRates().catch(()=>null),
  ]);
  [
    runtime.accounts, runtime.categories, runtime.categorizationRules, runtime.transactions,
    runtime.importBatches, runtime.merchants, runtime.recurringRules, runtime.budgets, runtime.bills, runtime.contracts,
    runtime.goals, runtime.goalSources, runtime.debts, runtime.debtPayments, runtime.receivables, runtime.receivablePayments, runtime.legalCases, runtime.legalEvents, runtime.assets,
    runtime.properties, runtime.vehicles, runtime.insurance, runtime.investments, runtime.investmentTransactions, runtime.pensions,
    runtime.documents, runtime.householdMembers, runtime.fxRates,
  ] = results.map((value) => value || (value === null ? null : []));
}
async function loadContext() {
  const [profile, adminRole, moduleAccess, productModules, households] = await Promise.all([
    financeApi.getProfile(runtime.user.id), financeApi.getAdminRole(runtime.user.id), financeApi.listUserModules(runtime.user.id),
    financeApi.listProductModules(), financeApi.listHouseholds(),
  ]);
  runtime.profile = profile;
  runtime.adminRole = adminRole;
  runtime.moduleAccess = moduleAccess || {};
  runtime.productModules = productModules || [];
  runtime.household = households?.[0] || null;
  runtime.adminUsers = runtime.adminRole ? (await backend.adminListUsers())?.users || [] : [];
  if (runtime.household) {
    await loadFinanceData();
    runtime.householdRole = runtime.householdMembers.find((member)=>member.user_id===runtime.user.id)?.role || null;
  } else {
    runtime.householdRole = null;
  }
  updateProfileUI();
}

function renderSetup() {
  renderNavigation();
  pageTitle.textContent = 'Einrichtung';
  pageEyebrow.textContent = 'Finance Core';
  document.title = 'Einrichtung · Finance';
  const displayName = runtime.profile?.display_name || '';
  pageContent.innerHTML = `
    <header class="page-header"><p class="page-kicker">Einmalige Grundeinrichtung</p><h2 class="page-heading">Dein Finance Core</h2><p class="page-subtitle">Lege Land, Basiswährung und Haushalt fest. Danach stehen dir alle freigeschalteten Module zur Verfügung.</p></header>
    <form class="card card-padding setup-card" id="setup-create" data-form="setup-create">
      <div class="form-grid form-grid--2">
        <label class="field"><span>Anzeigename</span><input class="text-control" name="displayName" value="${escapeHtml(displayName)}" required></label>
        <label class="field"><span>Haushalt</span><input class="text-control" name="householdName" value="Privat" required></label>
        <label class="field"><span>Land</span><select class="text-control" name="countryCode" id="setupCountry"><option value="CH">Schweiz</option><option value="DE">Deutschland</option></select></label>
        <label class="field"><span>Basiswährung</span><select class="text-control" name="baseCurrency" id="setupCurrency"><option value="CHF">CHF</option><option value="EUR">EUR</option></select></label>
      </div>
      <div class="form-actions"><button class="action-button action-button--primary" type="submit">Finance Core starten</button></div>
    </form>`;
  document.querySelector('#setupCountry')?.addEventListener('change', (event) => {
    const currency = document.querySelector('#setupCurrency');
    currency.value = event.target.value === 'DE' ? 'EUR' : 'CHF';
  });
}

function render() {
  if (!runtime.user) return;
  if (!runtime.household) { renderSetup(); return; }
  renderNavigation();
  const route = resolveRoute();
  const meta = PAGE_META[route] || PAGE_META.overview;
  pageTitle.textContent = meta.title;
  pageEyebrow.textContent = meta.eyebrow;
  document.title = `${meta.title} · Finance`;
  const renderer = views[route] || views.overview;
  pageContent.innerHTML = renderer({
    ...runtime,
    ...store.getState(),
    canWrite: canWriteHousehold(),
    canAdminHousehold: canAdminHousehold(),
    householdRole: runtime.householdRole,
    hiddenModules: hiddenModuleKeys(),
    privacyEnabled: privacyEnabled(),
    adminQuery: uiState.adminQuery,
    adminPage: uiState.adminPage,
    adminExpandedUserId: uiState.adminExpandedUserId,
    importQuery: uiState.importQuery,
    importCategory: uiState.importCategory,
    transactionView: uiState.transactionView,
    transactionPeriod: uiState.transactionPeriod,
    transactionQuery: uiState.transactionQuery,
    transactionCategory: uiState.transactionCategory,
    transactionAccount: uiState.transactionAccount,
    transactionFrom: uiState.transactionFrom,
    transactionTo: uiState.transactionTo,
    transactionPage: uiState.transactionPage,
    categorizationOpen: uiState.categorizationOpen,
    categorizationFilter: uiState.categorizationFilter,
    categorizationPage: uiState.categorizationPage,
    debtExpandedId: uiState.debtExpandedId,
    receivableExpandedId: uiState.receivableExpandedId,
    taxYear: uiState.taxYear,
  });
  document.querySelectorAll('[data-route]').forEach((el) => el.dataset.route === route ? el.setAttribute('aria-current','page') : el.removeAttribute('aria-current'));
  applyPermissionUI(route);
  closeMobileNav();
  closeProfileMenu();
  applyPrivacyUI();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function applyPermissionUI(route) {
  if (!runtime.household || route === 'settings' || route === 'admin') return;
  if (!canWriteHousehold()) {
    const notice = document.createElement('div');
    notice.className = 'inline-alert access-notice';
    notice.innerHTML = '<strong>Nur-Lesezugriff.</strong><span>Du darfst diese Daten sehen, aber nicht verändern.</span>';
    pageContent.prepend(notice);
    pageContent.querySelectorAll('form[data-form] input, form[data-form] select, form[data-form] textarea, form[data-form] button').forEach((el)=>{ el.disabled = true; });
    pageContent.querySelectorAll('[data-action]').forEach((el)=>{
      if (!['document-download','document-preview','tax-export-csv','profile-close','receivable-history','receivable-history-close'].includes(el.dataset.action)) el.disabled = true;
    });
  }
  if (route === 'family' && !canAdminHousehold()) {
    pageContent.querySelectorAll('#family-add input, #family-add select, #family-add button, [data-action="family-remove"]').forEach((el)=>{ el.disabled = true; });
  }
}

async function refresh(message = '') {
  showLoading('Daten werden aktualisiert …');
  await loadContext();
  render();
  if (message) showToast(message);
}

function formValue(data, key) { return String(data.get(key) ?? '').trim(); }
function numberValue(data, key, fallback = 0) { const n = Number(data.get(key)); return Number.isFinite(n) ? n : fallback; }
function nullValue(data, key) { const v = formValue(data,key); return v || null; }

async function seedStarterCategoriesForHousehold(householdId, countryCode, existingCategories = []) {
  const cfg = countryConfig(countryCode || 'CH');
  const existing = new Set(existingCategories.map((category)=>`${category.kind}:${String(category.name||'').toLowerCase()}`));
  const missing = cfg.starterCategories.filter(([name,kind])=>!existing.has(`${kind}:${name.toLowerCase()}`));
  if (!missing.length) return 0;
  await financeApi.createCategories(missing.map(([name,kind],index)=>({
    household_id: householdId,
    name,
    kind,
    sort_order: (index + 1) * 10,
  })));
  return missing.length;
}

function currentCategorizationGroups() {
  return buildCategorizationGroups({
    transactions: runtime.transactions,
    categories: runtime.categories,
    merchants: runtime.merchants,
    rules: runtime.categorizationRules,
  });
}

async function applyCategorizationGroup(group, categoryId, { onlyUncategorized = false } = {}) {
  if (!group) throw new Error('Händlergruppe wurde nicht gefunden.');
  const category = runtime.categories.find((row)=>row.id===categoryId);
  if (!category || category.kind !== group.kind) throw new Error('Bitte eine passende Kategorie auswählen.');
  const targets = group.rows.filter((row)=>!onlyUncategorized || !row.category_id);
  if (!targets.length) return 0;

  let merchantId = group.merchantId || null;
  if (group.merchantKey && group.merchantKey !== 'unbekannt') {
    const merchant = await financeApi.upsertMerchant({
      household_id: runtime.household.id,
      normalized_key: group.merchantKey,
      name: group.name,
      default_category_id: category.id,
    });
    merchantId = merchant?.id || merchantId;
  }

  const patch = { category_id: category.id };
  if (merchantId) patch.merchant_id = merchantId;
  await financeApi.bulkUpdateTransactions(targets.map((row)=>row.id), patch);
  return targets.length;
}

function debtRecurringPayload(debt) {
  const account = runtime.accounts.find((row)=>row.account_id===debt.payment_account_id);
  if (!account) throw new Error('Bitte zuerst ein Standard-Zahlungskonto bei der Schuld hinterlegen.');
  if (account.currency !== debt.currency) throw new Error('Zahlungskonto und Schuld müssen für Wiederkehrend dieselbe Währung haben.');
  if (debt.payment_cadence === 'manual') throw new Error('Flexible/manuelle Schulden können nicht als Wiederkehrend geplant werden.');
  if (!(Number(debt.installment_amount) > 0)) throw new Error('Bitte zuerst eine Rate grösser als 0 hinterlegen.');
  if (!debt.next_payment_date) throw new Error('Bitte zuerst den nächsten Zahlungstermin hinterlegen.');
  return {
    household_id: runtime.household.id,
    account_id: account.account_id,
    category_id: null,
    direction: 'expense',
    description: `Schuldenrate: ${debt.name}`,
    counterparty: debt.creditor || null,
    amount: Number(debt.installment_amount),
    currency: debt.currency,
    cadence: debt.payment_cadence,
    next_date: debt.next_payment_date,
    end_date: debt.end_date || null,
    active: debt.status === 'active' && Number(debt.outstanding_amount) > 0,
  };
}

async function syncLinkedDebtRecurring(debt) {
  if (!debt?.recurring_rule_id) return;
  const rule = runtime.recurringRules.find((row)=>row.id===debt.recurring_rule_id);
  if (!rule) {
    await financeApi.updateDebt(debt.id,{recurring_rule_id:null});
    return;
  }
  const valid = debt.payment_account_id && debt.payment_cadence !== 'manual' && Number(debt.installment_amount)>0 && debt.next_payment_date;
  if (!valid) {
    await financeApi.updateRecurringRule(rule.id,{active:false});
    await financeApi.updateDebt(debt.id,{recurring_rule_id:null});
    return;
  }
  await financeApi.updateRecurringRule(rule.id,debtRecurringPayload(debt));
}

function showDebtPaymentSource(source) {
  const accountField=document.querySelector('#debtPaymentAccountField');
  const transactionField=document.querySelector('#debtPaymentTransactionField');
  const historyInfo=document.querySelector('#debtPaymentHistoryInfo');
  if(accountField) accountField.hidden=source!=='created_transaction';
  if(transactionField) transactionField.hidden=source!=='linked_transaction';
  if(historyInfo) historyInfo.hidden=source!=='history_only';
}

function showBillPaymentSource(source) {
  const accountField=document.querySelector('#billPaymentAccountField');
  const transactionField=document.querySelector('#billPaymentTransactionField');
  if(accountField) accountField.hidden=source!=='created_transaction';
  if(transactionField) transactionField.hidden=source!=='linked_transaction';
}

function addMonthsToDate(isoDate, months = 1) {
  const date = new Date(isoDate || Date.now());
  if (Number.isNaN(date.getTime())) return dateInputValue();
  date.setMonth(date.getMonth() + months);
  return dateInputValue(date);
}

function importMappingFromForm(form) {
  const data = new FormData(form);
  return {
    date:formValue(data,'mapDate'), description:formValue(data,'mapDescription'), counterparty:formValue(data,'mapCounterparty'),
    amount:formValue(data,'mapAmount'), debit:formValue(data,'mapDebit'), credit:formValue(data,'mapCredit'),
  };
}

function renderImportReview() {
  const form = document.querySelector('#bank-import');
  const host = document.querySelector('#importReview');
  if (!form || !host || !importState.parsed) return;
  const mapping = importMappingFromForm(form);
  if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)) {
    host.innerHTML = '<div class="inline-alert"><strong>Zuordnung unvollständig.</strong><span>Wähle Datum, Beschreibung und eine Betragsspalte.</span></div>';
    return;
  }
  const groups = new Map();
  for (const row of importState.parsed.rows) {
    const tx = rowToTransaction(row,mapping);
    if (!tx) continue;
    const merchant = merchantFromTransaction(tx);
    const existing = runtime.merchants.find((m)=>m.normalized_key===merchant.key);
    const knownCategoryName=suggestKnownCategoryName(tx); const knownCategory=knownCategoryName?runtime.categories.find((c)=>c.name===knownCategoryName&&c.kind===(Number(tx.amount)<0?'expense':'income')):null; const categoryId = existing?.default_category_id || applyCategoryRules(tx,runtime.categorizationRules) || knownCategory?.id || '';
    const group = groups.get(merchant.key) || { merchant, rows:[], total:0, categoryId };
    group.rows.push(tx); group.total += Number(tx.amount);
    if (!group.categoryId && categoryId) group.categoryId = categoryId;
    groups.set(merchant.key,group);
  }
  const html = [...groups.values()].sort((a,b)=>Math.abs(b.total)-Math.abs(a.total)).map((group)=>{
    const kind = group.total < 0 ? 'expense' : 'income';
    const options = runtime.categories.filter((c)=>c.kind===kind).map((c)=>`<option value="${c.id}" ${c.id===group.categoryId?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
    return `<div class="csv-review-row"><div><strong>${escapeHtml(group.merchant.name)}</strong></div><select class="text-control" data-csv-merchant-key="${escapeHtml(group.merchant.key)}"><option value="">Ohne Kategorie</option>${options}</select></div>`;
  }).join('');
  host.innerHTML = `<div class="card-heading csv-review-heading"><div><h3 class="card-title">Händler & Kategorien prüfen</h3><p class="card-subtitle">${groups.size} erkannte Händler · Kategorien können vor dem Import gesetzt werden.</p></div></div><div class="csv-review-list">${html || '<div class="table-empty">Keine gültigen Buchungszeilen erkannt.</div>'}</div>`;
}

function openTransactionEditor(tx, { recurring = false } = {}) {
  if (!tx || tx.transfer_group_id) throw new Error('Diese Buchung kann nicht einzeln bearbeitet werden.');
  if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden unter Schulden & Kredite verwaltet.');
  document.querySelector('#transactionEditId').value=tx.id;
  document.querySelector('#transactionEditDirection').value=Number(tx.amount)<0?'expense':'income';
  document.querySelector('#transactionEditAmount').value=Math.abs(Number(tx.amount));
  document.querySelector('#transactionEditAccount').value=tx.account_id;
  document.querySelector('#transactionEditDate').value=dateTimeLocalValue(new Date(tx.occurred_at));
  document.querySelector('#transactionEditDescription').value=tx.description||'';
  document.querySelector('#transactionEditCategory').value=tx.category_id||'';
  document.querySelector('#transactionEditCounterparty').value=tx.counterparty||'';
  document.querySelector('#transactionEditNote').value=tx.note||'';
  const taxRelevant=document.querySelector('#transactionEditTaxRelevant'); if (taxRelevant) taxRelevant.value=tx.tax_relevant?'true':'false';
  const taxCategory=document.querySelector('#transactionEditTaxCategory'); if (taxCategory) taxCategory.value=tx.tax_category||'';
  const toggle=document.querySelector('#transactionMakeRecurring');
  const fields=document.querySelector('#transactionRecurringFields');
  if (toggle) toggle.checked=recurring;
  if (fields) fields.hidden=!recurring;
  const next=document.querySelector('#transactionRecurringNextDate');
  if (next) next.value=addMonthsToDate(tx.occurred_at,1);
  const form=document.querySelector('#transaction-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function handleForm(form) {
  const data = new FormData(form);
  const id = form.id;
  const h = runtime.household?.id;
  const currency = runtime.household?.base_currency || 'CHF';

  if (!['setup-create','password-change','admin-user-create'].includes(id)) {
    if (id === 'family-add') { if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen Mitglieder verwalten.'); }
    else if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
  }

  if (id === 'setup-create') {
    const countryCode = formValue(data,'countryCode');
    const baseCurrency = formValue(data,'baseCurrency');
    runtime.profile = await financeApi.updateProfile(runtime.user.id, {
      display_name: formValue(data,'displayName'), country_code: countryCode, base_currency: baseCurrency,
      locale: countryCode === 'DE' ? 'de-DE' : 'de-CH', onboarding_completed_at: new Date().toISOString(),
    });
    const createdHousehold = await financeApi.createHousehold({ name: formValue(data,'householdName'), countryCode, baseCurrency, ownerUserId: runtime.user.id });
    await seedStarterCategoriesForHousehold(createdHousehold.id, countryCode, []);
    await refresh('Finance Core wurde eingerichtet.');
    location.hash = '#/overview';
    return;
  }

  if (id === 'account-create') {
    await financeApi.createAccount({ household_id:h, name:formValue(data,'name'), account_type:formValue(data,'accountType'), institution_name:nullValue(data,'institutionName'), currency:formValue(data,'currency')||currency, balance_anchor_amount:numberValue(data,'balance'), balance_anchor_at:new Date().toISOString(), visibility:formValue(data,'visibility')||'private' });
    await refresh('Konto gespeichert.'); return;
  }
  if (id === 'account-edit') {
    const accountId=formValue(data,'accountId');
    const account=runtime.accounts.find((a)=>a.account_id===accountId);
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    const patch={ name:formValue(data,'name'), account_type:formValue(data,'accountType'), institution_name:nullValue(data,'institutionName'), currency:formValue(data,'currency'), visibility:formValue(data,'visibility')||'private' };
    const correction=formValue(data,'balanceCorrection');
    if (correction !== '') {
      const corrected=Number(correction);
      if (!Number.isFinite(corrected)) throw new Error('Ungültiger Kontostand.');
      patch.balance_anchor_amount=corrected;
      patch.balance_anchor_at=new Date().toISOString();
    }
    await financeApi.updateAccount(accountId,patch);
    await refresh(correction !== '' ? 'Konto und Stand-jetzt-Anker korrigiert.' : 'Konto aktualisiert.'); return;
  }

  if (id === 'transaction-create') {
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    const amount = Math.abs(numberValue(data,'amount')) * (formValue(data,'direction')==='expense' ? -1 : 1);
    const payload={ household_id:h, account_id:formValue(data,'accountId'), category_id:nullValue(data,'categoryId'), occurred_at:new Date(formValue(data,'occurredAt')).toISOString(), amount, currency:account?.currency||currency, description:formValue(data,'description'), counterparty:nullValue(data,'counterparty'), note:nullValue(data,'note'), status:'booked', source:'manual' };
    if (moduleEnabled('tax')) { payload.tax_relevant=formValue(data,'taxRelevant')==='true'; payload.tax_category=nullValue(data,'taxCategory'); }
    await financeApi.createTransaction(payload);
    await refresh('Transaktion gespeichert.'); return;
  }
  if (id === 'transaction-edit') {
    const transactionId=formValue(data,'transactionId');
    const tx=runtime.transactions.find((row)=>row.id===transactionId);
    if (!tx || tx.transfer_group_id) throw new Error('Diese Buchung kann nicht einzeln bearbeitet werden.');
    if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden unter Schulden & Kredite verwaltet.');
    const account=runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    const amount=Math.abs(numberValue(data,'amount'))*(formValue(data,'direction')==='expense'?-1:1);
    const patch={ account_id:account.account_id, category_id:nullValue(data,'categoryId'), occurred_at:new Date(formValue(data,'occurredAt')).toISOString(), amount, currency:account.currency, description:formValue(data,'description'), counterparty:nullValue(data,'counterparty'), note:nullValue(data,'note') };
    if (moduleEnabled('tax')) { patch.tax_relevant=formValue(data,'taxRelevant')==='true'; patch.tax_category=nullValue(data,'taxCategory'); }
    await financeApi.updateTransaction(transactionId,patch);
    let recurringSaved = false;
    if (data.get('makeRecurring') === 'on') {
      const direction = amount < 0 ? 'expense' : 'income';
      const recurringPayload = { household_id:h, account_id:account.account_id, category_id:patch.category_id, direction, description:patch.description, counterparty:patch.counterparty, amount:Math.abs(amount), currency:account.currency, cadence:formValue(data,'recurringCadence')||'monthly', next_date:formValue(data,'recurringNextDate')||addMonthsToDate(patch.occurred_at,1), active:true };
      const existing = runtime.recurringRules.find((r)=>r.account_id===account.account_id && r.direction===direction && r.description.trim().toLowerCase()===patch.description.trim().toLowerCase() && Math.abs(Number(r.amount)-Math.abs(amount))<0.01);
      if (existing) await financeApi.updateRecurringRule(existing.id, recurringPayload);
      else await financeApi.createRecurringRule(recurringPayload);
      recurringSaved = true;
    }
    await refresh(recurringSaved ? 'Transaktion korrigiert und unter Wiederkehrend übernommen.' : 'Transaktion korrigiert.'); return;
  }

  if (id === 'transfer-create') {
    const from = runtime.accounts.find((a)=>a.account_id===formValue(data,'fromAccountId'));
    const to = runtime.accounts.find((a)=>a.account_id===formValue(data,'toAccountId'));
    if (!from || !to) throw new Error('Konten fehlen.');
    const fromAmount=Math.abs(numberValue(data,'amount'));
    const enteredToAmount=formValue(data,'toAmount');
    const toAmount=from.currency===to.currency ? fromAmount : Math.abs(Number(enteredToAmount));
    if (!(fromAmount>0)) throw new Error('Der Abgangsbetrag muss grösser als 0 sein.');
    if (from.currency!==to.currency && (!enteredToAmount || !Number.isFinite(toAmount) || !(toAmount>0))) throw new Error(`Für ${from.currency} → ${to.currency} muss der tatsächlich gutgeschriebene Zielbetrag angegeben werden.`);
    await financeApi.createTransfer({ p_household_id:h, p_from_account_id:from.account_id, p_to_account_id:to.account_id, p_from_amount:fromAmount, p_to_amount:toAmount, p_occurred_at:new Date(formValue(data,'occurredAt')).toISOString(), p_description:formValue(data,'description')||'Umbuchung' });
    await refresh(from.currency===to.currency?'Umbuchung gespeichert.':'Fremdwährungs-Umbuchung mit beiden Originalbeträgen gespeichert.'); return;
  }

  if (id === 'category-create' || id === 'category-create-inline') {
    await financeApi.createCategory({ household_id:h, parent_id:id==='category-create'?nullValue(data,'parentId'):null, name:formValue(data,'name'), kind:formValue(data,'kind'), icon:id==='category-create'?nullValue(data,'icon'):null });
    await refresh('Kategorie gespeichert.'); return;
  }
  if (id === 'rule-create') {
    await financeApi.createCategorizationRule({ household_id:h, category_id:formValue(data,'categoryId'), field_name:formValue(data,'fieldName'), match_type:formValue(data,'matchType'), match_value:formValue(data,'matchValue'), priority:100, active:true });
    await refresh('Kategorisierungsregel gespeichert.'); return;
  }
  if (id === 'recurring-create') {
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    await financeApi.createRecurringRule({ household_id:h, account_id:formValue(data,'accountId'), category_id:nullValue(data,'categoryId'), direction:formValue(data,'direction'), description:formValue(data,'description'), amount:Math.abs(numberValue(data,'amount')), currency:account?.currency||currency, cadence:formValue(data,'cadence'), next_date:formValue(data,'nextDate'), active:true });
    await refresh('Wiederkehrende Zahlung gespeichert.'); return;
  }
  if (id === 'budget-create') {
    const scopeType=formValue(data,'scopeType')||'category';
    const categoryId=scopeType==='category'?formValue(data,'categoryId'):null;
    const merchantId=scopeType==='merchant'?formValue(data,'merchantId'):null;
    if (!categoryId && !merchantId) throw new Error('Bitte Kategorie oder Händler auswählen.');
    await financeApi.upsertBudget({ household_id:h, category_id:categoryId, merchant_id:merchantId, month_start:`${formValue(data,'month')}-01`, amount:numberValue(data,'amount') });
    await refresh('Budget gespeichert.'); return;
  }
  if (id === 'bill-create') {
    await financeApi.createBill({ household_id:h, account_id:nullValue(data,'accountId'), category_id:nullValue(data,'categoryId'), name:formValue(data,'name'), provider:nullValue(data,'provider'), amount:numberValue(data,'amount'), currency, due_date:formValue(data,'dueDate'), status:'open', reference:nullValue(data,'reference') });
    await refresh('Rechnung gespeichert.'); return;
  }
  if (id === 'bill-payment') {
    const billId=formValue(data,'billId');
    const source=formValue(data,'source');
    if(!billId) throw new Error('Rechnung wurde nicht gefunden.');
    await financeApi.payBill({ householdId:h, billId, source, paidAt:nullValue(data,'paidAt'), accountId:nullValue(data,'accountId'), transactionId:nullValue(data,'transactionId') });
    await refresh('Rechnung bezahlt und mit der Kontobuchung verknüpft.'); return;
  }
  if (id === 'contract-create') {
    await financeApi.createContract({ household_id:h, account_id:nullValue(data,'accountId'), category_id:nullValue(data,'categoryId'), name:formValue(data,'name'), provider:nullValue(data,'provider'), contract_type:formValue(data,'contractType'), amount:numberValue(data,'amount'), currency, billing_cadence:formValue(data,'cadence'), next_payment_date:nullValue(data,'nextPaymentDate'), cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null, end_date:nullValue(data,'endDate'), status:'active' });
    await refresh('Vertrag gespeichert.'); return;
  }
  if (id === 'goal-create') {
    await financeApi.createGoal({ household_id:h, name:formValue(data,'name'), target_amount:numberValue(data,'targetAmount'), current_amount:numberValue(data,'currentAmount'), monthly_amount:numberValue(data,'monthlyAmount'), currency, target_date:nullValue(data,'targetDate'), goal_type:formValue(data,'goalType'), status:'active' });
    await refresh('Sparziel gespeichert.'); return;
  }
  if (id === 'goal-edit') {
    const goalId=formValue(data,'goalId');
    const targetAmount=numberValue(data,'targetAmount'); const currentAmount=numberValue(data,'currentAmount');
    await financeApi.updateGoal(goalId,{ name:formValue(data,'name'), goal_type:formValue(data,'goalType'), target_amount:targetAmount, current_amount:currentAmount, monthly_amount:numberValue(data,'monthlyAmount'), target_date:nullValue(data,'targetDate'), status:currentAmount>=targetAmount?'completed':'active' });
    await refresh('Sparziel aktualisiert.'); return;
  }
  if (id === 'goal-source-create') {
    const goalId=formValue(data,'goalId'); const sourceType=formValue(data,'sourceType');
    const payload={ household_id:h, goal_id:goalId, source_type:sourceType, label:nullValue(data,'label'), active:true };
    if(sourceType==='fixed'){ const amount=numberValue(data,'amount',-1); if(amount<0) throw new Error('Bitte einen gültigen Monatsbetrag eingeben.'); payload.amount=amount; payload.recurring_rule_id=null; }
    else if(sourceType==='recurring_rule'){ const recurringRuleId=formValue(data,'recurringRuleId'); if(!recurringRuleId) throw new Error('Bitte eine wiederkehrende Zahlung wählen.'); payload.amount=null; payload.recurring_rule_id=recurringRuleId; }
    else if(sourceType==='surplus'){ payload.amount=null; payload.recurring_rule_id=null; payload.label='Monatsüberschuss'; }
    else throw new Error('Unbekannte Finanzierungsquelle.');
    await financeApi.createGoalSource(payload); await refresh('Finanzierungsquelle hinzugefügt.'); return;
  }
  if (id === 'receivable-create') {
    const amount=numberValue(data,'amount',-1);
    if(!(amount>0)) throw new Error('Bitte einen gültigen Forderungsbetrag eingeben.');
    const sourceAccountId=nullValue(data,'sourceAccountId');
    await financeApi.createReceivable({
      householdId:h, debtor:formValue(data,'debtor'), reason:formValue(data,'reason'),
      originalAmount:amount, currency:formValue(data,'currency')||currency,
      lentAt:formValue(data,'lentAt')||dateInputValue(), dueDate:nullValue(data,'dueDate'),
      notes:nullValue(data,'notes'), sourceAccountId, createTransaction:Boolean(sourceAccountId),
    });
    await refresh(sourceAccountId?'Forderung und Auszahlung gespeichert.':'Forderung gespeichert.');
    return;
  }
  if (id === 'receivable-payment-create') {
    const receivableId=formValue(data,'receivableId');
    const receivable=runtime.receivables.find((row)=>row.id===receivableId);
    if(!receivable) throw new Error('Forderung wurde nicht gefunden.');
    const amount=numberValue(data,'amount',-1);
    if(!(amount>0)) throw new Error('Bitte einen gültigen Rückzahlungsbetrag eingeben.');
    if(amount>Number(receivable.outstanding_amount)+0.005) throw new Error('Die Rückzahlung ist höher als der offene Betrag.');
    const paymentAccountId=nullValue(data,'paymentAccountId');
    await financeApi.recordReceivablePayment({
      householdId:h, receivableId, amount, paidAt:formValue(data,'paidAt')||dateInputValue(),
      note:nullValue(data,'note'), paymentAccountId, createTransaction:Boolean(paymentAccountId),
    });
    uiState.receivableExpandedId=receivableId;
    await refresh(paymentAccountId?'Rückzahlung und Kontoeingang gespeichert.':'Rückzahlung im Forderungsverlauf gespeichert.');
    return;
  }
  if (id === 'debt-create' || id === 'debt-edit') {
    const originalAmount=numberValue(data,'originalAmount');
    const outstandingAmount=numberValue(data,'outstandingAmount');
    const requestedStatus=formValue(data,'status')||'active';
    if (requestedStatus==='paid' && outstandingAmount>0) throw new Error('Status „Bezahlt“ ist nur bei Restschuld 0 möglich.');
    const payload={
      debt_type:formValue(data,'debtType'), creditor:formValue(data,'creditor'), name:formValue(data,'name'),
      original_amount:originalAmount, outstanding_amount:outstandingAmount, currency:formValue(data,'currency')||currency,
      interest_rate:numberValue(data,'interestRate'), installment_amount:numberValue(data,'installmentAmount'),
      payment_cadence:formValue(data,'paymentCadence')||'manual', payment_account_id:nullValue(data,'paymentAccountId'),
      next_payment_date:nullValue(data,'nextPaymentDate'), start_date:nullValue(data,'startDate'), end_date:nullValue(data,'endDate'),
      status:outstandingAmount===0?'paid':requestedStatus, notes:nullValue(data,'notes'),
    };
    if (id==='debt-create') {
      await financeApi.createDebt({household_id:h,...payload});
      await refresh('Schuld / Kredit gespeichert.');
    } else {
      const debtId=formValue(data,'debtId');
      const before=runtime.debts.find((row)=>row.id===debtId);
      if (!before) throw new Error('Schuld wurde nicht gefunden.');
      const updated=await financeApi.updateDebt(debtId,payload);
      if (before.recurring_rule_id) await syncLinkedDebtRecurring({...updated,recurring_rule_id:before.recurring_rule_id});
      await refresh('Schuld / Kredit aktualisiert.');
    }
    return;
  }
  if (id === 'debt-payment-create') {
    const debtId=formValue(data,'debtId');
    const debt=runtime.debts.find((row)=>row.id===debtId);
    if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    const amount=numberValue(data,'amount',-1);
    const principal=numberValue(data,'principalAmount',-1);
    const interest=numberValue(data,'interestAmount',0);
    const fee=numberValue(data,'feeAmount',0);
    if(!(amount>0)||principal<0||interest<0||fee<0) throw new Error('Bitte gültige Zahlungsbeträge eingeben.');
    if(Math.abs(amount-(principal+interest+fee))>0.005) throw new Error('Zahlung gesamt muss Tilgung + Zins + Gebühren entsprechen.');
    const source=formValue(data,'source');
    const payload={
      household_id:h, debt_id:debt.id, paid_at:formValue(data,'paidAt'), amount,
      principal_amount:principal, interest_amount:interest, fee_amount:fee, currency:debt.currency,
      source, payment_account_id:null, transaction_id:null, note:nullValue(data,'note'),
      advance_next_date:data.get('advanceNextDate')==='on',
    };
    if(source==='created_transaction') {
      payload.payment_account_id=formValue(data,'paymentAccountId');
      if(!payload.payment_account_id) throw new Error('Bitte ein Zahlungskonto auswählen.');
    } else if(source==='linked_transaction') {
      payload.transaction_id=formValue(data,'transactionId');
      if(!payload.transaction_id) throw new Error('Bitte eine bestehende Buchung auswählen.');
    } else if(source!=='history_only') throw new Error('Unbekannte Zahlungsart.');
    await financeApi.createDebtPayment(payload);
    uiState.debtExpandedId=debt.id;
    await refresh('Zahlung verbucht und Restschuld aktualisiert.');
    return;
  }
  if (id === 'legal-create') {
    await financeApi.createLegalCase({ household_id:h, country_code:runtime.household.country_code, case_type:formValue(data,'caseType'), creditor:formValue(data,'creditor'), reference:nullValue(data,'reference'), original_amount:numberValue(data,'originalAmount'), outstanding_amount:numberValue(data,'outstandingAmount'), currency, status:formValue(data,'status'), next_action_date:nullValue(data,'nextActionDate'), notes:nullValue(data,'notes') });
    await refresh('Fall gespeichert.'); return;
  }
  if (id === 'family-add') {
    await financeApi.addHouseholdMember(h, formValue(data,'email'), formValue(data,'role'));
    await refresh('Haushaltsmitglied hinzugefügt.'); return;
  }
  if (id === 'asset-create') {
    await financeApi.createAsset({ household_id:h, asset_type:formValue(data,'assetType'), name:formValue(data,'name'), current_value:numberValue(data,'currentValue'), currency, acquired_date:nullValue(data,'acquiredDate'), notes:nullValue(data,'notes') });
    await refresh('Vermögenswert gespeichert.'); return;
  }
  if (id === 'property-create') {
    await financeApi.createProperty({ household_id:h, name:formValue(data,'name'), property_type:formValue(data,'propertyType'), current_value:numberValue(data,'currentValue'), currency, purchase_price:nullValue(data,'purchasePrice')?numberValue(data,'purchasePrice'):null, purchase_date:nullValue(data,'purchaseDate'), monthly_running_cost:numberValue(data,'monthlyCost'), renovation_reserve:numberValue(data,'renovationReserve') });
    await refresh('Immobilie gespeichert.'); return;
  }
  if (id === 'vehicle-create' || id === 'vehicle-edit') {
    const payload={ name:formValue(data,'name'), vehicle_type:formValue(data,'vehicleType'), current_value:numberValue(data,'currentValue'), currency, purchase_price:nullValue(data,'purchasePrice')?numberValue(data,'purchasePrice'):null, purchase_date:nullValue(data,'purchaseDate'), monthly_cost:numberValue(data,'monthlyCost'), odometer_km:nullValue(data,'odometerKm')?numberValue(data,'odometerKm'):null, license_plate:nullValue(data,'licensePlate') };
    if (id==='vehicle-create') await financeApi.createVehicle({ household_id:h, ...payload });
    else await financeApi.updateVehicle(formValue(data,'vehicleId'),payload);
    await refresh(id==='vehicle-create'?'Fahrzeug gespeichert.':'Fahrzeug aktualisiert.'); return;
  }
  if (id === 'insurance-create' || id === 'insurance-edit') {
    const payload={ name:formValue(data,'name'), provider:nullValue(data,'provider'), policy_type:formValue(data,'policyType')||'other', policy_number:nullValue(data,'policyNumber'), premium_amount:numberValue(data,'premiumAmount'), currency:formValue(data,'currency')||currency, billing_cadence:formValue(data,'cadence'), account_id:nullValue(data,'accountId'), category_id:nullValue(data,'categoryId'), next_payment_date:nullValue(data,'nextPaymentDate'), last_paid_date:nullValue(data,'lastPaidDate'), cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null, end_date:nullValue(data,'endDate'), status:'active' };
    if (id==='insurance-create') await financeApi.createInsurance({ household_id:h, ...payload });
    else await financeApi.updateInsurance(formValue(data,'insuranceId'),payload);
    await refresh(id==='insurance-create'?'Versicherung gespeichert.':'Versicherung aktualisiert.'); return;
  }
  if (id === 'insurance-document-upload') {
    const insuranceId=formValue(data,'insuranceId');
    const file=data.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('Bitte eine Datei auswählen.');
    if (file.size > 10*1024*1024) throw new Error('Die Datei ist grösser als 10 MB.');
    const path=await financeApi.uploadDocument(h,file);
    await financeApi.createDocument({ household_id:h, object_type:'insurance', object_id:insuranceId, name:file.name, storage_path:path, mime_type:file.type||'application/octet-stream', file_size:file.size, document_date:nullValue(data,'documentDate'), notes:nullValue(data,'notes') });
    await refresh('Versicherungsdokument gespeichert.'); return;
  }
  if (id === 'investment-create' || id === 'investment-edit') {
    const payload={ name:formValue(data,'name'), investment_type:formValue(data,'investmentType'), symbol:nullValue(data,'symbol'), quantity:numberValue(data,'quantity'), cost_basis:numberValue(data,'costBasis'), current_value:numberValue(data,'currentValue'), currency:formValue(data,'currency')||currency, provider:nullValue(data,'provider') };
    if (id==='investment-create') await financeApi.createInvestment({ household_id:h, ...payload });
    else await financeApi.updateInvestment(formValue(data,'investmentId'),payload);
    await refresh(id==='investment-create'?'Investmentposition gespeichert.':'Investmentposition aktualisiert.'); return;
  }
  if (id === 'investment-trade-form') {
    await financeApi.recordInvestmentTrade({ p_household_id:h, p_investment_id:formValue(data,'investmentId'), p_trade_date:formValue(data,'tradeDate'), p_side:formValue(data,'side'), p_quantity:numberValue(data,'quantity'), p_unit_price:numberValue(data,'unitPrice'), p_fees:numberValue(data,'fees'), p_notes:nullValue(data,'notes') });
    await refresh('Investment-Trade gebucht.'); return;
  }
  if (id === 'pension-create') {
    await financeApi.createPension({ household_id:h, country_code:runtime.household.country_code, pension_type:formValue(data,'pensionType'), provider:nullValue(data,'provider'), name:formValue(data,'name'), current_value:numberValue(data,'currentValue'), currency, annual_contribution:numberValue(data,'annualContribution') });
    await refresh('Vorsorgeposition gespeichert.'); return;
  }
  if (id === 'document-create') {
    const file = data.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('Bitte eine Datei auswählen.');
    if (file.size > 10*1024*1024) throw new Error('Die Datei ist grösser als 10 MB.');
    const path = await financeApi.uploadDocument(h,file);
    const payload={ household_id:h, object_type:formValue(data,'objectType')||'general', name:file.name, storage_path:path, mime_type:file.type||'application/octet-stream', file_size:file.size, document_date:nullValue(data,'documentDate'), notes:nullValue(data,'notes') };
    if (moduleEnabled('tax')) { const taxRelevant=formValue(data,'taxRelevant')==='true'; payload.tax_relevant=taxRelevant; payload.tax_year=taxRelevant&&nullValue(data,'taxYear')?numberValue(data,'taxYear'):null; payload.tax_category=taxRelevant?nullValue(data,'taxCategory'):null; }
    await financeApi.createDocument(payload);
    await refresh('Dokument gespeichert.'); return;
  }
  if (id === 'tax-settings') {
    if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen das Steuerprofil ändern.');
    const regionCode=nullValue(data,'regionCode');
    runtime.household=await financeApi.updateHousehold(h,{ tax_region_code:regionCode });
    uiState.taxYear=numberValue(data,'taxYear',new Date().getFullYear());
    await refresh('Steuerprofil gespeichert.'); return;
  }
  if (id === 'password-change') {
    const p1 = formValue(data,'password'); const p2 = formValue(data,'passwordConfirm');
    if (p1.length<8) throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (p1!==p2) throw new Error('Die Passwörter stimmen nicht überein.');
    await backend.updatePassword(p1); form.reset(); showToast('Passwort geändert.'); return;
  }
  if (id === 'admin-user-create') {
    await backend.adminCreateUser({ displayName:formValue(data,'displayName'), email:formValue(data,'email'), password:formValue(data,'password') });
    await refresh('Benutzer erstellt.'); return;
  }
  if (id === 'bank-import') {
    if (!importState.parsed || !importState.file) throw new Error('Bitte zuerst eine CSV- oder PDF-Datei auswählen.');
    const accountId = formValue(data,'accountId');
    const account = runtime.accounts.find((a)=>a.account_id===accountId);
    if (!account) throw new Error('Zielkonto wurde nicht gefunden.');
    const mapping = importMappingFromForm(form);
    if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)) throw new Error('Datum, Beschreibung und Betragsspalten müssen zugeordnet sein.');
    const categorySelections = new Map([...form.querySelectorAll('[data-csv-merchant-key]')].map((select)=>[select.dataset.csvMerchantKey, select.value || null]));
    const remember = data.get('rememberMerchants') === 'on';
    const batch = await financeApi.createImportBatch({ household_id:h, account_id:accountId, file_name:importState.file.name, row_count:importState.parsed.rows.length, imported_count:0, skipped_count:0, status:'processing' });
    try {
      const prepared = [];
      const merchantCache = new Map(runtime.merchants.map((merchant)=>[merchant.normalized_key,merchant]));
      for (const row of importState.parsed.rows) {
        const tx = rowToTransaction(row,mapping);
        if (!tx) continue;
        const merchantInfo = merchantFromTransaction(tx);
        const existingMerchant = merchantCache.get(merchantInfo.key);
        const selectedCategory = categorySelections.has(merchantInfo.key) ? categorySelections.get(merchantInfo.key) : null;
        const knownCategoryName=suggestKnownCategoryName(tx); const knownCategory=knownCategoryName?runtime.categories.find((c)=>c.name===knownCategoryName&&c.kind===(Number(tx.amount)<0?'expense':'income')):null; const fallbackCategory = existingMerchant?.default_category_id || applyCategoryRules(tx,runtime.categorizationRules) || knownCategory?.id || null;
        const categoryId = selectedCategory || fallbackCategory;
        let merchant = existingMerchant;
        if (!merchant) {
          merchant = await financeApi.upsertMerchant({ household_id:h, name:merchantInfo.name, normalized_key:merchantInfo.key, default_category_id:remember?categoryId:null });
          if (merchant) merchantCache.set(merchantInfo.key,merchant);
        } else if (remember && categoryId && merchant.default_category_id !== categoryId) {
          merchant = await financeApi.updateMerchant(merchant.id,{ default_category_id:categoryId, name:merchantInfo.name });
          if (merchant) merchantCache.set(merchantInfo.key,merchant);
        }
        const externalReference = await transactionFingerprint(accountId,tx);
        prepared.push({ household_id:h, account_id:accountId, category_id:categoryId, merchant_id:merchant?.id||null, import_batch_id:batch.id, occurred_at:tx.occurred_at, amount:tx.amount, currency:account.currency||currency, description:tx.description, counterparty:tx.counterparty, status:'booked', source:'import', external_reference:externalReference });
      }
      const inserted = prepared.length ? await financeApi.importTransactions(prepared) : [];
      if (inserted.some((row)=>row.import_batch_id!==batch.id)) throw new Error('Import-Zuordnung konnte nicht vollständig gespeichert werden.');
      const skippedCount=Math.max(0,importState.parsed.rows.length-inserted.length);
      await financeApi.updateImportBatch(batch.id,{ imported_count:inserted.length, skipped_count:skippedCount, status:'completed' });
      importState.file=null; importState.parsed=null;
      uiState.importQuery=''; uiState.importCategory='all';
      await refresh(`${inserted.length} Transaktionen importiert. ${skippedCount} Dubletten oder ungültige Zeilen wurden übersprungen.`); return;
    } catch (error) {
      await financeApi.updateImportBatch(batch.id,{ status:'failed' }).catch(()=>{});
      throw error;
    }
  }
}

const deleteMap = {
  categories: (id)=>financeApi.deleteCategory(id), categorization_rules:(id)=>financeApi.deleteCategorizationRule(id), recurring_rules:(id)=>financeApi.deleteRecurringRule(id), budgets:(id)=>financeApi.deleteBudget(id), bills:(id)=>financeApi.deleteBill(id), contracts:(id)=>financeApi.deleteContract(id), savings_goals:(id)=>financeApi.deleteGoal(id), debts:(id)=>financeApi.deleteDebt(id), receivables:(id)=>financeApi.deleteReceivable({householdId:runtime.household.id,receivableId:id}), legal_cases:(id)=>financeApi.deleteLegalCase(id), assets:(id)=>financeApi.deleteAsset(id), properties:(id)=>financeApi.deleteProperty(id), vehicles:(id)=>financeApi.deleteVehicle(id), insurance_policies:(id)=>financeApi.deleteInsurance(id), investments:(id)=>financeApi.deleteInvestment(id), pension_accounts:(id)=>financeApi.deletePension(id),
};

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  const writeActions = new Set(['starter-categories','categorization-open','categorization-apply-safe','categorization-apply-group','account-edit','transaction-edit','transaction-make-recurring','transaction-delete','transaction-to-transfer','transaction-note','transaction-tax-toggle','delete','bill-payment-open','bill-payment-reverse','goal-progress','goal-apply-suggestion','goal-edit','goal-source-open','goal-source-delete','debt-edit','debt-payment-open','debt-payment-reverse','debt-recurring','debt-recurring-remove','receivable-payment-open','receivable-payment-reverse','legal-event','import-group-assign','budget-suggestion','vehicle-edit','insurance-edit','insurance-recurring','insurance-document','contract-recurring','investment-edit','investment-trade','document-tax-toggle','tax-receipt']);
  if (writeActions.has(action) && !canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
  if (action === 'show-form') { document.getElementById(target.dataset.target)?.removeAttribute('hidden'); return; }
  if (action === 'starter-categories') {
    const created = await seedStarterCategoriesForHousehold(runtime.household.id, runtime.household.country_code, runtime.categories);
    if (!created) { showToast('Starter-Kategorien sind bereits vorhanden.'); return; }
    await refresh(`${created} Starter-Kategorien angelegt.`); return;
  }
  if (action === 'categorization-open') {
    if (!runtime.categories.length) {
      await seedStarterCategoriesForHousehold(runtime.household.id, runtime.household.country_code, []);
      await loadFinanceData();
    }
    uiState.categorizationOpen = true;
    uiState.categorizationFilter = 'action';
    uiState.categorizationPage = 1;
    render();
    return;
  }
  if (action === 'categorization-close') {
    uiState.categorizationOpen = false;
    render();
    return;
  }
  if (action === 'categorization-page') {
    uiState.categorizationPage = Math.max(1, Number(target.dataset.page) || 1);
    render();
    return;
  }
  if (action === 'categorization-view-group') {
    const group = currentCategorizationGroups().find((row)=>row.key===target.dataset.groupKey);
    if (!group) throw new Error('Händlergruppe wurde nicht gefunden.');
    uiState.categorizationOpen = false;
    uiState.transactionQuery = group.name;
    uiState.transactionCategory = 'all';
    uiState.transactionAccount = 'all';
    uiState.transactionFrom = '';
    uiState.transactionTo = '';
    uiState.transactionPeriod = 'all';
    uiState.transactionView = 'details';
    uiState.transactionPage = 1;
    render();
    return;
  }
  if (action === 'categorization-apply-group') {
    const group = currentCategorizationGroups().find((row)=>row.key===target.dataset.groupKey);
    const container = target.closest('[data-categorization-group]');
    const categoryId = container?.querySelector('[data-categorization-category]')?.value || '';
    const changed = await applyCategorizationGroup(group, categoryId, { onlyUncategorized:false });
    await refresh(`${changed} Buchung${changed===1?'':'en'} kategorisiert; Händler-Zuordnung gemerkt.`);
    return;
  }
  if (action === 'categorization-apply-safe') {
    const groups = currentCategorizationGroups().filter((group)=>group.unassignedCount>0&&group.suggestion?.safe);
    if (!groups.length) { showToast('Keine sicheren offenen Vorschläge vorhanden.'); return; }
    let changed = 0;
    for (const group of groups) changed += await applyCategorizationGroup(group, group.suggestion.categoryId, { onlyUncategorized:true });
    await refresh(`${changed} bisher unkategorisierte Buchung${changed===1?'':'en'} automatisch zugeordnet. Bestehende Kategorien wurden nicht verändert.`);
    return;
  }
  if (action === 'hide-form') { document.getElementById(target.dataset.target)?.setAttribute('hidden',''); return; }
  if (action === 'profile-close') { closeProfileMenu(); return; }
  if (action === 'privacy-toggle') {
    await saveUserPreferences({ privacy_enabled: !privacyEnabled() });
    render();
    showToast(privacyEnabled() ? 'Privatsphäre-Modus aktiviert.' : 'Finanzwerte wieder sichtbar.');
    return;
  }
  if (action === 'admin-user-toggle-details') {
    uiState.adminExpandedUserId = uiState.adminExpandedUserId === target.dataset.userId ? null : target.dataset.userId;
    render(); return;
  }
  if (action === 'admin-page') {
    uiState.adminPage = Math.max(1, Number(target.dataset.page) || 1);
    uiState.adminExpandedUserId = null;
    render(); return;
  }
  if (action === 'admin-refresh-presence') {
    runtime.adminUsers=(await backend.adminListUsers())?.users||[];
    render();
    showToast('Online-Status aktualisiert.');
    return;
  }
  if (action === 'logout') { await logoutCurrentUser(); return; }
  if (action === 'account-edit') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const account=runtime.accounts.find((row)=>row.account_id===target.dataset.id);
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    document.querySelector('#accountEditId').value=account.account_id;
    document.querySelector('#accountEditName').value=account.name||'';
    document.querySelector('#accountEditType').value=account.account_type||'checking';
    document.querySelector('#accountEditInstitution').value=account.institution_name||'';
    document.querySelector('#accountEditCurrency').value=account.currency||runtime.household.base_currency;
    document.querySelector('#accountEditVisibility').value=account.visibility||'private';
    document.querySelector('#accountEditBalance').value='';
    const form=document.querySelector('#account-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'vehicle-edit') {
    const v=runtime.vehicles.find((row)=>row.id===target.dataset.id); if(!v) throw new Error('Fahrzeug wurde nicht gefunden.');
    document.querySelector('#vehicleEditId').value=v.id; document.querySelector('#vehicleEditName').value=v.name||''; document.querySelector('#vehicleEditType').value=v.vehicle_type||'car'; document.querySelector('#vehicleEditValue').value=v.current_value||0; document.querySelector('#vehicleEditPurchasePrice').value=v.purchase_price??''; document.querySelector('#vehicleEditPurchaseDate').value=v.purchase_date||''; document.querySelector('#vehicleEditMonthlyCost').value=v.monthly_cost||0; document.querySelector('#vehicleEditOdometer').value=v.odometer_km??''; document.querySelector('#vehicleEditPlate').value=v.license_plate||'';
    const form=document.querySelector('#vehicle-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'insurance-edit') {
    const v=runtime.insurance.find((row)=>row.id===target.dataset.id); if(!v) throw new Error('Versicherung wurde nicht gefunden.');
    document.querySelector('#insuranceEditId').value=v.id; document.querySelector('#insuranceEditName').value=v.name||''; document.querySelector('#insuranceEditProvider').value=v.provider||''; document.querySelector('#insuranceEditType').value=v.policy_type||''; document.querySelector('#insuranceEditNumber').value=v.policy_number||''; document.querySelector('#insuranceEditPremium').value=v.premium_amount||0; const insuranceCurrency=document.querySelector('#insuranceEditCurrency'); if(insuranceCurrency) insuranceCurrency.value=v.currency||runtime.household.base_currency; document.querySelector('#insuranceEditCadence').value=v.billing_cadence||'monthly'; document.querySelector('#insuranceEditAccount').value=v.account_id||''; document.querySelector('#insuranceEditCategory').value=v.category_id||''; document.querySelector('#insuranceEditNext').value=v.next_payment_date||''; document.querySelector('#insuranceEditLastPaid').value=v.last_paid_date||''; document.querySelector('#insuranceEditNotice').value=v.cancellation_notice_days??''; document.querySelector('#insuranceEditEnd').value=v.end_date||'';
    const form=document.querySelector('#insurance-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'insurance-document') {
    const input=document.querySelector('#insuranceDocumentId'); if(input) input.value=target.dataset.id;
    const form=document.querySelector('#insurance-document-upload'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'insurance-recurring') {
    const p=runtime.insurance.find((row)=>row.id===target.dataset.id); if(!p||!p.account_id) throw new Error('Bitte zuerst ein Zahlungskonto hinterlegen.');
    const cadence=p.billing_cadence||'annual'; const next=p.next_payment_date||dateInputValue();
    const payload={ household_id:runtime.household.id, account_id:p.account_id, category_id:p.category_id||null, direction:'expense', description:p.name, counterparty:p.provider||null, amount:Number(p.premium_amount), currency:p.currency||runtime.household.base_currency, cadence, next_date:next, active:true };
    const existing=runtime.recurringRules.find((r)=>r.account_id===p.account_id&&r.description.trim().toLowerCase()===p.name.trim().toLowerCase());
    if(existing) await financeApi.updateRecurringRule(existing.id,payload); else await financeApi.createRecurringRule(payload);
    await refresh('Versicherungsprämie unter Wiederkehrend übernommen.'); return;
  }
  if (action === 'contract-recurring') {
    const c=runtime.contracts.find((row)=>row.id===target.dataset.id); if(!c||!c.account_id) throw new Error('Bitte beim Vertrag zuerst ein Zahlungskonto hinterlegen.');
    if(c.billing_cadence==='oneoff') throw new Error('Einmalige Verträge sind nicht wiederkehrend.');
    const account=runtime.accounts.find((a)=>a.account_id===c.account_id);
    const payload={ household_id:runtime.household.id, account_id:c.account_id, category_id:c.category_id||null, direction:'expense', description:c.name, counterparty:c.provider||null, amount:Number(c.amount), currency:account?.currency||c.currency||runtime.household.base_currency, cadence:c.billing_cadence, next_date:c.next_payment_date||dateInputValue(), active:true };
    const existing=runtime.recurringRules.find((r)=>r.account_id===c.account_id&&r.description.trim().toLowerCase()===c.name.trim().toLowerCase());
    if(existing) await financeApi.updateRecurringRule(existing.id,payload); else await financeApi.createRecurringRule(payload);
    await refresh('Vertrag unter Wiederkehrend übernommen.'); return;
  }
  if (action === 'investment-edit') {
    const i=runtime.investments.find((row)=>row.id===target.dataset.id); if(!i) throw new Error('Investment wurde nicht gefunden.');
    document.querySelector('#investmentEditId').value=i.id; document.querySelector('#investmentEditName').value=i.name||''; document.querySelector('#investmentEditType').value=i.investment_type||'other'; document.querySelector('#investmentEditSymbol').value=i.symbol||''; document.querySelector('#investmentEditQuantity').value=i.quantity||0; document.querySelector('#investmentEditCost').value=i.cost_basis||0; document.querySelector('#investmentEditCurrent').value=i.current_value||0; const invCurrency=document.querySelector('#investmentEditCurrency'); if(invCurrency) invCurrency.value=i.currency||runtime.household.base_currency; document.querySelector('#investmentEditProvider').value=i.provider||'';
    const form=document.querySelector('#investment-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'investment-trade') {
    const id=target.dataset.id; const form=document.querySelector('#investment-trade-form'); if(!form) return; form.removeAttribute('hidden'); const sel=document.querySelector('#tradeInvestmentId'); if(sel) sel.value=id; const side=document.querySelector('#tradeSide'); if(side) side.value=target.dataset.side||'buy'; form.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'transaction-note') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id); if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
    const value=prompt('Wofür war diese Zahlung?',tx.note||''); if(value===null) return; await financeApi.updateTransaction(tx.id,{note:value.trim()||null}); await refresh('Zweck gespeichert.'); return;
  }
  if (action === 'transaction-tax-toggle') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id); if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
    const value=target.dataset.value==='true'; let category=tx.tax_category||null; if(value&&!category){ const entered=prompt('Steuerkategorie (optional):','Berufskosten'); if(entered!==null) category=entered.trim()||null; }
    await financeApi.updateTransaction(tx.id,{tax_relevant:value,tax_category:value?category:null}); await refresh(value?'Als steuerrelevant markiert.':'Steuermarkierung entfernt.'); return;
  }
  if (action === 'transaction-to-transfer') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id); const to=runtime.accounts.find((a)=>a.account_id===target.dataset.toAccount); if(!tx||!to) throw new Error('Buchung oder Zielkonto fehlt.');
    if(tx.cashflow_type==='debt_payment') throw new Error('Eine Schuldzahlung kann nicht in eine Umbuchung umgewandelt werden.');
    let toAmount=null; if(tx.currency!==to.currency){ const entered=prompt(`Wie viel ${to.currency} wurden tatsächlich in ${to.name} gelegt?`,String(Math.abs(Number(tx.amount)))); if(entered===null) return; toAmount=Number(entered); if(!Number.isFinite(toAmount)||toAmount<=0) throw new Error('Ungültiger Zielbetrag.'); }
    await financeApi.convertTransactionToTransfer({householdId:runtime.household.id,transactionId:tx.id,toAccountId:to.account_id,toAmount,description:to.account_type==='savings'?'Sparen':'Bargeldtransfer'}); await refresh(`Als Umbuchung nach ${to.name} erkannt.`); return;
  }
  if (action === 'budget-suggestion') {
    const month=monthInputValue()+'-01'; await financeApi.upsertBudget({household_id:runtime.household.id,category_id:null,merchant_id:target.dataset.merchantId,month_start:month,amount:Number(target.dataset.amount)}); await refresh('Händler-Budget angelegt.'); return;
  }
  if (action === 'document-tax-toggle') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const doc=runtime.documents.find((d)=>d.id===target.dataset.id); if(!doc) throw new Error('Dokument nicht gefunden.'); const value=target.dataset.value==='true'; await financeApi.updateDocument(doc.id,{tax_relevant:value,tax_year:value?(doc.tax_year||new Date(doc.document_date||doc.created_at).getFullYear()):null,tax_category:value?(doc.tax_category||null):null}); await refresh(value?'Dokument der Steuerablage hinzugefügt.':'Dokument aus Steuerablage entfernt.'); return;
  }
  if (action === 'tax-receipt') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    uiState.taxReceiptTxId=target.dataset.id; document.querySelector('#taxReceiptInput')?.click(); return;
  }
  if (action === 'tax-export-csv') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const year=Number(target.dataset.year)||uiState.taxYear; const rows=runtime.transactions.filter((tx)=>tx.tax_relevant&&new Date(tx.occurred_at).getFullYear()===year);
    const header=['Datum','Beschreibung','Kategorie','Steuerkategorie','Betrag','Währung','Kostenanteil Basiswährung','Basiswährung','Belege'];
    const escapeCsv=(v)=>`"${String(v??'').replaceAll('"','""')}"`;
    const paymentMap=buildDebtPaymentTransactionMap(runtime.debtPayments);
    const lines=[header,...rows.map((tx)=>{ const docs=runtime.documents.filter((d)=>d.object_type==='transaction'&&d.object_id===tx.id).map((d)=>d.name).join(' | '); const base=consumptionExpenseBase(tx,paymentMap,runtime.household.base_currency,runtime.fxRates); return [dateInputValue(new Date(tx.occurred_at)),tx.description,tx.categories?.name||(tx.cashflow_type==='debt_payment'?'Schuldentilgung':''),tx.tax_category||'',tx.amount,tx.currency,base.toFixed(2),runtime.household.base_currency,docs]; })].map((row)=>row.map(escapeCsv).join(';')).join('\n');
    const blob=new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`steuerberater-${year}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); showToast(`Steuerexport ${year} erstellt.`); return;
  }
  if (action === 'goal-edit') {
    const g=runtime.goals.find((row)=>row.id===target.dataset.id); if(!g) throw new Error('Sparziel wurde nicht gefunden.');
    document.querySelector('#goalEditId').value=g.id; document.querySelector('#goalEditName').value=g.name||''; document.querySelector('#goalEditType').value=g.goal_type||'custom'; document.querySelector('#goalEditTarget').value=g.target_amount||0; document.querySelector('#goalEditCurrent').value=g.current_amount||0; document.querySelector('#goalEditMonthly').value=g.monthly_amount||0; document.querySelector('#goalEditDate').value=g.target_date||'';
    const form=document.querySelector('#goal-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'goal-source-open') {
    const input=document.querySelector('#goalSourceGoalId'); if(input) input.value=target.dataset.id;
    const form=document.querySelector('#goal-source-create'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'goal-source-delete') {
    await financeApi.deleteGoalSource(target.dataset.id); await refresh('Finanzierungsquelle entfernt.'); return;
  }
  if (action === 'transaction-filter-category') {
    uiState.transactionCategory=target.dataset.category||'all'; uiState.transactionPeriod='all'; uiState.transactionView='details'; uiState.transactionPage=1; render(); return;
  }
  if (action === 'transaction-filter-reset') {
    uiState.transactionQuery=''; uiState.transactionCategory='all'; uiState.transactionAccount='all'; uiState.transactionFrom=''; uiState.transactionTo=''; uiState.transactionPeriod='month'; uiState.transactionPage=1; render(); return;
  }
  if (action === 'transaction-page') { uiState.transactionPage=Math.max(1,Number(target.dataset.page)||1); render(); return; }
  if (action === 'goal-apply-suggestion') {
    const amount=Number(target.dataset.amount); if(!Number.isFinite(amount)||amount<0) throw new Error('Ungültiger Vorschlag.'); await financeApi.updateGoal(target.dataset.id,{monthly_amount:amount}); await refresh('Vorgeschlagenen Monatsbetrag übernommen.'); return;
  }
  if (action === 'transaction-edit' || action === 'transaction-make-recurring') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    openTransactionEditor(tx,{ recurring:action==='transaction-make-recurring' });
    return;
  }
  if (action === 'import-group-assign') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const row=target.closest('.import-group-row');
    const categoryId=row?.querySelector('[data-import-group-category]')?.value || null;
    if (!categoryId) throw new Error('Bitte zuerst eine Kategorie auswählen.');
    const ids=String(row?.dataset.txIds||'').split(',').filter(Boolean);
    for (const id of ids) await financeApi.updateTransaction(id,{category_id:categoryId});
    if (row?.dataset.merchantId) await financeApi.updateMerchant(row.dataset.merchantId,{default_category_id:categoryId});
    await refresh(`${ids.length} Buchung${ids.length===1?'':'en'} kategorisiert und Händler-Zuordnung gespeichert.`); return;
  }
  if (action === 'transaction-delete') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if (!tx) throw new Error('Transaktion wurde nicht gefunden.');
    if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden im Zahlungsverlauf unter Schulden & Kredite storniert.');
    if (!confirm(tx.transfer_group_id?'Die gesamte Umbuchung mit beiden Buchungsseiten löschen?':'Diese Transaktion wirklich löschen?')) return;
    if (tx.transfer_group_id) await financeApi.deleteTransfer(runtime.household.id,tx.transfer_group_id); else await financeApi.deleteTransaction(tx.id);
    await refresh(tx.transfer_group_id?'Umbuchung gelöscht.':'Transaktion gelöscht.'); return;
  }
  if (action === 'delete') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const table=target.dataset.table; const id=target.dataset.id;
    if (!confirm('Diesen Eintrag wirklich löschen?')) return;
    if (table==='documents') {
      const doc=runtime.documents.find((d)=>d.id===id); if (doc) await financeApi.deleteDocument(doc);
    } else {
      const fn=deleteMap[table]; if (!fn) throw new Error('Löschen für diesen Datentyp ist nicht definiert.'); await fn(id);
    }
    await refresh('Eintrag gelöscht.'); return;
  }
  if (action === 'bill-payment-open') {
    const bill=runtime.bills.find((row)=>row.id===target.dataset.id); if(!bill) throw new Error('Rechnung wurde nicht gefunden.');
    document.querySelector('#billPaymentBillId').value=bill.id;
    document.querySelector('#billPaymentSource').value='created_transaction';
    document.querySelector('#billPaymentDate').value=dateInputValue();
    document.querySelector('#billPaymentAccount').value=bill.account_id||'';
    const used=new Set(runtime.bills.filter((row)=>row.paid_transaction_id).map((row)=>row.paid_transaction_id));
    const matches=runtime.transactions.filter((tx)=>tx.status==='booked'&&Number(tx.amount)<0&&!tx.transfer_group_id&&tx.cashflow_type!=='debt_payment'&&tx.currency===bill.currency&&Math.abs(Number(tx.amount)-(-Number(bill.amount)))<0.005&&!used.has(tx.id));
    const select=document.querySelector('#billPaymentTransaction');
    select.innerHTML='<option value="">Bitte wählen</option>'+matches.map((tx)=>`<option value="${tx.id}">${escapeHtml(dateInputValue(new Date(tx.occurred_at)))} · ${escapeHtml(tx.description)} · ${Math.abs(Number(tx.amount)).toFixed(2)} ${escapeHtml(tx.currency)}</option>`).join('');
    showBillPaymentSource('created_transaction');
    const form=document.querySelector('#bill-payment'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'bill-payment-reverse') {
    if(!confirm('Rechnungszahlung wirklich zurücknehmen? Eine von Finance erzeugte Kontobuchung wird dabei ebenfalls entfernt.')) return;
    await financeApi.unpayBill({householdId:runtime.household.id,billId:target.dataset.id});
    await refresh('Rechnungszahlung zurückgenommen.'); return;
  }
  if (action === 'goal-progress') {
    const value=prompt('Aktueller Stand des Sparziels:',target.dataset.current||'0'); if (value===null) return;
    const n=Number(value); if (!Number.isFinite(n)||n<0) throw new Error('Ungültiger Betrag.');
    const goal=runtime.goals.find((g)=>g.id===target.dataset.id); await financeApi.updateGoal(target.dataset.id,{current_amount:n,status:goal&&n>=Number(goal.target_amount)?'completed':'active'}); await refresh('Sparziel aktualisiert.'); return;
  }
  if (action === 'receivable-payment-open') {
    const receivable=runtime.receivables.find((row)=>row.id===target.dataset.id);
    if(!receivable) throw new Error('Forderung wurde nicht gefunden.');
    document.querySelector('#receivablePaymentId').value=receivable.id;
    document.querySelector('#receivablePaymentDate').value=dateInputValue();
    document.querySelector('#receivablePaymentAmount').value=Number(receivable.outstanding_amount||0).toFixed(2);
    document.querySelector('#receivablePaymentNote').value='';
    const accountSelect=document.querySelector('#receivablePaymentAccount');
    if(accountSelect){
      accountSelect.value=receivable.source_account_id||'';
      [...accountSelect.options].forEach((option)=>{
        if(!option.value) return;
        const account=runtime.accounts.find((row)=>row.account_id===option.value);
        const allowed=account?.currency===receivable.currency;
        option.hidden=!allowed; option.disabled=!allowed;
      });
      if(accountSelect.value&&accountSelect.selectedOptions[0]?.disabled) accountSelect.value='';
    }
    const form=document.querySelector('#receivable-payment-create');
    form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'receivable-history') { uiState.receivableExpandedId=target.dataset.id; render(); return; }
  if (action === 'receivable-history-close') { uiState.receivableExpandedId=null; render(); return; }
  if (action === 'receivable-payment-reverse') {
    if(!confirm('Die zuletzt erfasste Rückzahlung wirklich stornieren? Eine von Finance erstellte Kontobuchung wird ebenfalls entfernt.')) return;
    const payment=runtime.receivablePayments.find((row)=>row.id===target.dataset.id);
    if(!payment) throw new Error('Rückzahlung wurde nicht gefunden.');
    await financeApi.reverseReceivablePayment(payment.id);
    uiState.receivableExpandedId=payment.receivable_id;
    await refresh('Rückzahlung storniert; Forderung wiederhergestellt.');
    return;
  }
  if (action === 'debt-edit') {
    const debt=runtime.debts.find((row)=>row.id===target.dataset.id); if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    document.querySelector('#debtEditId').value=debt.id;
    document.querySelector('#debtEditName').value=debt.name||'';
    document.querySelector('#debtEditCreditor').value=debt.creditor||'';
    document.querySelector('#debtEditType').value=debt.debt_type||'other';
    document.querySelector('#debtEditCurrency').value=debt.currency||runtime.household.base_currency;
    document.querySelector('#debtEditOriginal').value=debt.original_amount||0;
    document.querySelector('#debtEditOutstanding').value=debt.outstanding_amount||0;
    document.querySelector('#debtEditInterest').value=debt.interest_rate||0;
    document.querySelector('#debtEditInstallment').value=debt.installment_amount||0;
    document.querySelector('#debtEditCadence').value=debt.payment_cadence||'manual';
    document.querySelector('#debtEditAccount').value=debt.payment_account_id||'';
    document.querySelector('#debtEditNext').value=debt.next_payment_date||'';
    document.querySelector('#debtEditStart').value=debt.start_date||'';
    document.querySelector('#debtEditEnd').value=debt.end_date||'';
    document.querySelector('#debtEditStatus').value=debt.status||'active';
    document.querySelector('#debtEditNotes').value=debt.notes||'';
    const form=document.querySelector('#debt-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'debt-payment-open') {
    const debt=runtime.debts.find((row)=>row.id===target.dataset.id); if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    const suggested=Math.min(Number(debt.installment_amount||0)||Number(debt.outstanding_amount||0),Number(debt.outstanding_amount||0));
    document.querySelector('#debtPaymentDebtId').value=debt.id;
    document.querySelector('#debtPaymentDate').value=dateInputValue();
    document.querySelector('#debtPaymentAmount').value=suggested>0?suggested.toFixed(2):'';
    document.querySelector('#debtPaymentPrincipal').value=suggested>0?suggested.toFixed(2):'';
    document.querySelector('#debtPaymentInterest').value='0';
    document.querySelector('#debtPaymentFee').value='0';
    document.querySelector('#debtPaymentSource').value='created_transaction';
    document.querySelector('#debtPaymentAccount').value=debt.payment_account_id||'';
    const txSelect=document.querySelector('#debtPaymentTransaction');
    if(txSelect){
      txSelect.value='';
      [...txSelect.options].forEach((option)=>{
        if(!option.value) return;
        const allowed=option.dataset.currency===debt.currency;
        option.hidden=!allowed; option.disabled=!allowed;
      });
    }
    document.querySelector('#debtPaymentAdvance').checked=debt.payment_cadence!=='manual';
    document.querySelector('#debtPaymentNote').value='';
    showDebtPaymentSource('created_transaction');
    const form=document.querySelector('#debt-payment-create'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'debt-history') { uiState.debtExpandedId=target.dataset.id; render(); return; }
  if (action === 'debt-history-close') { uiState.debtExpandedId=null; render(); return; }
  if (action === 'debt-payment-reverse') {
    if(!confirm('Die zuletzt erfasste Schuldzahlung wirklich stornieren? Restschuld und verknüpfte Buchung werden entsprechend zurückgesetzt.')) return;
    const payment=runtime.debtPayments.find((row)=>row.id===target.dataset.id);
    if(!payment) throw new Error('Zahlung wurde nicht gefunden.');
    await financeApi.reverseDebtPayment(payment.id);
    uiState.debtExpandedId=payment.debt_id;
    await refresh('Schuldzahlung storniert.'); return;
  }
  if (action === 'debt-recurring') {
    const debt=runtime.debts.find((row)=>row.id===target.dataset.id); if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    const payload=debtRecurringPayload(debt);
    let rule=null;
    if(debt.recurring_rule_id) rule=await financeApi.updateRecurringRule(debt.recurring_rule_id,payload);
    else rule=await financeApi.createRecurringRule(payload);
    if(!debt.recurring_rule_id) await financeApi.updateDebt(debt.id,{recurring_rule_id:rule.id});
    await refresh('Schuldenrate unter Wiederkehrend verknüpft.'); return;
  }
  if (action === 'debt-recurring-remove') {
    const debt=runtime.debts.find((row)=>row.id===target.dataset.id); if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    if(debt.recurring_rule_id) await financeApi.updateRecurringRule(debt.recurring_rule_id,{active:false});
    await financeApi.updateDebt(debt.id,{recurring_rule_id:null});
    await refresh('Verknüpfung zu Wiederkehrend gelöst.'); return;
  }
  if (action === 'legal-event') {
    const caseId=target.dataset.id; const title=prompt('Ereignis / Titel:'); if (!title) return;
    const type=prompt('Typ des Ereignisses:','Notiz')||'Notiz'; const notes=prompt('Notiz (optional):','')||null;
    await financeApi.createLegalEvent({case_id:caseId,household_id:runtime.household.id,event_date:dateInputValue(),event_type:type,title,notes}); await refresh('Timeline-Ereignis gespeichert.'); return;
  }
  if (action === 'family-remove') { if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen Mitglieder entfernen.'); if (!confirm('Mitglied aus dem Haushalt entfernen?')) return; await financeApi.removeHouseholdMember(runtime.household.id,target.dataset.userId); await refresh('Mitglied entfernt.'); return; }
  if (action === 'document-download') {
    const blob=await financeApi.downloadDocument(target.dataset.path); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=target.dataset.name||'dokument'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); return;
  }
  if (action === 'admin-password') {
    const password=prompt('Neues temporäres Passwort (mind. 8 Zeichen):'); if (password===null) return; if (password.length<8) throw new Error('Mindestens 8 Zeichen.');
    await backend.adminSetPassword({userId:target.dataset.userId,password}); showToast('Passwort gesetzt.'); return;
  }
}

function fillSelect(select, headers, selected, allowEmpty = true) {
  if (!select) return;
  select.innerHTML = `${allowEmpty?'<option value="">— nicht verwenden —</option>':''}${headers.map((h)=>`<option value="${escapeHtml(h)}" ${h===selected?'selected':''}>${escapeHtml(h)}</option>`).join('')}`;
}

pageContent.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try { await handleForm(form); }
  catch (error) { showToast(humanError(error),'error'); }
  finally { if (submit) submit.disabled = false; }
});

pageContent.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || target.matches('input[type="checkbox"]')) return;
  try { await handleAction(target); }
  catch (error) { showToast(humanError(error),'error'); }
});

pageContent.addEventListener('change', async (event) => {
  const target = event.target;
  try {
    if (target.id === 'themeSelect') { store.setState({theme:target.value},{persistPreferences:true}); return; }
    if (target.id === 'depthSelect') { store.setState({depth:target.value},{persistPreferences:true}); render(); return; }
    if (target.id === 'transactionPeriodSelect') { uiState.transactionPeriod=target.value||'month'; if(uiState.transactionPeriod!=='custom'){ uiState.transactionFrom=''; uiState.transactionTo=''; } uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionViewSelect') { uiState.transactionView=target.value||'summary'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionCategoryFilter') { uiState.transactionCategory=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionAccountFilter') { uiState.transactionAccount=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'categorizationFilter') { uiState.categorizationFilter=target.value||'action'; uiState.categorizationPage=1; render(); return; }
    if (target.id === 'transactionFrom') { uiState.transactionFrom=target.value||''; uiState.transactionPeriod='custom'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionTo') { uiState.transactionTo=target.value||''; uiState.transactionPeriod='custom'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'debtPaymentSource') { showDebtPaymentSource(target.value); return; }
    if (target.id === 'billPaymentSource') { showBillPaymentSource(target.value); return; }
    if (target.id === 'debtPaymentTransaction') {
      const option=target.selectedOptions?.[0];
      if(option?.value){
        const amount=Math.abs(Number(option.dataset.amount||0));
        const total=document.querySelector('#debtPaymentAmount'); const principal=document.querySelector('#debtPaymentPrincipal');
        if(total) total.value=amount.toFixed(2); if(principal) principal.value=amount.toFixed(2);
        const interest=document.querySelector('#debtPaymentInterest'); if(interest) interest.value='0';
        const fee=document.querySelector('#debtPaymentFee'); if(fee) fee.value='0';
      }
      return;
    }
    if (target.id === 'goalSourceType') {
      const type=target.value; const amount=document.querySelector('#goalSourceAmountField'); const recurring=document.querySelector('#goalSourceRecurringField'); const label=document.querySelector('#goalSourceLabelField'); const info=document.querySelector('#goalSourceSurplusInfo');
      if(amount) amount.hidden=type!=='fixed'; if(recurring) recurring.hidden=type!=='recurring_rule'; if(label) label.hidden=type==='surplus'; if(info) info.hidden=type!=='surplus'; return;
    }
    if (target.id === 'taxYearSelect') { uiState.taxYear=Number(target.value)||new Date().getFullYear(); render(); return; }
    if (target.id === 'budgetScopeType') { const merchant=document.querySelector('#budgetMerchantField'); const category=document.querySelector('#budgetCategoryField'); if(merchant) merchant.hidden=target.value!=='merchant'; if(category) category.hidden=target.value==='merchant'; return; }
    if (target.id === 'taxReceiptInput') {
      const file=target.files?.[0]; const txId=uiState.taxReceiptTxId; if(!file||!txId) return;
      if (file.size > 10*1024*1024) throw new Error('Die Datei ist grösser als 10 MB.');
      const tx=runtime.transactions.find((row)=>row.id===txId); if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
      const path=await financeApi.uploadDocument(runtime.household.id,file);
      await financeApi.createDocument({household_id:runtime.household.id,object_type:'transaction',object_id:tx.id,name:file.name,storage_path:path,mime_type:file.type||'application/octet-stream',file_size:file.size,document_date:dateInputValue(new Date(tx.occurred_at)),notes:'Quittung zur Transaktion',tax_relevant:true,tax_year:new Date(tx.occurred_at).getFullYear(),tax_category:tx.tax_category||null});
      uiState.taxReceiptTxId=null; await refresh('Quittung gespeichert und mit der Transaktion verknüpft.'); return;
    }
    if (target.id === 'transactionMakeRecurring') { const fields=document.querySelector('#transactionRecurringFields'); if (fields) fields.hidden=!target.checked; return; }
    if (target.id === 'importCategoryFilter') { uiState.importCategory=target.value||'all'; render(); return; }
    if (target.closest('#importMapping') && ['mapDate','mapDescription','mapCounterparty','mapAmount','mapDebit','mapCredit'].includes(target.name)) { renderImportReview(); return; }
    if (target.name === 'kind' && target.closest('#category-create')) {
      const parent = target.closest('form')?.querySelector('[name="parentId"]');
      if (parent) {
        [...parent.options].forEach((option)=>{ if (!option.value) return; option.hidden = option.dataset.kind !== target.value; option.disabled = option.dataset.kind !== target.value; });
        if (parent.selectedOptions[0]?.disabled) parent.value = '';
      }
      return;
    }
    if (target.id === 'importFile') {
      const file=target.files?.[0]; if (!file) return;
      const parsed=await parseImportFile(file); if (!parsed.headers.length) throw new Error('Keine verwertbaren Importspalten erkannt.');
      importState.file=file; importState.parsed=parsed;
      const guess=guessMapping(parsed.headers);
      fillSelect(document.querySelector('#mapDate'),parsed.headers,guess.date,false);
      fillSelect(document.querySelector('#mapDescription'),parsed.headers,guess.description,false);
      fillSelect(document.querySelector('#mapCounterparty'),parsed.headers,guess.counterparty,true);
      fillSelect(document.querySelector('#mapAmount'),parsed.headers,guess.amount,true);
      fillSelect(document.querySelector('#mapDebit'),parsed.headers,guess.debit,true);
      fillSelect(document.querySelector('#mapCredit'),parsed.headers,guess.credit,true);
      const meta=parsed.format==='pdf' ? `${parsed.rows.length} erkannte Buchungen · ${parsed.meta?.pages||0} PDF-Seite${parsed.meta?.pages===1?'':'n'}${parsed.meta?.ambiguous?` · ${parsed.meta.ambiguous} unklare Zeile${parsed.meta.ambiguous===1?'':'n'} übersprungen`:''}` : `${parsed.rows.length} Datenzeilen · Trennzeichen ${parsed.delimiter==='\t'?'Tab':parsed.delimiter}`;
      document.querySelector('#importPreviewMeta').textContent=meta;
      document.querySelector('#importMapping').hidden=false;
      renderImportReview();
      return;
    }
    if (target.dataset.action === 'user-toggle-module-visibility') {
      target.disabled = true;
      const moduleKey = target.dataset.moduleKey;
      if (!moduleEntitled(moduleKey) || MODULES[moduleKey]?.locked || moduleKey === 'admin') throw new Error('Dieses Modul kann nicht persönlich ausgeblendet werden.');
      const hidden = new Set(hiddenModuleKeys());
      if (target.checked) hidden.delete(moduleKey); else hidden.add(moduleKey);
      await saveUserPreferences({ hidden_modules: [...hidden] });
      render();
      showToast(target.checked ? 'Modul wieder eingeblendet.' : 'Modul aus deiner Navigation ausgeblendet.');
      return;
    }
    if (target.dataset.action === 'admin-toggle-module') {
      target.disabled=true;
      await backend.adminSetModule({userId:target.dataset.userId,moduleKey:target.dataset.moduleKey,enabled:target.checked});
      const user=runtime.adminUsers.find((u)=>u.id===target.dataset.userId); if (user) (user.modules ||= {})[target.dataset.moduleKey]=target.checked;
      if (target.dataset.userId===runtime.user?.id) {
        runtime.moduleAccess[target.dataset.moduleKey]=target.checked;
        render();
      }
      showToast('Modulfreigabe aktualisiert.'); target.disabled=false;
    }
  } catch (error) { showToast(humanError(error),'error'); target.disabled=false; }
});

pageContent.addEventListener('input', (event) => {
  const target = event.target;
  if (['debtPaymentAmount','debtPaymentInterest','debtPaymentFee'].includes(target.id)) {
    const amount=Number(document.querySelector('#debtPaymentAmount')?.value||0);
    const interest=Number(document.querySelector('#debtPaymentInterest')?.value||0);
    const fee=Number(document.querySelector('#debtPaymentFee')?.value||0);
    const principal=document.querySelector('#debtPaymentPrincipal');
    const calculated=amount-interest-fee;
    if(principal && Number.isFinite(calculated) && calculated>=0) principal.value=calculated.toFixed(2);
    return;
  }
  if (target.id === 'adminUserSearch') {
    uiState.adminQuery = target.value; uiState.adminPage = 1; uiState.adminExpandedUserId = null; render();
    const next = document.querySelector('#adminUserSearch'); if (next) { next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
    return;
  }
  if (target.id === 'importMerchantSearch') {
    uiState.importQuery = target.value; render();
    const next = document.querySelector('#importMerchantSearch'); if (next) { next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
    return;
  }
  if (target.id === 'transactionSearch') {
    uiState.transactionQuery=target.value; uiState.transactionPage=1; render();
    const next=document.querySelector('#transactionSearch'); if(next){ next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
  }
});

async function enterApp(session) {
  runtime.session=session; runtime.user=session.user;
  authGate.hidden=true; appShell.hidden=false; showLoading();
  try { await loadContext(); render(); startLiveTimers(); }
  catch (error) { pageContent.innerHTML=`<div class="inline-alert"><strong>Daten konnten nicht geladen werden.</strong><span>${escapeHtml(humanError(error))}</span></div>`; }
}

window.addEventListener('hashchange',()=>{ render(); void pulsePresence(); });
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') void pulsePresence(); });
window.addEventListener('scroll', syncMobileScrollState, { passive: true });
window.addEventListener('resize',()=>{ syncMobileScrollState(); closeProfileMenu(); });
store.subscribe((state)=>{ setTheme(state.theme); document.documentElement.dataset.depth=state.depth; });

themeButton?.addEventListener('click',cycleTheme);
privacyButton?.addEventListener('click',async()=>{ try { await saveUserPreferences({ privacy_enabled: !privacyEnabled() }); render(); showToast(privacyEnabled() ? 'Privatsphäre-Modus aktiviert.' : 'Finanzwerte wieder sichtbar.'); } catch (error) { showToast(humanError(error),'error'); } });
mobileMenuButton?.addEventListener('click',()=>{ const open=!document.body.classList.contains('mobile-nav-open'); document.body.classList.toggle('mobile-nav-open',open); mobileMenuButton.setAttribute('aria-expanded',String(open)); mobileScrim.hidden=!open; });
mobileScrim?.addEventListener('click',closeMobileNav);
mobileLogoutButton?.addEventListener('click',async()=>{ try { await logoutCurrentUser(); } catch (error) { showToast(humanError(error),'error'); } });
profileButton?.addEventListener('click',(event)=>{ event.stopPropagation(); toggleProfileMenu(); });
document.addEventListener('click',(event)=>{ if (!event.target.closest('#profilePopover') && !event.target.closest('#profileButton')) closeProfileMenu(); });
document.addEventListener('click',async(event)=>{ const target=event.target.closest('#profilePopover [data-action]'); if (!target) return; try { await handleAction(target); } catch (error) { showToast(humanError(error),'error'); } });

hydrateStaticIcons();
setTheme(store.getState().theme);
document.documentElement.dataset.depth=store.getState().depth;
applyPrivacyUI();
syncMobileScrollState();
const restored = await backend.restoreSession();
if (restored?.user) await enterApp(restored); else showAuth();
