import { APP_CONFIG, MODULES, NAV_ITEMS, PAGE_META } from './app/config.js';
import { store } from './app/store.js';
import { backend } from './app/backend.js';
import { financeApi } from './app/finance-api.js';
import { dateInputValue, escapeHtml, dateTimeLocalValue, monthInputValue, financeEventTimestamp, moneyText } from './app/format.js';
import { setLocale, t, translateElement } from './app/i18n.js';
import { icon, hydrateStaticIcons } from './app/icons.js';
import { guessMapping, rowToTransaction, applyCategoryRules, transactionFingerprint, merchantFromTransaction, normalizeMerchantKey, resolveCanonicalMerchant, suggestKnownCategoryCandidates } from './app/csv-import.js';
import { parseImportFile } from './app/import-file.js';
import { countryConfig } from './country/index.js';
import { convertAmount } from './app/fx.js';
import { buildCategorizationGroups } from './app/categorization.js';
import { buildCategoryMlModel, predictCategoryMl } from './app/ml-categorization.js';
import { buildSetupStatus } from './app/setup-model.js';
import { resolveFinanceCycle } from './app/finance-cycle.js';
import { buildBudgetDecisionGuide } from './app/finance-coach.js';
import {
  DEFAULT_IDLE_MINUTES, MAX_SESSION_HOURS, formatRemainingMinutes, normalizeIdleMinutes,
  presenceActivityState, sessionStatus,
} from './app/session-guard.js';
import {
  RELEASE_CHECK_INTERVAL_MS, clearFinanceCaches, fetchReleaseManifest,
  releaseMismatch, releaseReloadUrl, schemaCompatibility,
} from './app/release-guard.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from './app/financial-effects.js';
import {
  createEconomicTransaction, createEconomicTransfer, recordDebtMovement,
  createReceivableMovement, recordReceivableMovement, recordBillMovement, recordTaxMovement,
  merchantDefaultCategory,
} from './app/transaction-engine.js';
import { withPrimaryAccountPreference } from './app/user-preferences.js';
import { rankCategoriesByUsage } from './app/category-ranking.js';
import { merchantSimilarity, preferredTransactionToKeep, transactionMergeCandidates } from './app/duplicate-intelligence.js?v=20261006-r35';

import { renderOverview } from './views/overview.js';
import { renderMoney } from './views/money.js';
import { renderPlanning } from './views/planning.js';
import { renderSetupGuide } from './views/setup.js';
import { renderAccounts } from './views/accounts.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderMerchants } from './views/merchants.js';
import { renderImports } from './views/imports.js';
import { renderImportHistory } from './views/import-history.js';
import { renderRecurring } from './views/recurring.js';
import { renderFixedCosts } from './views/fixed-costs.js';
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
import { renderProfile } from './views/profile.js';
import { renderAdmin } from './views/admin.js';
import { renderReview } from './views/review.js';
import { renderSearch } from './views/search.js';
import { renderProjects } from './views/projects.js';

const views = {
  overview: renderOverview,
  review: renderReview,
  search: renderSearch,
  projects: renderProjects,
  money: renderMoney,
  planning: renderPlanning,
  setup: renderSetupGuide,
  accounts: renderAccounts,
  transactions: renderTransactions,
  categories: renderCategories,
  merchants: renderMerchants,
  imports: renderImports,
  'import-history': renderImportHistory,
  recurring: renderRecurring,
  'fixed-costs': renderFixedCosts,
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
  profile: renderProfile,
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
  merchantAliases: [],
  counterparties: [],
  transactionContexts: [],
  countryMasterCategories: [],
  countryMasterMerchants: [],
  masterDataHouseholds: [],
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
  taxRuleVersions: [],
  taxCases: [],
  taxPeople: [],
  taxChildren: [],
  taxEmployments: [],
  taxCaseSections: [],
  taxItems: [],
  taxObligations: [],
  taxPayments: [],
  fxRates: null,
  runtimeState: null,
  previousVisitAt: null,
  changeHistory: [],
};

const importState = { items: [] };
const uiState = { adminQuery: '', adminPage: 1, adminExpandedUserId: null, demoCredentials: null, importQuery: '', importCategory: 'all', merchantQuery: '', searchQuery: '', transactionView: 'summary', transactionPeriod: 'month', transactionQuery: '', transactionCategory: 'all', transactionAccount: 'all', transactionContext: 'all', transactionVehicle: 'all', transactionDirection: 'all', transactionSemantic: 'all', transactionCategoryIds: [], transactionSourceSet: [], transactionFrom: '', transactionTo: '', transactionPage: 1, categorizationOpen: false, categorizationFilter: 'action', categorizationPage: 1, categorizationGroupKey: '', debtExpandedId: null, receivableExpandedId: null, budgetExpandedMerchantId: null, pendingTransactionEditId: null, taxYear: new Date().getFullYear(), taxReceiptTxId: null, taxItemDocumentId: null };

const authGate = document.querySelector('#authGate');
const appShell = document.querySelector('#appShell');
const pageContent = document.querySelector('#pageContent');
const pageTitle = document.querySelector('#pageTitle');
const pageEyebrow = document.querySelector('#pageEyebrow');
const desktopNav = document.querySelector('#desktopNav');
const mobileNav = document.querySelector('#mobileNav');
const themeButton = document.querySelector('#themeButton');
const privacyButton = document.querySelector('#privacyButton');
const searchButton = document.querySelector('#searchButton');
const mobileMenuButton = document.querySelector('#mobileMenuButton');
const mobileScrim = document.querySelector('#mobileScrim');
const quickAddSheet = document.querySelector('#quickAddSheet');
const quickAddScrim = document.querySelector('#quickAddScrim');
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

async function recordChange({type,label,before=[],after=[],undoable=true}={}) {
  const payload={
    household_id:runtime.household.id,
    action_type:type||'change',
    label:label||'Änderung',
    before_data:Array.isArray(before)?before:[],
    after_data:Array.isArray(after)?after:[],
  };
  const saved=await financeApi.createTransactionChangeLog(payload);
  const entry={
    id:saved.id,
    type:saved.action_type,
    label:saved.label,
    before:saved.before_data||[],
    after:saved.after_data||[],
    undoable:Boolean(undoable),
    undone:Boolean(saved.undone_at),
    at:saved.created_at,
  };
  runtime.changeHistory.unshift(entry);
  runtime.changeHistory=runtime.changeHistory.slice(0,100);
  return entry;
}

async function undoRecordedChange(entry) {
  if(!entry||entry.undone||!entry.undoable) throw new Error('Diese Änderung kann nicht rückgängig gemacht werden.');
  if(entry.type==='category_bulk'){
    for(const row of entry.before||[]){
      if(row.entity==='merchant') await financeApi.updateMerchant(row.id,{default_category_id:row.default_category_id||null});
      else await financeApi.updateTransaction(row.id,{category_id:row.category_id||null,merchant_id:row.merchant_id||null});
    }
    const undoneAt=new Date().toISOString();
    await financeApi.updateTransactionChangeLog(entry.id,{undone_at:undoneAt});
    entry.undone=true;
    return;
  }
  if(entry.type==='semantic_bulk'){
    for(const row of entry.before||[]){
      await financeApi.updateTransaction(row.id,{semantic_type:row.semantic_type||null});
    }
    const undoneAt=new Date().toISOString();
    await financeApi.updateTransactionChangeLog(entry.id,{undone_at:undoneAt});
    entry.undone=true;
    return;
  }
  throw new Error('Für diese Änderung ist kein sicherer Rückgängig-Schritt verfügbar.');
}

async function savePrimaryAccountPreference(accountId) {
  const householdId=runtime.household?.id;
  if(!householdId) throw new Error('Kein Haushalt aktiv.');
  const account=runtime.accounts.find((row)=>row.account_id===accountId&&!row.is_archived);
  if(!account) throw new Error('Bitte ein gültiges Hauptkonto auswählen.');
  const preferences=withPrimaryAccountPreference(profilePreferences(),householdId,account.account_id);
  runtime.profile=await financeApi.updateProfile(runtime.user.id,{preferences});
  applyPrivacyUI();
  updateProfileUI();
  return account;
}

function applyPrivacyUI() {
  const enabled = privacyEnabled();
  document.documentElement.classList.toggle('privacy-mode', enabled);
  if (privacyButton) {
    privacyButton.innerHTML = icon(enabled ? 'eye' : 'eye-off');
    const privacyLabel=t(enabled ? 'Finanzwerte anzeigen' : 'Finanzwerte verbergen');
    privacyButton.setAttribute('aria-label', privacyLabel);
    privacyButton.title = privacyLabel;
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
  return t(({ owner:'Owner', admin:'Haushalt-Admin', editor:'Editor', viewer:'Nur lesen' })[role] || 'Keine Rolle');
}

function enabledNavItems() {
  return NAV_ITEMS.filter((item) => moduleEnabled(item.module) && (!item.adminOnly || Boolean(runtime.adminRole)));
}

function renderNavigation() {
  const primary = enabledNavItems().filter((item) => item.primary);
  const management = [
    `<a class="nav-item" href="#/settings" data-route="settings" data-section="settings">${icon('settings')}<span>${escapeHtml(t('Einstellungen'))}</span></a>`,
    runtime.adminRole
      ? `<a class="nav-item" href="#/admin" data-route="admin" data-section="settings">${icon('shield')}<span>${escapeHtml(t('Administration'))}</span></a>`
      : '',
  ].filter(Boolean).join('');

  desktopNav.innerHTML = `
    <div class="nav-group-label">${escapeHtml(t('Finance'))}</div>
    ${primary.map((item) => `<a class="nav-item" href="#/${item.route}" data-route="${item.route}" data-section="${item.section || item.route}">${icon(item.icon)}<span>${escapeHtml(t(item.label))}</span></a>`).join('')}
    <div class="nav-group-label nav-group-label--management">${escapeHtml(t('Mehr'))}</div>
    ${management}
  `;

  mobileNav.innerHTML = `
    <a href="#/overview" data-route="overview" data-section="overview">${icon('home')}<span>${escapeHtml(t('Übersicht'))}</span></a>
    <a href="#/review" data-route="review" data-section="review">${icon('check-circle')}<span>${escapeHtml(t('Prüfen'))}</span></a>
    <button class="mobile-quick-add" id="mobileQuickAddButton" type="button" aria-label="${escapeHtml(t('Hinzufügen'))}" ${canWriteHousehold() ? '' : 'disabled'}>${icon('plus')}</button>
    <a href="#/money" data-route="money" data-section="money">${icon('wallet')}<span>${escapeHtml(t('Geld'))}</span></a>
    <a href="#/planning" data-route="planning" data-section="planning">${icon('target')}<span>${escapeHtml(t('Planung'))}</span></a>
  `;
}

function routeSection(route) {
  if (['settings','categories','merchants','setup','profile','admin'].includes(route)) return 'settings';
  if (route === 'import-history') return 'money';
  if (route === 'search') return 'settings';
  if (route === 'review') return 'review';
  return NAV_ITEMS.find((item) => item.route === route)?.section || route;
}

function resolveRoute() {
  const requested = (location.hash || '#/overview').replace(/^#\//, '').split('?')[0];
  const allowed = new Set([...enabledNavItems().map((item) => item.route), 'settings', 'setup', 'profile', 'search']);
  if (moduleEntitled('money')) { allowed.add('categories'); allowed.add('merchants'); allowed.add('import-history'); }
  const onboardingPending = Boolean(runtime.profile && !runtime.profile.onboarding_completed_at);
  if (onboardingPending) {
    const setupCoreRoutes = new Set(['setup','accounts','categories','merchants','settings','fixed-costs','recurring','imports','documents']);
    if (setupCoreRoutes.has(requested)) return requested;
    const setupOptionalRoutes = new Set(['budget','goals','debts','receivables','tax-advisor']);
    if (setupOptionalRoutes.has(requested) && allowed.has(requested)) return requested;
    return 'setup';
  }
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

function quickAddSheetHtml() {
  const transferOption = runtime.accounts.length > 1
    ? `<a class="quick-add-option" href="#/transactions?create=transfer"><span>${icon('repeat')}</span><strong>Umbuchung</strong><small>Zwischen eigenen Konten</small></a>`
    : `<button class="quick-add-option" type="button" disabled><span>${icon('repeat')}</span><strong>Umbuchung</strong><small>Mindestens 2 Konten nötig</small></button>`;
  const debtOptions = moduleEnabled('debts') ? `
    <a class="quick-add-option" href="#/debts?create=debt"><span>${icon('credit-card')}</span><strong>Schuld</strong><small>Kredit oder offene Schuld</small></a>
    <a class="quick-add-option" href="#/receivables?create=receivable"><span>${icon('banknote')}</span><strong>Forderung</strong><small>Verliehenes Geld</small></a>
  ` : '';
  return `
    <div class="quick-add-handle" aria-hidden="true"></div>
    <div class="quick-add-head"><div><strong>Hinzufügen</strong><span>Was möchtest du erfassen?</span></div><button class="icon-button" type="button" data-quick-add-close aria-label="Schliessen">×</button></div>
    <div class="quick-add-grid">
      <a class="quick-add-option" href="#/transactions?create=expense"><span>${icon('arrow-up-right')}</span><strong>Ausgabe</strong><small>Geld ist abgeflossen</small></a>
      <a class="quick-add-option" href="#/transactions?create=income"><span>${icon('arrow-down-left')}</span><strong>Einnahme</strong><small>Geld ist eingegangen</small></a>
      <a class="quick-add-option" href="#/transactions?create=receipt"><span>${icon('receipt')}</span><strong>Beleg</strong><small>Fotografieren & erkennen</small></a>
      ${transferOption}
      ${debtOptions}
    </div>
  `;
}

function openQuickAdd() {
  if (!runtime.household || !canWriteHousehold()) {
    showToast('Du hast für diesen Haushalt nur Leserechte.', 'error');
    return;
  }
  if (!quickAddSheet || !quickAddScrim) return;
  quickAddSheet.innerHTML = quickAddSheetHtml();
  translateElement(quickAddSheet);
  quickAddSheet.hidden = false;
  quickAddScrim.hidden = false;
  document.body.classList.add('quick-add-open');
}

function closeQuickAdd() {
  if (quickAddSheet) quickAddSheet.hidden = true;
  if (quickAddScrim) quickAddScrim.hidden = true;
  document.body.classList.remove('quick-add-open');
}

function applyRouteIntent(route) {
  if (!canWriteHousehold()) return;
  const query = (location.hash.split('?')[1] || '').trim();
  if (!query) return;
  const params = new URLSearchParams(query);
  const create = params.get('create');
  const accountId = params.get('account');
  const contextId = params.get('context');
  if (route === 'transactions' && contextId && runtime.transactionContexts.some((row)=>row.id===contextId)) {
    uiState.transactionContext=contextId;
    uiState.transactionPeriod='all';
    uiState.transactionPage=1;
  }
  if (route === 'transactions' && accountId && runtime.accounts.some((row)=>row.account_id===accountId)) {
    uiState.transactionAccount = accountId;
    uiState.transactionPage = 1;
  }
  if (!create) {
    if (accountId||contextId) history.replaceState(null, '', `#/${route}`);
    return;
  }

  history.replaceState(null, '', `#/${route}`);

  if (route === 'transactions' && create === 'receipt') {
    requestAnimationFrame(() => pageContent.querySelector('[data-action="receipt-camera"]')?.click());
    return;
  }

  const formId = ({
    accounts: { account: 'account-create' },
    transactions: { expense: 'transaction-create', income: 'transaction-create', transaction: 'transaction-create', transfer: 'transfer-create' },
    debts: { debt: 'debt-create' },
    receivables: { receivable: 'receivable-create' },
  })[route]?.[create];

  if (!formId) return;
  const form = document.getElementById(formId);
  if (!form) return;
  form.removeAttribute('hidden');
  if (formId === 'transaction-create' && ['expense','income'].includes(create)) {
    const direction = form.querySelector('[name="direction"]');
    if (direction) direction.value = create;
    const account = form.querySelector('[name="accountId"]');
    if (account && accountId) account.value = accountId;
  }
  if (formId === 'transfer-create' && accountId) {
    const source = form.querySelector('[name="fromAccountId"]');
    if (source) source.value = accountId;
  }
  requestAnimationFrame(() => form.scrollIntoView({ behavior:'smooth', block:'start' }));
}

function syncMobileScrollState() {
  const compact = window.matchMedia('(max-width: 660px)').matches && window.scrollY > 46;
  document.body.classList.toggle('mobile-title-collapsed', compact);
}

function updateProfileUI() {
  setLocale(runtime.profile?.locale || APP_CONFIG.defaultLocale);
  const fallbackName = runtime.user?.email?.split('@')[0] || 'Privat';
  const name = runtime.profile?.display_name || fallbackName;
  profileAvatar.textContent = name.trim().charAt(0).toUpperCase() || 'F';
  profileName.textContent = name;
  profileMeta.textContent = runtime.user?.email || '';
  profileButton?.setAttribute('aria-label', `${t('Konto und Zugriff')} – ${runtime.user?.email || name}`);
  translateElement(document.querySelector('.sidebar-footer'));
  translateElement(document.querySelector('.topbar'));
  applyReleaseChannelUI();
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
    <div class="profile-popover-actions"><a class="action-button action-button--secondary" href="#/profile" data-action="profile-close">Mein Profil</a><a class="action-button action-button--secondary" href="#/settings" data-action="profile-close">Einstellungen</a><button class="action-button action-button--secondary" type="button" data-action="logout">Abmelden</button></div>
  </div>`;
}

function closeProfileMenu() {
  document.querySelector('#profilePopover')?.remove();
  profileButton?.setAttribute('aria-expanded','false');
}

const SESSION_KEYS=Object.freeze({
  lastInteraction:'finance:lastInteractionAt',
  sessionStarted:'finance:sessionStartedAt',
  timeout:'finance:sessionTimeoutMinutes',
});
const SESSION_WARNING_ID='sessionExpiryWarning';
const RELEASE_OVERLAY_ID='releaseUpdateOverlay';
const BACKGROUND_REFRESH_MS=5*60_000;

let presenceTimer=null;
let adminPresenceTimer=null;
let sessionGuardTimer=null;
let releaseTimer=null;
let hiddenAt=null;
let releaseCheckInFlight=null;
let releaseReloading=false;
let lastInteractionPersistAt=0;

function releaseUiMeta() {
  const channel=APP_CONFIG.releaseChannel||'stable';
  const label=channel==='beta'?'Beta':channel==='local'?'Local':'Stable';
  const shortRelease=String(APP_CONFIG.releaseId||'').split('-').pop()||APP_CONFIG.releaseId||'';
  return {channel,label,shortRelease};
}

function applyReleaseChannelUI() {
  const {channel,label,shortRelease}=releaseUiMeta();
  const pill=document.querySelector('#releaseVersionPill');
  const heading=document.querySelector('#releaseChannelLabel');
  const caption=document.querySelector('#releaseChannelCaption');
  if(pill) pill.textContent=`V${APP_CONFIG.version} · ${label.toUpperCase()} · ${shortRelease.toUpperCase()}`;
  if(heading) heading.textContent=`${label} ${APP_CONFIG.version}`;
  if(caption) caption.textContent=`${shortRelease.toUpperCase()} · ${channel==='beta'
    ? t('Teststand · kann sich ändern')
    : channel==='local'
      ? t('Lokale Entwicklungsumgebung')
      : t('Freigegebener Stand · Supabase')}`;
  document.documentElement.dataset.releaseChannel=channel;
  document.documentElement.dataset.releaseId=APP_CONFIG.releaseId;
}

function currentDeviceLabel() {
  const ua=navigator.userAgent||'';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return 'Browser';
}

function storageNumber(key){
  try {
    const value=Number(localStorage.getItem(key));
    return Number.isFinite(value)&&value>0?value:null;
  } catch { return null; }
}

function persistNumber(key,value){
  try { localStorage.setItem(key,String(value)); } catch {}
}

function clearSessionClock(){
  try {
    localStorage.removeItem(SESSION_KEYS.lastInteraction);
    localStorage.removeItem(SESSION_KEYS.sessionStarted);
  } catch {}
}

function configuredSessionTimeout(){
  const preferred=profilePreferences().session_timeout_minutes;
  const stored=storageNumber(SESSION_KEYS.timeout);
  return normalizeIdleMinutes(preferred??stored??DEFAULT_IDLE_MINUTES);
}

function ensureSessionClock({fresh=false}={}){
  const now=Date.now();
  let started=fresh?null:storageNumber(SESSION_KEYS.sessionStarted);
  let last=fresh?null:storageNumber(SESSION_KEYS.lastInteraction);
  if(!started) started=now;
  if(!last) last=now;
  persistNumber(SESSION_KEYS.sessionStarted,started);
  persistNumber(SESSION_KEYS.lastInteraction,last);
  return {started,last};
}

function sessionClock(){
  const clock=ensureSessionClock();
  return {
    sessionStartedAt:clock.started,
    lastInteractionAt:clock.last,
    idleMinutes:configuredSessionTimeout(),
  };
}

function hideSessionWarning(){
  document.querySelector(`#${SESSION_WARNING_ID}`)?.remove();
}

function renderSessionWarning(status){
  let banner=document.querySelector(`#${SESSION_WARNING_ID}`);
  if(!banner){
    banner=document.createElement('aside');
    banner.id=SESSION_WARNING_ID;
    banner.className='session-expiry-warning';
    banner.setAttribute('role','alert');
    document.body.appendChild(banner);
  }
  const minutes=formatRemainingMinutes(status.remainingMs);
  banner.innerHTML=`<div><strong>${escapeHtml(t('Sitzung läuft bald ab'))}</strong><span>${escapeHtml(t(`Ohne Bedienung wirst du in ${minutes} Min. automatisch abgemeldet.`))}</span></div><button class="action-button action-button--primary" type="button" data-session-continue>${escapeHtml(t('Weiterarbeiten'))}</button>`;
  banner.querySelector('[data-session-continue]')?.addEventListener('click',()=>{
    markInteraction(true);
    hideSessionWarning();
    void pulsePresence();
  },{once:true});
}

function markInteraction(force=false){
  if(!runtime.user) return;
  const now=Date.now();
  if(!force&&now-lastInteractionPersistAt<5000) return;
  lastInteractionPersistAt=now;
  persistNumber(SESSION_KEYS.lastInteraction,now);
  hideSessionWarning();
}

function currentSessionStatus(){
  const clock=sessionClock();
  return sessionStatus({
    now:Date.now(),
    lastInteractionAt:clock.lastInteractionAt,
    sessionStartedAt:clock.sessionStartedAt,
    idleMinutes:clock.idleMinutes,
    maxSessionHours:MAX_SESSION_HOURS,
  });
}

function showReleaseUpdating(message='Neue Finance-Version wird geladen …'){
  let overlay=document.querySelector(`#${RELEASE_OVERLAY_ID}`);
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id=RELEASE_OVERLAY_ID;
    overlay.className='release-update-overlay';
    overlay.setAttribute('role','alert');
    document.body.appendChild(overlay);
  }
  overlay.innerHTML=`<div class="release-update-card"><span class="loading-spinner" aria-hidden="true"></span><strong>${escapeHtml(t(message))}</strong><span>${escapeHtml(t('Deine Finanzdaten bleiben unverändert.'))}</span></div>`;
}

async function reloadForRelease(releaseId,message='Neue Finance-Version wird geladen …'){
  if(releaseReloading) return false;
  releaseReloading=true;
  showReleaseUpdating(message);
  stopLiveTimers();
  await clearFinanceCaches().catch(()=>null);
  const next=releaseReloadUrl(location,releaseId||Date.now());
  location.replace(next);
  return false;
}

async function ensureCurrentRelease(){
  if(releaseReloading) return false;
  if(releaseCheckInFlight) return releaseCheckInFlight;
  releaseCheckInFlight=(async()=>{
    try {
      const manifest=await fetchReleaseManifest(`./version.json?check=${Date.now()}`);
      if(releaseMismatch(APP_CONFIG.releaseId,manifest)){
        return reloadForRelease(manifest.releaseId,'Neue Finance-Version verfügbar. Finance wird aktualisiert …');
      }
      return true;
    } catch {
      // Netzwerkfehler dürfen eine bereits geladene, kompatible App nicht blockieren.
      return true;
    } finally {
      releaseCheckInFlight=null;
    }
  })();
  return releaseCheckInFlight;
}

async function ensureRuntimeCompatibility(){
  let state;
  try {
    state=await financeApi.getRuntimeState();
  } catch {
    // Wenn der Versions-RPC vorübergehend nicht erreichbar ist, kann die App weiterarbeiten.
    // Datenzugriffe selbst bleiben weiterhin durch Supabase geschützt.
    runtime.runtimeState=null;
    return true;
  }
  runtime.runtimeState=state;
  const compatibility=schemaCompatibility(APP_CONFIG.schemaVersion,state);
  if(!compatibility.ok){
    if(compatibility.reason==='server_too_old'){
      showReleaseUpdating('Finance-Datenbank wird aktualisiert. Bitte kurz warten …');
      return false;
    }
    const manifest=await fetchReleaseManifest(`./version.json?schema=${Date.now()}`).catch(()=>({releaseId:APP_CONFIG.releaseId}));
    return reloadForRelease(manifest.releaseId||APP_CONFIG.releaseId,'Finance-Version und Datenbank werden synchronisiert …');
  }
  return true;
}

async function pulsePresence({force=false,stateOverride=null}={}){
  if(!runtime.user) return;
  if(document.visibilityState==='hidden'&&!force) return;
  const clock=sessionClock();
  const activityState=stateOverride||presenceActivityState({
    now:Date.now(),
    lastInteractionAt:clock.lastInteractionAt,
  });
  await financeApi.touchPresence({
    route:(location.hash||'#/overview').replace(/^#\//,'').split('?')[0],
    appVersion:`${APP_CONFIG.version}-${APP_CONFIG.releaseChannel}-${APP_CONFIG.releaseId}`,
    deviceLabel:currentDeviceLabel(),
    activityState,
    lastInteractionAt:new Date(clock.lastInteractionAt).toISOString(),
    sessionStartedAt:new Date(clock.sessionStartedAt).toISOString(),
  }).catch(()=>null);
}

async function enforceSessionGuard(){
  if(!runtime.user) return false;
  const status=currentSessionStatus();
  if(status.state==='expired'){
    const message=status.reason==='max_session'
      ? 'Maximale Sitzungsdauer erreicht. Bitte erneut anmelden.'
      : 'Du wurdest nach längerer Inaktivität automatisch abgemeldet.';
    await logoutCurrentUser({notice:message});
    return true;
  }
  if(status.state==='warning') renderSessionWarning(status);
  else hideSessionWarning();
  return false;
}

function stopLiveTimers() {
  if (presenceTimer) window.clearInterval(presenceTimer);
  if (adminPresenceTimer) window.clearInterval(adminPresenceTimer);
  if (sessionGuardTimer) window.clearInterval(sessionGuardTimer);
  if (releaseTimer) window.clearInterval(releaseTimer);
  presenceTimer=null;
  adminPresenceTimer=null;
  sessionGuardTimer=null;
  releaseTimer=null;
}

function startLiveTimers() {
  stopLiveTimers();
  ensureSessionClock();
  void pulsePresence();
  void enforceSessionGuard();
  presenceTimer=window.setInterval(()=>{ void pulsePresence(); },45000);
  sessionGuardTimer=window.setInterval(()=>{ void enforceSessionGuard(); },15000);
  releaseTimer=window.setInterval(()=>{ void ensureCurrentRelease(); },RELEASE_CHECK_INTERVAL_MS);
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

async function logoutCurrentUser({notice=''}={}) {
  stopLiveTimers();
  hideSessionWarning();
  closeProfileMenu();
  closeMobileNav();
  closeQuickAdd();
  await financeApi.clearPresence().catch(()=>null);
  await backend.signOut();
  clearSessionClock();
  runtime.session=null;
  runtime.user=null;
  runtime.profile=null;
  runtime.household=null;
  runtime.householdRole=null;
  runtime.adminRole=null;
  runtime.runtimeState=null;
  location.hash='';
  window.scrollTo({top:0,left:0,behavior:'auto'});
  showAuth(notice);
}

function toggleProfileMenu() {
  const existing = document.querySelector('#profilePopover');
  if (existing) { closeProfileMenu(); return; }
  const popover = document.createElement('div');
  popover.id = 'profilePopover';
  popover.className = 'profile-popover';
  popover.innerHTML = profileMenuHtml();
  translateElement(popover);
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
  toast.textContent = t(message);
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

function showAuth(notice='') {
  appShell.hidden = true;
  authGate.hidden = false;
  const {label,shortRelease}=releaseUiMeta();
  authGate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">${icon('wallet')}</span><div><strong>Finance</strong><span>V${escapeHtml(APP_CONFIG.version)} · ${escapeHtml(label.toUpperCase())} · ${escapeHtml(shortRelease.toUpperCase())}</span></div></div>
      <div class="auth-copy"><span class="eyebrow">Finance Core</span><h1>Willkommen zurück</h1><p>Benutzer werden durch einen Administrator angelegt.</p></div>
      ${notice?`<div class="inline-alert"><strong>${escapeHtml(t('Sitzung beendet'))}</strong><span>${escapeHtml(t(notice))}</span></div>`:''}
      <form class="auth-form" id="authForm">
        <label class="field"><span>E-Mail</span><input class="text-control" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Passwort</span><input class="text-control" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <div class="auth-error" id="authError" hidden></div>
        <button class="action-button action-button--primary auth-submit" type="submit">Anmelden</button>
      </form>
    </div>`;

  translateElement(authGate);
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
      await enterApp({ ...result, user: result.user },{freshLogin:true});
    } catch (error) {
      errorBox.textContent = humanError(error);
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

function showLoading(title = 'Daten werden geladen …') {
  pageContent.innerHTML = `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><strong>${escapeHtml(t(title))}</strong></div>`;
}

async function runLimited(tasks, limit = 5) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

async function loadFinanceData() {
  if (!runtime.household) return;
  const h = runtime.household.id;
  const tasks = [
    () => financeApi.listAccounts(h), () => financeApi.listCategories(h), () => financeApi.listCategorizationRules(h), () => financeApi.listTransactions(h),
    () => financeApi.listImportBatches(h), () => financeApi.listMerchants(h), () => financeApi.listMerchantAliases(h), () => financeApi.listCounterparties(h), () => financeApi.listTransactionContexts(h), () => financeApi.listRecurringRules(h), () => financeApi.listBudgets(h), () => financeApi.listBills(h), () => financeApi.listContracts(h),
    () => financeApi.listGoals(h), () => financeApi.listGoalSources(h), () => financeApi.listDebts(h), () => financeApi.listDebtPayments(h), () => financeApi.listReceivables(h), () => financeApi.listReceivablePayments(h), () => financeApi.listLegalCases(h), () => financeApi.listLegalEvents(h), () => financeApi.listAssets(h),
    () => financeApi.listProperties(h), () => financeApi.listVehicles(h), () => financeApi.listInsurance(h), () => financeApi.listInvestments(h), () => financeApi.listInvestmentTransactions(h), () => financeApi.listPensions(h),
    () => financeApi.listDocuments(h), () => financeApi.listHouseholdMembers(h), () => financeApi.getFxRates().catch(()=>null),
    () => financeApi.listCountryCategoryCatalog(runtime.household.country_code).catch(()=>[]),
    () => financeApi.listCountryMerchantCatalog(runtime.household.country_code).catch(()=>[]),
    () => financeApi.listMasterDataHouseholds().catch(()=>[]),
    () => financeApi.listTransactionChangeLogs(h).catch(()=>[]),
    () => financeApi.listTaxRuleVersions().catch(()=>[]),
    () => financeApi.listTaxCases(h).catch(()=>[]),
    () => financeApi.listTaxPeople(h).catch(()=>[]),
    () => financeApi.listTaxChildren(h).catch(()=>[]),
    () => financeApi.listTaxEmployments(h).catch(()=>[]),
    () => financeApi.listTaxCaseSections(h).catch(()=>[]),
    () => financeApi.listTaxItems(h).catch(()=>[]),
    () => financeApi.listTaxObligations(h).catch(()=>[]),
    () => financeApi.listTaxPayments(h).catch(()=>[]),
  ];
  const results = await runLimited(tasks, 5);
  [
    runtime.accounts, runtime.categories, runtime.categorizationRules, runtime.transactions,
    runtime.importBatches, runtime.merchants, runtime.merchantAliases, runtime.counterparties, runtime.transactionContexts, runtime.recurringRules, runtime.budgets, runtime.bills, runtime.contracts,
    runtime.goals, runtime.goalSources, runtime.debts, runtime.debtPayments, runtime.receivables, runtime.receivablePayments, runtime.legalCases, runtime.legalEvents, runtime.assets,
    runtime.properties, runtime.vehicles, runtime.insurance, runtime.investments, runtime.investmentTransactions, runtime.pensions,
    runtime.documents, runtime.householdMembers, runtime.fxRates,
    runtime.countryMasterCategories, runtime.countryMasterMerchants, runtime.masterDataHouseholds,
    runtime.changeHistory,
    runtime.taxRuleVersions, runtime.taxCases, runtime.taxPeople, runtime.taxChildren, runtime.taxEmployments, runtime.taxCaseSections, runtime.taxItems, runtime.taxObligations, runtime.taxPayments,
  ] = results.map((value) => value || (value === null ? null : []));
  runtime.changeHistory=(runtime.changeHistory||[]).map((row)=>({
    id:row.id,
    type:row.action_type||row.type,
    label:row.label,
    before:row.before_data||row.before||[],
    after:row.after_data||row.after||[],
    undoable:['category_bulk','semantic_bulk'].includes(row.action_type||row.type),
    undone:Boolean(row.undone_at||row.undone),
    at:row.created_at||row.at,
  }));
}
async function loadContext() {
  const [profile, adminRole, moduleAccess, productModules, households] = await Promise.all([
    financeApi.getProfile(runtime.user.id), financeApi.getAdminRole(runtime.user.id), financeApi.listUserModules(runtime.user.id),
    financeApi.listProductModules(), financeApi.listHouseholds(),
  ]);
  runtime.profile = profile;
  setLocale(profile?.locale || APP_CONFIG.defaultLocale);
  runtime.adminRole = adminRole;
  runtime.moduleAccess = moduleAccess || {};
  runtime.productModules = productModules || [];
  runtime.household = households?.[0] || null;
  runtime.adminUsers = runtime.adminRole ? (await backend.adminListUsers().catch(()=>({ users: [] })))?.users || [] : [];
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
  pageTitle.textContent = t('Einrichtung');
  pageEyebrow.textContent = t('Finance Core');
  document.title = `${t('Einrichtung')} · Finance`;
  const displayName = runtime.profile?.display_name || '';
  pageContent.innerHTML = `
    <header class="page-header"><p class="page-kicker">Einmalige Grundeinrichtung</p><h2 class="page-heading">Dein Finance Core</h2><p class="page-subtitle">Lege zuerst Sprache, Land, Basiswährung und Haushalt fest. Danach führt dich Finance durch Konten, Kategorien und Händler.</p></header>
    <form class="card card-padding setup-card" id="setup-create" data-form="setup-create">
      <div class="form-grid form-grid--2">
        <label class="field"><span>Anzeigename</span><input class="text-control" name="displayName" value="${escapeHtml(displayName)}" required></label>
        <label class="field"><span>Haushalt</span><input class="text-control" name="householdName" value="Privat" required></label>
        <label class="field"><span>Sprache & Region</span><select class="text-control" name="locale" id="setupLocale">
          <option value="de-CH">Deutsch · Schweiz</option><option value="de-DE">Deutsch · Deutschland</option>
          <option value="it-CH">Italiano · Svizzera</option><option value="it-IT">Italiano · Italia</option>
          <option value="en-CH">English · Switzerland</option><option value="en-GB">English · United Kingdom</option>
        </select></label>
        <label class="field"><span>Land</span><select class="text-control" name="countryCode" id="setupCountry"><option value="CH">Schweiz</option><option value="DE">Deutschland</option></select></label>
        <label class="field"><span>Basiswährung</span><select class="text-control" name="baseCurrency" id="setupCurrency"><option value="CHF">CHF</option><option value="EUR">EUR</option></select><small>Konten können später unabhängig davon CHF, EUR, USD oder GBP führen.</small></label>
      </div>
      <div class="form-actions"><button class="action-button action-button--primary" type="submit">Weiter zur Einrichtung</button></div>
    </form>`;
  document.querySelector('#setupCountry')?.addEventListener('change', (event) => {
    const currency = document.querySelector('#setupCurrency');
    currency.value = event.target.value === 'DE' ? 'EUR' : 'CHF';
  });
  translateElement(pageContent);
}

function render() {
  if (!runtime.user) return;
  if (!runtime.household) { renderSetup(); return; }
  renderNavigation();
  const route = resolveRoute();
  const meta = PAGE_META[route] || PAGE_META.overview;
  pageTitle.textContent = t(meta.title);
  pageEyebrow.textContent = t(meta.eyebrow);
  document.title = `${t(meta.title)} · Finance`;
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
    demoCredentials: uiState.demoCredentials,
    importQuery: uiState.importQuery,
    importCategory: uiState.importCategory,
    merchantQuery: uiState.merchantQuery,
    searchQuery: uiState.searchQuery,
    previousVisitAt: runtime.previousVisitAt,
    changeHistory: runtime.changeHistory,
    transactionView: uiState.transactionView,
    transactionPeriod: uiState.transactionPeriod,
    transactionQuery: uiState.transactionQuery,
    transactionCategory: uiState.transactionCategory,
    transactionAccount: uiState.transactionAccount,
    transactionContext: uiState.transactionContext,
    transactionVehicle: uiState.transactionVehicle,
    transactionDirection: uiState.transactionDirection,
    transactionSemantic: uiState.transactionSemantic,
    transactionCategoryIds: uiState.transactionCategoryIds,
    transactionSourceSet: uiState.transactionSourceSet,
    transactionFrom: uiState.transactionFrom,
    transactionTo: uiState.transactionTo,
    transactionPage: uiState.transactionPage,
    categorizationOpen: uiState.categorizationOpen,
    categorizationFilter: uiState.categorizationFilter,
    categorizationPage: uiState.categorizationPage,
    categorizationGroupKey: uiState.categorizationGroupKey,
    debtExpandedId: uiState.debtExpandedId,
    receivableExpandedId: uiState.receivableExpandedId,
    budgetExpandedMerchantId: uiState.budgetExpandedMerchantId,
    taxYear: uiState.taxYear,
  });
  document.querySelectorAll('[data-route]').forEach((el) => el.dataset.route === route ? el.setAttribute('aria-current','page') : el.removeAttribute('aria-current'));
  const section = routeSection(route);
  mobileNav.querySelectorAll('[data-section]').forEach((el) => el.dataset.section === section ? el.setAttribute('aria-current','page') : el.removeAttribute('aria-current'));
  applyPermissionUI(route);
  translateElement(pageContent);
  applyInformationDepth();
  closeMobileNav();
  closeQuickAdd();
  closeProfileMenu();
  applyPrivacyUI();
  window.scrollTo({ top: 0, behavior: 'auto' });
  applyRouteIntent(route);
  if (route==='transactions' && uiState.pendingTransactionEditId) {
    const pendingId=uiState.pendingTransactionEditId;
    uiState.pendingTransactionEditId=null;
    requestAnimationFrame(()=>{
      const tx=runtime.transactions.find((row)=>row.id===pendingId);
      if(tx) openTransactionEditor(tx);
    });
  }
}

function applyInformationDepth() {
  const depth=store.getState().depth||'standard';
  if(depth==='expert') return;
  const hide=(selector)=>pageContent.querySelectorAll(selector).forEach((el)=>{
    const target=el.closest('.field, details, .category-advanced')||el;
    target.classList.add('depth-hidden');
  });
  if(depth==='simple'){
    hide('[name="merchantId"],[name="counterpartyKind"],[name="semanticType"],[name="excludeFromReports"],#transactionVehicleFilter,#transactionSemanticFilter,#transactionFrom,#transactionTo,#transactionViewSelect');
    pageContent.querySelectorAll('.category-advanced').forEach((el)=>el.classList.add('depth-hidden'));
  } else {
    hide('[name="semanticType"],[name="excludeFromReports"]');
  }
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
      if (!['document-download','document-preview','tax-export-csv','profile-close','receivable-history','receivable-history-close','budget-suggestion-toggle'].includes(el.dataset.action)) el.disabled = true;
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
  let changed = 0;

  const masterResult = await financeApi.installCountryMasterData(householdId).catch(()=>null);
  changed += Number(masterResult?.categories_created||0) + Number(masterResult?.merchants_created||0) + Number(masterResult?.merchants_linked||0);

  let categories = existingCategories.length ? existingCategories : await financeApi.listCategories(householdId);
  const parentKeys = new Set(categories.filter((category)=>!category.parent_id).map((category)=>`${category.kind}:${String(category.name||'').toLowerCase()}`));
  const missingParents = (cfg.starterCategories || []).filter(([name,kind])=>!parentKeys.has(`${kind}:${name.toLowerCase()}`));
  if (missingParents.length) {
    await financeApi.createCategories(missingParents.map(([name,kind],index)=>({
      household_id:householdId, name, kind, sort_order:(index+1)*10,
    })));
    changed += missingParents.length;
    categories = await financeApi.listCategories(householdId);
  } else if (masterResult) {
    categories = await financeApi.listCategories(householdId);
  }

  const childKeys = new Set(categories.filter((category)=>category.parent_id).map((category)=>`${category.parent_id}:${String(category.name||'').toLowerCase()}`));
  const childRows = [];
  for (const [name,parentName,kind] of (cfg.starterSubcategories || [])) {
    const parent = categories.find((category)=>!category.parent_id && category.kind===kind && String(category.name||'').toLowerCase()===parentName.toLowerCase());
    if (!parent) continue;
    const key=`${parent.id}:${name.toLowerCase()}`;
    if (childKeys.has(key)) continue;
    childRows.push({ household_id:householdId, parent_id:parent.id, name, kind, sort_order:(childRows.length+1)*10 });
    childKeys.add(key);
  }
  if (childRows.length) {
    await financeApi.createCategories(childRows);
    changed += childRows.length;
    categories = await financeApi.listCategories(householdId);
  }

  const merchants = await financeApi.listMerchants(householdId);
  for (const [merchantName,targetCategoryName] of (cfg.starterMerchantCategories || [])) {
    const target = categories.find((category)=>category.kind==='expense' && String(category.name||'').toLowerCase()===targetCategoryName.toLowerCase());
    if (!target) continue;
    const normalizedKey=normalizeMerchantKey(merchantName);
    const current=merchants.find((merchant)=>merchant.normalized_key===normalizedKey);
    if (current?.default_category_id===target.id) continue;
    if (current?.default_category_id && current.default_category_id !== target.parent_id) continue;
    await financeApi.upsertMerchant({
      household_id:householdId,
      normalized_key:normalizedKey,
      name:current?.name || merchantName,
      default_category_id:target.id,
    });
    changed += 1;
  }

  return changed;
}

function currentCategorizationGroups() {
  return buildCategorizationGroups({
    transactions: runtime.transactions,
    categories: runtime.categories,
    merchants: runtime.merchants,
    aliases: runtime.merchantAliases,
    rules: runtime.categorizationRules,
  });
}

function categorizationSelectedIds(container) {
  return [...(container?.querySelectorAll('[data-categorization-select]:checked')||[])].map((input)=>input.value).filter(Boolean);
}

function updateCategorizationSelectedCount(container) {
  const count=categorizationSelectedIds(container).length;
  const label=container?.querySelector('[data-categorization-selected-count]');
  if(label) label.textContent=`${count} ausgewählt`;
  return count;
}

function uniqueBulkTransferCandidate(tx,otherAccountId,selectedIds,expectedAmount=null) {
  const selected=new Set(selectedIds||[]);
  const txTime=new Date(tx.occurred_at).getTime();
  const sign=Math.sign(Number(tx.amount));
  const requestedAmount=Number(expectedAmount);
  const amount=Number.isFinite(requestedAmount)&&requestedAmount>0 ? Math.abs(requestedAmount) : Math.abs(Number(tx.amount));
  const candidates=runtime.transactions.filter((row)=>{
    if(row.id===tx.id||selected.has(row.id)) return false;
    if(row.account_id!==otherAccountId||row.transfer_group_id||row.status!=='booked'||row.cashflow_type!=='standard') return false;
    if(runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===row.id)) return false;
    if(Math.sign(Number(row.amount))!==-sign||Math.abs(Math.abs(Number(row.amount))-amount)>=0.005) return false;
    const rowTime=new Date(row.occurred_at).getTime();
    return Number.isFinite(txTime)&&Number.isFinite(rowTime)&&Math.abs(rowTime-txTime)<=7*24*60*60*1000;
  });
  if(candidates.length>1) throw new Error(`Für „${tx.description}“ gibt es mehrere mögliche Gegenbuchungen. Bitte diese Buchung einzeln prüfen.`);
  return candidates[0]||null;
}

function syncCategorizationTransferFx(container) {
  const box=container?.querySelector('[data-categorization-transfer-fx]');
  if(!box) return null;
  const input=box.querySelector('[data-categorization-transfer-amount]');
  const label=box.querySelector('[data-categorization-transfer-fx-label]');
  const rateLabel=box.querySelector('[data-categorization-transfer-rate]');
  const ids=categorizationSelectedIds(container);
  const otherAccountId=container?.querySelector('[data-categorization-transfer-account]')?.value||'';
  const tx=ids.length===1 ? runtime.transactions.find((row)=>row.id===ids[0]) : null;
  const currentAccount=tx ? runtime.accounts.find((row)=>row.account_id===tx.account_id) : null;
  const otherAccount=runtime.accounts.find((row)=>row.account_id===otherAccountId&&!row.is_archived) || null;
  const foreign=Boolean(tx&&currentAccount&&otherAccount&&currentAccount.currency!==otherAccount.currency);

  box.hidden=!foreign;
  if(input){
    input.disabled=!foreign;
    input.required=foreign;
    if(!foreign) input.value='';
  }
  if(!foreign){
    if(rateLabel) rateLabel.textContent='';
    return null;
  }

  if(label) label.textContent=`Erhaltener Betrag in ${otherAccount.currency}`;
  const sourceAmount=Math.abs(Number(tx.amount));
  const targetAmount=Number(input?.value||0);
  const locale=runtime.profile?.locale||'de-CH';
  if(rateLabel){
    if(targetAmount>0&&sourceAmount>0){
      const direct=targetAmount/sourceAmount;
      const inverse=sourceAmount/targetAmount;
      const format=(value)=>value.toLocaleString(locale,{minimumFractionDigits:4,maximumFractionDigits:6});
      rateLabel.textContent=`Effektiver Kurs: 1 ${currentAccount.currency} = ${format(direct)} ${otherAccount.currency} · 1 ${otherAccount.currency} = ${format(inverse)} ${currentAccount.currency}`;
    } else {
      rateLabel.textContent=`Gib den Betrag ein, der tatsächlich in ${otherAccount.currency} angekommen ist. Finance berechnet daraus den effektiven Wechselkurs.`;
    }
  }
  return {tx,currentAccount,otherAccount,sourceAmount,targetAmount};
}

async function convertCategorizationSelectionToTransfers(ids,otherAccountId,{otherAmount=null}={}) {
  const selectedIds=[...new Set((ids||[]).filter(Boolean))];
  if(!selectedIds.length) throw new Error('Bitte mindestens eine Buchung markieren.');
  const otherAccount=runtime.accounts.find((row)=>row.account_id===otherAccountId&&!row.is_archived);
  if(!otherAccount) throw new Error('Bitte ein gültiges Gegenkonto auswählen.');

  const selected=selectedIds.map((id)=>runtime.transactions.find((row)=>row.id===id));
  if(selected.some((tx)=>!tx)) throw new Error('Mindestens eine markierte Buchung wurde nicht gefunden.');

  let foreignTransfer=null;
  for(const tx of selected){
    if(tx.transfer_group_id) throw new Error('Mindestens eine markierte Buchung ist bereits eine Umbuchung.');
    if(tx.status!=='booked'||tx.cashflow_type!=='standard') throw new Error('Fachmodul- oder vorgemerkte Buchungen können nicht gesammelt umgebucht werden.');
    if(runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id)) throw new Error('Eine markierte Buchung gehört zu einer bezahlten Rechnung und muss dort verwaltet werden.');
    const currentAccount=runtime.accounts.find((row)=>row.account_id===tx.account_id);
    if(!currentAccount) throw new Error('Konto einer markierten Buchung wurde nicht gefunden.');
    if(currentAccount.account_id===otherAccount.account_id) throw new Error('Das Gegenkonto muss sich vom Konto der markierten Buchungen unterscheiden.');
    if(currentAccount.currency!==otherAccount.currency){
      if(selectedIds.length!==1) throw new Error('Mehrere Buchungen können nur bei gleicher Währung gesammelt umgebucht werden. Fremdwährungsbuchungen bitte einzeln markieren.');
      const targetAmount=Number(otherAmount);
      if(!Number.isFinite(targetAmount)||targetAmount<=0) throw new Error(`Bitte den tatsächlich erhaltenen Betrag in ${otherAccount.currency} eingeben.`);
      const sourceAmount=Math.abs(Number(tx.amount));
      foreignTransfer={
        sourceCurrency:currentAccount.currency,
        targetCurrency:otherAccount.currency,
        sourceAmount,
        targetAmount,
        effectiveRate:targetAmount/sourceAmount,
        inverseRate:sourceAmount/targetAmount,
      };
    }
  }

  let converted=0;
  for(const tx of selected){
    const currentAccount=runtime.accounts.find((row)=>row.account_id===tx.account_id);
    const foreign=currentAccount?.currency!==otherAccount.currency;
    const targetAmount=foreign?Number(otherAmount):null;
    const counterpart=uniqueBulkTransferCandidate(tx,otherAccount.account_id,selectedIds,targetAmount);
    await financeApi.convertTransactionToTransferV2({
      householdId:runtime.household.id,
      transactionId:tx.id,
      otherAccountId:otherAccount.account_id,
      amount:Math.abs(Number(tx.amount)),
      otherAmount:targetAmount,
      otherTransactionId:counterpart?.id||null,
      occurredAt:tx.occurred_at,
      description:tx.description,
      note:tx.note||null,
    });
    converted+=1;
  }
  return {converted,otherAccount,foreignTransfer};
}

async function applyCategorizationGroup(group, categoryId, { onlyUncategorized = false } = {}) {
  if (!group) throw new Error('Händlergruppe wurde nicht gefunden.');
  const category = runtime.categories.find((row)=>row.id===categoryId);
  if (!category || category.kind !== group.kind) throw new Error('Bitte eine passende Kategorie auswählen.');
  const targets = group.rows.filter((row)=>!onlyUncategorized || !row.category_id);
  if (!targets.length) return 0;
  const before=targets.map((row)=>({entity:'transaction',id:row.id,category_id:row.category_id||null,merchant_id:row.merchant_id||null}));

  let merchantId = group.merchantId || null;
  const existingMerchant=merchantId?runtime.merchants.find((row)=>row.id===merchantId):runtime.merchants.find((row)=>row.normalized_key===group.merchantKey);
  if(existingMerchant) before.push({entity:'merchant',id:existingMerchant.id,default_category_id:existingMerchant.default_category_id||null});
  if (group.merchantKey && group.merchantKey !== 'unbekannt') {
    const merchant = await financeApi.upsertMerchant({
      household_id: runtime.household.id,
      normalized_key: group.merchantKey,
      name: group.name,
      default_category_id: category.id,
    });
    merchantId = merchant?.id || merchantId;
    const detected=merchantFromTransaction(group.rows[0]);
    if(merchant?.id && detected?.aliasKey && detected.aliasKey!==merchant.normalized_key){
      await financeApi.upsertMerchantAlias({
        household_id:runtime.household.id,
        merchant_id:merchant.id,
        alias_name:detected.rawName||detected.name,
        normalized_key:detected.aliasKey,
        payment_processor:detected.paymentProcessor||null,
      });
    }
  }

  const patch = { category_id: category.id };
  if (merchantId) patch.merchant_id = merchantId;
  await financeApi.bulkUpdateTransactions(targets.map((row)=>row.id), patch);
  await recordChange({
    type:'category_bulk',
    label:`${targets.length} Buchung${targets.length===1?'':'en'} → ${category.name}`,
    before,
    after:targets.map((row)=>({entity:'transaction',id:row.id,category_id:category.id,merchant_id:merchantId||row.merchant_id||null})),
    undoable:true,
  });
  return targets.length;
}

async function applyImportGroupLearning(ids, categoryId) {
  const selectedIds=new Set((ids||[]).filter(Boolean));
  const selected=runtime.transactions.filter((row)=>selectedIds.has(row.id));
  if(!selected.length) throw new Error('Importgruppe wurde nicht gefunden.');

  const kind=Number(selected[0].amount)<0?'expense':'income';
  const category=runtime.categories.find((row)=>row.id===categoryId);
  if(!category || category.kind!==kind) throw new Error('Bitte eine passende Kategorie auswählen.');

  const detected=merchantFromTransaction(selected[0]);
  if(!detected?.key || detected.key==='unbekannt'){
    await financeApi.bulkUpdateTransactions(selected.map((row)=>row.id),{category_id:category.id});
    for(const row of selected){
      row.category_id=category.id;
      row.categories={name:category.name,kind:category.kind,parent_id:category.parent_id||null};
    }
    return {count:selected.length,name:selected[0].counterparty||selected[0].description||'Buchung'};
  }

  let merchant=runtime.merchants.find((row)=>row.normalized_key===detected.key)||null;
  if(!merchant){
    merchant=await financeApi.upsertMerchant({
      household_id:runtime.household.id,
      normalized_key:detected.key,
      name:detected.name,
      default_category_id:category.id,
    });
    if(merchant) runtime.merchants.push(merchant);
  } else if(merchant.default_category_id!==category.id){
    merchant=await financeApi.updateMerchant(merchant.id,{default_category_id:category.id});
    const index=runtime.merchants.findIndex((row)=>row.id===merchant.id);
    if(index>=0) runtime.merchants[index]=merchant;
  }

  const candidates=runtime.transactions.filter((row)=>{
    if(row.transfer_group_id || !['booked','pending'].includes(row.status)) return false;
    const rowKind=Number(row.amount)<0?'expense':'income';
    if(rowKind!==kind) return false;
    const identity=merchantFromTransaction(row);
    if(identity?.key!==detected.key) return false;
    return selectedIds.has(row.id) || !row.category_id || row.category_id===category.id;
  });

  const aliasVariants=new Map();
  for(const row of candidates){
    const identity=merchantFromTransaction(row);
    if(identity?.aliasKey && identity.aliasKey!==detected.key){
      aliasVariants.set(identity.aliasKey,identity);
    }
  }
  for(const identity of aliasVariants.values()){
    const alias=await financeApi.upsertMerchantAlias({
      household_id:runtime.household.id,
      merchant_id:merchant.id,
      alias_name:identity.rawName||identity.name,
      normalized_key:identity.aliasKey,
      payment_processor:identity.paymentProcessor||null,
    });
    if(alias && !runtime.merchantAliases.some((row)=>row.id===alias.id)) runtime.merchantAliases.push(alias);
  }

  const patch={category_id:category.id,merchant_id:merchant.id};
  await financeApi.bulkUpdateTransactions(candidates.map((row)=>row.id),patch);
  for(const row of candidates){
    row.category_id=category.id;
    row.merchant_id=merchant.id;
    row.categories={name:category.name,kind:category.kind,parent_id:category.parent_id||null};
    row.merchants={name:merchant.name,normalized_key:merchant.normalized_key,default_category_id:category.id};
  }
  return {count:candidates.length,name:merchant.name};
}

function contractRecurringPayload(contract) {
  const account=runtime.accounts.find((row)=>row.account_id===contract.account_id);
  if(!account) throw new Error('Bitte beim Vertrag zuerst ein Zahlungskonto hinterlegen.');
  if(contract.billing_cadence==='oneoff') throw new Error('Einmalige Verträge sind nicht wiederkehrend.');
  if(!(Number(contract.amount)>0)) throw new Error('Der Vertragsbetrag muss grösser als 0 sein.');
  if(!contract.next_payment_date) throw new Error('Bitte beim Vertrag den nächsten Zahlungstermin hinterlegen.');
  return {
    household_id:runtime.household.id,
    account_id:contract.account_id,
    category_id:contract.category_id||null,
    direction:'expense',
    description:contract.name,
    counterparty:contract.provider||null,
    amount:Number(contract.amount),
    currency:account.currency||contract.currency||runtime.household.base_currency,
    cadence:contract.billing_cadence,
    next_date:contract.next_payment_date,
    end_date:contract.end_date||null,
    active:contract.status==='active',
  };
}

async function syncContractRecurring(contract) {
  const valid=contract?.account_id
    && contract.billing_cadence!=='oneoff'
    && Number(contract.amount)>0
    && contract.next_payment_date
    && contract.status==='active';
  if(!valid) {
    if(contract?.recurring_rule_id) {
      await financeApi.updateRecurringRule(contract.recurring_rule_id,{active:false});
    }
    return null;
  }
  const payload=contractRecurringPayload(contract);
  const rule=contract.recurring_rule_id
    ? await financeApi.updateRecurringRule(contract.recurring_rule_id,payload)
    : await financeApi.createRecurringRule(payload);
  if(rule?.id && contract.recurring_rule_id!==rule.id) {
    await financeApi.updateContract(contract.id,{recurring_rule_id:rule.id});
  }
  return rule;
}

function insuranceRecurringPayload(policy) {
  const account=runtime.accounts.find((row)=>row.account_id===policy.account_id);
  if(!account) throw new Error('Bitte bei der Versicherung zuerst ein Zahlungskonto hinterlegen.');
  if(!(Number(policy.premium_amount)>0)) throw new Error('Die Versicherungsprämie muss grösser als 0 sein.');
  if(!policy.next_payment_date) throw new Error('Bitte bei der Versicherung den nächsten Zahlungstermin hinterlegen.');
  return {
    household_id:runtime.household.id,
    account_id:policy.account_id,
    category_id:policy.category_id||null,
    direction:'expense',
    description:policy.name,
    counterparty:policy.provider||null,
    amount:Number(policy.premium_amount),
    currency:policy.currency||account.currency||runtime.household.base_currency,
    cadence:policy.billing_cadence||'annual',
    next_date:policy.next_payment_date,
    end_date:policy.end_date||null,
    active:policy.status==='active',
  };
}

async function syncInsuranceRecurring(policy) {
  const valid=policy?.account_id
    && Number(policy.premium_amount)>0
    && policy.next_payment_date
    && policy.status==='active';
  if(!valid) {
    if(policy?.recurring_rule_id) {
      await financeApi.updateRecurringRule(policy.recurring_rule_id,{active:false});
    }
    return null;
  }
  const payload=insuranceRecurringPayload(policy);
  const rule=policy.recurring_rule_id
    ? await financeApi.updateRecurringRule(policy.recurring_rule_id,payload)
    : await financeApi.createRecurringRule(payload);
  if(rule?.id && policy.recurring_rule_id!==rule.id) {
    await financeApi.updateInsurance(policy.id,{recurring_rule_id:rule.id});
  }
  return rule;
}

async function syncRecurringSourceFromRule(rule) {
  if(!rule?.id) return;
  const contract=runtime.contracts.find((row)=>row.recurring_rule_id===rule.id);
  if(contract) {
    await financeApi.updateContract(contract.id,{
      account_id:rule.account_id,
      category_id:rule.category_id||null,
      amount:Number(rule.amount||0),
      currency:rule.currency,
      billing_cadence:rule.cadence,
      next_payment_date:rule.next_date||null,
      end_date:rule.end_date||null,
      status:rule.active===false?'paused':'active',
    });
  }

  const policy=runtime.insurance.find((row)=>row.recurring_rule_id===rule.id);
  if(policy) {
    await financeApi.updateInsurance(policy.id,{
      account_id:rule.account_id,
      category_id:rule.category_id||null,
      premium_amount:Number(rule.amount||0),
      currency:rule.currency,
      billing_cadence:rule.cadence,
      next_payment_date:rule.next_date||null,
      end_date:rule.end_date||null,
    });
  }

  const debt=runtime.debts.find((row)=>row.recurring_rule_id===rule.id);
  if(debt) {
    await financeApi.updateDebt(debt.id,{
      payment_account_id:rule.account_id,
      installment_amount:Number(rule.amount||0),
      payment_cadence:rule.cadence,
      next_payment_date:rule.next_date||null,
      end_date:rule.end_date||null,
      status:rule.active===false?'paused':(Number(debt.outstanding_amount)>0?'active':'paid'),
    });
  }
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

function showTaxPaymentSource(source) {
  const accountField=document.querySelector('#taxPaymentAccountField');
  const transactionField=document.querySelector('#taxPaymentTransactionField');
  const historyInfo=document.querySelector('#taxPaymentHistoryInfo');
  if(accountField) accountField.hidden=source!=='created_transaction';
  if(transactionField) transactionField.hidden=source!=='linked_transaction';
  if(historyInfo) historyInfo.hidden=source!=='history_only';
}

function showReceivablePaymentSource(source) {
  const accountField=document.querySelector('#receivablePaymentAccountField');
  const transactionField=document.querySelector('#receivablePaymentTransactionField');
  const historyInfo=document.querySelector('#receivablePaymentHistoryInfo');
  if(accountField) accountField.hidden=source!=='created_transaction';
  if(transactionField) transactionField.hidden=source!=='linked_transaction';
  if(historyInfo) historyInfo.hidden=source!=='history_only';
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
    date:formValue(data,'mapDate'),
    description:formValue(data,'mapDescription'),
    counterparty:formValue(data,'mapCounterparty'),
    counterpartyAccount:formValue(data,'mapCounterpartyAccount'),
    bankReference:formValue(data,'mapBankReference'),
    amount:formValue(data,'mapAmount'),
    debit:formValue(data,'mapDebit'),
    credit:formValue(data,'mapCredit'),
  };
}

function importMappingForParsed(parsed, preferred = {}) {
  const headers=parsed?.headers||[];
  const guessed=guessMapping(headers);
  const use=(key)=>preferred[key]&&headers.includes(preferred[key])?preferred[key]:(guessed[key]||'');
  return {
    date:use('date'),
    description:use('description'),
    counterparty:use('counterparty'),
    counterpartyAccount:use('counterpartyAccount'),
    bankReference:use('bankReference'),
    sourcePage:use('sourcePage'),
    rawData:use('rawData'),
    amount:use('amount'),
    debit:use('debit'),
    credit:use('credit'),
  };
}

function validImportMapping(mapping) {
  return Boolean(mapping?.date && mapping?.description && (mapping?.amount || mapping?.debit || mapping?.credit));
}

function normalizeAccountReference(value) {
  return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
}

function ownAccountForReference(reference,currentAccountId=null) {
  const key=normalizeAccountReference(reference);
  if(!key) return null;
  return runtime.accounts.find((account)=>{
    if(account.account_id===currentAccountId) return false;
    return normalizeAccountReference(account.external_account_ref)===key;
  })||null;
}

function importedTransferCounterpart(tx,otherAccountId,allTransactions=[]) {
  const sign=Math.sign(Number(tx.amount)||0);
  const amount=Math.abs(Number(tx.amount)||0);
  const time=new Date(tx.occurred_at).getTime();
  const matches=allTransactions.filter((row)=>{
    if(!row||row.id===tx.id||row.account_id!==otherAccountId||row.transfer_group_id||row.status!=='booked'||row.cashflow_type!=='standard') return false;
    if(row.currency!==tx.currency||Math.sign(Number(row.amount)||0)!==-sign) return false;
    if(Math.abs(Math.abs(Number(row.amount)||0)-amount)>=0.005) return false;
    const otherTime=new Date(row.occurred_at).getTime();
    return Number.isFinite(time)&&Number.isFinite(otherTime)&&Math.abs(otherTime-time)<=7*86400000;
  });
  return matches.length===1?matches[0]:null;
}

async function reconcileImportedOwnTransfers(insertedRows=[]) {
  let linked=0;
  const known=[...runtime.transactions,...insertedRows];
  for(const tx of insertedRows){
    if(!tx||tx.transfer_group_id||!tx.counterparty_account_ref) continue;
    const otherAccount=ownAccountForReference(tx.counterparty_account_ref,tx.account_id);
    if(!otherAccount) continue;
    const currentAccount=runtime.accounts.find((row)=>row.account_id===tx.account_id);
    if(!currentAccount||currentAccount.currency!==otherAccount.currency) continue;
    const counterpart=importedTransferCounterpart(tx,otherAccount.account_id,known);
    await financeApi.convertTransactionToTransferV2({
      householdId:runtime.household.id,
      transactionId:tx.id,
      otherAccountId:otherAccount.account_id,
      amount:Math.abs(Number(tx.amount)),
      otherAmount:null,
      otherTransactionId:counterpart?.id||null,
      occurredAt:tx.occurred_at,
      description:tx.description||'Umbuchung',
      note:tx.note||null,
    });
    linked+=1;
  }
  return linked;
}

function renderImportReview() {
  const form = document.querySelector('#bank-import');
  const host = document.querySelector('#importReview');
  if (!form || !host || !importState.items.length) return;
  const preferredMapping = importMappingFromForm(form);
  if (!validImportMapping(preferredMapping)) {
    host.innerHTML = '<div class="inline-alert"><strong>Zuordnung unvollständig.</strong><span>Wähle Datum, Beschreibung und eine Betragsspalte.</span></div>';
    return;
  }
  const groups = new Map();
  const importAccountId=form.querySelector('[name="accountId"]')?.value||'';
  const importAccount=runtime.accounts.find((row)=>row.account_id===importAccountId)||null;
  const mlModel=buildCategoryMlModel({transactions:runtime.transactions,categories:runtime.categories});
  let validRows=0;
  let unmappedFiles=0;
  for (const item of importState.items) {
    const mapping=importMappingForParsed(item.parsed,preferredMapping);
    if(!validImportMapping(mapping)){ unmappedFiles+=1; continue; }
    for (const row of item.parsed.rows) {
      const tx = rowToTransaction(row,mapping);
      if (!tx) continue;
      validRows+=1;
      const ownCounterAccount=ownAccountForReference(tx.counterparty_account_ref,importAccountId);
      const merchant = merchantFromTransaction(tx);
      const existing = ownCounterAccount?null:resolveCanonicalMerchant(merchant,{merchants:runtime.merchants,aliases:runtime.merchantAliases});
      const knownCategoryNames=ownCounterAccount?[]:suggestKnownCategoryCandidates(tx);
      const knownCategory=knownCategoryNames.map((name)=>runtime.categories.find((c)=>c.name===name&&c.kind===(Number(tx.amount)<0?'expense':'income'))).find(Boolean)||null;
      const mlPrediction=ownCounterAccount?null:predictCategoryMl(mlModel,tx);
      const categoryId = ownCounterAccount?'':(existing?.default_category_id || applyCategoryRules(tx,runtime.categorizationRules) || knownCategory?.id || mlPrediction?.categoryId || '');
      const fromName=Number(tx.amount)<0?(importAccount?.name||'Importkonto'):(ownCounterAccount?.name||'eigenes Konto');
      const toName=Number(tx.amount)<0?(ownCounterAccount?.name||'eigenes Konto'):(importAccount?.name||'Importkonto');
      const groupKey=ownCounterAccount?`own-transfer:${ownCounterAccount.account_id}`:(existing?.normalized_key||merchant.key);
      const group = groups.get(groupKey) || {
        merchant:{...merchant,name:ownCounterAccount?`Eigene Umbuchung: ${fromName} → ${toName}`:(existing?.name||merchant.name),key:groupKey},
        rows:[], total:0, categoryId, isTransfer:Boolean(ownCounterAccount)
      };
      group.rows.push(tx); group.total += Number(tx.amount);
      if (!group.categoryId && categoryId) group.categoryId = categoryId;
      groups.set(groupKey,group);
    }
  }
  const html = [...groups.values()].sort((a,b)=>Math.abs(b.total)-Math.abs(a.total)).map((group)=>{
    const kind = group.total < 0 ? 'expense' : 'income';
    const options = runtime.categories.filter((c)=>c.kind===kind).map((c)=>`<option value="${c.id}" ${c.id===group.categoryId?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
    return `<div class="csv-review-row"><div><strong>${escapeHtml(group.merchant.name)}</strong><span>${group.rows.length} Buchung${group.rows.length===1?'':'en'}${group.isTransfer?' · wird als interne Umbuchung verbunden':''}</span></div>${group.isTransfer?'<span class="status-pill status-pill--active">Eigene Umbuchung</span>':`<select class="text-control" data-csv-merchant-key="${escapeHtml(group.merchant.key)}"><option value="">Ohne Kategorie</option>${options}</select>`}</div>`;
  }).join('');
  const warning=unmappedFiles?` · ${unmappedFiles} Datei${unmappedFiles===1?'':'en'} mit abweichenden Spalten bitte prüfen`:'';
  host.innerHTML = `<div class="card-heading csv-review-heading"><div><h3 class="card-title">Händler & Kategorien prüfen</h3><p class="card-subtitle">${importState.items.length} Datei${importState.items.length===1?'':'en'} · ${validRows} gültige Buchungen · ${groups.size} erkannte Händler${warning}</p></div></div><div class="csv-review-list">${html || '<div class="table-empty">Keine gültigen Buchungszeilen erkannt.</div>'}</div>`;
}

function suggestedCategoryIdForTransaction({
  explicitCategoryId=null,
  merchantId=null,
  description='',
  counterparty='',
  note='',
  amount=0,
  semanticType=null,
  contextName='',
}={}) {
  if(explicitCategoryId) return explicitCategoryId;
  const merchantDefault=merchantId
    ? runtime.merchants.find((row)=>row.id===merchantId)?.default_category_id||null
    : null;
  if(merchantDefault) return merchantDefault;

  const candidates=[];
  if(semanticType==='asset_acquisition') candidates.push('Fahrzeugkauf','Mobilität');
  candidates.push(...suggestKnownCategoryCandidates({description,counterparty,note,amount}));
  if(/\b(?:ferien|urlaub|vacanza|vacanze|italien|italia|reise|trip)\b/i.test(contextName||'')) candidates.push('Ferien','Urlaub','Freizeit');
  for(const name of [...new Set(candidates)]){
    const category=runtime.categories.find((row)=>row.kind===(Number(amount)<0?'expense':'income')&&row.name.toLowerCase()===String(name).toLowerCase());
    if(category) return category.id;
  }
  const mlModel=buildCategoryMlModel({transactions:runtime.transactions,categories:runtime.categories});
  const mlPrediction=predictCategoryMl(mlModel,{description,counterparty,note,amount,merchant_id:merchantId,source:'manual'});
  return mlPrediction?.safe ? mlPrediction.categoryId : null;
}


function categoryKindForForm(form) {
  const direction=form?.querySelector('[name="direction"]')?.value||'expense';
  return direction==='income'?'income':'expense';
}

function rebuildRankedCategorySelect(select,{kind,selectedId=''}={}) {
  if(!select) return;
  const ranked=rankCategoriesByUsage(runtime.categories,runtime.transactions,{kind,excludeNames:['Sparen']});
  select.innerHTML=`<option value="">Ohne Kategorie</option>${ranked.map((category)=>
    `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
  ).join('')}`;
  if(selectedId && ranked.some((category)=>category.id===selectedId)) select.value=selectedId;
}

function syncSmartCategoryForForm(form,{allowSuggestion=true,selectedId=null}={}) {
  if(!form) return null;
  const category=form.querySelector('[name="categoryId"]');
  if(!category) return null;
  const previous=selectedId??category.value??'';
  const kind=categoryKindForForm(form);
  rebuildRankedCategorySelect(category,{kind,selectedId:previous});

  const hint=form.querySelector(kind==='income'?'#transactionCreateCategoryHint, #transactionEditCategoryHint':'#transactionCreateCategoryHint, #transactionEditCategoryHint');
  if(!allowSuggestion||category.dataset.userSelected==='true') return category.value||null;

  const amountField=form.querySelector('[name="amount"]');
  const rawAmount=Math.abs(Number(amountField?.value||0));
  const amount=kind==='income'?rawAmount:-rawAmount;
  const merchantId=form.querySelector('[name="merchantId"]')?.value||null;
  const description=form.querySelector('[name="description"]')?.value||'';
  const counterparty=form.querySelector('[name="counterparty"]')?.value||'';
  const note=form.querySelector('[name="note"]')?.value||'';
  const currentAuto=category.dataset.autoCategory||'';
  const explicit=(category.value && category.value!==currentAuto)?category.value:null;
  const suggestion=suggestedCategoryIdForTransaction({
    explicitCategoryId:explicit,
    merchantId,
    description,
    counterparty,
    note,
    amount,
  });

  if(suggestion && (!category.value || category.value===currentAuto)){
    category.value=suggestion;
    category.dataset.autoCategory=suggestion;
    const suggestedCategory=runtime.categories.find((row)=>row.id===suggestion);
    const merchant=runtime.merchants.find((row)=>row.id===merchantId);
    const source=merchant?.default_category_id===suggestion
      ? `${t('Händler erkannt')}: ${merchant.name}`
      : t('Finance-Vorschlag aus Händler/Beschreibung');
    if(hint&&suggestedCategory) hint.textContent=`${source} → ${suggestedCategory.name}. ${t('Du kannst die Kategorie jederzeit ändern.')}`;
  } else if(hint && !category.value) {
    hint.textContent=t('Häufig verwendete Kategorien stehen oben. Finance versucht Händler und Beschreibung direkt zu erkennen.');
  }
  if(form.id==='transaction-create') syncTransactionBudgetCoach(form);
  return category.value||null;
}

function syncReceiptSmartCategory() {
  const merchant=document.querySelector('#receiptMerchant');
  const category=document.querySelector('#receiptCategory');
  if(!merchant||!category||category.dataset.userSelected==='true') return;
  const amount=Math.abs(Number(document.querySelector('#receiptAmount')?.value||0));
  const suggestion=suggestedCategoryIdForTransaction({
    description:merchant.value||'',
    counterparty:merchant.value||'',
    amount:-amount,
  });
  const currentAuto=category.dataset.autoCategory||'';
  if(suggestion&&(!category.value||category.value===currentAuto)){
    category.value=suggestion;
    category.dataset.autoCategory=suggestion;
  }
}

function transactionTaxDefaults(txLike={}) {
  const amount=Number(txLike.amount||0);
  const text=`${txLike.tax_category||txLike.taxCategory||''} ${txLike.description||''} ${txLike.counterparty||''} ${txLike.note||''}`.toLowerCase();
  let treatment=txLike.tax_treatment||txLike.taxTreatment||null;
  if(!treatment){
    if(/steuerrück|steuererstatt|tax refund/.test(text)) treatment='tax_refund';
    else if(/steuerzahlung|steueramt|steuerverwaltung|kanton.*steuer|gemeinde.*steuer|tax payment/.test(text)) treatment=amount>=0?'tax_refund':'tax_payment';
    else treatment=amount>=0?'income':'deduction';
  }
  let section=txLike.tax_section_key||txLike.taxSectionKey||null;
  if(!section){
    if(['tax_payment','tax_refund'].includes(treatment)) section='tax_account';
    else if(treatment==='income') section='income';
    else if(treatment==='deduction') section='work_expenses';
  }
  return {treatment,section};
}
function transactionTaxYear(txLike={}) {
  const explicit=Number(txLike.tax_year||txLike.taxYear);
  if(Number.isInteger(explicit)&&explicit>=2000&&explicit<=2100) return explicit;
  const text=`${txLike.tax_category||txLike.taxCategory||''} ${txLike.description||''} ${txLike.counterparty||''} ${txLike.note||''}`;
  const mentioned=text.match(/\b(20\d{2})\b/);
  if(mentioned) return Number(mentioned[1]);
  const d=new Date(txLike.occurred_at||txLike.occurredAt||Date.now());
  return Number.isNaN(d.getTime())?new Date().getFullYear():d.getFullYear();
}
async function ensureTransactionTaxCase(year) {
  if(!moduleEnabled('tax')||runtime.household?.country_code!=='CH') return null;
  const existing=runtime.taxCases.find((row)=>Number(row.tax_year)===Number(year)&&row.country_code==='CH'&&row.canton_code==='SG');
  if(existing) return existing;
  return financeApi.ensureTaxCase({householdId:runtime.household.id,taxYear:Number(year),countryCode:'CH',cantonCode:'SG'});
}

function findMatchingRecurringRule(txLike={}) {
  const amount=Math.abs(Number(txLike.amount||0));
  const refund=txLike.semantic_type==='refund'||txLike.semanticType==='refund';
  const direction=Number(txLike.amount||0)<0?'expense':'income';
  const text=normalizeMerchantKey([txLike.merchants?.name,txLike.counterparty,txLike.description].filter(Boolean).join(' '));
  const candidates=runtime.recurringRules
    .filter((rule)=>rule.active!==false&&(rule.direction===direction||(refund&&rule.direction==='expense'&&rule.amount_mode==='variable')))
    .map((rule)=>{
      let score=0;
      if(rule.account_id&&txLike.account_id===rule.account_id) score+=2;
      if(rule.merchant_id&&txLike.merchant_id===rule.merchant_id) score+=8;
      if(rule.category_id&&txLike.category_id===rule.category_id) score+=2;
      if(rule.amount_mode==='variable'&&amount>0) score+=3;
      else if(amount>0&&Math.abs(Math.abs(Number(rule.amount||0))-amount)<=Math.max(.01,amount*.03)) score+=5;
      const ruleText=normalizeMerchantKey([rule.merchants?.name,rule.counterparty,rule.description].filter(Boolean).join(' '));
      if(text&&ruleText&&(text.includes(ruleText)||ruleText.includes(text))) score+=6;
      return {rule,score};
    })
    .filter((row)=>row.score>=7)
    .sort((a,b)=>b.score-a.score);
  return candidates[0]?.rule||null;
}

async function resolveCounterpartyFromForm(data) {
  const name=String(formValue(data,'counterparty')||'').trim();
  if(!name) return null;
  const kind=formValue(data,'counterpartyKind');
  if(!kind) return null;
  const normalizedKey=normalizeMerchantKey(name);
  if(!normalizedKey) return null;
  const existing=runtime.counterparties.find((row)=>row.kind===kind&&row.normalized_key===normalizedKey);
  return existing||financeApi.upsertCounterparty({
    household_id:runtime.household.id,
    name,
    normalized_key:normalizedKey,
    kind,
  });
}

async function resolveContextFromForm(data) {
  const selected=nullValue(data,'contextId');
  const name=String(formValue(data,'contextName')||'').trim();
  if(!name) return selected;
  const normalizedKey=normalizeMerchantKey(name);
  if(!normalizedKey) return selected;
  const existing=runtime.transactionContexts.find((row)=>row.normalized_key===normalizedKey);
  if(existing) return existing.id;
  const created=await financeApi.upsertTransactionContext({
    household_id:runtime.household.id,
    name,
    normalized_key:normalizedKey,
    context_type:'project',
  });
  return created?.id||selected;
}

async function resolveVehicleFromForm(data,{amount=0,occurredAt=null,currency='CHF'}={}) {
  const selected=nullValue(data,'vehicleId');
  if(selected){
    if(!runtime.vehicles.some((row)=>row.id===selected)) throw new Error('Fahrzeug wurde nicht gefunden.');
    return selected;
  }
  const name=String(formValue(data,'vehicleName')||'').trim();
  if(!name) return null;
  const type=formValue(data,'vehicleType')||'other';
  const date=new Date(occurredAt||Date.now());
  const purchaseDate=Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10);
  const semantic=formValue(data,'semanticType');
  const purchaseValue=semantic==='asset_acquisition'?Math.abs(Number(amount||0)):0;
  const created=await financeApi.createVehicle({
    household_id:runtime.household.id,
    name,
    vehicle_type:type,
    current_value:purchaseValue,
    currency,
    purchase_price:purchaseValue||null,
    purchase_date:purchaseDate,
    monthly_cost:0,
    odometer_km:null,
    license_plate:null,
  });
  return created?.id||null;
}

async function ensureCashAccount(currency, occurredAt) {
  const existing=runtime.accounts.find((row)=>row.account_type==='cash'&&row.currency===currency&&!row.is_archived);
  if(existing) return existing;
  const event=new Date(occurredAt||Date.now());
  const anchor=new Date((Number.isNaN(event.getTime())?Date.now():event.getTime())-1000).toISOString();
  const created=await financeApi.createAccount({
    household_id:runtime.household.id,
    name:`Bargeld ${currency}`,
    account_type:'cash',
    institution_name:null,
    currency,
    balance_anchor_amount:0,
    balance_anchor_at:anchor,
    visibility:'private',
  });
  return {
    ...created,
    account_id:created?.id||created?.account_id,
    current_balance:0,
  };
}

function syncTransactionBudgetCoach(form=document.querySelector('#transaction-create')) {
  if(!form) return;
  const hint=form.querySelector('#transactionCreateBudgetCoach');
  if(!hint) return;
  const direction=form.querySelector('[name="direction"]')?.value||'expense';
  const categoryId=form.querySelector('[name="categoryId"]')?.value||null;
  const merchantId=form.querySelector('[name="merchantId"]')?.value||null;
  if(direction!=='expense'||(!categoryId&&!merchantId)){
    hint.hidden=true;
    hint.innerHTML='';
    return;
  }

  const guide=buildBudgetDecisionGuide({
    categoryId,merchantId,
    budgets:runtime.budgets,
    transactions:runtime.transactions,
    debtPayments:runtime.debtPayments,
    categories:runtime.categories,
    merchants:runtime.merchants,
    recurringRules:runtime.recurringRules,
    accounts:runtime.accounts,
    household:runtime.household,
    fxRates:runtime.fxRates,
    now:new Date(),
  });
  const locale=runtime.profile?.locale||'de-CH';
  const currency=runtime.household?.base_currency||'CHF';
  const entered=Math.max(0,Number(form.querySelector('[name="amount"]')?.value||0));
  hint.hidden=false;

  if(!guide.found){
    hint.className='budget-decision-hint budget-decision-hint--neutral form-grid-span';
    hint.innerHTML=`<div><strong>${escapeHtml(t('Kein Budgetrahmen für diese Auswahl'))}</strong><span>${escapeHtml(t('Die Ausgabe kann gespeichert werden. Für eine Entscheidung vor dem Kauf fehlt aber noch ein Budgetrahmen.'))}</span></div><a href="#/budget">${escapeHtml(t('Budget festlegen'))}</a>`;
    return;
  }

  const after=guide.remaining-entered;
  const tone=after<0?'negative':guide.percent>=80?'warning':'positive';
  hint.className=`budget-decision-hint budget-decision-hint--${tone} form-grid-span`;
  const remaining=moneyText(guide.remaining,{currency,locale,decimals:0});
  const afterText=moneyText(Math.max(0,after),{currency,locale,decimals:0});
  const overshoot=moneyText(Math.abs(Math.min(0,after)),{currency,locale,decimals:0});
  hint.innerHTML=after<0
    ? `<div><strong>${escapeHtml(guide.label)} · ${escapeHtml(t('Budget würde überschritten'))}</strong><span>${escapeHtml(t('Vor dieser Ausgabe noch'))} ${escapeHtml(remaining)} ${escapeHtml(t('verfügbar. Danach'))} ${escapeHtml(overshoot)} ${escapeHtml(t('über dem Rahmen.'))}</span></div><a href="#/budget">${escapeHtml(t('Budget prüfen'))}</a>`
    : `<div><strong>${escapeHtml(guide.label)} · ${Math.round(guide.percent)} % ${escapeHtml(t('verbraucht'))}</strong><span>${escapeHtml(t('Aktuell'))} ${escapeHtml(remaining)} ${escapeHtml(t('verfügbar'))}${entered>0?` · ${escapeHtml(t('nach dieser Ausgabe'))} ${escapeHtml(afterText)}`:''}.</span></div><a href="#/budget">${escapeHtml(t('Budget prüfen'))}</a>`;
}

function syncTransactionTransferEditor() {
  const form=document.querySelector('#transaction-edit');
  if(!form) return;
  const tx=runtime.transactions.find((row)=>row.id===form.querySelector('[name="transactionId"]')?.value);
  if(!tx) return;

  const mode=document.querySelector('#transactionEditDirection')?.value||'expense';
  const transfer=mode==='transfer';
  const cashWithdrawal=mode==='cash_withdrawal';
  const special=transfer||cashWithdrawal;
  const account=document.querySelector('#transactionEditAccount');
  const fields=document.querySelector('#transactionEditTransferFields');
  const other=document.querySelector('#transactionEditOtherAccount');
  const otherAmount=document.querySelector('#transactionEditOtherAmount');
  const otherAmountField=document.querySelector('#transactionEditOtherAmountField');
  const counterpart=document.querySelector('#transactionEditOtherTransaction');
  const hint=document.querySelector('#transactionEditTransferHint');

  if(fields) fields.hidden=!special;
  if(account){ account.disabled=special; if(special) account.value=tx.account_id; }
  if(other) other.required=special;

  const hiddenInTransfer=['categoryId','merchantId','counterparty','counterpartyKind','contextId','contextName','vehicleId','vehicleName','vehicleType','taxRelevant','taxYear','taxTreatment','taxSectionKey','taxCategory','semanticType','excludeFromReports'];
  for(const name of hiddenInTransfer){
    const input=form.querySelector(`[name="${name}"]`);
    if(!input) continue;
    input.disabled=special;
    const field=input.closest('.field');
    if(field) field.hidden=special;
  }
  const recurringToggle=document.querySelector('#transactionMakeRecurring');
  if(recurringToggle){
    recurringToggle.disabled=cashWithdrawal;
    const recurringField=recurringToggle.closest('.field');
    if(recurringField) recurringField.hidden=cashWithdrawal;
    if(cashWithdrawal) recurringToggle.checked=false;
  }
  const recurringFields=document.querySelector('#transactionRecurringFields');
  if(cashWithdrawal&&recurringFields) recurringFields.hidden=true;
  else if(transfer&&recurringFields) recurringFields.hidden=!(recurringToggle?.checked);

  if(!special||!other||!counterpart) return;

  const currentAccount=runtime.accounts.find((row)=>row.account_id===tx.account_id);
  for(const option of other.options){
    if(!option.value) continue;
    if(option.value==='__auto_cash__'){
      option.hidden=!cashWithdrawal;
      option.disabled=!cashWithdrawal;
      continue;
    }
    const candidate=runtime.accounts.find((row)=>row.account_id===option.value);
    if(cashWithdrawal){
      option.hidden=!(candidate?.account_type==='cash'&&candidate.currency===currentAccount?.currency);
      option.disabled=option.hidden;
    } else {
      option.hidden=false;
      option.disabled=option.value===tx.account_id;
    }
  }

  if(cashWithdrawal){
    if(Number(tx.amount)>=0){
      if(hint) hint.textContent='Ein Bargeldbezug muss ein Abgang vom Bankkonto sein.';
    } else if(hint) {
      hint.textContent='Bargeldbezug ist eine Umbuchung vom Bankkonto in dein Bargeld-Wallet – keine Ausgabe.';
    }
    if(!other.value||other.selectedOptions?.[0]?.disabled){
      const cashAccount=runtime.accounts.find((row)=>row.account_type==='cash'&&row.currency===currentAccount?.currency&&!row.is_archived);
      other.value=cashAccount?.account_id||'__auto_cash__';
    }
  } else if(other.selectedOptions?.[0]?.disabled) {
    other.value='';
  }

  const otherAccount=runtime.accounts.find((row)=>row.account_id===other.value);
  if(other.value==='__auto_cash__'){
    counterpart.replaceChildren(new Option('Bargeld-Wallet wird automatisch angelegt',''));
    if(otherAmountField) otherAmountField.hidden=true;
    if(otherAmount){ otherAmount.required=false; otherAmount.disabled=true; otherAmount.value=''; }
    return;
  }

  counterpart.replaceChildren(new Option(otherAccount?'Keine passende Bankbuchung – Gegenbuchung erstellen':'Zuerst Gegenkonto wählen',''));
  if(!currentAccount||!otherAccount) return;
  const sameCurrency=currentAccount.currency===otherAccount.currency;
  if(otherAmountField) otherAmountField.hidden=sameCurrency;
  if(otherAmount){ otherAmount.disabled=sameCurrency; otherAmount.required=!sameCurrency; if(sameCurrency) otherAmount.value=''; }
  const amount=Math.abs(Number(document.querySelector('#transactionEditAmount')?.value||tx.amount));
  const targetAmount=sameCurrency?amount:Number(otherAmount?.value||0);
  if(!(targetAmount>0)) return;
  const when=new Date(financeEventTimestamp(document.querySelector('#transactionEditDate')?.value||tx.occurred_at));
  const sign=Number(tx.amount)<0?-1:1;
  const billIds=new Set(runtime.bills.filter((row)=>row.status==='paid'&&row.paid_transaction_id).map((row)=>row.paid_transaction_id));
  const matches=runtime.transactions.filter((row)=>{
    if(row.id===tx.id||row.account_id!==otherAccount.account_id||row.transfer_group_id||row.status!=='booked'||row.cashflow_type!=='standard'||billIds.has(row.id)) return false;
    if((Number(row.amount)<0?-1:1)===sign) return false;
    if(Math.abs(Math.abs(Number(row.amount))-targetAmount)>=0.005) return false;
    return Math.abs(new Date(row.occurred_at).getTime()-when.getTime())<=7*86400000;
  });
  const locale=runtime.profile?.locale||'de-CH';
  for(const row of matches){
    const option=new Option(`${Math.abs(Number(row.amount)).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})} ${row.currency} · ${new Intl.DateTimeFormat(locale).format(new Date(row.occurred_at))} · ${row.description||'Gegenposten'}`,row.id);
    option.dataset.amount=String(Math.abs(Number(row.amount)));
    counterpart.add(option);
  }
  if(matches.length===1) counterpart.value=matches[0].id;
}

function openTransactionEditor(tx, { recurring = false } = {}) {
  if (!tx || tx.transfer_group_id) throw new Error('Diese Buchung kann nicht einzeln bearbeitet werden.');
  if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden unter Schulden & Kredite verwaltet.');
  if (tx.cashflow_type === 'receivable_principal') throw new Error('Forderungsbuchungen werden unter Forderungen verwaltet.');
  if (runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id)) throw new Error('Diese Buchung ist mit einer bezahlten Rechnung verknüpft. Bitte die Rechnung unter Rechnungen verwalten.');
  document.querySelector('#transactionEditId').value=tx.id;
  document.querySelector('#transactionEditDirection').value=Number(tx.amount)<0?'expense':'income';
  document.querySelector('#transactionEditAmount').value=Math.abs(Number(tx.amount));
  document.querySelector('#transactionEditAccount').value=tx.account_id;
  document.querySelector('#transactionEditDate').value=dateTimeLocalValue(new Date(tx.occurred_at));
  document.querySelector('#transactionEditDescription').value=tx.description||'';
  const editForm=document.querySelector('#transaction-edit');
  const editCategory=document.querySelector('#transactionEditCategory');
  if(editCategory){ editCategory.dataset.userSelected=''; editCategory.dataset.autoCategory=''; }
  syncSmartCategoryForForm(editForm,{allowSuggestion:false,selectedId:tx.category_id||''});
  if(editCategory) editCategory.value=tx.category_id||'';
  const merchantSelect=document.querySelector('#transactionEditMerchant'); if(merchantSelect) merchantSelect.value=tx.merchant_id||'';
  document.querySelector('#transactionEditCounterparty').value=tx.counterparties?.name||tx.counterparty||'';
  const counterpartyKind=document.querySelector('#transactionEditCounterpartyKind'); if(counterpartyKind) counterpartyKind.value=tx.counterparties?.kind||'';
  const context=document.querySelector('#transactionEditContext'); if(context) context.value=tx.context_id||'';
  const contextName=document.querySelector('#transactionEditContextName'); if(contextName) contextName.value='';
  const vehicle=document.querySelector('#transactionEditVehicle'); if(vehicle) vehicle.value=tx.vehicle_id||'';
  const vehicleName=document.querySelector('#transactionEditVehicleName'); if(vehicleName) vehicleName.value='';
  const vehicleType=document.querySelector('#transactionEditVehicleType'); if(vehicleType) vehicleType.value='motorcycle';
  const optionalDetails=document.querySelector('#transactionEditOptionalDetails');
  if(optionalDetails) optionalDetails.open=Boolean(tx.context_id||tx.vehicle_id||tx.semantic_type==='asset_acquisition');
  const vehicleTypeField=document.querySelector('#transactionEditVehicleTypeField');
  if(vehicleTypeField) vehicleTypeField.hidden=true;
  document.querySelector('#transactionEditNote').value=tx.note||'';
  const importContext=document.querySelector('#transactionEditImportContext');
  const importContextBody=document.querySelector('#transactionEditImportContextBody');
  const rawImport=tx.import_raw_data&&typeof tx.import_raw_data==='object'?tx.import_raw_data:null;
  const rawText=String(rawImport?.raw_text||'').trim();
  const rawRow=rawImport?.row&&typeof rawImport.row==='object'?rawImport.row:null;
  const importParts=[
    tx.bank_reference?`<span><b>Bankreferenz / Zweck:</b> ${escapeHtml(tx.bank_reference)}</span>`:'',
    tx.counterparty_account_ref?`<span><b>Gegenkonto / IBAN:</b> ${escapeHtml(tx.counterparty_account_ref)}</span>`:'',
    tx.import_source_page?`<span><b>PDF-Seite:</b> ${Number(tx.import_source_page)}</span>`:'',
    rawText?`<pre>${escapeHtml(rawText)}</pre>`:rawRow?`<pre>${escapeHtml(JSON.stringify(rawRow,null,2))}</pre>`:'',
  ].filter(Boolean).join('');
  if(importContext&&importContextBody){
    importContext.hidden=!importParts;
    importContext.open=false;
    importContextBody.innerHTML=importParts;
  }
  const taxRelevant=document.querySelector('#transactionEditTaxRelevant'); if (taxRelevant) taxRelevant.value=tx.tax_relevant?'true':'false';
  const taxYear=document.querySelector('#transactionEditTaxYear'); if (taxYear) taxYear.value=String(transactionTaxYear(tx));
  const taxTreatment=document.querySelector('#transactionEditTaxTreatment'); if (taxTreatment) taxTreatment.value=tx.tax_treatment||transactionTaxDefaults(tx).treatment||'';
  const taxSection=document.querySelector('#transactionEditTaxSectionKey'); if (taxSection) taxSection.value=tx.tax_section_key||transactionTaxDefaults(tx).section||'';
  const taxCategory=document.querySelector('#transactionEditTaxCategory'); if (taxCategory) taxCategory.value=tx.tax_category||'';
  const semantic=document.querySelector('#transactionEditSemantic'); if(semantic) semantic.value=tx.semantic_type||'';
  const exclude=document.querySelector('#transactionEditExclude'); if(exclude) exclude.checked=tx.exclude_from_reports===true;
  const toggle=document.querySelector('#transactionMakeRecurring');
  const fields=document.querySelector('#transactionRecurringFields');
  const linkedRule=(tx.recurring_rule_id&&runtime.recurringRules.find((row)=>row.id===tx.recurring_rule_id))||findMatchingRecurringRule(tx);
  const recurringWanted=recurring||Boolean(linkedRule);
  if (toggle) {
    toggle.checked=recurringWanted;
    toggle.dataset.matchRuleId=linkedRule?.id||'';
  }
  if (fields) fields.hidden=!recurringWanted||Boolean(linkedRule);
  const recurringHint=document.querySelector('#transactionRecurringMatchHint');
  if(recurringHint) recurringHint.textContent=linkedRule
    ? `Bereits erkannt: ${linkedRule.description} · ${Number(linkedRule.amount).toFixed(2)} ${linkedRule.currency} · ${linkedRule.cadence}. Finance verknüpft die Buchung und erstellt keine zweite Regel.`
    : 'Keine bestehende Wiederholung erkannt. Nur wenn aktiviert, wird eine neue Regel angelegt.';
  const next=document.querySelector('#transactionRecurringNextDate');
  if (next) next.value=linkedRule?.next_date||addMonthsToDate(tx.occurred_at,1);
  const otherAccount=document.querySelector('#transactionEditOtherAccount'); if(otherAccount) otherAccount.value='';
  const otherAmount=document.querySelector('#transactionEditOtherAmount'); if(otherAmount) otherAmount.value='';
  const form=document.querySelector('#transaction-edit'); form?.removeAttribute('hidden'); syncTransactionTransferEditor(); form?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function handleForm(form) {
  const data = new FormData(form);
  const id = form.id;
  const h = runtime.household?.id;
  const currency = runtime.household?.base_currency || 'CHF';

  if (!['setup-create','password-change','admin-user-create','admin-demo-create'].includes(id)) {
    if (id === 'family-add') { if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen Mitglieder verwalten.'); }
    else if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
  }

  if (id === 'project-create') {
    const name=formValue(data,'name').trim();
    if(!name) throw new Error('Bitte einen Projektnamen eingeben.');
    const normalizedKey=normalizeMerchantKey(name);
    const existing=runtime.transactionContexts.find((row)=>row.normalized_key===normalizedKey);
    if(existing&&!existing.is_archived) throw new Error('Dieses Projekt existiert bereits.');
    if(existing){
      await financeApi.updateTransactionContext(existing.id,{
        name,
        context_type:formValue(data,'contextType')||'project',
        starts_on:nullValue(data,'startsOn'),
        ends_on:nullValue(data,'endsOn'),
        is_archived:false,
      });
    } else {
      await financeApi.upsertTransactionContext({
        household_id:h,
        name,
        normalized_key:normalizedKey,
        context_type:formValue(data,'contextType')||'project',
        vehicle_id:null,
        starts_on:nullValue(data,'startsOn'),
        ends_on:nullValue(data,'endsOn'),
        is_archived:false,
      });
    }
    await refresh('Anlass / Projekt gespeichert.');
    return;
  }

  if (id === 'setup-create') {
    const countryCode = formValue(data,'countryCode');
    const baseCurrency = formValue(data,'baseCurrency');
    const locale = formValue(data,'locale') || (countryCode === 'DE' ? 'de-DE' : 'de-CH');
    runtime.profile = await financeApi.updateProfile(runtime.user.id, {
      display_name: formValue(data,'displayName'),
      country_code: countryCode,
      base_currency: baseCurrency,
      locale,
      onboarding_completed_at: null,
      preferences:{...profilePreferences(),setup_reviewed:[],setup_completed_version:null},
    });
    const createdHousehold = await financeApi.createHousehold({
      name: formValue(data,'householdName'), countryCode, baseCurrency, ownerUserId: runtime.user.id
    });
    await seedStarterCategoriesForHousehold(createdHousehold.id, countryCode, []);
    await refresh('Grunddaten gespeichert. Richte jetzt dein erstes Konto ein.');
    location.hash = '#/setup';
    return;
  }
  if (id === 'setup-income-create') {
    const account=runtime.accounts.find((row)=>row.account_id===formValue(data,'accountId'));
    if(!account) throw new Error('Bitte ein Zielkonto für die Einnahme auswählen.');
    const amount=Math.abs(numberValue(data,'amount'));
    if(!amount) throw new Error('Bitte einen gültigen Monatsbetrag eingeben.');
    const incomeCategory=runtime.categories.find((row)=>row.kind==='income'&&String(row.name||'').toLowerCase()==='lohn')
      || runtime.categories.find((row)=>row.kind==='income')
      || null;
    await financeApi.createRecurringRule({
      household_id:h,
      account_id:account.account_id,
      destination_account_id:null,
      category_id:incomeCategory?.id||null,
      merchant_id:null,
      direction:'income',
      description:formValue(data,'description')||'Lohn',
      counterparty:nullValue(data,'counterparty'),
      amount,
      currency:account.currency||currency,
      cadence:'monthly',
      next_date:formValue(data,'nextDate'),
      end_date:null,
      active:true,
    });
    await refresh('Monatseinnahme gespeichert.');
    location.hash='#/setup';
    return;
  }
  if (id === 'setup-expense-create') {
    const account=runtime.accounts.find((row)=>row.account_id===formValue(data,'accountId'));
    if(!account) throw new Error('Bitte ein Zahlungskonto auswählen.');
    const category=runtime.categories.find((row)=>row.id===formValue(data,'categoryId'));
    if(!category||category.kind!=='expense') throw new Error('Bitte eine Ausgaben-Kategorie auswählen.');
    const amount=Math.abs(numberValue(data,'amount'));
    if(!amount) throw new Error('Bitte einen gültigen Betrag eingeben.');
    const counterpartyName=String(formValue(data,'counterparty')||'').trim();
    let merchant=null;
    if(counterpartyName){
      const key=normalizeMerchantKey(counterpartyName);
      merchant=runtime.merchants.find((row)=>row.normalized_key===key) || await financeApi.upsertMerchant({
        household_id:h,
        name:counterpartyName,
        normalized_key:key,
        default_category_id:category.id,
      });
      if(merchant && merchant.default_category_id!==category.id){
        await financeApi.updateMerchant(merchant.id,{default_category_id:category.id});
      }
    }
    await financeApi.createRecurringRule({
      household_id:h,
      account_id:account.account_id,
      destination_account_id:null,
      category_id:category.id,
      merchant_id:merchant?.id||null,
      direction:'expense',
      description:formValue(data,'description'),
      counterparty:counterpartyName||null,
      amount,
      currency:account.currency||currency,
      cadence:'monthly',
      next_date:formValue(data,'nextDate'),
      end_date:null,
      active:true,
    });
    await refresh(merchant?'Fixkosten gespeichert und Empfänger verknüpft.':'Fixkosten gespeichert.');
    location.hash='#/setup';
    return;
  }

  if (id === 'setup-complete') {
    const setup=buildSetupStatus({...runtime,profile:runtime.profile,household:runtime.household});
    if (!setup.states.accounts) throw new Error('Bitte zuerst mindestens ein Konto oder eine Geldbörse einrichten.');
    if (!setup.states.balances) throw new Error('Bitte die aktuellen Kontostände prüfen.');
    if (!setup.states.categories) throw new Error('Bitte zuerst die Hauptkategorien einrichten.');
    if (!setup.states.subcategories) throw new Error('Bitte zuerst Unterkategorien einrichten.');
    if (!setup.states.automation) throw new Error('Bitte Händler oder automatische Zuordnungsregeln einrichten.');
    if (!setup.states.recurring) throw new Error('Bitte wiederkehrende Einnahmen und Fixkosten einrichten oder bewusst auf später setzen.');
    if (!setup.states.modules) throw new Error('Bitte optionale Module prüfen oder bewusst auf später setzen.');
    runtime.profile = await financeApi.updateProfile(runtime.user.id, {
      onboarding_completed_at:new Date().toISOString(),
      preferences:{...profilePreferences(),setup_completed_version:2},
    });
    await refresh('Einrichtung abgeschlossen. Finance ist bereit.');
    location.hash = '#/overview';
    return;
  }

  if (id === 'masterdata-copy') {
    const sourceHouseholdId=formValue(data,'sourceHouseholdId');
    const targetHouseholdId=formValue(data,'targetHouseholdId')||h;
    if(!sourceHouseholdId) throw new Error('Bitte einen Quellhaushalt auswählen.');
    if(!targetHouseholdId) throw new Error('Bitte einen Zielhaushalt auswählen.');
    if(sourceHouseholdId===targetHouseholdId) throw new Error('Quell- und Zielhaushalt müssen unterschiedlich sein.');
    const result=await financeApi.copyHouseholdMasterData(sourceHouseholdId,targetHouseholdId);
    const parts=[
      Number(result?.categories_created||0)?`${result.categories_created} Kategorien`:'',
      Number(result?.merchants_created||0)?`${result.merchants_created} Händler`:'',
      Number(result?.merchants_linked||0)?`${result.merchants_linked} Händler-Zuordnungen`:'',
      Number(result?.rules_created||0)?`${result.rules_created} Regeln`:'',
    ].filter(Boolean);
    await refresh(parts.length?`Stammdaten übernommen: ${parts.join(' · ')}.`:'Stammdaten sind bereits aktuell.');
    return;
  }

  if (id === 'account-create') {
    await financeApi.createAccount({ household_id:h, name:formValue(data,'name'), account_type:formValue(data,'accountType'), institution_name:nullValue(data,'institutionName'), external_account_ref:nullValue(data,'externalAccountRef'), currency:formValue(data,'currency')||currency, balance_anchor_amount:numberValue(data,'balance'), balance_anchor_at:new Date().toISOString(), visibility:formValue(data,'visibility')||'private' });
    await refresh('Konto gespeichert.'); return;
  }
  if (id === 'account-edit') {
    const accountId=formValue(data,'accountId');
    const account=runtime.accounts.find((a)=>a.account_id===accountId);
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    const nextCurrency=formValue(data,'currency')||account.currency;
    const correction=formValue(data,'balanceCorrection');
    if(nextCurrency!==account.currency){
      const linked=
        runtime.transactions.some((row)=>row.account_id===accountId)
        || runtime.recurringRules.some((row)=>row.account_id===accountId||row.destination_account_id===accountId)
        || runtime.bills.some((row)=>row.account_id===accountId)
        || runtime.contracts.some((row)=>row.account_id===accountId)
        || runtime.goals.some((row)=>row.account_id===accountId)
        || runtime.debts.some((row)=>row.payment_account_id===accountId)
        || runtime.debtPayments.some((row)=>row.payment_account_id===accountId)
        || runtime.receivables.some((row)=>row.source_account_id===accountId)
        || runtime.receivablePayments.some((row)=>row.payment_account_id===accountId)
        || runtime.insurance.some((row)=>row.account_id===accountId);
      if(linked) throw new Error('Die Kontowährung kann nicht geändert werden, solange Buchungen oder Verknüpfungen auf diesem Konto bestehen.');
      if(correction==='') throw new Error('Bei einem Währungswechsel muss der aktuelle Kontostand neu angegeben werden.');
    }
    const patch={ name:formValue(data,'name'), account_type:formValue(data,'accountType'), institution_name:nullValue(data,'institutionName'), external_account_ref:nullValue(data,'externalAccountRef'), currency:nextCurrency, visibility:formValue(data,'visibility')||'private' };
    if (correction !== '') {
      const corrected=Number(correction);
      if (!Number.isFinite(corrected)) throw new Error('Ungültiger Kontostand.');
      patch.balance_anchor_amount=corrected;
      patch.balance_anchor_at=new Date().toISOString();
    }
    await financeApi.updateAccount(accountId,patch);
    await refresh(correction !== '' ? 'Konto und Stand-jetzt-Anker korrigiert.' : 'Konto aktualisiert.'); return;
  }

  if (id === 'transaction-merge') {
    const left=runtime.transactions.find((row)=>row.id===formValue(data,'transactionId'));
    const right=runtime.transactions.find((row)=>row.id===formValue(data,'duplicateTransactionId'));
    if(!left||!right||left.id===right.id) throw new Error('Bitte zwei unterschiedliche Buchungen auswählen.');
    const keep=preferredTransactionToKeep(left,right,runtime.documents);
    const duplicate=keep.id===left.id?right:left;
    if(!confirm('Diese Doppelbuchung zusammenführen? Finance behält bevorzugt die Bankbuchung und übernimmt Belege sowie Zuordnungen.')) return;
    await financeApi.mergeDuplicateTransactions({householdId:h,keepTransactionId:keep.id,duplicateTransactionId:duplicate.id});
    await refresh('Doppelbuchung zusammengeführt. Der Beleg bleibt mit der verbleibenden Buchung verknüpft.');
    return;
  }
  if (id === 'transaction-create') {
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Bitte ein Konto auswählen.');
    const direction=formValue(data,'direction')||'expense';
    const rawAmount=Math.abs(numberValue(data,'amount'));
    const occurredAt=financeEventTimestamp(formValue(data,'occurredAt'));
    const merchantId=nullValue(data,'merchantId');
    const explicitCategoryId=nullValue(data,'categoryId');
    const counterpartyEntity=await resolveCounterpartyFromForm(data);
    const contextId=await resolveContextFromForm(data);
    const contextName=formValue(data,'contextName')||runtime.transactionContexts.find((row)=>row.id===contextId)?.name||'';
    const categoryId=suggestedCategoryIdForTransaction({
      explicitCategoryId,
      merchantId,
      description:formValue(data,'description'),
      counterparty:nullValue(data,'counterparty'),
      note:nullValue(data,'note'),
      amount:direction==='expense'?-rawAmount:rawAmount,
      semanticType:nullValue(data,'semanticType'),
      contextName,
    });
    const vehicleId=await resolveVehicleFromForm(data,{amount:rawAmount,occurredAt,currency:account.currency});
    let tax=null;
    if (moduleEnabled('tax')) {
      const enabled=formValue(data,'taxRelevant')==='true';
      if(enabled){
        const signed=direction==='expense'?-rawAmount:rawAmount;
        const txLike={
          amount:signed, occurred_at:occurredAt, description:formValue(data,'description'),
          counterparty:nullValue(data,'counterparty'), tax_category:nullValue(data,'taxCategory'),
          taxTreatment:nullValue(data,'taxTreatment'), taxSectionKey:nullValue(data,'taxSectionKey')
        };
        const defaults=transactionTaxDefaults(txLike);
        const taxYear=numberValue(data,'taxYear',transactionTaxYear(txLike));
        await ensureTransactionTaxCase(taxYear);
        tax={
          enabled:true, category:nullValue(data,'taxCategory'), year:taxYear,
          treatment:nullValue(data,'taxTreatment')||defaults.treatment,
          sectionKey:nullValue(data,'taxSectionKey')||defaults.section,
        };
      } else tax={enabled:false};
    }
    await createEconomicTransaction({
      api:financeApi, householdId:h, account, direction, amount:rawAmount,
      categoryId, merchantId, merchants:runtime.merchants, occurredAt,
      description:formValue(data,'description'), counterparty:nullValue(data,'counterparty'),
      counterpartyId:counterpartyEntity?.id||null,
      contextId,
      vehicleId,
      note:nullValue(data,'note'), semanticType:nullValue(data,'semanticType'),
      excludeFromReports:data.get('excludeFromReports')==='on', tax,
    });
    await refresh('Transaktion gespeichert und in allen Auswertungen aktualisiert.'); return;
  }
  if (id === 'transaction-edit') {
    const transactionId=formValue(data,'transactionId');
    const tx=runtime.transactions.find((row)=>row.id===transactionId);
    if (!tx || tx.transfer_group_id) throw new Error('Diese Buchung kann nicht einzeln bearbeitet werden.');
    if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden unter Schulden & Kredite verwaltet.');
    if (tx.cashflow_type === 'receivable_principal') throw new Error('Forderungsbuchungen werden unter Forderungen verwaltet.');
    if (runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id)) throw new Error('Diese Buchung ist mit einer bezahlten Rechnung verknüpft. Bitte die Rechnung unter Rechnungen verwalten.');

    const editDirection=formValue(data,'direction')||'expense';
    if(['transfer','cash_withdrawal'].includes(editDirection)){
      const cashWithdrawal=editDirection==='cash_withdrawal';
      const currentAccount=runtime.accounts.find((a)=>a.account_id===tx.account_id);
      if(!currentAccount) throw new Error('Konto der Buchung wurde nicht gefunden.');
      if(cashWithdrawal&&Number(tx.amount)>=0) throw new Error('Ein Bargeldbezug muss ein Abgang vom Bankkonto sein.');

      const occurredAt=financeEventTimestamp(formValue(data,'occurredAt'));
      let otherAccountId=formValue(data,'otherAccountId');
      let otherAccount=null;
      if(cashWithdrawal&&otherAccountId==='__auto_cash__'){
        otherAccount=await ensureCashAccount(currentAccount.currency,occurredAt);
        otherAccountId=otherAccount?.account_id;
      } else {
        otherAccount=runtime.accounts.find((a)=>a.account_id===otherAccountId);
      }
      if(!otherAccount) throw new Error(cashWithdrawal?'Bitte ein Bargeld-Wallet auswählen.':'Bitte das Gegenkonto der Umbuchung auswählen.');
      if(currentAccount.account_id===otherAccount.account_id) throw new Error('Die Umbuchung braucht zwei verschiedene Konten.');
      if(cashWithdrawal&&otherAccount.account_type!=='cash') throw new Error('Ein Bargeldbezug muss auf ein Bargeld-Wallet gebucht werden.');
      if(cashWithdrawal&&otherAccount.currency!==currentAccount.currency) throw new Error('Bargeldbezug und Bargeld-Wallet müssen dieselbe Währung haben.');

      const currentAmount=Math.abs(numberValue(data,'amount'));
      if(!(currentAmount>0)) throw new Error('Der Betrag muss grösser als 0 sein.');
      const sameCurrency=currentAccount.currency===otherAccount.currency;
      const otherAmount=sameCurrency?null:Math.abs(numberValue(data,'otherAmount'));
      if(!sameCurrency&&!(otherAmount>0)) throw new Error('Bitte den Betrag auf dem Gegenkonto angeben.');

      const makeRecurring=!cashWithdrawal&&data.get('makeRecurring')==='on';
      if(makeRecurring&&!sameCurrency) throw new Error('Wiederkehrende Umbuchungen werden aktuell nur zwischen Konten derselben Währung unterstützt.');
      const description=formValue(data,'description')||tx.description||(cashWithdrawal?'Bargeldbezug':'Umbuchung');

      const transferGroupId=await financeApi.convertTransactionToTransferV2({
        householdId:h,
        transactionId:tx.id,
        otherAccountId:otherAccount.account_id,
        amount:currentAmount,
        otherAmount,
        otherTransactionId:nullValue(data,'otherTransactionId'),
        occurredAt,
        description,
        note:formValue(data,'note'),
      });

      let recurringRule=null;
      let recurringCreated=false;
      if(makeRecurring){
        const currentOutgoing=Number(tx.amount)<0;
        const sourceAccount=currentOutgoing?currentAccount:otherAccount;
        const destinationAccount=currentOutgoing?otherAccount:currentAccount;
        recurringRule=runtime.recurringRules.find((rule)=>
          rule.active!==false
          && rule.direction==='transfer'
          && rule.account_id===sourceAccount.account_id
          && rule.destination_account_id===destinationAccount.account_id
          && Math.abs(Number(rule.amount)-currentAmount)<0.01
        )||null;
        if(!recurringRule){
          recurringRule=await financeApi.createRecurringRule({
            household_id:h,
            account_id:sourceAccount.account_id,
            destination_account_id:destinationAccount.account_id,
            category_id:null,
            merchant_id:null,
            direction:'transfer',
            description,
            counterparty:null,
            amount:currentAmount,
            currency:sourceAccount.currency,
            cadence:formValue(data,'recurringCadence')||'monthly',
            interval_months:(formValue(data,'recurringCadence')||'monthly')==='monthly'?Math.max(1,numberValue(data,'recurringIntervalMonths',1)):1,
            amount_mode:'fixed',
            next_date:formValue(data,'recurringNextDate')||addMonthsToDate(occurredAt,1),
            active:true,
          });
          recurringCreated=Boolean(recurringRule?.id);
        }
        if(recurringRule?.id) await financeApi.updateTransaction(tx.id,{recurring_rule_id:recurringRule.id});
      }

      const currentOutgoing=Number(tx.amount)<0;
      const from=currentOutgoing?currentAccount:otherAccount;
      const to=currentOutgoing?otherAccount:currentAccount;
      const message=cashWithdrawal
        ? `Bargeldbezug korrekt als Umbuchung ${from.name} → ${to.name} gespeichert. Keine Ausgabe wurde erzeugt.`
        : recurringRule
          ? recurringCreated
            ? `Umbuchung ${from.name} → ${to.name} gespeichert und neue Wiederholung angelegt.`
            : `Umbuchung ${from.name} → ${to.name} gespeichert und mit bestehender Wiederholung verknüpft.`
          : `Umbuchung ${from.name} → ${to.name} korrekt verknüpft.`;
      void transferGroupId;
      await refresh(message);
      return;
    }

    const account=runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    const amount=Math.abs(numberValue(data,'amount'))*(editDirection==='expense'?-1:1);
    const merchantId=nullValue(data,'merchantId');
    const counterpartyEntity=await resolveCounterpartyFromForm(data);
    const contextId=await resolveContextFromForm(data);
    const editOccurredAt=financeEventTimestamp(formValue(data,'occurredAt'));
    const vehicleId=await resolveVehicleFromForm(data,{amount:Math.abs(amount),occurredAt:editOccurredAt,currency:account.currency});

    const patch={
      account_id:account.account_id,
      category_id:suggestedCategoryIdForTransaction({
        explicitCategoryId:nullValue(data,'categoryId'),
        merchantId,
        description:formValue(data,'description'),
        counterparty:nullValue(data,'counterparty'),
        note:nullValue(data,'note'),
        amount,
        semanticType:nullValue(data,'semanticType'),
        contextName:formValue(data,'contextName')||runtime.transactionContexts.find((row)=>row.id===contextId)?.name||'',
      }),
      merchant_id:merchantId,
      counterparty_id:counterpartyEntity?.id||null,
      context_id:contextId,
      vehicle_id:vehicleId,
      occurred_at:editOccurredAt,
      amount,
      currency:account.currency,
      description:formValue(data,'description'),
      counterparty:nullValue(data,'counterparty'),
      note:nullValue(data,'note'),
      semantic_type:nullValue(data,'semanticType'),
      exclude_from_reports:data.get('excludeFromReports')==='on'
    };

    if (moduleEnabled('tax')) {
      patch.tax_relevant=formValue(data,'taxRelevant')==='true';
      patch.tax_category=patch.tax_relevant?nullValue(data,'taxCategory'):null;
      if(patch.tax_relevant){
        const defaults=transactionTaxDefaults({...patch,taxTreatment:nullValue(data,'taxTreatment'),taxSectionKey:nullValue(data,'taxSectionKey')});
        patch.tax_year=numberValue(data,'taxYear',transactionTaxYear({...tx,...patch}));
        patch.tax_treatment=nullValue(data,'taxTreatment')||defaults.treatment;
        patch.tax_section_key=nullValue(data,'taxSectionKey')||defaults.section;
        await ensureTransactionTaxCase(patch.tax_year);
      } else {
        patch.tax_year=null; patch.tax_treatment=null; patch.tax_section_key=null;
      }
    }

    const makeRecurring=data.get('makeRecurring')==='on';
    let recurringRule=null;
    let recurringCreated=false;
    if(makeRecurring){
      const hintedId=document.querySelector('#transactionMakeRecurring')?.dataset.matchRuleId||'';
      recurringRule=runtime.recurringRules.find((rule)=>rule.id===hintedId)
        || findMatchingRecurringRule({...tx,...patch})
        || null;
      if(recurringRule){
        patch.recurring_rule_id=recurringRule.id;
      }
    } else {
      patch.recurring_rule_id=null;
    }

    await financeApi.updateTransaction(transactionId,patch);

    if(makeRecurring&&!recurringRule){
      const direction=amount<0?'expense':'income';
      recurringRule=await financeApi.createRecurringRule({
        household_id:h,
        account_id:account.account_id,
        category_id:patch.category_id,
        merchant_id:patch.merchant_id,
        direction,
        description:patch.description,
        counterparty:patch.counterparty,
        amount:Math.abs(amount),
        currency:account.currency,
        cadence:formValue(data,'recurringCadence')||'monthly',
        interval_months:(formValue(data,'recurringCadence')||'monthly')==='monthly'?Math.max(1,numberValue(data,'recurringIntervalMonths',1)):1,
        amount_mode:formValue(data,'recurringAmountMode')||'fixed',
        next_date:formValue(data,'recurringNextDate')||addMonthsToDate(patch.occurred_at,1),
        active:true
      });
      if(recurringRule?.id){
        recurringCreated=true;
        await financeApi.updateTransaction(transactionId,{recurring_rule_id:recurringRule.id});
      }
    }

    await refresh(
      recurringRule
        ? recurringCreated
          ? 'Transaktion korrigiert und neue wiederkehrende Zahlung angelegt.'
          : 'Transaktion korrigiert und mit der bereits vorhandenen wiederkehrenden Zahlung verknüpft.'
        : 'Transaktion korrigiert.'
    );
    return;
  }
  if (id === 'transfer-create') {
    const from = runtime.accounts.find((a)=>a.account_id===formValue(data,'fromAccountId'));
    const to = runtime.accounts.find((a)=>a.account_id===formValue(data,'toAccountId'));
    if (!from || !to) throw new Error('Konten fehlen.');
    const enteredToAmount=formValue(data,'toAmount');
    await createEconomicTransfer({
      api:financeApi, householdId:h, fromAccount:from, toAccount:to,
      fromAmount:Math.abs(numberValue(data,'amount')),
      toAmount:from.currency===to.currency?null:Math.abs(Number(enteredToAmount)),
      occurredAt:financeEventTimestamp(formValue(data,'occurredAt')),
      description:formValue(data,'description')||'Umbuchung',
    });
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
  if (id === 'merchant-create') {
    const name=formValue(data,'name');
    const key=normalizeMerchantKey(name);
    if(!key) throw new Error('Bitte einen gültigen Händlernamen eingeben.');
    const duplicate=runtime.merchants.find((row)=>row.normalized_key===key);
    if(duplicate) throw new Error('Dieser Händler existiert bereits.');
    await financeApi.upsertMerchant({
      household_id:h,
      name,
      normalized_key:key,
      default_category_id:nullValue(data,'categoryId')
    });
    await refresh('Händler gespeichert.'); return;
  }
  if (id === 'merchant-merge-manual') {
    const duplicateId=formValue(data,'duplicateMerchantId');
    const canonicalId=formValue(data,'canonicalMerchantId');
    const duplicate=runtime.merchants.find((row)=>row.id===duplicateId);
    const canonical=runtime.merchants.find((row)=>row.id===canonicalId);
    if(!duplicate||!canonical||duplicate.id===canonical.id) throw new Error('Bitte zwei unterschiedliche Händler auswählen.');
    if(!confirm(`${duplicate.name} mit ${canonical.name} zusammenführen? Künftige Varianten von ${duplicate.name} werden als ${canonical.name} erkannt.`)) return;
    await financeApi.mergeMerchants({householdId:h,canonicalMerchantId:canonical.id,duplicateMerchantId:duplicate.id});
    await refresh(`${duplicate.name} wurde als Alias von ${canonical.name} gespeichert.`);
    return;
  }
  if (id === 'merchant-edit') {
    const merchantId=formValue(data,'merchantId');
    const merchant=runtime.merchants.find((row)=>row.id===merchantId);
    if(!merchant) throw new Error('Händler wurde nicht gefunden.');
    const name=formValue(data,'name');
    const key=normalizeMerchantKey(name);
    if(!key) throw new Error('Bitte einen gültigen Händlernamen eingeben.');
    const duplicate=runtime.merchants.find((row)=>row.id!==merchantId && row.normalized_key===key);
    if(duplicate) throw new Error('Ein anderer Händler verwendet diesen Namen bereits.');
    if(merchant.normalized_key!==key){
      await financeApi.upsertMerchantAlias({
        household_id:h,
        merchant_id:merchant.id,
        alias_name:merchant.name,
        normalized_key:merchant.normalized_key,
        payment_processor:null,
      });
    }
    const updated=await financeApi.updateMerchant(merchantId,{
      name,
      normalized_key:key,
      default_category_id:nullValue(data,'categoryId')
    });
    const linkedRules=runtime.recurringRules.filter((rule)=>rule.merchant_id===merchantId);
    for(const rule of linkedRules){
      if(rule.counterparty!==name) await financeApi.updateRecurringRule(rule.id,{counterparty:name});
    }
    await refresh('Händler aktualisiert.'); return;
  }
  if (id === 'recurring-create') {
    const direction=formValue(data,'direction')||'expense';
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Bitte ein Konto auswählen.');
    let destinationAccountId=null;
    if(direction==='transfer'){
      const destination=runtime.accounts.find((a)=>a.account_id===formValue(data,'destinationAccountId'));
      if(!destination) throw new Error('Bitte ein Zielkonto / einen Topf auswählen.');
      if(destination.account_id===account.account_id) throw new Error('Quell- und Zielkonto müssen unterschiedlich sein.');
      if(destination.currency!==account.currency) throw new Error('Wiederkehrende Umbuchungen werden aktuell nur zwischen Konten derselben Währung unterstützt.');
      destinationAccountId=destination.account_id;
    }
    await financeApi.createRecurringRule({
      household_id:h,
      account_id:account.account_id,
      destination_account_id:destinationAccountId,
      category_id:direction==='transfer'?null:nullValue(data,'categoryId'),
      direction,
      description:formValue(data,'description'),
      amount:Math.abs(numberValue(data,'amount')),
      amount_mode:direction==='transfer'?'fixed':(formValue(data,'amountMode')||'fixed'),
      currency:account.currency||currency,
      cadence:formValue(data,'cadence'),
      interval_months:formValue(data,'cadence')==='monthly'?Math.max(1,numberValue(data,'intervalMonths',1)):1,
      next_date:formValue(data,'nextDate'),
      end_date:nullValue(data,'endDate'),
      active:true
    });
    await refresh(direction==='transfer'?'Wiederkehrende Umbuchung gespeichert.':'Wiederkehrende Zahlung gespeichert.'); return;
  }
  if (id === 'recurring-edit') {
    const ruleId=formValue(data,'ruleId');
    const rule=runtime.recurringRules.find((row)=>row.id===ruleId);
    if(!rule) throw new Error('Wiederkehrende Regel wurde nicht gefunden.');
    const linkedSource=
      runtime.contracts.some((row)=>row.recurring_rule_id===ruleId)
      || runtime.insurance.some((row)=>row.recurring_rule_id===ruleId)
      || runtime.debts.some((row)=>row.recurring_rule_id===ruleId)
      || runtime.goalSources.some((row)=>row.recurring_rule_id===ruleId);
    if(linkedSource) throw new Error('Diese Regel ist mit einer Quelle verknüpft und wird dort bearbeitet.');

    const direction=formValue(data,'direction')||rule.direction||'expense';
    const account=runtime.accounts.find((row)=>row.account_id===formValue(data,'accountId'));
    if(!account) throw new Error('Bitte ein Konto auswählen.');

    let destinationAccountId=null;
    if(direction==='transfer'){
      const destination=runtime.accounts.find((row)=>row.account_id===formValue(data,'destinationAccountId'));
      if(!destination) throw new Error('Bitte ein Zielkonto / einen Topf auswählen.');
      if(destination.account_id===account.account_id) throw new Error('Quell- und Zielkonto müssen unterschiedlich sein.');
      if(destination.currency!==account.currency) throw new Error('Wiederkehrende Umbuchungen werden aktuell nur zwischen Konten derselben Währung unterstützt.');
      destinationAccountId=destination.account_id;
    }

    const categoryId=direction==='transfer'?null:nullValue(data,'categoryId');
    await financeApi.updateRecurringRule(ruleId,{
      account_id:account.account_id,
      destination_account_id:destinationAccountId,
      category_id:categoryId,
      merchant_id:direction==='expense'?(rule.merchant_id||null):null,
      counterparty:direction==='expense'?(rule.counterparty||null):null,
      direction,
      description:formValue(data,'description'),
      amount:Math.abs(numberValue(data,'amount')),
      amount_mode:direction==='transfer'?'fixed':(formValue(data,'amountMode')||'fixed'),
      currency:account.currency||currency,
      cadence:formValue(data,'cadence'),
      interval_months:formValue(data,'cadence')==='monthly'?Math.max(1,numberValue(data,'intervalMonths',1)):1,
      reserve_enabled:direction==='expense'?Boolean(rule.reserve_enabled):false,
      reserve_account_id:direction==='expense'?(rule.reserve_account_id||null):null,
      next_date:formValue(data,'nextDate'),
      end_date:nullValue(data,'endDate'),
      active:formValue(data,'active')==='true'
    });
    if(direction==='expense' && rule.merchant_id && categoryId){
      const merchant=runtime.merchants.find((row)=>row.id===rule.merchant_id);
      if(merchant && merchant.default_category_id!==categoryId){
        await financeApi.updateMerchant(merchant.id,{default_category_id:categoryId});
      }
    }
    await refresh('Wiederkehrende Regel aktualisiert.'); return;
  }
  if (id === 'fixed-cost-create') {
    const direction=formValue(data,'direction')||'expense';
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Bitte ein Konto auswählen.');
    const categoryId=direction==='transfer'?null:nullValue(data,'categoryId');
    const category=runtime.categories.find((row)=>row.id===categoryId) || null;
    if(direction==='income' && category && category.kind!=='income') throw new Error('Für eine feste Einnahme bitte eine Einnahmen-Kategorie wählen.');
    if(direction==='expense' && category && category.kind!=='expense') throw new Error('Für Fixkosten bitte eine Ausgaben-Kategorie wählen.');

    const counterpartyName=direction==='transfer'?'':String(formValue(data,'counterparty')||'').trim();
    let merchant=null;
    if(direction==='expense' && counterpartyName){
      const key=normalizeMerchantKey(counterpartyName);
      merchant=runtime.merchants.find((row)=>row.normalized_key===key) || await financeApi.upsertMerchant({
        household_id:h,
        name:counterpartyName,
        normalized_key:key,
        default_category_id:categoryId,
      });
    }

    let destinationAccountId=null;
    if(direction==='transfer'){
      const destination=runtime.accounts.find((a)=>a.account_id===formValue(data,'destinationAccountId'));
      if(!destination) throw new Error('Bitte ein Zielkonto / einen Topf auswählen.');
      if(destination.account_id===account.account_id) throw new Error('Quell- und Zielkonto müssen unterschiedlich sein.');
      if(destination.currency!==account.currency) throw new Error('Fixe Umbuchungen werden aktuell nur zwischen Konten derselben Währung unterstützt.');
      destinationAccountId=destination.account_id;
    }
    const reserveEnabled=direction==='expense'&&data.get('reserveEnabled')==='on';
    let reserveAccountId=null;
    if(reserveEnabled){
      const reserve=runtime.accounts.find((a)=>a.account_id===formValue(data,'reserveAccountId'));
      if(!reserve) throw new Error('Bitte einen Rücklagetopf auswählen.');
      if(reserve.account_id===account.account_id) throw new Error('Rücklagetopf und Zahlungskonto müssen unterschiedlich sein.');
      if(reserve.currency!==account.currency) throw new Error('Rücklagetopf und Zahlungskonto müssen dieselbe Währung haben.');
      reserveAccountId=reserve.account_id;
    }
    await financeApi.createRecurringRule({
      household_id:h,
      account_id:account.account_id,
      destination_account_id:destinationAccountId,
      category_id:categoryId,
      merchant_id:direction==='expense'?(merchant?.id||null):null,
      direction,
      description:formValue(data,'description'),
      counterparty:counterpartyName||null,
      amount:Math.abs(numberValue(data,'amount')),
      amount_mode:direction==='transfer'?'fixed':(formValue(data,'amountMode')||'fixed'),
      currency:account.currency||currency,
      cadence:formValue(data,'cadence'),
      interval_months:formValue(data,'cadence')==='monthly'?Math.max(1,numberValue(data,'intervalMonths',1)):1,
      reserve_enabled:reserveEnabled,
      reserve_account_id:reserveAccountId,
      reserve_strategy:'monthly',
      next_date:formValue(data,'nextDate'),
      end_date:nullValue(data,'endDate'),
      active:true,
    });
    if(merchant && categoryId && merchant.default_category_id!==categoryId){
      await financeApi.updateMerchant(merchant.id,{default_category_id:categoryId});
    }
    const message=direction==='income'
      ? 'Feste Einnahme gespeichert.'
      : direction==='transfer'
        ? 'Fixe Umbuchung gespeichert.'
        : merchant
          ? 'Fixkosten gespeichert und Händler verknüpft.'
          : 'Fixkosten gespeichert.';
    await refresh(message); return;
  }
  if (id === 'fixed-cost-edit') {
    const ruleId=formValue(data,'ruleId');
    const direction=formValue(data,'direction')||'expense';
    const cadence=formValue(data,'cadence');
    const account = runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!ruleId) throw new Error('Fixkosten-Eintrag wurde nicht gefunden.');
    if (!account) throw new Error('Bitte ein Konto auswählen.');

    const linkedContract=runtime.contracts.find((row)=>row.recurring_rule_id===ruleId);
    const linkedPolicy=runtime.insurance.find((row)=>row.recurring_rule_id===ruleId);
    const linkedDebt=runtime.debts.find((row)=>row.recurring_rule_id===ruleId);
    const linkedSource=linkedContract||linkedPolicy||linkedDebt;
    if(linkedSource && direction!=='expense') {
      throw new Error('Diese Fixkosten sind mit Vertrag, Versicherung oder Schuld verknüpft und können nicht direkt in eine Umbuchung umgewandelt werden.');
    }
    if(linkedDebt && cadence==='semiannual') {
      throw new Error('Schuldenraten unterstützen keinen halbjährlichen Rhythmus.');
    }
    if(linkedDebt && account.currency!==linkedDebt.currency) {
      throw new Error('Zahlungskonto und Schuld müssen dieselbe Währung haben.');
    }

    const categoryId=direction==='transfer'?null:nullValue(data,'categoryId');
    const category=runtime.categories.find((row)=>row.id===categoryId) || null;
    if(direction==='income' && category && category.kind!=='income') throw new Error('Für eine feste Einnahme bitte eine Einnahmen-Kategorie wählen.');
    if(direction==='expense' && category && category.kind!=='expense') throw new Error('Für Fixkosten bitte eine Ausgaben-Kategorie wählen.');

    const counterpartyName=direction==='transfer'?'':String(formValue(data,'counterparty')||'').trim();
    let merchant=null;
    if(direction==='expense' && counterpartyName){
      const key=normalizeMerchantKey(counterpartyName);
      merchant=runtime.merchants.find((row)=>row.normalized_key===key) || await financeApi.upsertMerchant({
        household_id:h,
        name:counterpartyName,
        normalized_key:key,
        default_category_id:categoryId,
      });
    }

    let destinationAccountId=null;
    if(direction==='transfer'){
      const destination=runtime.accounts.find((a)=>a.account_id===formValue(data,'destinationAccountId'));
      if(!destination) throw new Error('Bitte ein Zielkonto / einen Topf auswählen.');
      if(destination.account_id===account.account_id) throw new Error('Quell- und Zielkonto müssen unterschiedlich sein.');
      if(destination.currency!==account.currency) throw new Error('Fixe Umbuchungen werden aktuell nur zwischen Konten derselben Währung unterstützt.');
      destinationAccountId=destination.account_id;
    }
    const reserveEnabled=direction==='expense'&&data.get('reserveEnabled')==='on';
    let reserveAccountId=null;
    if(reserveEnabled){
      const reserve=runtime.accounts.find((a)=>a.account_id===formValue(data,'reserveAccountId'));
      if(!reserve) throw new Error('Bitte einen Rücklagetopf auswählen.');
      if(reserve.account_id===account.account_id) throw new Error('Rücklagetopf und Zahlungskonto müssen unterschiedlich sein.');
      if(reserve.currency!==account.currency) throw new Error('Rücklagetopf und Zahlungskonto müssen dieselbe Währung haben.');
      reserveAccountId=reserve.account_id;
    }
    const rule=await financeApi.updateRecurringRule(ruleId,{
      account_id:account.account_id,
      destination_account_id:destinationAccountId,
      category_id:categoryId,
      merchant_id:direction==='expense'?(merchant?.id||null):null,
      direction,
      description:formValue(data,'description'),
      counterparty:counterpartyName||null,
      amount:Math.abs(numberValue(data,'amount')),
      amount_mode:direction==='transfer'?'fixed':(formValue(data,'amountMode')||'fixed'),
      currency:linkedDebt?linkedDebt.currency:(account.currency||currency),
      cadence,
      interval_months:cadence==='monthly'?Math.max(1,numberValue(data,'intervalMonths',1)):1,
      reserve_enabled:reserveEnabled,
      reserve_account_id:reserveAccountId,
      reserve_strategy:'monthly',
      next_date:formValue(data,'nextDate'),
      end_date:nullValue(data,'endDate'),
      active:formValue(data,'active')==='true',
    });
    if(merchant && categoryId && merchant.default_category_id!==categoryId){ await financeApi.updateMerchant(merchant.id,{default_category_id:categoryId}); }
    if(linkedSource) await syncRecurringSourceFromRule(rule);
    const message=direction==='income'
      ? 'Feste Einnahme aktualisiert.'
      : direction==='transfer'
        ? 'Fixe Umbuchung aktualisiert.'
        : linkedSource
          ? 'Fixkosten und verknüpfte Quelle aktualisiert.'
          : merchant
            ? 'Fixkosten und Händler aktualisiert.'
            : 'Fixkosten aktualisiert.';
    await refresh(message); return;
  }
  if (id === 'budget-create') {
    const scopeType=formValue(data,'scopeType')||'category';
    const categoryId=scopeType==='category'?formValue(data,'categoryId'):null;
    const merchantId=scopeType==='merchant'?formValue(data,'merchantId'):null;
    if (!categoryId && !merchantId) throw new Error('Bitte Kategorie oder Händler auswählen.');
    const amount=numberValue(data,'amount');
    if(!(amount>0)) throw new Error('Bitte einen Budgetbetrag grösser als 0 eingeben.');
    const activeCycle=resolveFinanceCycle({transactions:runtime.transactions,recurringRules:runtime.recurringRules,now:new Date(),fallbackDay:25});
    await financeApi.upsertBudget({ household_id:h, category_id:categoryId, merchant_id:merchantId, month_start:`${activeCycle.budgetMonth}-01`, amount });
    await refresh('Budget für den aktuellen Finanzmonat gespeichert.'); return;
  }
  if (id === 'bill-create') {
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    await financeApi.createBill({ household_id:h, account_id:accountId, category_id:nullValue(data,'categoryId'), name:formValue(data,'name'), provider:nullValue(data,'provider'), amount:numberValue(data,'amount'), currency:account?.currency||currency, due_date:formValue(data,'dueDate'), status:'open', reference:nullValue(data,'reference') });
    await refresh('Rechnung gespeichert.'); return;
  }
  if (id === 'bill-edit') {
    const billId=formValue(data,'billId');
    const bill=runtime.bills.find((row)=>row.id===billId);
    if(!bill) throw new Error('Rechnung wurde nicht gefunden.');
    if(bill.status==='paid') throw new Error('Eine bezahlte Rechnung kann erst nach „Zahlung zurücknehmen“ bearbeitet werden.');
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    await financeApi.updateBill(billId,{
      account_id:accountId,
      category_id:nullValue(data,'categoryId'),
      name:formValue(data,'name'),
      provider:nullValue(data,'provider'),
      amount:numberValue(data,'amount'),
      currency:account?.currency||bill.currency||currency,
      due_date:formValue(data,'dueDate'),
      reference:nullValue(data,'reference')
    });
    await refresh('Rechnung aktualisiert.'); return;
  }
  if (id === 'bill-payment') {
    const billId=formValue(data,'billId');
    const bill=runtime.bills.find((row)=>row.id===billId);
    if(!bill) throw new Error('Rechnung wurde nicht gefunden.');
    await recordBillMovement({
      api:financeApi, householdId:h, bill, source:formValue(data,'source'),
      paidAt:nullValue(data,'paidAt'), accountId:nullValue(data,'accountId'),
      transactionId:nullValue(data,'transactionId'),
    });
    await refresh('Rechnung bezahlt und mit der Kontobuchung verknüpft.'); return;
  }
  if (id === 'contract-create') {
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    const contract=await financeApi.createContract({
      household_id:h,
      account_id:accountId,
      category_id:nullValue(data,'categoryId'),
      name:formValue(data,'name'),
      provider:nullValue(data,'provider'),
      contract_type:formValue(data,'contractType'),
      amount:numberValue(data,'amount'),
      currency:account?.currency||currency,
      billing_cadence:formValue(data,'cadence'),
      next_payment_date:nullValue(data,'nextPaymentDate'),
      cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null,
      end_date:nullValue(data,'endDate'),
      status:'active'
    });
    const linked=await syncContractRecurring(contract);
    await refresh(linked?'Vertrag gespeichert und mit Fixkosten verknüpft.':'Vertrag gespeichert. Für Fixkosten bitte Zahlungskonto und nächsten Termin ergänzen.'); return;
  }
  if (id === 'contract-edit') {
    const contractId=formValue(data,'contractId');
    const current=runtime.contracts.find((row)=>row.id===contractId);
    if(!current) throw new Error('Vertrag wurde nicht gefunden.');
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    const contract=await financeApi.updateContract(contractId,{
      account_id:accountId,
      category_id:nullValue(data,'categoryId'),
      name:formValue(data,'name'),
      provider:nullValue(data,'provider'),
      contract_type:formValue(data,'contractType'),
      amount:numberValue(data,'amount'),
      currency:account?.currency||current.currency||currency,
      billing_cadence:formValue(data,'cadence'),
      next_payment_date:nullValue(data,'nextPaymentDate'),
      cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null,
      end_date:nullValue(data,'endDate'),
      status:formValue(data,'status')||'active'
    });
    await syncContractRecurring(contract);
    await refresh('Vertrag und verknüpfte Planung aktualisiert.'); return;
  }
  if (id === 'goal-create') {
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    const targetAmount=numberValue(data,'targetAmount');
    const currentAmount=account ? Number(account.current_balance||0) : numberValue(data,'currentAmount');
    await financeApi.createGoal({
      household_id:h,
      account_id:account?.account_id||null,
      name:formValue(data,'name'),
      target_amount:targetAmount,
      current_amount:currentAmount,
      monthly_amount:numberValue(data,'monthlyAmount'),
      currency:account?.currency||currency,
      target_date:nullValue(data,'targetDate'),
      goal_type:formValue(data,'goalType'),
      status:currentAmount>=targetAmount?'completed':'active'
    });
    await refresh(account?'Sparziel gespeichert und mit Topf verknüpft.':'Sparziel gespeichert.'); return;
  }
  if (id === 'goal-edit') {
    const goalId=formValue(data,'goalId');
    const accountId=nullValue(data,'accountId');
    const account=runtime.accounts.find((row)=>row.account_id===accountId);
    const targetAmount=numberValue(data,'targetAmount');
    const currentAmount=account ? Number(account.current_balance||0) : numberValue(data,'currentAmount');
    await financeApi.updateGoal(goalId,{
      account_id:account?.account_id||null,
      name:formValue(data,'name'),
      goal_type:formValue(data,'goalType'),
      target_amount:targetAmount,
      current_amount:currentAmount,
      monthly_amount:numberValue(data,'monthlyAmount'),
      currency:account?.currency||currency,
      target_date:nullValue(data,'targetDate'),
      status:currentAmount>=targetAmount?'completed':'active'
    });
    await refresh(account?'Sparziel und Topf-Verknüpfung aktualisiert.':'Sparziel aktualisiert.'); return;
  }
  if (id === 'goal-source-create') {
    const goalId=formValue(data,'goalId'); const sourceType=formValue(data,'sourceType');
    const payload={ household_id:h, goal_id:goalId, source_type:sourceType, label:nullValue(data,'label'), active:true };
    if(sourceType==='fixed'){ const amount=numberValue(data,'amount',-1); if(amount<0) throw new Error('Bitte einen gültigen Monatsbetrag eingeben.'); payload.amount=amount; payload.recurring_rule_id=null; }
    else if(sourceType==='recurring_rule'){
      const recurringRuleId=formValue(data,'recurringRuleId');
      if(!recurringRuleId) throw new Error('Bitte eine wiederkehrende Zahlung wählen.');
      const rule=runtime.recurringRules.find((row)=>row.id===recurringRuleId);
      const goal=runtime.goals.find((row)=>row.id===goalId);
      if(!rule || rule.direction!=='transfer') throw new Error('Als Sparziel-Finanzierung können nur geplante Umbuchungen verwendet werden.');
      if(goal?.account_id && rule.destination_account_id!==goal.account_id) throw new Error('Die Umbuchung muss auf das mit dem Sparziel verknüpfte Konto eingehen.');
      payload.amount=null; payload.recurring_rule_id=recurringRuleId;
    }
    else if(sourceType==='surplus'){ payload.amount=null; payload.recurring_rule_id=null; payload.label='Monatsüberschuss'; }
    else throw new Error('Unbekannte Finanzierungsquelle.');
    await financeApi.createGoalSource(payload); await refresh('Finanzierungsquelle hinzugefügt.'); return;
  }
  if (id === 'receivable-create') {
    const sourceAccountId=nullValue(data,'sourceAccountId');
    await createReceivableMovement({
      api:financeApi, householdId:h, debtor:formValue(data,'debtor'), reason:formValue(data,'reason'),
      amount:numberValue(data,'amount',-1), currency:formValue(data,'currency')||currency,
      lentAt:formValue(data,'lentAt')||dateInputValue(), dueDate:nullValue(data,'dueDate'),
      notes:nullValue(data,'notes'), sourceAccountId,
    });
    await refresh(sourceAccountId?'Forderung und Auszahlung gespeichert.':'Forderung gespeichert.');
    return;
  }
  if (id === 'receivable-payment-create') {
    const receivableId=formValue(data,'receivableId');
    const receivable=runtime.receivables.find((row)=>row.id===receivableId);
    if(!receivable) throw new Error('Forderung wurde nicht gefunden.');
    const source=formValue(data,'source')||'created_transaction';
    const paymentAccountId=nullValue(data,'paymentAccountId');
    const transactionId=nullValue(data,'transactionId');
    await recordReceivableMovement({
      api:financeApi, householdId:h, receivable, amount:numberValue(data,'amount',-1),
      paidAt:formValue(data,'paidAt')||dateInputValue(), note:nullValue(data,'note'),
      source, paymentAccountId, transactionId,
    });
    uiState.receivableExpandedId=receivableId;
    await refresh(source==='created_transaction'
      ? 'Rückzahlung und Kontoeingang gemeinsam gespeichert.'
      : source==='linked_transaction'
        ? 'Rückzahlung mit bestehendem Kontoeingang verknüpft.'
        : 'Rückzahlung nur im Forderungsverlauf gespeichert.');
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
    const shouldPlanRate=payload.status==='active'
      && payload.payment_cadence!=='manual'
      && Number(payload.installment_amount)>0
      && Boolean(payload.payment_account_id)
      && Boolean(payload.next_payment_date);

    if (id==='debt-create') {
      const created=await financeApi.createDebt({household_id:h,...payload});
      if(shouldPlanRate){
        const rule=await financeApi.createRecurringRule(debtRecurringPayload(created));
        await financeApi.updateDebt(created.id,{recurring_rule_id:rule.id});
      }
      await refresh(shouldPlanRate
        ? 'Schuld / Kredit gespeichert. Die Rate wurde automatisch unter Wiederkehrend geplant.'
        : 'Schuld / Kredit gespeichert.');
    } else {
      const debtId=formValue(data,'debtId');
      const before=runtime.debts.find((row)=>row.id===debtId);
      if (!before) throw new Error('Schuld wurde nicht gefunden.');
      const updated=await financeApi.updateDebt(debtId,payload);
      if (before.recurring_rule_id) {
        await syncLinkedDebtRecurring({...updated,recurring_rule_id:before.recurring_rule_id});
      } else if(shouldPlanRate) {
        const rule=await financeApi.createRecurringRule(debtRecurringPayload(updated));
        await financeApi.updateDebt(updated.id,{recurring_rule_id:rule.id});
      }
      await refresh(shouldPlanRate
        ? 'Schuld / Kredit aktualisiert. Die Rate ist automatisch in der Planung verknüpft.'
        : 'Schuld / Kredit aktualisiert.');
    }
    return;
  }
  if (id === 'debt-payment-create') {
    const debtId=formValue(data,'debtId');
    const debt=runtime.debts.find((row)=>row.id===debtId);
    if(!debt) throw new Error('Schuld wurde nicht gefunden.');
    await recordDebtMovement({
      api:financeApi, householdId:h, debt,
      amount:numberValue(data,'amount',-1), principalAmount:numberValue(data,'principalAmount',-1),
      interestAmount:numberValue(data,'interestAmount',0), feeAmount:numberValue(data,'feeAmount',0),
      paidAt:formValue(data,'paidAt'), source:formValue(data,'source'),
      paymentAccountId:nullValue(data,'paymentAccountId'), transactionId:nullValue(data,'transactionId'),
      note:nullValue(data,'note'), advanceNextDate:data.get('advanceNextDate')==='on',
    });
    uiState.debtExpandedId=debt.id;
    await refresh('Zahlung verbucht: Konto, Restschuld und Planung sind aktualisiert.');
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
    const payload={ name:formValue(data,'name'), provider:nullValue(data,'provider'), policy_type:formValue(data,'policyType')||'other', policy_number:nullValue(data,'policyNumber'), premium_amount:numberValue(data,'premiumAmount'), currency:formValue(data,'currency')||currency, billing_cadence:formValue(data,'cadence'), account_id:nullValue(data,'accountId'), category_id:nullValue(data,'categoryId'), next_payment_date:nullValue(data,'nextPaymentDate'), last_paid_date:nullValue(data,'lastPaidDate'), cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null, end_date:nullValue(data,'endDate'), status:id==='insurance-edit'?(formValue(data,'status')||'active'):'active' };
    const policy=id==='insurance-create'
      ? await financeApi.createInsurance({ household_id:h, ...payload })
      : await financeApi.updateInsurance(formValue(data,'insuranceId'),payload);
    const linked=await syncInsuranceRecurring(policy);
    const actionLabel=id==='insurance-create'?'Versicherung gespeichert':'Versicherung aktualisiert';
    await refresh(linked?`${actionLabel} und mit Fixkosten verknüpft.`:`${actionLabel}. Für Fixkosten bitte Zahlungskonto und nächsten Termin ergänzen.`); return;
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
  if (id === 'tax-case-settings') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const year=numberValue(data,'taxYear',uiState.taxYear);
    let taxCase=runtime.taxCases.find((row)=>Number(row.tax_year)===year&&row.country_code==='CH'&&row.canton_code==='SG');
    if(!taxCase) taxCase=await financeApi.ensureTaxCase({householdId:h,taxYear:year,countryCode:'CH',cantonCode:'SG'});
    await financeApi.updateTaxCase(taxCase.id,{
      municipality:nullValue(data,'municipality'),
      tax_period_from:nullValue(data,'taxPeriodFrom'),
      tax_period_to:nullValue(data,'taxPeriodTo'),
      marital_status:nullValue(data,'maritalStatus'),
      denomination:nullValue(data,'denomination'),
      registry_number:nullValue(data,'registryNumber'),
      tax_advisor:nullValue(data,'taxAdvisor'),
      status:formValue(data,'status')||'open',
      expected_tax_amount:nullValue(data,'expectedTaxAmount')?numberValue(data,'expectedTaxAmount'):null,
      assessed_tax_amount:nullValue(data,'assessedTaxAmount')?numberValue(data,'assessedTaxAmount'):null,
      notes:nullValue(data,'notes'),
    });
    uiState.taxYear=year;
    await refresh('Steuerfall gespeichert.'); return;
  }
  if (id === 'tax-person-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    const taxCase=runtime.taxCases.find((row)=>row.id===caseId); if(!taxCase) throw new Error('Steuerfall wurde nicht gefunden.');
    const payload={
      household_id:h,tax_case_id:caseId,person_no:numberValue(data,'personNo'),role:formValue(data,'role')||'taxpayer',
      first_name:formValue(data,'firstName'),last_name:formValue(data,'lastName'),birth_date:nullValue(data,'birthDate'),
      address_line:nullValue(data,'addressLine'),postal_code:nullValue(data,'postalCode'),city:nullValue(data,'city'),
      country_code:formValue(data,'countryCode')||'CH',move_in_date:nullValue(data,'moveInDate'),move_out_date:nullValue(data,'moveOutDate'),
      marital_status:nullValue(data,'maritalStatus'),denomination:nullValue(data,'denomination'),occupation:nullValue(data,'occupation'),
      employment_type:nullValue(data,'employmentType'),employer_name:nullValue(data,'employerName'),
      joint_taxation:formValue(data,'jointTaxation')==='true',notes:nullValue(data,'notes'),
    };
    const existing=runtime.taxPeople.find((row)=>row.tax_case_id===caseId&&Number(row.person_no)===payload.person_no);
    if(existing) await financeApi.updateTaxPerson(existing.id,payload); else await financeApi.createTaxPerson(payload);
    await refresh('Steuerperson gespeichert.'); return;
  }
  if (id === 'tax-child-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    if(!runtime.taxCases.some((row)=>row.id===caseId)) throw new Error('Steuerfall wurde nicht gefunden.');
    await financeApi.createTaxChild({
      household_id:h,tax_case_id:caseId,first_name:formValue(data,'firstName'),last_name:formValue(data,'lastName'),
      birth_date:formValue(data,'birthDate'),residence_country:formValue(data,'residenceCountry')||'CH',
      residence_city:nullValue(data,'residenceCity'),custody:nullValue(data,'custody'),parental_authority:nullValue(data,'parentalAuthority'),
      education_status:formValue(data,'educationStatus')||'none',school_or_training:nullValue(data,'schoolOrTraining'),training_end:nullValue(data,'trainingEnd'),
      maintenance_paid:numberValue(data,'maintenancePaid',0),maintenance_received:numberValue(data,'maintenanceReceived',0),
      childcare_costs:numberValue(data,'childcareCosts',0),assets_value:numberValue(data,'assetsValue',0),
      currency:formValue(data,'currency')||'CHF',assignment_status:formValue(data,'assignmentStatus')||'review',notes:nullValue(data,'notes'),
    });
    await refresh('Kind im Steuerfall gespeichert.'); return;
  }
  if (id === 'tax-employment-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    if(!runtime.taxCases.some((row)=>row.id===caseId)) throw new Error('Steuerfall wurde nicht gefunden.');
    await financeApi.createTaxEmployment({
      household_id:h,tax_case_id:caseId,tax_person_id:nullValue(data,'taxPersonId'),employer_name:formValue(data,'employerName'),
      work_location:nullValue(data,'workLocation'),period_from:nullValue(data,'periodFrom'),period_to:nullValue(data,'periodTo'),
      gross_income:nullValue(data,'grossIncome')?numberValue(data,'grossIncome'):null,net_income:nullValue(data,'netIncome')?numberValue(data,'netIncome'):null,
      withholding_tax:numberValue(data,'withholdingTax',0),bonus:numberValue(data,'bonus',0),commission:numberValue(data,'commission',0),board_fees:numberValue(data,'boardFees',0),
      currency:formValue(data,'currency')||'CHF',work_days:numberValue(data,'workDays',0),homeoffice_days:numberValue(data,'homeofficeDays',0),
      vacation_days:numberValue(data,'vacationDays',0),sick_days:numberValue(data,'sickDays',0),field_service_days:numberValue(data,'fieldServiceDays',0),
      commuting_distance_km:numberValue(data,'commutingDistanceKm',0),transport_mode:nullValue(data,'transportMode'),
      subsidized_meals:formValue(data,'subsidizedMeals')===''?null:formValue(data,'subsidizedMeals')==='true',
      weekly_resident:formValue(data,'weeklyResident')==='true',lodging_cost:numberValue(data,'lodgingCost',0),home_trip_cost:numberValue(data,'homeTripCost',0),
      continuing_education_cost:numberValue(data,'continuingEducationCost',0),employer_contribution:numberValue(data,'employerContribution',0),
      work_equipment_cost:numberValue(data,'workEquipmentCost',0),notes:nullValue(data,'notes'),
    });
    await refresh('Arbeitsstelle gespeichert.'); return;
  }
  if (id === 'tax-item-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    const taxCase=runtime.taxCases.find((row)=>row.id===caseId);
    if(!taxCase) throw new Error('Steuerfall wurde nicht gefunden.');
    const gross=nullValue(data,'grossAmount')?numberValue(data,'grossAmount'):null;
    const reimbursement=numberValue(data,'reimbursementAmount',0);
    let deductible=nullValue(data,'deductibleAmount')?numberValue(data,'deductibleAmount'):null;
    if(deductible===null && gross!==null) deductible=Math.max(0,gross-reimbursement);
    const sourceRef=nullValue(data,'sourceRef');
    let sourceType=null,sourceId=null;
    if(sourceRef){
      const splitAt=sourceRef.indexOf(':');
      if(splitAt<=0) throw new Error('Ungültige Finance-Quelle.');
      sourceType=sourceRef.slice(0,splitAt); sourceId=sourceRef.slice(splitAt+1);
    }
    await financeApi.createTaxItem({
      household_id:h,tax_case_id:caseId,section_key:formValue(data,'sectionKey'),item_type:formValue(data,'itemType')||'manual',
      title:formValue(data,'title'),person_label:nullValue(data,'personLabel'),country_code:formValue(data,'countryCode')||'CH',
      canton_code:nullValue(data,'cantonCode'),occurred_on:nullValue(data,'occurredOn'),
      amount:nullValue(data,'amount')?numberValue(data,'amount'):null,gross_amount:gross,reimbursement_amount:reimbursement,
      deductible_amount:deductible,deductible_percentage:nullValue(data,'deductiblePercentage')?numberValue(data,'deductiblePercentage'):null,
      currency:formValue(data,'currency')||taxCase.currency||'CHF',source_type:sourceType,source_id:sourceId,
      verification_status:formValue(data,'verificationStatus')||'unverified',
      advisor_note:nullValue(data,'advisorNote'),metadata:{ notes:nullValue(data,'notes')||null },
    });
    await refresh('Steuerposition gespeichert.'); return;
  }
  if (id === 'tax-obligation-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    if(!runtime.taxCases.some((row)=>row.id===caseId)) throw new Error('Steuerfall wurde nicht gefunden.');
    await financeApi.createTaxObligation({
      household_id:h,tax_case_id:caseId,obligation_type:formValue(data,'obligationType')||'provisional',
      label:formValue(data,'label'),amount:numberValue(data,'amount'),currency:formValue(data,'currency')||'CHF',
      due_date:nullValue(data,'dueDate'),status:formValue(data,'status')||'open',reference:nullValue(data,'reference'),notes:nullValue(data,'notes'),
    });
    await refresh('Steuerforderung gespeichert.'); return;
  }
  if (id === 'tax-payment-create') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    const taxCase=runtime.taxCases.find((row)=>row.id===caseId);
    if(!taxCase) throw new Error('Steuerfall wurde nicht gefunden.');
    const source=formValue(data,'source') || (nullValue(data,'transactionId')?'linked_transaction':'history_only');
    const account=runtime.accounts.find((row)=>row.account_id===nullValue(data,'accountId'))||null;
    const transaction=runtime.transactions.find((row)=>row.id===nullValue(data,'transactionId'))||null;
    await recordTaxMovement({
      api:financeApi, householdId:h, taxCase, obligationId:nullValue(data,'obligationId'),
      paymentType:formValue(data,'paymentType')||'payment', amount:numberValue(data,'amount'),
      paidAt:formValue(data,'paidAt'), reference:nullValue(data,'reference'), notes:nullValue(data,'notes'),
      source, account, transaction,
    });
    await refresh(source==='history_only'?'Steuerzahlung im Dossier gespeichert.':'Steuerzahlung, Konto und Steuerdossier sind verknüpft.'); return;
  }
  if (id === 'tax-section-status') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const caseId=formValue(data,'taxCaseId');
    await financeApi.upsertTaxCaseSection({
      household_id:h,tax_case_id:caseId,section_key:formValue(data,'sectionKey'),
      status:formValue(data,'status')||'open',notes:nullValue(data,'notes'),
    });
    await refresh('Bereichsstatus gespeichert.'); return;
  }
  if (id === 'tax-settings') {
    if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen das Steuerprofil ändern.');
    const regionCode=nullValue(data,'regionCode');
    runtime.household=await financeApi.updateHousehold(h,{ tax_region_code:regionCode });
    uiState.taxYear=numberValue(data,'taxYear',new Date().getFullYear());
    await refresh('Steuerprofil gespeichert.'); return;
  }
  if (id === 'household-preferences') {
    if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen die Basiswährung ändern.');
    const baseCurrency=formValue(data,'baseCurrency');
    if (!['CHF','EUR'].includes(baseCurrency)) throw new Error('Ungültige Basiswährung.');
    runtime.household=await financeApi.updateHousehold(h,{base_currency:baseCurrency});
    await refresh('Basiswährung gespeichert. Konten und Originalbuchungen bleiben unverändert.');
    return;
  }
  if (id === 'primary-account-preference') {
    const account=await savePrimaryAccountPreference(formValue(data,'accountId'));
    render();
    showToast(`${account.name} ist jetzt dein Haupt- und Standardkonto.`);
    return;
  }
  if (id === 'password-change') {
    const p1 = formValue(data,'password'); const p2 = formValue(data,'passwordConfirm');
    if (p1.length<8) throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (p1!==p2) throw new Error('Die Passwörter stimmen nicht überein.');
    await backend.updatePassword(p1); form.reset(); showToast('Passwort geändert.'); return;
  }
  if (id === 'admin-demo-create') {
    if (!runtime.adminRole) throw new Error('Nur App-Admins dürfen Demo-Instanzen erstellen.');
    const result=await backend.adminCreateDemo({ email:formValue(data,'email'), locale:formValue(data,'locale')||'de-CH' });
    uiState.demoCredentials={ email:result?.email||formValue(data,'email'), password:result?.password||'' };
    runtime.adminUsers=(await backend.adminListUsers())?.users||[];
    render();
    showToast(result?.reset?'Demo-Instanz zurückgesetzt.':'Demo-Instanz erstellt.');
    return;
  }
  if (id === 'admin-user-create') {
    await backend.adminCreateUser({ displayName:formValue(data,'displayName'), email:formValue(data,'email'), locale:formValue(data,'locale')||'de-CH', password:formValue(data,'password') });
    await refresh('Benutzer erstellt.'); return;
  }
  if (id === 'bank-import') {
    if (!importState.items.length) throw new Error('Bitte zuerst mindestens eine CSV- oder PDF-Datei auswählen.');
    const accountId = formValue(data,'accountId');
    const account = runtime.accounts.find((a)=>a.account_id===accountId);
    if (!account) throw new Error('Zielkonto wurde nicht gefunden.');
    const preferredMapping = importMappingFromForm(form);
    if (!validImportMapping(preferredMapping)) throw new Error('Datum, Beschreibung und Betragsspalten müssen zugeordnet sein.');
    const categorySelections = new Map([...form.querySelectorAll('[data-csv-merchant-key]')].map((select)=>[select.dataset.csvMerchantKey, select.value || null]));
    const remember = data.get('rememberMerchants') === 'on';
    const merchantCache = new Map(runtime.merchants.map((merchant)=>[merchant.normalized_key,merchant]));
    const aliasCache = [...runtime.merchantAliases];
    const mlModel=buildCategoryMlModel({transactions:runtime.transactions,categories:runtime.categories});
    let importedTotal=0;
    let skippedTotal=0;
    let completedFiles=0;
    let linkedTransfers=0;
    const failedFiles=[];

    for (const item of importState.items) {
      const mapping=importMappingForParsed(item.parsed,preferredMapping);
      if(!validImportMapping(mapping)){
        failedFiles.push(item.file.name);
        continue;
      }
      const batch = await financeApi.createImportBatch({
        household_id:h,
        account_id:accountId,
        file_name:item.file.name,
        row_count:item.parsed.rows.length,
        imported_count:0,
        skipped_count:0,
        status:'processing'
      });
      try {
        const prepared = [];
        for (const row of item.parsed.rows) {
          const tx = rowToTransaction(row,mapping);
          if (!tx) continue;
          const ownCounterAccount=ownAccountForReference(tx.counterparty_account_ref,accountId);
          const merchantInfo = merchantFromTransaction(tx);
          let merchant = ownCounterAccount ? null : resolveCanonicalMerchant(merchantInfo,{merchants:[...merchantCache.values()],aliases:aliasCache});
          const groupKey=merchant?.normalized_key||merchantInfo.key;
          const selectedCategory = ownCounterAccount ? null : (categorySelections.has(groupKey) ? categorySelections.get(groupKey) : (categorySelections.has(merchantInfo.key)?categorySelections.get(merchantInfo.key):null));
          const knownCategoryNames=ownCounterAccount?[]:suggestKnownCategoryCandidates(tx);
          const knownCategory=knownCategoryNames.map((name)=>runtime.categories.find((c)=>c.name===name&&c.kind===(Number(tx.amount)<0?'expense':'income'))).find(Boolean)||null;
          const mlPrediction=ownCounterAccount?null:predictCategoryMl(mlModel,{...tx,account_id:accountId,currency:account.currency||currency,source:'import'});
          const fallbackCategory = ownCounterAccount ? null : (merchant?.default_category_id || applyCategoryRules(tx,runtime.categorizationRules) || knownCategory?.id || (mlPrediction?.safe?mlPrediction.categoryId:null));
          const categoryId = selectedCategory || fallbackCategory;
          if (!ownCounterAccount && !merchant) {
            merchant = await financeApi.upsertMerchant({ household_id:h, name:merchantInfo.name, normalized_key:merchantInfo.key, default_category_id:remember?categoryId:null });
            if (merchant) merchantCache.set(merchant.normalized_key,merchant);
          } else if (!ownCounterAccount && remember && categoryId && merchant?.default_category_id !== categoryId) {
            merchant = await financeApi.updateMerchant(merchant.id,{ default_category_id:categoryId });
            if (merchant) merchantCache.set(merchant.normalized_key,merchant);
          }
          if(!ownCounterAccount && merchant && merchantInfo.aliasKey && merchantInfo.aliasKey!==merchant.normalized_key){
            const alias=await financeApi.upsertMerchantAlias({
              household_id:h,
              merchant_id:merchant.id,
              alias_name:merchantInfo.rawName||merchantInfo.name,
              normalized_key:merchantInfo.aliasKey,
              payment_processor:merchantInfo.paymentProcessor||null,
            });
            if(alias && !aliasCache.some((row)=>row.id===alias.id)) aliasCache.push(alias);
          }
          const recurringRule=findMatchingRecurringRule({
            ...tx,
            account_id:accountId,
            category_id:categoryId,
            merchant_id:merchant?.id||null,
            currency:account.currency||currency,
          });
          const externalReference = await transactionFingerprint(accountId,tx);
          prepared.push({
            household_id:h,
            account_id:accountId,
            category_id:categoryId,
            merchant_id:merchant?.id||null,
            recurring_rule_id:recurringRule?.id||null,
            import_batch_id:batch.id,
            occurred_at:tx.occurred_at,
            amount:tx.amount,
            currency:account.currency||currency,
            description:tx.description,
            counterparty:tx.counterparty,
            bank_reference:tx.bank_reference||null,
            counterparty_account_ref:tx.counterparty_account_ref||null,
            import_raw_data:tx.import_raw_data||null,
            import_source_page:tx.import_source_page||null,
            semantic_type:ownCounterAccount?'internal_transfer':null,
            status:'booked',
            source:'import',
            external_reference:externalReference
          });
        }
        const inserted = prepared.length ? await financeApi.importTransactions(prepared) : [];
        if (inserted.some((row)=>row.import_batch_id!==batch.id)) throw new Error('Import-Zuordnung konnte nicht vollständig gespeichert werden.');
        linkedTransfers+=await reconcileImportedOwnTransfers(inserted);
        const skippedCount=Math.max(0,item.parsed.rows.length-inserted.length);
        await financeApi.updateImportBatch(batch.id,{ imported_count:inserted.length, skipped_count:skippedCount, status:'completed' });
        importedTotal+=inserted.length;
        skippedTotal+=skippedCount;
        completedFiles+=1;
      } catch (error) {
        await financeApi.updateImportBatch(batch.id,{ status:'failed' }).catch(()=>{});
        failedFiles.push(item.file.name);
      }
    }

    importState.items=[];
    uiState.importQuery=''; uiState.importCategory='all';
    const fileText=`${completedFiles} Datei${completedFiles===1?'':'en'} verarbeitet`;
    await refresh(`${fileText}: ${importedTotal} Transaktionen importiert. ${skippedTotal} Dubletten oder ungültige Zeilen wurden übersprungen.${linkedTransfers?` ${linkedTransfers} eigene Umbuchung${linkedTransfers===1?'':'en'} über Gegenkonto/IBAN erkannt und verbunden.`:''}`);
    if(failedFiles.length) showToast(`${failedFiles.length} Datei${failedFiles.length===1?' konnte':'en konnten'} nicht importiert werden: ${failedFiles.join(', ')}`,'error');
    return;
  }
}

async function deleteLinkedDocuments(objectType, objectId) {
  const linked=(runtime.documents||[]).filter((doc)=>doc.object_type===objectType&&doc.object_id===objectId);
  for(const doc of linked) await financeApi.deleteDocument(doc);
}

const documentObjectTypeByTable={
  bills:'bill',
  contracts:'contract',
  debts:'debt',
  legal_cases:'legal',
  properties:'property',
  vehicles:'vehicle',
  insurance_policies:'insurance',
  investments:'investment',
  pension_accounts:'pension',
};

const deleteMap = {
  categories: (id)=>financeApi.deleteCategory(id), categorization_rules:(id)=>financeApi.deleteCategorizationRule(id), recurring_rules:(id)=>financeApi.deleteRecurringRule(id), budgets:(id)=>financeApi.deleteBudget(id), bills:(id)=>financeApi.deleteBill(id), contracts:(id)=>financeApi.deleteContract(id), savings_goals:(id)=>financeApi.deleteGoal(id), debts:(id)=>financeApi.deleteDebt(id), receivables:(id)=>financeApi.deleteReceivable({householdId:runtime.household.id,receivableId:id}), legal_cases:(id)=>financeApi.deleteLegalCase(id), assets:(id)=>financeApi.deleteAsset(id), properties:(id)=>financeApi.deleteProperty(id), vehicles:(id)=>financeApi.deleteVehicle(id), insurance_policies:(id)=>financeApi.deleteInsurance(id), investments:(id)=>financeApi.deleteInvestment(id), pension_accounts:(id)=>financeApi.deletePension(id),
};

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  const writeActions = new Set(['review-link-transfer','review-undo-change','project-toggle-archive','starter-categories','categorization-open','categorization-apply-safe','categorization-apply-group','categorization-apply-selected-category','categorization-apply-selected-transfer','categorization-apply-selected-debt-repayment','account-edit','transaction-edit','transaction-merge-open','transaction-merge-suggested','transaction-make-recurring','transaction-delete','transaction-to-transfer','transaction-cash-withdrawal','transaction-note','transaction-tax-toggle','delete','bill-edit','contract-edit','bill-payment-open','bill-payment-reverse','goal-progress','goal-apply-suggestion','goal-edit','goal-source-open','goal-source-delete','debt-edit','debt-payment-open','debt-payment-reverse','debt-recurring','debt-recurring-remove','contract-recurring-remove','insurance-recurring-remove','receivable-payment-open','receivable-payment-reverse','legal-event','import-group-assign','budget-suggestion','budget-transaction-edit','merchant-edit','merchant-merge-open','merchant-merge','merchant-bulk-merge','merchant-promote-master','category-promote-master','masterdata-install-country','recurring-edit','vehicle-edit','insurance-edit','insurance-recurring','insurance-document','contract-recurring','investment-edit','investment-trade','document-tax-toggle','tax-receipt','tax-case-create','tax-person-delete','tax-child-delete','tax-employment-delete','tax-item-delete','tax-item-document','tax-obligation-delete','tax-payment-delete']);
  if (writeActions.has(action) && !canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
  if (action === 'review-edit-transaction' || action === 'search-open-transaction') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if(!tx) throw new Error('Buchung wurde nicht gefunden.');
    uiState.pendingTransactionEditId=tx.id;
    location.hash='#/transactions';
    return;
  }
  if (action === 'review-link-transfer') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    const other=runtime.transactions.find((row)=>row.id===target.dataset.otherId);
    if(!tx||!other) throw new Error('Eine der Buchungen wurde nicht gefunden.');
    if(tx.transfer_group_id||other.transfer_group_id) throw new Error('Mindestens eine Buchung ist bereits als Umbuchung verbunden.');
    const otherAccount=runtime.accounts.find((row)=>row.account_id===other.account_id);
    if(!otherAccount) throw new Error('Gegenkonto wurde nicht gefunden.');
    const groupId=await financeApi.convertTransactionToTransferV2({
      householdId:runtime.household.id,
      transactionId:tx.id,
      otherAccountId:otherAccount.account_id,
      amount:Math.abs(Number(tx.amount)),
      otherAmount:null,
      otherTransactionId:other.id,
      occurredAt:tx.occurred_at,
      description:tx.description||other.description||'Umbuchung',
      note:tx.note||null,
    });
    await recordChange({type:'transfer_link',label:`Umbuchung ${runtime.accounts.find((row)=>row.account_id===tx.account_id)?.name||'Konto'} ↔ ${otherAccount.name} verbunden`,before:[],after:[{transfer_group_id:groupId}],undoable:false});
    await refresh('Eindeutige Gegenbuchungen wurden als interne Umbuchung verbunden. Sie zählen nicht mehr als Konsumausgabe oder Einkommen.');
    return;
  }
  if (action === 'review-undo-change') {
    const entry=runtime.changeHistory.find((row)=>row.id===target.dataset.changeId);
    await undoRecordedChange(entry);
    await refresh('Letzte Kategorisierung rückgängig gemacht.');
    return;
  }
  if (action === 'project-toggle-archive') {
    const context=runtime.transactionContexts.find((row)=>row.id===target.dataset.id);
    if(!context) throw new Error('Projekt wurde nicht gefunden.');
    await financeApi.updateTransactionContext(context.id,{is_archived:!context.is_archived});
    await refresh(context.is_archived?'Projekt reaktiviert.':'Projekt archiviert.');
    return;
  }
  if (action === 'show-form') { document.getElementById(target.dataset.target)?.removeAttribute('hidden'); return; }
  if (action === 'masterdata-install-country') {
    const result=await financeApi.installCountryMasterData(runtime.household.id);
    const parts=[
      Number(result?.categories_created||0)?`${result.categories_created} Kategorien neu`:'',
      Number(result?.merchants_created||0)?`${result.merchants_created} Händler neu`:'',
      Number(result?.merchants_linked||0)?`${result.merchants_linked} Händler ergänzt`:'',
    ].filter(Boolean);
    await refresh(parts.length?`${runtime.household.country_code}-Stammdaten aktualisiert: ${parts.join(' · ')}.`:`${runtime.household.country_code}-Stammdaten sind bereits aktuell.`);
    return;
  }
  if (action === 'merchant-select-visible') {
    document.querySelectorAll('[data-merchant-select]').forEach((input)=>{ input.checked=true; });
    return;
  }
  if (action === 'merchant-select-clear') {
    document.querySelectorAll('[data-merchant-select]').forEach((input)=>{ input.checked=false; });
    return;
  }
  if (action === 'merchant-bulk-merge') {
    const canonicalId=String(document.querySelector('#merchantBulkCanonical')?.value||'');
    const canonical=runtime.merchants.find((row)=>row.id===canonicalId);
    if(!canonical) throw new Error('Bitte auswählen, welcher Händlername bleiben soll.');
    const selectedIds=[...document.querySelectorAll('[data-merchant-select]:checked')].map((input)=>String(input.value||'')).filter(Boolean);
    const duplicateIds=[...new Set(selectedIds.filter((id)=>id!==canonical.id))];
    if(!duplicateIds.length) throw new Error('Bitte mindestens einen weiteren Händler markieren.');
    const duplicateNames=duplicateIds.map((id)=>runtime.merchants.find((row)=>row.id===id)?.name).filter(Boolean);
    if(!confirm(`${duplicateNames.length} Händler mit „${canonical.name}“ zusammenführen? Alle bisherigen Namen bleiben als gelernte Aliase erhalten.`)) return;
    const merged=await financeApi.mergeMerchantsBulk({
      householdId:runtime.household.id,
      canonicalMerchantId:canonical.id,
      duplicateMerchantIds:duplicateIds,
    });
    await refresh(`${Number(merged)||duplicateIds.length} Händler wurden unter ${canonical.name} zusammengeführt und als Aliase gelernt.`);
    return;
  }
  if (action === 'merchant-merge-open') {
    const duplicate=runtime.merchants.find((row)=>row.id===target.dataset.id);
    if(!duplicate) throw new Error('Händler wurde nicht gefunden.');
    const form=document.querySelector('#merchant-merge-manual');
    const idInput=document.querySelector('#merchantMergeDuplicateId');
    const source=document.querySelector('#merchantMergeSource');
    const select=document.querySelector('#merchantMergeCanonical');
    if(!form||!idInput||!select) throw new Error('Zusammenführen-Dialog ist nicht verfügbar.');
    idInput.value=duplicate.id;
    if(source) source.innerHTML=`<strong>${escapeHtml(duplicate.name)}</strong><span>Dieser Name wird nach der Zusammenführung als Alias gespeichert.</span>`;
    [...select.options].forEach((option)=>{ option.disabled=option.value===duplicate.id; });
    select.value='';
    form.removeAttribute('hidden');
    form.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'merchant-merge') {
    const canonical=runtime.merchants.find((row)=>row.id===target.dataset.canonicalId);
    const duplicate=runtime.merchants.find((row)=>row.id===target.dataset.duplicateId);
    if(!canonical||!duplicate) throw new Error('Händler für die Zusammenführung wurden nicht gefunden.');
    if(!confirm(`${duplicate.name} wirklich mit ${canonical.name} zusammenführen? Der Name ${duplicate.name} bleibt als gelernter Alias erhalten.`)) return;
    await financeApi.mergeMerchants({
      householdId:runtime.household.id,
      canonicalMerchantId:canonical.id,
      duplicateMerchantId:duplicate.id,
    });
    await refresh(`${duplicate.name} wurde als Alias von ${canonical.name} zusammengeführt. Bestehende Banktexte bleiben erhalten.`);
    return;
  }
  if (action === 'merchant-promote-master') {
    if(!runtime.adminRole) throw new Error('Nur App-Admins dürfen globale Stammdaten freigeben.');
    const merchant=runtime.merchants.find((row)=>row.id===target.dataset.id);
    if(!merchant) throw new Error('Händler wurde nicht gefunden.');
    if(!merchant.default_category_id) throw new Error('Bitte dem Händler zuerst eine Standardkategorie zuweisen.');
    const result=await financeApi.promoteMerchantToCountryCatalog(merchant.id);
    await refresh(`${result?.merchant||merchant.name} wurde für ${result?.country_code||runtime.household.country_code} freigegeben.`);
    return;
  }
  if (action === 'category-promote-master') {
    if(!runtime.adminRole) throw new Error('Nur App-Admins dürfen globale Stammdaten freigeben.');
    const category=runtime.categories.find((row)=>row.id===target.dataset.id);
    if(!category) throw new Error('Kategorie wurde nicht gefunden.');
    const result=await financeApi.promoteCategoryToCountryCatalog(category.id);
    await refresh(`${result?.category||category.name} wurde für ${result?.country_code||runtime.household.country_code} freigegeben.`);
    return;
  }

  if (action === 'starter-categories') {
    const created = await seedStarterCategoriesForHousehold(runtime.household.id, runtime.household.country_code, runtime.categories);
    if (!created) { showToast('Die empfohlene Struktur ist bereits vorhanden.'); return; }
    await refresh(`Empfohlene Struktur ergänzt: ${created} Einträge aktualisiert oder angelegt.`); return;
  }
  if (action === 'setup-review') {
    if (!canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
    const key=String(target.dataset.key||'').trim();
    if (!['recurring','modules'].includes(key)) throw new Error('Unbekannter Einrichtungsschritt.');
    const reviewed=new Set(Array.isArray(profilePreferences().setup_reviewed)?profilePreferences().setup_reviewed:[]);
    reviewed.add(key);
    await saveUserPreferences({setup_reviewed:[...reviewed]});
    render();
    showToast(key==='recurring'
      ? 'Wiederkehrende Einnahmen und Fixkosten kannst du später ergänzen.'
      : 'Optionale Module kannst du später jederzeit einrichten.');
    return;
  }
  if (action === 'categorization-open') {
    const cfg=countryConfig(runtime.household.country_code||'CH');
    const existingKeys=new Set(runtime.categories.map((category)=>`${category.kind}:${String(category.name||'').toLowerCase()}`));
    const requiredNames=new Set(['lohn','gehalt','rückerstattung','rückzahlung','sonstige einnahmen','rechts- & gerichtskosten']);
    const requiredCategories=(cfg.starterCategories||[]).filter(([name])=>requiredNames.has(String(name).toLowerCase()));
    const missingCategories=requiredCategories.filter(([name,kind])=>!existingKeys.has(`${kind}:${String(name).toLowerCase()}`));
    if (missingCategories.length) {
      await financeApi.createCategories(missingCategories.map(([name,kind],index)=>({
        household_id:runtime.household.id,
        name,
        kind,
        sort_order:(index+1)*10,
      })));
      await loadFinanceData();
    }
    uiState.categorizationOpen = true;
    uiState.categorizationFilter = 'action';
    uiState.categorizationPage = 1;
    uiState.categorizationGroupKey = '';
    render();
    return;
  }
  if (action === 'categorization-close') {
    uiState.categorizationOpen = false;
    uiState.categorizationGroupKey = '';
    render();
    return;
  }
  if (action === 'categorization-page') {
    uiState.categorizationPage = Math.max(1, Number(target.dataset.page) || 1);
    uiState.categorizationGroupKey = '';
    render();
    return;
  }
  if (action === 'categorization-view-group') {
    const group = currentCategorizationGroups().find((row)=>row.key===target.dataset.groupKey);
    if (!group) throw new Error('Händlergruppe wurde nicht gefunden.');
    uiState.categorizationGroupKey = group.key;
    render();
    requestAnimationFrame(()=>document.querySelector('[data-categorization-detail]')?.scrollIntoView({behavior:'smooth',block:'center'}));
    return;
  }
  if (action === 'categorization-close-group') {
    uiState.categorizationGroupKey = '';
    render();
    return;
  }
  if (action === 'categorization-select-all' || action === 'categorization-select-none') {
    const detail=target.closest('[data-categorization-detail]');
    const checked=action==='categorization-select-all';
    detail?.querySelectorAll('[data-categorization-select]').forEach((input)=>{ if(!input.disabled) input.checked=checked; });
    updateCategorizationSelectedCount(detail);
    syncCategorizationTransferFx(detail);
    return;
  }
  if (action === 'categorization-apply-selected-category') {
    const detail=target.closest('[data-categorization-detail]');
    const ids=categorizationSelectedIds(detail);
    if(!ids.length) throw new Error('Bitte mindestens eine Buchung markieren.');
    const categoryId=detail?.querySelector('[data-categorization-selected-category]')?.value||'';
    const group=currentCategorizationGroups().find((row)=>row.key===uiState.categorizationGroupKey);
    const category=runtime.categories.find((row)=>row.id===categoryId);
    if(!group||!category||category.kind!==group.kind) throw new Error('Bitte eine passende Kategorie auswählen.');
    const before=ids.map((id)=>runtime.transactions.find((row)=>row.id===id)).filter(Boolean).map((row)=>({id:row.id,category_id:row.category_id||null}));
    await financeApi.bulkUpdateTransactions(ids,{category_id:category.id});
    await recordChange({type:'category_bulk',label:`${ids.length} Buchung${ids.length===1?'':'en'} → ${category.name}`,before,after:ids.map((id)=>({id,category_id:category.id})),undoable:true});
    await refresh(`${ids.length} markierte Buchung${ids.length===1?'':'en'} gespeichert. Keine feste Regel angelegt. Machine Learning verwendet diese Entscheidung als Trainingsbeispiel.`);
    requestAnimationFrame(()=>document.querySelector('[data-categorization-detail]')?.scrollIntoView({behavior:'smooth',block:'center'}));
    return;
  }
  if (action === 'categorization-apply-selected-debt-repayment') {
    const detail=target.closest('[data-categorization-detail]');
    const ids=categorizationSelectedIds(detail);
    if(!ids.length) throw new Error('Bitte mindestens eine Buchung markieren.');
    const selected=ids.map((id)=>runtime.transactions.find((row)=>row.id===id)).filter(Boolean);
    if(selected.length!==ids.length) throw new Error('Mindestens eine markierte Buchung wurde nicht gefunden.');
    if(selected.some((tx)=>tx.status!=='booked'||Number(tx.amount)>=0||tx.transfer_group_id||['debt_payment','receivable_principal'].includes(tx.cashflow_type))){
      throw new Error('Als Darlehensrückzahlung können nur gebuchte Geldabgänge ohne bestehende Spezialverknüpfung markiert werden.');
    }
    const before=selected.map((row)=>({id:row.id,semantic_type:row.semantic_type||null}));
    await financeApi.bulkUpdateTransactions(ids,{semantic_type:'debt_repayment'});
    await recordChange({
      type:'semantic_bulk',
      label:`${ids.length} Buchung${ids.length===1?'':'en'} → Darlehensrückzahlung / Schuldentilgung`,
      before,
      after:ids.map((id)=>({id,semantic_type:'debt_repayment'})),
      undoable:true,
    });
    await refresh(`${ids.length} markierte Buchung${ids.length===1?'':'en'} als Darlehensrückzahlung / Schuldentilgung verbucht. Kontobewegung und Cashflow bleiben vollständig erhalten; der Betrag zählt nicht mehr als Konsumausgabe.`);
    return;
  }
  if (action === 'categorization-apply-selected-transfer') {
    const detail=target.closest('[data-categorization-detail]');
    const ids=categorizationSelectedIds(detail);
    const otherAccountId=detail?.querySelector('[data-categorization-transfer-account]')?.value||'';
    const amountInput=detail?.querySelector('[data-categorization-transfer-amount]');
    const enteredAmount=String(amountInput?.value||'').trim();
    const otherAmount=enteredAmount ? Number(enteredAmount.replace(/['’\s]/g,'').replace(',','.')) : null;
    const result=await convertCategorizationSelectionToTransfers(ids,otherAccountId,{otherAmount});
    const fx=result.foreignTransfer;
    const locale=runtime.profile?.locale||'de-CH';
    const fxText=fx
      ? ` Effektiver Kurs: 1 ${fx.sourceCurrency} = ${fx.effectiveRate.toLocaleString(locale,{minimumFractionDigits:4,maximumFractionDigits:6})} ${fx.targetCurrency}.`
      : '';
    await refresh(`${result.converted} markierte Buchung${result.converted===1?'':'en'} als interne Umbuchung mit ${result.otherAccount.name} verknüpft. Diese Beträge zählen nicht mehr als Konsumausgaben.${fxText}`);
    requestAnimationFrame(()=>document.querySelector('[data-categorization-detail]')?.scrollIntoView({behavior:'smooth',block:'center'}));
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
  if (action === 'account-set-primary') {
    const account=await savePrimaryAccountPreference(target.dataset.id);
    render();
    showToast(`${account.name} ist jetzt dein Haupt- und Standardkonto.`);
    return;
  }
  if (action === 'account-edit') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const account=runtime.accounts.find((row)=>row.account_id===target.dataset.id);
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    document.querySelector('#accountEditId').value=account.account_id;
    document.querySelector('#accountEditName').value=account.name||'';
    document.querySelector('#accountEditType').value=account.account_type||'checking';
    document.querySelector('#accountEditInstitution').value=account.institution_name||'';
    const externalRef=document.querySelector('#accountEditExternalRef'); if(externalRef) externalRef.value=account.external_account_ref||'';
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
    document.querySelector('#insuranceEditId').value=v.id; document.querySelector('#insuranceEditName').value=v.name||''; document.querySelector('#insuranceEditProvider').value=v.provider||''; document.querySelector('#insuranceEditType').value=v.policy_type||''; document.querySelector('#insuranceEditNumber').value=v.policy_number||''; document.querySelector('#insuranceEditPremium').value=v.premium_amount||0; const insuranceCurrency=document.querySelector('#insuranceEditCurrency'); if(insuranceCurrency) insuranceCurrency.value=v.currency||runtime.household.base_currency; document.querySelector('#insuranceEditCadence').value=v.billing_cadence||'monthly'; document.querySelector('#insuranceEditAccount').value=v.account_id||''; document.querySelector('#insuranceEditCategory').value=v.category_id||''; document.querySelector('#insuranceEditNext').value=v.next_payment_date||''; document.querySelector('#insuranceEditLastPaid').value=v.last_paid_date||''; document.querySelector('#insuranceEditNotice').value=v.cancellation_notice_days??''; document.querySelector('#insuranceEditEnd').value=v.end_date||''; const insuranceStatus=document.querySelector('#insuranceEditStatus'); if(insuranceStatus) insuranceStatus.value=v.status||'active';
    const form=document.querySelector('#insurance-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'insurance-document') {
    const input=document.querySelector('#insuranceDocumentId'); if(input) input.value=target.dataset.id;
    const form=document.querySelector('#insurance-document-upload'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'insurance-recurring') {
    const policy=runtime.insurance.find((row)=>row.id===target.dataset.id);
    if(!policy) throw new Error('Versicherung wurde nicht gefunden.');
    await syncInsuranceRecurring(policy);
    await refresh('Versicherungsprämie mit Fixkosten synchronisiert.'); return;
  }
  if (action === 'contract-recurring') {
    const contract=runtime.contracts.find((row)=>row.id===target.dataset.id);
    if(!contract) throw new Error('Vertrag wurde nicht gefunden.');
    await syncContractRecurring(contract);
    await refresh('Vertrag mit Fixkosten synchronisiert.'); return;
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
    const value=prompt(t('Wofür war diese Zahlung?'),tx.note||''); if(value===null) return; await financeApi.updateTransaction(tx.id,{note:value.trim()||null}); await refresh('Zweck gespeichert.'); return;
  }
  if (action === 'transaction-tax-toggle') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id); if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
    const value=target.dataset.value==='true'; let category=tx.tax_category||null; if(value&&!category){ const entered=prompt(t('Steuerkategorie (optional):'),t('Berufskosten')); if(entered!==null) category=entered.trim()||null; }
    if(value){
      const defaults=transactionTaxDefaults({...tx,tax_category:category});
      const taxYear=transactionTaxYear({...tx,tax_category:category});
      await ensureTransactionTaxCase(taxYear);
      await financeApi.updateTransaction(tx.id,{tax_relevant:true,tax_category:category,tax_year:taxYear,tax_treatment:defaults.treatment,tax_section_key:defaults.section});
    } else {
      await financeApi.updateTransaction(tx.id,{tax_relevant:false,tax_category:null,tax_year:null,tax_treatment:null,tax_section_key:null});
    }
    await refresh(value?'Als steuerrelevant markiert und mit dem Steuerjahr verknüpft.':'Steuermarkierung entfernt.'); return;
  }
  if (action === 'transaction-cash-withdrawal') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
    openTransactionEditor(tx);
    const direction=document.querySelector('#transactionEditDirection');
    if(direction) direction.value='cash_withdrawal';
    syncTransactionTransferEditor();
    document.querySelector('#transaction-edit')?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'transaction-to-transfer') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id); const to=runtime.accounts.find((a)=>a.account_id===target.dataset.toAccount); if(!tx||!to) throw new Error('Buchung oder Zielkonto fehlt.');
    if(tx.cashflow_type==='debt_payment') throw new Error('Eine Schuldzahlung kann nicht in eine Umbuchung umgewandelt werden.');
    if(tx.cashflow_type==='receivable_principal') throw new Error('Eine Forderungsbuchung kann nicht in eine Umbuchung umgewandelt werden.');
    if(runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id)) throw new Error('Eine bezahlte Rechnungsbuchung kann nicht in eine Umbuchung umgewandelt werden.');
    let toAmount=null; if(tx.currency!==to.currency){ const entered=prompt(t(`Wie viel ${to.currency} wurden tatsächlich in ${to.name} gelegt?`),String(Math.abs(Number(tx.amount)))); if(entered===null) return; toAmount=Number(entered); if(!Number.isFinite(toAmount)||toAmount<=0) throw new Error('Ungültiger Zielbetrag.'); }
    await financeApi.convertTransactionToTransfer({householdId:runtime.household.id,transactionId:tx.id,toAccountId:to.account_id,toAmount,description:to.account_type==='savings'?'Sparen':'Bargeldtransfer'}); await refresh(`Als Umbuchung nach ${to.name} erkannt.`); return;
  }
  if (action === 'budget-suggestion') {
    const cycle=resolveFinanceCycle({transactions:runtime.transactions,recurringRules:runtime.recurringRules,now:new Date(),fallbackDay:25});
    const merchantId=target.dataset.merchantId||null;
    const categoryId=merchantId?null:(target.dataset.categoryId||null);
    if(!merchantId&&!categoryId) throw new Error('Budgetvorschlag hat keinen gültigen Händler oder keine Kategorie.');
    const month=`${cycle.budgetMonth}-01`;
    await financeApi.upsertBudget({household_id:runtime.household.id,category_id:categoryId,merchant_id:merchantId,month_start:month,amount:Number(target.dataset.amount)});
    await refresh('Variables Budget für den aktuellen Finanzmonat angelegt.'); return;
  }
  if (action === 'document-tax-toggle') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const doc=runtime.documents.find((d)=>d.id===target.dataset.id); if(!doc) throw new Error('Dokument nicht gefunden.'); const value=target.dataset.value==='true'; await financeApi.updateDocument(doc.id,{tax_relevant:value,tax_year:value?(doc.tax_year||new Date(doc.document_date||doc.created_at).getFullYear()):null,tax_category:value?(doc.tax_category||null):null}); await refresh(value?'Dokument der Steuerablage hinzugefügt.':'Dokument aus Steuerablage entfernt.'); return;
  }
  if (action === 'tax-case-select') {
    uiState.taxYear=Number(target.dataset.year)||new Date().getFullYear(); render(); return;
  }
  if (action === 'tax-case-create') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const year=Number(target.dataset.year)||uiState.taxYear;
    await financeApi.ensureTaxCase({householdId:runtime.household.id,taxYear:year,countryCode:'CH',cantonCode:'SG'});
    uiState.taxYear=year; await refresh(`Steuerfall ${year} angelegt.`); return;
  }
  if (action === 'tax-person-delete') {
    if(!confirm(t('Steuerperson wirklich löschen?'))) return;
    await financeApi.deleteTaxPerson(target.dataset.id); await refresh('Steuerperson gelöscht.'); return;
  }
  if (action === 'tax-child-delete') {
    if(!confirm(t('Kind aus dem Steuerfall löschen?'))) return;
    await financeApi.deleteTaxChild(target.dataset.id); await refresh('Kind aus dem Steuerfall gelöscht.'); return;
  }
  if (action === 'tax-employment-delete') {
    if(!confirm(t('Arbeitsstelle aus dem Steuerfall löschen?'))) return;
    await financeApi.deleteTaxEmployment(target.dataset.id); await refresh('Arbeitsstelle gelöscht.'); return;
  }
  if (action === 'tax-item-delete') {
    if(!confirm(t('Steuerposition wirklich löschen?'))) return;
    await deleteLinkedDocuments('tax_item',target.dataset.id);
    await financeApi.deleteTaxItem(target.dataset.id); await refresh('Steuerposition gelöscht.'); return;
  }
  if (action === 'tax-item-document') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const item=runtime.taxItems.find((row)=>row.id===target.dataset.id);
    if(!item) throw new Error('Steuerposition wurde nicht gefunden.');
    uiState.taxItemDocumentId=item.id;
    document.querySelector('#taxItemDocumentInput')?.click();
    return;
  }
  if (action === 'tax-obligation-delete') {
    if(!confirm(t('Steuerforderung wirklich löschen?'))) return;
    await financeApi.deleteTaxObligation(target.dataset.id); await refresh('Steuerforderung gelöscht.'); return;
  }
  if (action === 'tax-payment-delete') {
    if(!confirm(t('Steuerzahlung wirklich stornieren? Eine von Finance erstellte Kontobuchung wird ebenfalls zurückgenommen.'))) return;
    await financeApi.reverseTaxPayment({householdId:runtime.household.id,paymentId:target.dataset.id});
    await refresh('Steuerzahlung storniert und verknüpfte Kontobewegung korrekt zurückgenommen.'); return;
  }
  if (action === 'tax-receipt') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    uiState.taxReceiptTxId=target.dataset.id; document.querySelector('#taxReceiptInput')?.click(); return;
  }
  if (action === 'tax-export-csv') {
    if (!moduleEnabled('tax')) throw new Error('Das Modul Steuern & Steuerberater ist ausgeblendet oder nicht freigeschaltet.');
    const year=Number(target.dataset.year)||uiState.taxYear;
    const taxCase=runtime.taxCases.find((row)=>Number(row.tax_year)===year&&row.country_code==='CH'&&row.canton_code==='SG')||null;
    const taxTransactions=runtime.transactions.filter((tx)=>tx.tax_relevant&&transactionTaxYear(tx)===year);
    const escapeCsv=(v)=>`"${String(v??'').replaceAll('"','""')}"`;
    const paymentMap=buildDebtPaymentTransactionMap(runtime.debtPayments);
    const rows=[];
    const push=(type,section,date,title,gross,reimbursement,deductible,currency,status,source,notes)=>rows.push([type,section,date,title,gross,reimbursement,deductible,currency,status,source,notes]);
    if(taxCase){
      push('STEUERFALL','case',taxCase.tax_period_to||`${year}-12-31`,`CH/SG · ${taxCase.municipality||''}`,taxCase.assessed_tax_amount??taxCase.expected_tax_amount??'',0,'',taxCase.currency||'CHF',taxCase.status,taxCase.tax_rule_versions?.version||'',taxCase.notes||'');
      for(const p of runtime.taxPeople.filter((row)=>row.tax_case_id===taxCase.id)) push('PERSON','persons_household',p.birth_date,`Person ${p.person_no} · ${p.first_name} ${p.last_name}`,'','','',taxCase.currency||'CHF',p.role,p.employer_name||'',p.notes||'');
      for(const child of runtime.taxChildren.filter((row)=>row.tax_case_id===taxCase.id)) push('KIND','children',child.birth_date,`${child.first_name} ${child.last_name}`,child.assets_value,child.maintenance_received,child.childcare_costs,child.currency,child.assignment_status,child.school_or_training||'',child.notes||'');
      for(const job of runtime.taxEmployments.filter((row)=>row.tax_case_id===taxCase.id)){
        const commute=Math.max(0,Number(job.work_days||0)-Number(job.homeoffice_days||0)-Number(job.vacation_days||0)-Number(job.sick_days||0)-Number(job.field_service_days||0));
        push('ARBEIT','income',job.period_to||job.period_from,job.employer_name,job.gross_income,'',job.withholding_tax,job.currency,'',job.work_location||'',`Pendeltage ${commute}; Homeoffice ${job.homeoffice_days||0}; Distanz ${job.commuting_distance_km||0} km; Weiterbildung ${job.continuing_education_cost||0}; Arbeitsmittel ${job.work_equipment_cost||0}`);
      }
      for(const item of runtime.taxItems.filter((row)=>row.tax_case_id===taxCase.id)){
        const docs=runtime.documents.filter((d)=>d.object_type==='tax_item'&&d.object_id===item.id).map((d)=>d.name).join(' | ');
        push('POSITION',item.section_key,item.occurred_on,item.title,item.gross_amount??item.amount??'',item.reimbursement_amount,item.deductible_amount,item.currency,item.verification_status,item.source_type&&item.source_id?`${item.source_type}:${item.source_id}`:'',`${item.advisor_note||''}${docs?` · Belege: ${docs}`:''}`);
      }
      for(const row of runtime.taxObligations.filter((entry)=>entry.tax_case_id===taxCase.id)) push('STEUERFORDERUNG','tax_account',row.due_date,row.label,row.amount,0,'',row.currency,row.status,row.obligation_type,row.reference||'');
      for(const row of runtime.taxPayments.filter((entry)=>entry.tax_case_id===taxCase.id)) push('STEUERZAHLUNG','tax_account',row.paid_at,row.payment_type,row.amount,0,'',row.currency,'',row.transaction_id?`transaction:${row.transaction_id}`:'',row.reference||'');
    }
    for(const tx of taxTransactions){
      const docs=runtime.documents.filter((d)=>d.object_type==='transaction'&&d.object_id===tx.id).map((d)=>d.name).join(' | ');
      const base=consumptionExpenseBase(tx,paymentMap,runtime.household.base_currency,runtime.fxRates);
      push('BUCHUNG',tx.tax_category||tx.categories?.name||'',dateInputValue(new Date(tx.occurred_at)),tx.description,tx.amount,0,base.toFixed(2),tx.currency,tx.status,`transaction:${tx.id}`,docs);
    }
    for(const doc of runtime.documents.filter((d)=>d.tax_relevant&&Number(d.tax_year||new Date(d.document_date||d.created_at).getFullYear())===year)){
      push('DOKUMENT',doc.tax_category||'',doc.document_date||dateInputValue(new Date(doc.created_at)),doc.name,'','','','',doc.object_type||'',doc.object_id||'',doc.notes||'');
    }
    const header=['Typ','Bereich','Datum/Stichtag','Bezeichnung','Brutto/Betrag','Erstattung','Abziehbar/Basis','Währung','Status','Quelle/Referenz','Notiz/Belege'];
    const lines=[header,...rows].map((row)=>row.map(escapeCsv).join(';')).join('\n');
    const blob=new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`Steuerdossier_SG_${year}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); showToast(`Steuerdossier ${year} als CSV erstellt.`); return;
  }
  if (action === 'goal-edit') {
    const g=runtime.goals.find((row)=>row.id===target.dataset.id); if(!g) throw new Error('Sparziel wurde nicht gefunden.');
    const account=runtime.accounts.find((row)=>row.account_id===g.account_id);
    document.querySelector('#goalEditId').value=g.id;
    document.querySelector('#goalEditName').value=g.name||'';
    document.querySelector('#goalEditType').value=g.goal_type||'custom';
    document.querySelector('#goalEditAccount').value=g.account_id||'';
    document.querySelector('#goalEditTarget').value=g.target_amount||0;
    const current=document.querySelector('#goalEditCurrent');
    if(current){ current.value=account?Number(account.current_balance||0):Number(g.current_amount||0); current.disabled=Boolean(account); }
    const help=document.querySelector('#goalEditCurrentHelp');
    if(help) help.textContent=account?`Automatisch aus ${account.name}; hier nicht manuell änderbar.`:'Nur für Ziele ohne verknüpftes Konto.';
    document.querySelector('#goalEditMonthly').value=g.monthly_amount||0;
    document.querySelector('#goalEditDate').value=g.target_date||'';
    const form=document.querySelector('#goal-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'goal-source-open') {
    const input=document.querySelector('#goalSourceGoalId'); if(input) input.value=target.dataset.id;
    const form=document.querySelector('#goal-source-create'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'}); return;
  }
  if (action === 'goal-source-delete') {
    await financeApi.deleteGoalSource(target.dataset.id); await refresh('Finanzierungsquelle entfernt.'); return;
  }
  if (action === 'budget-suggestion-toggle') {
    uiState.budgetExpandedMerchantId = uiState.budgetExpandedMerchantId===target.dataset.merchantId ? null : target.dataset.merchantId;
    render();
    return;
  }
  if (action === 'budget-transaction-edit') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if(!tx) throw new Error('Buchung wurde nicht gefunden.');
    const merchant=runtime.merchants.find((row)=>row.id===tx.merchant_id);
    uiState.transactionQuery=merchant?.name||tx.counterparty||tx.description||'';
    uiState.transactionCategory='all';
    uiState.transactionCategoryIds=[];
    uiState.transactionAccount='all';
    uiState.transactionFrom='';
    uiState.transactionTo='';
    uiState.transactionPeriod='all';
    uiState.transactionView='details';
    uiState.transactionPage=1;
    uiState.pendingTransactionEditId=tx.id;
    location.hash='#/transactions';
    return;
  }
  if (action === 'overview-drilldown-expense') {
    const key=target.dataset.key||'';
    const ids=String(target.dataset.categoryIds||'').split(',').filter(Boolean);
    uiState.transactionQuery='';
    uiState.transactionDirection='expense';
    uiState.transactionSemantic='all';
    uiState.transactionAccount='all';
    uiState.transactionFrom='';
    uiState.transactionTo='';
    uiState.transactionPeriod='all';
    uiState.transactionView='details';
    uiState.transactionPage=1;
    uiState.transactionCategoryIds=[];
    uiState.transactionSourceSet=[];
    if(key==='uncategorized') uiState.transactionCategory='uncategorized';
    else if(key==='other'){ uiState.transactionCategory='all'; uiState.transactionCategoryIds=ids; }
    else uiState.transactionCategory=ids[0]||key||'all';
    location.hash='#/transactions';
    return;
  }
  if (action === 'overview-drilldown-income') {
    const kind=target.dataset.kind||'earned';
    const source=target.dataset.source||'';
    const sources=String(target.dataset.sources||'').split('||').filter(Boolean);
    uiState.transactionDirection='income';
    uiState.transactionSemantic=kind;
    uiState.transactionQuery=sources.length>1?'':source;
    uiState.transactionSourceSet=sources.length>1?sources:[];
    uiState.transactionCategory='all';
    uiState.transactionAccount='all';
    uiState.transactionFrom=`${new Date().getFullYear()}-01-01`;
    uiState.transactionTo=`${new Date().getFullYear()}-12-31`;
    uiState.transactionPeriod='custom';
    uiState.transactionView='details';
    uiState.transactionPage=1;
    location.hash='#/transactions';
    return;
  }
  if (action === 'transaction-filter-category') {
    uiState.transactionCategory=target.dataset.category||'all'; uiState.transactionPeriod='all'; uiState.transactionView='details'; uiState.transactionPage=1; render(); return;
  }
  if (action === 'transaction-filter-reset') {
    uiState.transactionQuery=''; uiState.transactionCategory='all'; uiState.transactionCategoryIds=[]; uiState.transactionSourceSet=[]; uiState.transactionAccount='all'; uiState.transactionContext='all'; uiState.transactionVehicle='all'; uiState.transactionDirection='all'; uiState.transactionSemantic='all'; uiState.transactionFrom=''; uiState.transactionTo=''; uiState.transactionPeriod='month'; uiState.transactionPage=1; render(); return;
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
    const scrollY=window.scrollY;
    const result=await applyImportGroupLearning(ids,categoryId);
    render();
    requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}));
    showToast(`${result.name}: ${result.count} Buchung${result.count===1?'':'en'} zugeordnet und dauerhaft gemerkt.`);
    return;
  }
  if (action === 'transaction-merge-open') {
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
    const candidates=transactionMergeCandidates(tx,runtime.transactions,{documents:runtime.documents});
    if(!candidates.length) throw new Error('Für diese Buchung wurde keine sicher zusammenführbare Dublette gefunden. Finance prüft Betrag, Datum, Währung sowie bei unterschiedlichen Konten eindeutig Beleg gegen Bankbuchung.');
    const form=document.querySelector('#transaction-merge');
    const input=document.querySelector('#transactionMergeId');
    const source=document.querySelector('#transactionMergeSource');
    const select=document.querySelector('#transactionMergeCandidate');
    if(!form||!input||!select) throw new Error('Zusammenführen-Dialog ist nicht verfügbar.');
    input.value=tx.id;
    if(source) source.innerHTML=`<strong>${escapeHtml(tx.merchants?.name||tx.counterparty||tx.description)}</strong><span>${escapeHtml(dateInputValue(new Date(tx.occurred_at)))} · ${Math.abs(Number(tx.amount)).toFixed(2)} ${escapeHtml(tx.currency)}</span>`;
    select.innerHTML='<option value="">Bitte wählen</option>'+candidates.map((row)=>`<option value="${row.id}">${escapeHtml(dateInputValue(new Date(row.occurred_at)))} · ${escapeHtml(row.merchants?.name||row.counterparty||row.description)} · ${escapeHtml(row.accounts?.name||'Konto')} · ${Math.abs(Number(row.amount)).toFixed(2)} ${escapeHtml(row.currency)}${row.source==='import'?' · Bankimport':''}</option>`).join('');
    form.removeAttribute('hidden');
    form.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'transaction-merge-suggested') {
    const left=runtime.transactions.find((row)=>row.id===target.dataset.leftId);
    const right=runtime.transactions.find((row)=>row.id===target.dataset.rightId);
    if(!left||!right) throw new Error('Eine der vorgeschlagenen Buchungen wurde nicht gefunden.');
    const keep=preferredTransactionToKeep(left,right,runtime.documents);
    const duplicate=keep.id===left.id?right:left;
    const merchantHint=left.merchant_id&&right.merchant_id&&left.merchant_id!==right.merchant_id&&merchantSimilarity(left,right)>=0.85
      ? ' Die Händlernamen sehen ebenfalls ähnlich aus und können danach unter Händler vereinheitlicht werden.'
      : '';
    if(!confirm(`Diese zwei Buchungen zusammenführen? Finance behält bevorzugt die Bankbuchung und hängt vorhandene Belege daran.${merchantHint}`)) return;
    await financeApi.mergeDuplicateTransactions({householdId:runtime.household.id,keepTransactionId:keep.id,duplicateTransactionId:duplicate.id});
    await refresh('Doppelbuchung zusammengeführt. Belege und Zuordnungen wurden erhalten.');
    return;
  }
  if (action === 'transaction-delete') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if (!tx) throw new Error('Transaktion wurde nicht gefunden.');
    if (tx.cashflow_type === 'debt_payment') throw new Error('Schuldzahlungen werden im Zahlungsverlauf unter Schulden & Kredite storniert.');
    if (tx.cashflow_type === 'receivable_principal') throw new Error('Forderungsbuchungen werden unter Forderungen korrigiert oder storniert.');
    if (runtime.bills.some((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id)) throw new Error('Diese Buchung gehört zu einer bezahlten Rechnung. Bitte zuerst die Rechnungszahlung zurücknehmen.');
    if (!confirm(t(tx.transfer_group_id?'Die gesamte Umbuchung mit beiden Buchungsseiten löschen?':'Diese Transaktion wirklich löschen?'))) return;
    if (tx.transfer_group_id) {
      const groupTransactions=runtime.transactions.filter((row)=>row.transfer_group_id===tx.transfer_group_id);
      await financeApi.deleteTransfer(runtime.household.id,tx.transfer_group_id);
      for(const row of groupTransactions) await deleteLinkedDocuments('transaction',row.id);
    } else {
      await financeApi.deleteTransaction(tx.id);
      await deleteLinkedDocuments('transaction',tx.id);
    }
    await refresh(tx.transfer_group_id?'Umbuchung gelöscht.':'Transaktion gelöscht.'); return;
  }
  if (action === 'delete') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const table=target.dataset.table; const id=target.dataset.id;
    if(table==='recurring_rules'){
      const links=[];
      if(runtime.contracts.some((row)=>row.recurring_rule_id===id)) links.push('Vertrag');
      if(runtime.insurance.some((row)=>row.recurring_rule_id===id)) links.push('Versicherung');
      if(runtime.debts.some((row)=>row.recurring_rule_id===id)) links.push('Schuld');
      if(runtime.goalSources.some((row)=>row.recurring_rule_id===id)) links.push('Sparziel');
      if(links.length) throw new Error(`Diese Planung ist verknüpft mit: ${links.join(', ')}. Bitte die Verbindung zuerst dort lösen.`);
    }
    if(table==='contracts'){
      const row=runtime.contracts.find((item)=>item.id===id);
      if(row?.recurring_rule_id) throw new Error('Dieser Vertrag ist mit Fixkosten verknüpft. Bitte zuerst „Planung lösen“.');
    }
    if(table==='insurance_policies'){
      const row=runtime.insurance.find((item)=>item.id===id);
      if(row?.recurring_rule_id) throw new Error('Diese Versicherung ist mit Fixkosten verknüpft. Bitte zuerst „Planung lösen“.');
    }
    if(table==='debts'){
      const row=runtime.debts.find((item)=>item.id===id);
      if(row?.recurring_rule_id) throw new Error('Diese Schuld ist mit einer regelmässigen Rate verknüpft. Bitte zuerst die Planung lösen.');
      if(runtime.debtPayments.some((payment)=>payment.debt_id===id)) throw new Error('Diese Schuld hat eine Zahlungshistorie und kann nicht gelöscht werden. Setze sie stattdessen auf bezahlt oder pausiert.');
    }
    if(table==='bills'){
      const row=runtime.bills.find((item)=>item.id===id);
      if(row?.status==='paid') throw new Error('Eine bezahlte Rechnung kann nicht direkt gelöscht werden. Bitte zuerst die Zahlung zurücknehmen.');
    }
    if (!confirm(t('Diesen Eintrag wirklich löschen?'))) return;
    if (table==='documents') {
      const doc=runtime.documents.find((d)=>d.id===id); if (doc) await financeApi.deleteDocument(doc);
    } else {
      const objectType=documentObjectTypeByTable[table];
      const fn=deleteMap[table];
      if (!fn) throw new Error('Löschen für diesen Datentyp ist nicht definiert.');
      await fn(id);
      if(objectType) await deleteLinkedDocuments(objectType,id);
    }
    await refresh('Eintrag gelöscht.'); return;
  }
  if (action === 'bill-edit') {
    const bill=runtime.bills.find((row)=>row.id===target.dataset.id);
    if(!bill) throw new Error('Rechnung wurde nicht gefunden.');
    if(bill.status==='paid') throw new Error('Eine bezahlte Rechnung kann erst nach „Zahlung zurücknehmen“ bearbeitet werden.');
    document.querySelector('#billEditId').value=bill.id;
    document.querySelector('#billEditName').value=bill.name||'';
    document.querySelector('#billEditProvider').value=bill.provider||'';
    document.querySelector('#billEditAmount').value=bill.amount||0;
    document.querySelector('#billEditDueDate').value=bill.due_date||'';
    document.querySelector('#billEditAccount').value=bill.account_id||'';
    document.querySelector('#billEditCategory').value=bill.category_id||'';
    document.querySelector('#billEditReference').value=bill.reference||'';
    const form=document.querySelector('#bill-edit');
    form?.removeAttribute('hidden');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'contract-edit') {
    const contract=runtime.contracts.find((row)=>row.id===target.dataset.id);
    if(!contract) throw new Error('Vertrag wurde nicht gefunden.');
    document.querySelector('#contractEditId').value=contract.id;
    document.querySelector('#contractEditName').value=contract.name||'';
    document.querySelector('#contractEditProvider').value=contract.provider||'';
    document.querySelector('#contractEditType').value=contract.contract_type||'contract';
    document.querySelector('#contractEditAmount').value=contract.amount||0;
    document.querySelector('#contractEditCadence').value=contract.billing_cadence||'monthly';
    document.querySelector('#contractEditNext').value=contract.next_payment_date||'';
    document.querySelector('#contractEditAccount').value=contract.account_id||'';
    document.querySelector('#contractEditCategory').value=contract.category_id||'';
    document.querySelector('#contractEditNotice').value=contract.cancellation_notice_days??'';
    document.querySelector('#contractEditEnd').value=contract.end_date||'';
    document.querySelector('#contractEditStatus').value=contract.status||'active';
    const form=document.querySelector('#contract-edit');
    form?.removeAttribute('hidden');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
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
    if(!confirm(t('Rechnungszahlung wirklich zurücknehmen? Eine von Finance erzeugte Kontobuchung wird dabei ebenfalls entfernt.'))) return;
    await financeApi.unpayBill({householdId:runtime.household.id,billId:target.dataset.id});
    await refresh('Rechnungszahlung zurückgenommen.'); return;
  }
  if (action === 'goal-progress') {
    const goal=runtime.goals.find((g)=>g.id===target.dataset.id);
    if(!goal) throw new Error('Sparziel wurde nicht gefunden.');
    if(goal.account_id) throw new Error('Dieses Sparziel ist mit einem Konto verknüpft. Der aktuelle Stand kommt automatisch vom Kontostand.');
    const value=prompt(t('Aktueller Stand des Sparziels:'),target.dataset.current||'0'); if (value===null) return;
    const n=Number(value); if (!Number.isFinite(n)||n<0) throw new Error('Ungültiger Betrag.');
    await financeApi.updateGoal(target.dataset.id,{current_amount:n,status:n>=Number(goal.target_amount)?'completed':'active'}); await refresh('Sparziel aktualisiert.'); return;
  }
  if (action === 'receivable-payment-open') {
    const receivable=runtime.receivables.find((row)=>row.id===target.dataset.id);
    if(!receivable) throw new Error('Forderung wurde nicht gefunden.');
    document.querySelector('#receivablePaymentId').value=receivable.id;
    document.querySelector('#receivablePaymentDate').value=dateInputValue();
    document.querySelector('#receivablePaymentAmount').value=Number(receivable.outstanding_amount||0).toFixed(2);
    document.querySelector('#receivablePaymentNote').value='';
    const sourceSelect=document.querySelector('#receivablePaymentSource');
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
    const transactionSelect=document.querySelector('#receivablePaymentTransaction');
    if(transactionSelect){
      transactionSelect.value='';
      [...transactionSelect.options].forEach((option)=>{
        if(!option.value) return;
        const currencyMatches=option.dataset.currency===receivable.currency;
        const amountMatches=Math.abs(Number(option.dataset.amount||0)-Number(receivable.outstanding_amount||0))<=0.005;
        option.hidden=!(currencyMatches&&amountMatches);
        option.disabled=!(currencyMatches&&amountMatches);
      });
    }
    const defaultSource=accountSelect&&[...accountSelect.options].some((option)=>option.value&&!option.disabled)
      ? 'created_transaction'
      : transactionSelect&&[...transactionSelect.options].some((option)=>option.value&&!option.disabled)
        ? 'linked_transaction'
        : 'history_only';
    if(sourceSelect) sourceSelect.value=defaultSource;
    showReceivablePaymentSource(defaultSource);
    const form=document.querySelector('#receivable-payment-create');
    form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'receivable-history') { uiState.receivableExpandedId=target.dataset.id; render(); return; }
  if (action === 'receivable-history-close') { uiState.receivableExpandedId=null; render(); return; }
  if (action === 'receivable-payment-reverse') {
    if(!confirm(t('Die zuletzt erfasste Rückzahlung wirklich stornieren? Eine von Finance erstellte Kontobuchung wird ebenfalls entfernt.'))) return;
    const payment=runtime.receivablePayments.find((row)=>row.id===target.dataset.id);
    if(!payment) throw new Error('Rückzahlung wurde nicht gefunden.');
    await financeApi.reverseReceivablePayment(payment.id);
    uiState.receivableExpandedId=payment.receivable_id;
    await refresh('Rückzahlung storniert; Forderung wiederhergestellt.');
    return;
  }
  if (action === 'merchant-edit') {
    const merchant=runtime.merchants.find((row)=>row.id===target.dataset.id);
    if(!merchant) throw new Error('Händler wurde nicht gefunden.');
    document.querySelector('#merchantEditId').value=merchant.id;
    document.querySelector('#merchantEditName').value=merchant.name||'';
    document.querySelector('#merchantEditCategory').value=merchant.default_category_id||'';
    const form=document.querySelector('#merchant-edit');
    form?.removeAttribute('hidden');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'recurring-edit') {
    const rule=runtime.recurringRules.find((row)=>row.id===target.dataset.id);
    if(!rule) throw new Error('Wiederkehrende Regel wurde nicht gefunden.');
    const linkedSource=
      runtime.contracts.some((row)=>row.recurring_rule_id===rule.id)
      || runtime.insurance.some((row)=>row.recurring_rule_id===rule.id)
      || runtime.debts.some((row)=>row.recurring_rule_id===rule.id)
      || runtime.goalSources.some((row)=>row.recurring_rule_id===rule.id);
    if(linkedSource) throw new Error('Diese Regel wird an ihrer verknüpften Quelle bearbeitet.');

    document.querySelector('#recurringEditId').value=rule.id;
    document.querySelector('#recurringEditDirection').value=rule.direction||'expense';
    document.querySelector('#recurringEditAmount').value=rule.amount||0;
    document.querySelector('#recurringEditAmountMode').value=rule.amount_mode||'fixed';
    document.querySelector('#recurringEditAccount').value=rule.account_id||'';
    document.querySelector('#recurringEditTarget').value=rule.destination_account_id||'';
    document.querySelector('#recurringEditCategory').value=rule.category_id||'';
    document.querySelector('#recurringEditDescription').value=rule.description||'';
    document.querySelector('#recurringEditCadence').value=rule.cadence||'monthly';
    document.querySelector('#recurringEditInterval').value=rule.interval_months||1;
    const recurringIntervalField=document.querySelector('#recurringEditIntervalField');
    if(recurringIntervalField) recurringIntervalField.hidden=(rule.cadence||'monthly')!=='monthly';
    document.querySelector('#recurringEditNextDate').value=rule.next_date||'';
    document.querySelector('#recurringEditEndDate').value=rule.end_date||'';
    document.querySelector('#recurringEditActive').value=rule.active===false?'false':'true';

    const transfer=rule.direction==='transfer';
    const targetField=document.querySelector('#recurringEditTargetField');
    const categoryField=document.querySelector('#recurringEditCategoryField');
    if(targetField) targetField.hidden=!transfer;
    if(categoryField) categoryField.hidden=transfer;
    const form=document.querySelector('#recurring-edit');
    form?.removeAttribute('hidden');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'fixed-cost-edit') {
    const rule=runtime.recurringRules.find((row)=>row.id===target.dataset.id);
    if(!rule) throw new Error('Fixkosten-Eintrag wurde nicht gefunden.');
    document.querySelector('#fixedCostEditId').value=rule.id;
    document.querySelector('#fixedCostEditDirection').value=rule.direction||'expense';
    document.querySelector('#fixedCostEditDescription').value=rule.description||'';
    document.querySelector('#fixedCostEditAmount').value=rule.amount||0;
    document.querySelector('#fixedCostEditAmountMode').value=rule.amount_mode||'fixed';
    document.querySelector('#fixedCostEditAccount').value=rule.account_id||'';
    document.querySelector('#fixedCostEditTarget').value=rule.destination_account_id||'';
    document.querySelector('#fixedCostEditCategory').value=rule.category_id||'';
    document.querySelector('#fixedCostEditMerchant').value=rule.merchants?.name||rule.counterparty||'';
    document.querySelector('#fixedCostEditCadence').value=rule.cadence||'monthly';
    document.querySelector('#fixedCostEditInterval').value=rule.interval_months||1;
    const fixedIntervalField=document.querySelector('#fixedCostEditIntervalField');
    if(fixedIntervalField) fixedIntervalField.hidden=(rule.cadence||'monthly')!=='monthly';
    document.querySelector('#fixedCostEditReserveEnabled').checked=Boolean(rule.reserve_enabled);
    document.querySelector('#fixedCostEditReserveAccount').value=rule.reserve_account_id||'';
    const reserveAccountField=document.querySelector('#fixedCostEditReserveAccountField');
    if(reserveAccountField) reserveAccountField.hidden=!rule.reserve_enabled;
    const reserveToggleField=document.querySelector('#fixedCostEditReserveToggleField');
    if(reserveToggleField) reserveToggleField.hidden=rule.direction!=='expense';
    document.querySelector('#fixedCostEditNextDate').value=rule.next_date||'';
    document.querySelector('#fixedCostEditEndDate').value=rule.end_date||'';
    document.querySelector('#fixedCostEditActive').value=rule.active?'true':'false';
    const transfer=rule.direction==='transfer';
    const targetField=document.querySelector('#fixedCostEditTargetField');
    const categoryField=document.querySelector('#fixedCostEditCategoryField');
    const merchantField=document.querySelector('#fixedCostEditMerchantField');
    if(targetField) targetField.hidden=!transfer;
    if(categoryField) categoryField.hidden=transfer;
    if(merchantField) merchantField.hidden=transfer;
    const form=document.querySelector('#fixed-cost-edit');
    form?.removeAttribute('hidden');
    form?.scrollIntoView({behavior:'smooth',block:'start'});
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
    if(!confirm(t('Die zuletzt erfasste Schuldzahlung wirklich stornieren? Restschuld und verknüpfte Buchung werden entsprechend zurückgesetzt.'))) return;
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
    const ruleId=debt.recurring_rule_id;
    if(ruleId){
      const shared=runtime.contracts.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.insurance.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.goalSources.some((row)=>row.recurring_rule_id===ruleId);
      if(shared) throw new Error('Diese Planung wird noch an anderer Stelle verwendet und kann nicht gelöst werden.');
      await financeApi.deleteRecurringRule(ruleId);
    } else {
      await financeApi.updateDebt(debt.id,{recurring_rule_id:null});
    }
    await refresh('Verknüpfung zur regelmässigen Rate gelöst.'); return;
  }
  if (action === 'contract-recurring-remove') {
    const contract=runtime.contracts.find((row)=>row.id===target.dataset.id);
    if(!contract) throw new Error('Vertrag wurde nicht gefunden.');
    const ruleId=contract.recurring_rule_id;
    if(ruleId){
      const shared=runtime.insurance.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.debts.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.goalSources.some((row)=>row.recurring_rule_id===ruleId);
      if(shared) throw new Error('Diese Planung wird noch an anderer Stelle verwendet und kann nicht gelöst werden.');
      await financeApi.deleteRecurringRule(ruleId);
    }
    await refresh('Vertrag von Fixkosten getrennt.'); return;
  }
  if (action === 'insurance-recurring-remove') {
    const policy=runtime.insurance.find((row)=>row.id===target.dataset.id);
    if(!policy) throw new Error('Versicherung wurde nicht gefunden.');
    const ruleId=policy.recurring_rule_id;
    if(ruleId){
      const shared=runtime.contracts.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.debts.some((row)=>row.recurring_rule_id===ruleId)
        || runtime.goalSources.some((row)=>row.recurring_rule_id===ruleId);
      if(shared) throw new Error('Diese Planung wird noch an anderer Stelle verwendet und kann nicht gelöst werden.');
      await financeApi.deleteRecurringRule(ruleId);
    }
    await refresh('Versicherung von Fixkosten getrennt.'); return;
  }
  if (action === 'legal-event') {
    const caseId=target.dataset.id; const title=prompt(t('Ereignis / Titel:')); if (!title) return;
    const type=prompt(t('Typ des Ereignisses:'),t('Notiz'))||'Notiz'; const notes=prompt(t('Notiz (optional):'),'')||null;
    await financeApi.createLegalEvent({case_id:caseId,household_id:runtime.household.id,event_date:dateInputValue(),event_type:type,title,notes}); await refresh('Timeline-Ereignis gespeichert.'); return;
  }
  if (action === 'family-remove') { if (!canAdminHousehold()) throw new Error('Nur Owner oder Haushalts-Admins dürfen Mitglieder entfernen.'); if (!confirm(t('Mitglied aus dem Haushalt entfernen?'))) return; await financeApi.removeHouseholdMember(runtime.household.id,target.dataset.userId); await refresh('Mitglied entfernt.'); return; }
  if (action === 'document-download') {
    const blob=await financeApi.downloadDocument(target.dataset.path); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=target.dataset.name||'dokument'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); return;
  }
  if (action === 'admin-password') {
    const password=prompt(t('Neues temporäres Passwort (mind. 8 Zeichen):')); if (password===null) return; if (password.length<8) throw new Error('Mindestens 8 Zeichen.');
    await backend.adminSetPassword({userId:target.dataset.userId,password}); showToast('Passwort gesetzt.'); return;
  }
  if (action === 'admin-finance-reset') {
    if(!runtime.adminRole) throw new Error('Nur App-Admins dürfen Finance-Daten zurücksetzen.');
    const userId=target.dataset.userId||'';
    const email=String(target.dataset.userEmail||'').trim();
    if(!userId||!email) throw new Error('Benutzer konnte nicht eindeutig bestimmt werden.');
    const accepted=confirm(`Finance-Daten von ${email} wirklich unwiderruflich zurücksetzen?\n\nKonten, Transaktionen, Importe, Budgets, Planung, Händler, Steuer- und Vermögensdaten werden entfernt. Login und Modulfreigaben bleiben bestehen.`);
    if(!accepted) return;
    const confirmation=prompt(`Zur Bestätigung die E-Mail-Adresse exakt eingeben:\n${email}`);
    if(confirmation===null) return;
    if(confirmation.trim().toLowerCase()!==email.toLowerCase()) throw new Error('Die Bestätigung stimmt nicht mit der E-Mail-Adresse überein.');
    await backend.rpc('admin_reset_user_finance',{p_user_id:userId,p_confirmation_email:confirmation.trim()});
    if(userId===runtime.user?.id){
      await loadContext();
      location.hash='#/setup';
      render();
      showToast('Deine Finance-Daten wurden zurückgesetzt. Der Login bleibt bestehen.');
      return;
    }
    runtime.adminUsers=(await backend.adminListUsers())?.users||[];
    uiState.adminExpandedUserId=null;
    render();
    showToast(`Finance-Daten von ${email} wurden zurückgesetzt.`);
    return;
  }
  if (action === 'admin-demo-copy') {
    const value=`E-Mail: ${target.dataset.email||''}\nPasswort: ${target.dataset.password||''}`;
    await navigator.clipboard.writeText(value);
    showToast('Demo-Zugang kopiert.');
    return;
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

pageContent.addEventListener('input', (event) => {
  const target=event.target;
  if(target?.matches?.('[data-categorization-transfer-amount]')) {
    syncCategorizationTransferFx(target.closest('[data-categorization-detail]'));
    return;
  }
  if(target?.name==='amount' && target.closest?.('#transaction-create')) {
    syncSmartCategoryForForm(target.closest('form'));
    return;
  }
  if(target?.name==='description' && target.closest?.('#transaction-create, #transaction-edit')) {
    syncSmartCategoryForForm(target.closest('form'));
    return;
  }
  if(target?.id==='receiptMerchant' || target?.id==='receiptAmount') {
    syncReceiptSmartCategory();
    return;
  }
});

pageContent.addEventListener('change', async (event) => {
  const target = event.target;
  const filePicker = target.closest?.('.file-picker');
  if (filePicker && target.matches?.('input[type="file"]')) {
    const fileName = filePicker.querySelector('[data-file-name]');
    if (fileName) {
      const files=[...(target.files||[])];
      fileName.textContent = files.length>1 ? `${files.length} Dateien ausgewählt` : (files[0]?.name || t('Keine Datei ausgewählt'));
    }
  }
  try {
    if (target.matches?.('[data-categorization-select]')) {
      const detail=target.closest('[data-categorization-detail]');
      updateCategorizationSelectedCount(detail);
      syncCategorizationTransferFx(detail);
      return;
    }
    if (target.matches?.('[data-categorization-transfer-account]')) {
      syncCategorizationTransferFx(target.closest('[data-categorization-detail]'));
      return;
    }
    if (target.id === 'localeSelect') {
      runtime.profile=await financeApi.updateProfile(runtime.user.id,{locale:target.value});
      setLocale(target.value);
      updateProfileUI();
      render();
      showToast('Sprache & Region gespeichert.');
      return;
    }
    if (target.dataset.action === 'admin-set-locale') {
      target.disabled=true;
      await backend.adminSetLocale({userId:target.dataset.userId,locale:target.value});
      const user=runtime.adminUsers.find((row)=>row.id===target.dataset.userId);
      if(user) user.locale=target.value;
      if(target.dataset.userId===runtime.user?.id){
        runtime.profile=await financeApi.updateProfile(runtime.user.id,{locale:target.value});
        setLocale(target.value);
        updateProfileUI();
        render();
      }
      showToast('Sprache & Region des Benutzers aktualisiert.');
      target.disabled=false;
      return;
    }
    if (target.id === 'themeSelect') { store.setState({theme:target.value},{persistPreferences:true}); return; }
    if (target.id === 'depthSelect') { store.setState({depth:target.value},{persistPreferences:true}); render(); return; }
    if (target.id === 'sessionTimeoutSelect') {
      const minutes=normalizeIdleMinutes(target.value);
      persistNumber(SESSION_KEYS.timeout,minutes);
      await saveUserPreferences({session_timeout_minutes:minutes});
      markInteraction(true);
      startLiveTimers();
      render();
      showToast(`Automatischer Logout nach ${minutes} Minuten gespeichert.`);
      return;
    }
    if (target.id === 'transactionPeriodSelect') { uiState.transactionPeriod=target.value||'month'; if(uiState.transactionPeriod!=='custom'){ uiState.transactionFrom=''; uiState.transactionTo=''; } uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionViewSelect') { uiState.transactionView=target.value||'summary'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionCategoryFilter') { uiState.transactionCategory=target.value||'all'; uiState.transactionCategoryIds=[]; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionAccountFilter') { uiState.transactionAccount=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionContextFilter') { uiState.transactionContext=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionVehicleFilter') { uiState.transactionVehicle=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionDirectionFilter') { uiState.transactionDirection=target.value||'all'; uiState.transactionSourceSet=[]; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionSemanticFilter') { uiState.transactionSemantic=target.value||'all'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'categorizationFilter') { uiState.categorizationFilter=target.value||'action'; uiState.categorizationPage=1; uiState.categorizationGroupKey=''; render(); return; }
    if (target.id === 'transactionFrom') { uiState.transactionFrom=target.value||''; uiState.transactionPeriod='custom'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'transactionTo') { uiState.transactionTo=target.value||''; uiState.transactionPeriod='custom'; uiState.transactionPage=1; render(); return; }
    if (target.id === 'debtPaymentSource') { showDebtPaymentSource(target.value); return; }
    if (target.id === 'billPaymentSource') { showBillPaymentSource(target.value); return; }
    if (target.id === 'taxPaymentSource') { showTaxPaymentSource(target.value); return; }
    if (target.id === 'receivablePaymentSource') { showReceivablePaymentSource(target.value); return; }
    if (target.id === 'receivablePaymentTransaction') {
      const option=target.selectedOptions[0];
      const amount=document.querySelector('#receivablePaymentAmount');
      const date=document.querySelector('#receivablePaymentDate');
      if(option?.value){
        if(amount&&option.dataset.amount) amount.value=option.dataset.amount;
        if(date&&option.dataset.date) date.value=option.dataset.date;
      }
      return;
    }
    if (target.name==='direction' && target.closest('#transaction-create')) {
      const form=target.closest('form');
      const category=form?.querySelector('[name="categoryId"]');
      if(category){ category.dataset.userSelected=''; category.dataset.autoCategory=''; }
      syncSmartCategoryForForm(form);
      return;
    }
        if (['transactionEditDirection','transactionEditOtherAccount'].includes(target.id)) {
      if(target.id==='transactionEditDirection'){
        const form=target.closest('form');
        const category=form?.querySelector('[name="categoryId"]');
        if(category){ category.dataset.userSelected=''; category.dataset.autoCategory=''; }
        syncSmartCategoryForForm(form);
      }
      syncTransactionTransferEditor();
      return;
    }
    if (['transactionEditSemantic','transactionCreateSemantic'].includes(target.id) && target.value==='asset_acquisition') {
      const details=document.querySelector(target.id==='transactionEditSemantic'?'#transactionEditOptionalDetails':'#transactionCreateOptionalDetails');
      if(details) details.open=true;
      return;
    }
    if (['transactionEditCategory','transactionCreateCategory'].includes(target.id)) {
      target.dataset.userSelected=target.value?'true':'';
      target.dataset.autoCategory='';
      const category=runtime.categories.find((row)=>row.id===target.value);
      if(category && /(fahrzeugkauf|wartung|reparatur|mietfahrzeug|roller|motorrad|auto)/i.test(category.name||'')){
        const details=document.querySelector(target.id==='transactionEditCategory'?'#transactionEditOptionalDetails':'#transactionCreateOptionalDetails');
        if(details) details.open=true;
      }
      if(target.id==='transactionCreateCategory') syncTransactionBudgetCoach(target.closest('form'));
      return;
    }
    if (target.id === 'transactionEditVehicle' && target.value) {
      const details=document.querySelector('#transactionEditOptionalDetails');
      if(details) details.open=true;
      return;
    }
    if (target.id === 'transactionEditOtherTransaction') {
      const option=target.selectedOptions?.[0];
      const amount=document.querySelector('#transactionEditOtherAmount');
      const current=runtime.transactions.find((row)=>row.id===document.querySelector('#transactionEditId')?.value);
      const currentAccount=runtime.accounts.find((row)=>row.account_id===current?.account_id);
      const otherAccount=runtime.accounts.find((row)=>row.account_id===document.querySelector('#transactionEditOtherAccount')?.value);
      if(option?.value&&amount&&currentAccount&&otherAccount&&currentAccount.currency!==otherAccount.currency&&option.dataset.amount) amount.value=option.dataset.amount;
      return;
    }
    if (target.name === 'merchantId' && target.closest('#transaction-create, #transaction-edit')) {
      const form=target.closest('form');
      const category=form?.querySelector('[name="categoryId"]');
      if(category && category.dataset.userSelected!=='true'){
        category.value='';
        category.dataset.autoCategory='';
      }
      syncSmartCategoryForForm(form);
      return;
    }
    if(target.id==='receiptCategory') {
      target.dataset.userSelected=target.value?'true':'';
      target.dataset.autoCategory='';
      return;
    }
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
    if (target.id === 'goalCreateAccount' || target.id === 'goalEditAccount') {
      const edit=target.id==='goalEditAccount';
      const account=runtime.accounts.find((row)=>row.account_id===target.value);
      const current=document.querySelector(edit?'#goalEditCurrent':'#goalCreateCurrent');
      const help=document.querySelector(edit?'#goalEditCurrentHelp':'#goalCreateCurrentHelp');
      if(current){
        current.disabled=Boolean(account);
        if(account) current.value=Number(account.current_balance||0);
      }
      if(help) help.textContent=account?`Automatisch aus ${account.name}; hier nicht manuell änderbar.`:'Nur für Ziele ohne verknüpftes Konto.';
      return;
    }
    if (target.id === 'goalSourceType') {
      const type=target.value; const amount=document.querySelector('#goalSourceAmountField'); const recurring=document.querySelector('#goalSourceRecurringField'); const label=document.querySelector('#goalSourceLabelField'); const info=document.querySelector('#goalSourceSurplusInfo');
      if(amount) amount.hidden=type!=='fixed'; if(recurring) recurring.hidden=type!=='recurring_rule'; if(label) label.hidden=type==='surplus'; if(info) info.hidden=type!=='surplus'; return;
    }
    if (target.id === 'taxYearSelect') { uiState.taxYear=Number(target.value)||new Date().getFullYear(); render(); return; }
    if (target.id === 'recurringDirection' || target.id === 'recurringEditDirection') {
      const edit=target.id==='recurringEditDirection';
      const transfer=target.value==='transfer';
      const targetField=document.querySelector(edit?'#recurringEditTargetField':'#recurringTargetField');
      const categoryField=document.querySelector(edit?'#recurringEditCategoryField':'#recurringCategoryField');
      const amountMode=document.querySelector(edit?'#recurringEditAmountMode':'#recurringAmountMode');
      if(targetField) targetField.hidden=!transfer;
      if(categoryField) categoryField.hidden=transfer;
      if(amountMode&&transfer) amountMode.value='fixed';
      return;
    }
    if (target.id === 'recurringCadence' || target.id === 'recurringEditCadence') {
      const edit=target.id==='recurringEditCadence';
      const field=document.querySelector(edit?'#recurringEditIntervalField':'#recurringIntervalField');
      if(field) field.hidden=target.value!=='monthly';
      return;
    }
    if (target.id === 'fixedCostDirection' || target.id === 'fixedCostEditDirection') {
      const edit=target.id==='fixedCostEditDirection';
      const transfer=target.value==='transfer';
      const expense=target.value==='expense';
      const targetField=document.querySelector(edit?'#fixedCostEditTargetField':'#fixedCostTargetField');
      const categoryField=document.querySelector(edit?'#fixedCostEditCategoryField':'#fixedCostCategoryField');
      const merchantField=document.querySelector(edit?'#fixedCostEditMerchantField':'#fixedCostMerchantField');
      const reserveToggleField=document.querySelector(edit?'#fixedCostEditReserveToggleField':'#fixedCostReserveToggleField');
      const reserveAccountField=document.querySelector(edit?'#fixedCostEditReserveAccountField':'#fixedCostReserveAccountField');
      const reserveToggle=document.querySelector(edit?'#fixedCostEditReserveEnabled':'#fixedCostReserveEnabled');
      const amountMode=document.querySelector(edit?'#fixedCostEditAmountMode':'#fixedCostAmountMode');
      if(targetField) targetField.hidden=!transfer;
      if(categoryField) categoryField.hidden=transfer;
      if(merchantField) merchantField.hidden=transfer;
      if(reserveToggleField) reserveToggleField.hidden=!expense;
      if(!expense&&reserveToggle) reserveToggle.checked=false;
      if(reserveAccountField) reserveAccountField.hidden=!expense||!reserveToggle?.checked;
      if(amountMode&&transfer) amountMode.value='fixed';
      return;
    }
    if (target.id === 'fixedCostCadence' || target.id === 'fixedCostEditCadence') {
      const edit=target.id==='fixedCostEditCadence';
      const field=document.querySelector(edit?'#fixedCostEditIntervalField':'#fixedCostIntervalField');
      if(field) field.hidden=target.value!=='monthly';
      return;
    }
    if (target.id === 'fixedCostReserveEnabled' || target.id === 'fixedCostEditReserveEnabled') {
      const edit=target.id==='fixedCostEditReserveEnabled';
      const field=document.querySelector(edit?'#fixedCostEditReserveAccountField':'#fixedCostReserveAccountField');
      if(field) field.hidden=!target.checked;
      return;
    }
    if (target.id === 'transactionRecurringCadence') {
      const field=document.querySelector('#transactionRecurringIntervalField');
      if(field) field.hidden=target.value!=='monthly';
      return;
    }
    if (target.id === 'setupExpensePreset') {
      const option=target.selectedOptions?.[0];
      const category=document.querySelector('#setupExpenseCategory');
      const description=document.querySelector('#setupExpenseDescription');
      if(category) category.value=target.value||'';
      if(description && option?.dataset?.description) description.value=option.dataset.description;
      return;
    }
    if (target.id === 'budgetScopeType') { const merchant=document.querySelector('#budgetMerchantField'); const category=document.querySelector('#budgetCategoryField'); if(merchant) merchant.hidden=target.value!=='merchant'; if(category) category.hidden=target.value==='merchant'; return; }
    if (target.id === 'taxItemDocumentInput') {
      const file=target.files?.[0]; const itemId=uiState.taxItemDocumentId; if(!file||!itemId) return;
      if (file.size > 10*1024*1024) throw new Error('Die Datei ist grösser als 10 MB.');
      const item=runtime.taxItems.find((row)=>row.id===itemId); if(!item) throw new Error('Steuerposition wurde nicht gefunden.');
      const taxCase=runtime.taxCases.find((row)=>row.id===item.tax_case_id); if(!taxCase) throw new Error('Steuerfall wurde nicht gefunden.');
      const path=await financeApi.uploadDocument(runtime.household.id,file);
      await financeApi.createDocument({
        household_id:runtime.household.id,object_type:'tax_item',object_id:item.id,name:file.name,storage_path:path,
        mime_type:file.type||'application/octet-stream',file_size:file.size,document_date:item.occurred_on||dateInputValue(),
        notes:'Beleg zur Steuerposition',tax_relevant:true,tax_year:taxCase.tax_year,tax_category:item.section_key,
      });
      uiState.taxItemDocumentId=null; target.value='';
      await refresh('Steuerbeleg gespeichert und mit der Position verknüpft.'); return;
    }
    if (target.id === 'taxPaymentTransaction') {
      const option=target.selectedOptions?.[0];
      if(option?.value){
        const amount=document.querySelector('#taxPaymentAmount');
        const date=document.querySelector('#taxPaymentDate');
        const type=document.querySelector('#taxPaymentType');
        if(amount) amount.value=option.dataset.amount||'';
        if(date) date.value=option.dataset.date||date.value;
        if(type) type.value=option.dataset.type||type.value;
      }
      return;
    }
    if (target.id === 'taxReceiptInput') {
      const file=target.files?.[0]; const txId=uiState.taxReceiptTxId; if(!file||!txId) return;
      if (file.size > 10*1024*1024) throw new Error('Die Datei ist grösser als 10 MB.');
      const tx=runtime.transactions.find((row)=>row.id===txId); if(!tx) throw new Error('Transaktion wurde nicht gefunden.');
      const path=await financeApi.uploadDocument(runtime.household.id,file);
      await financeApi.createDocument({household_id:runtime.household.id,object_type:'transaction',object_id:tx.id,name:file.name,storage_path:path,mime_type:file.type||'application/octet-stream',file_size:file.size,document_date:dateInputValue(new Date(tx.occurred_at)),notes:'Quittung zur Transaktion',tax_relevant:true,tax_year:new Date(tx.occurred_at).getFullYear(),tax_category:tx.tax_category||null});
      uiState.taxReceiptTxId=null; await refresh('Quittung gespeichert und mit der Transaktion verknüpft.'); return;
    }
    if (target.id === 'transactionMakeRecurring') {
      const fields=document.querySelector('#transactionRecurringFields');
      const matched=Boolean(target.dataset.matchRuleId);
      if (fields) fields.hidden=!target.checked||matched;
      const hint=document.querySelector('#transactionRecurringMatchHint');
      if(hint&&matched) hint.textContent=target.checked
        ? 'Diese Buchung wird mit der bereits erkannten Wiederholung verknüpft. Es entsteht keine zweite Regel.'
        : 'Die erkannte Wiederholung bleibt bestehen; diese einzelne Buchung wird nicht damit verknüpft.';
      return;
    }
    if (target.id === 'importCategoryFilter') { uiState.importCategory=target.value||'all'; render(); return; }
    if (target.closest('#importMapping') && ['mapDate','mapDescription','mapCounterparty','mapCounterpartyAccount','mapBankReference','mapAmount','mapDebit','mapCredit'].includes(target.name)) { renderImportReview(); return; }
    if (target.name === 'kind' && target.closest('#category-create')) {
      const parent = target.closest('form')?.querySelector('[name="parentId"]');
      if (parent) {
        [...parent.options].forEach((option)=>{ if (!option.value) return; option.hidden = option.dataset.kind !== target.value; option.disabled = option.dataset.kind !== target.value; });
        if (parent.selectedOptions[0]?.disabled) parent.value = '';
      }
      return;
    }
    if (target.id === 'importFile') {
      const files=[...(target.files||[])];
      if (!files.length) return;
      const items=[];
      for(const file of files){
        const parsed=await parseImportFile(file);
        if (!parsed.headers.length) throw new Error(`${file.name}: Keine verwertbaren Importspalten erkannt.`);
        items.push({file,parsed});
      }
      importState.items=items;
      const primary=items[0].parsed;
      const guess=guessMapping(primary.headers);
      fillSelect(document.querySelector('#mapDate'),primary.headers,guess.date,false);
      fillSelect(document.querySelector('#mapDescription'),primary.headers,guess.description,false);
      fillSelect(document.querySelector('#mapCounterparty'),primary.headers,guess.counterparty,true);
      fillSelect(document.querySelector('#mapCounterpartyAccount'),primary.headers,guess.counterpartyAccount,true);
      fillSelect(document.querySelector('#mapBankReference'),primary.headers,guess.bankReference,true);
      fillSelect(document.querySelector('#mapAmount'),primary.headers,guess.amount,true);
      fillSelect(document.querySelector('#mapDebit'),primary.headers,guess.debit,true);
      fillSelect(document.querySelector('#mapCredit'),primary.headers,guess.credit,true);

      const totals=items.reduce((acc,item)=>{
        acc.rows+=item.parsed.rows.length;
        acc.pages+=Number(item.parsed.meta?.pages||0);
        acc.credits+=Number(item.parsed.meta?.credits||0);
        acc.debits+=Number(item.parsed.meta?.debits||0);
        acc.ambiguous+=Number(item.parsed.meta?.ambiguous||0);
        if(item.parsed.format==='pdf') acc.pdf+=1; else acc.csv+=1;
        return acc;
      },{rows:0,pages:0,credits:0,debits:0,ambiguous:0,pdf:0,csv:0});
      const formats=[totals.pdf?`${totals.pdf} PDF`:'',totals.csv?`${totals.csv} CSV`:''].filter(Boolean).join(' · ');
      const pdfWarning=totals.pdf>0&&totals.rows>=20&&totals.credits===0
        ? ' · ⚠ Keine Einnahme/Gutschrift erkannt – bitte vor dem Import prüfen.'
        : '';
      const meta=`${items.length} Datei${items.length===1?'':'en'} · ${formats} · ${totals.rows} erkannte Buchungen${totals.pdf?` · ${totals.credits} Einnahmen · ${totals.debits} Ausgaben · ${totals.pages} PDF-Seiten`:''}${totals.ambiguous?` · ${totals.ambiguous} unklare Zeilen übersprungen`:''}${pdfWarning}`;
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
  if (['transactionEditAmount','transactionEditDate','transactionEditOtherAmount'].includes(target.id)) {
    syncTransactionTransferEditor();
    return;
  }
  if (target.id === 'transactionEditVehicleName' || target.id === 'transactionCreateVehicleName') {
    const field=document.querySelector(target.id==='transactionEditVehicleName'?'#transactionEditVehicleTypeField':'#transactionCreateVehicleTypeField');
    if(field) field.hidden=!String(target.value||'').trim();
    return;
  }
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
  if (target.id === 'merchantSearch') {
    uiState.merchantQuery = target.value; render();
    const next = document.querySelector('#merchantSearch'); if (next) { next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
    return;
  }
  if (target.id === 'globalSearchInput') {
    uiState.searchQuery=target.value; render();
    const next=document.querySelector('#globalSearchInput'); if(next){ next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
    return;
  }
  if (target.id === 'transactionSearch') {
    uiState.transactionQuery=target.value; uiState.transactionPage=1; render();
    const next=document.querySelector('#transactionSearch'); if(next){ next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
  }
});

async function enterApp(session,{freshLogin=false}={}) {
  runtime.session=session;
  runtime.user=session.user;
  ensureSessionClock({fresh:freshLogin});
  authGate.hidden=true;
  appShell.hidden=false;
  showLoading();
  const releaseCurrent=await ensureCurrentRelease();
  if(!releaseCurrent) return;
  const compatible=await ensureRuntimeCompatibility();
  if(!compatible) return;
  try {
    await loadContext();
    const visitPreferences=profilePreferences();
    const previousVisit=visitPreferences.last_visit_at||null;
    const previousTs=previousVisit?new Date(previousVisit).getTime():0;
    runtime.previousVisitAt=previousVisit;
    // A quick refresh should not erase the useful "since last visit" window.
    if(!previousTs || Date.now()-previousTs>30*60*1000){
      const nextVisitAt=new Date().toISOString();
      const nextPreferences={...visitPreferences,last_visit_at:nextVisitAt};
      void financeApi.updateProfile(runtime.user.id,{preferences:nextPreferences}).then((profile)=>{ runtime.profile=profile; }).catch(()=>{});
    }
    // Profile preference is authoritative after login, but keep it locally for pre-profile session checks.
    persistNumber(SESSION_KEYS.timeout,configuredSessionTimeout());
    render();
    startLiveTimers();
  } catch (error) {
    pageContent.innerHTML=`<div class="inline-alert"><strong>Daten konnten nicht geladen werden.</strong><span>${escapeHtml(humanError(error))}</span></div>`;
  }
}

window.addEventListener('hashchange',()=>{ render(); void pulsePresence(); });
document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState==='hidden'){
    hiddenAt=Date.now();
    if(runtime.user) await pulsePresence({force:true,stateOverride:'idle'});
    return;
  }
  const awayMs=hiddenAt?Date.now()-hiddenAt:0;
  hiddenAt=null;
  if(!runtime.user) return;
  if(await enforceSessionGuard()) return;
  if(!(await ensureCurrentRelease())) return;
  if(!(await ensureRuntimeCompatibility())) return;
  if(awayMs>=BACKGROUND_REFRESH_MS){
    try {
      showLoading('Daten werden synchronisiert …');
      await loadContext();
      render();
    } catch(error){
      pageContent.innerHTML=`<div class="inline-alert"><strong>Daten konnten nicht aktualisiert werden.</strong><span>${escapeHtml(humanError(error))}</span></div>`;
    }
  }
  await pulsePresence();
});
window.addEventListener('scroll', syncMobileScrollState, { passive: true });
window.addEventListener('resize',()=>{ syncMobileScrollState(); closeProfileMenu(); });
store.subscribe((state)=>{ setTheme(state.theme); document.documentElement.dataset.depth=state.depth; });

themeButton?.addEventListener('click',cycleTheme);
searchButton?.addEventListener('click',()=>{ location.hash='#/search'; });
privacyButton?.addEventListener('click',async()=>{ try { await saveUserPreferences({ privacy_enabled: !privacyEnabled() }); render(); showToast(privacyEnabled() ? 'Privatsphäre-Modus aktiviert.' : 'Finanzwerte wieder sichtbar.'); } catch (error) { showToast(humanError(error),'error'); } });
mobileMenuButton?.addEventListener('click',()=>{ const open=!document.body.classList.contains('mobile-nav-open'); document.body.classList.toggle('mobile-nav-open',open); mobileMenuButton.setAttribute('aria-expanded',String(open)); mobileScrim.hidden=!open; });
mobileScrim?.addEventListener('click',closeMobileNav);
mobileNav?.addEventListener('click',(event)=>{ if (event.target.closest('#mobileQuickAddButton')) { event.preventDefault(); openQuickAdd(); } });
quickAddScrim?.addEventListener('click',closeQuickAdd);
quickAddSheet?.addEventListener('click',(event)=>{
  if (event.target.closest('[data-quick-add-close]')) { closeQuickAdd(); return; }
  if (event.target.closest('a.quick-add-option')) closeQuickAdd();
});
document.addEventListener('keydown',(event)=>{ markInteraction(); if (event.key === 'Escape') { closeQuickAdd(); closeMobileNav(); } });
for(const eventName of ['pointerdown','touchstart','wheel']){
  document.addEventListener(eventName,()=>markInteraction(),{passive:true});
}
mobileLogoutButton?.addEventListener('click',async()=>{ try { await logoutCurrentUser(); } catch (error) { showToast(humanError(error),'error'); } });
profileButton?.addEventListener('click',(event)=>{ event.stopPropagation(); toggleProfileMenu(); });
document.addEventListener('click',(event)=>{ if (!event.target.closest('#profilePopover') && !event.target.closest('#profileButton')) closeProfileMenu(); });
document.addEventListener('click',async(event)=>{ const target=event.target.closest('#profilePopover [data-action]'); if (!target) return; try { await handleAction(target); } catch (error) { showToast(humanError(error),'error'); } });

hydrateStaticIcons();
applyReleaseChannelUI();
setTheme(store.getState().theme);
document.documentElement.dataset.depth=store.getState().depth;
applyPrivacyUI();
syncMobileScrollState();
const initialReleaseCurrent=await ensureCurrentRelease();
if(initialReleaseCurrent){
  const restored=await backend.restoreSession();
  if(restored?.user) await enterApp(restored); else { clearSessionClock(); showAuth(); }
}
window.__FINANCE_BOOT_COMPLETE__ = true;
