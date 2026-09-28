import { MODULES, NAV_ITEMS, PAGE_META } from './app/config.js';
import { store } from './app/store.js';
import { backend } from './app/backend.js';
import { financeApi } from './app/finance-api.js';
import { escapeHtml, dateTimeLocalValue } from './app/format.js';
import { icon, hydrateStaticIcons } from './app/icons.js';
import { parseCsv, guessMapping, rowToTransaction, applyCategoryRules, transactionFingerprint } from './app/csv-import.js';
import { countryConfig } from './country/index.js';

import { renderOverview } from './views/overview.js';
import { renderAccounts } from './views/accounts.js';
import { renderTransactions } from './views/transactions.js';
import { renderCategories } from './views/categories.js';
import { renderImports } from './views/imports.js';
import { renderRecurring } from './views/recurring.js';
import { renderDocuments } from './views/documents.js';
import { renderBudget } from './views/budget.js';
import { renderBills } from './views/bills.js';
import { renderGoals } from './views/goals.js';
import { renderDebts } from './views/debts.js';
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
  recurring: renderRecurring,
  documents: renderDocuments,
  budget: renderBudget,
  bills: renderBills,
  goals: renderGoals,
  debts: renderDebts,
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
  recurringRules: [],
  budgets: [],
  bills: [],
  contracts: [],
  goals: [],
  debts: [],
  legalCases: [],
  legalEvents: [],
  assets: [],
  properties: [],
  vehicles: [],
  insurance: [],
  investments: [],
  pensions: [],
  documents: [],
};

const csvState = { file: null, parsed: null };
const uiState = { adminQuery: '', adminPage: 1, adminExpandedUserId: null };

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
    .map((item) => `<a href="#/${item.route}" data-route="${item.route}">${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`).join('');
}

function resolveRoute() {
  const requested = (location.hash || '#/overview').replace(/^#\//, '').split('?')[0];
  const allowed = new Set([...enabledNavItems().map((item) => item.route), 'settings']);
  if (moduleEntitled('money')) allowed.add('categories');
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

function toggleProfileMenu() {
  const existing = document.querySelector('#profilePopover');
  if (existing) { closeProfileMenu(); return; }
  const popover = document.createElement('div');
  popover.id = 'profilePopover';
  popover.className = 'profile-popover';
  popover.innerHTML = profileMenuHtml();
  document.querySelector('.topbar-actions')?.appendChild(popover);
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
  return message;
}

function showAuth() {
  appShell.hidden = true;
  authGate.hidden = false;
  authGate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">${icon('wallet')}</span><div><strong>Finance</strong><span>Beta V2.2 · UI Foundation</span></div></div>
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
    financeApi.listImportBatches(h), financeApi.listRecurringRules(h), financeApi.listBudgets(h), financeApi.listBills(h), financeApi.listContracts(h),
    financeApi.listGoals(h), financeApi.listDebts(h), financeApi.listLegalCases(h), financeApi.listLegalEvents(h), financeApi.listAssets(h),
    financeApi.listProperties(h), financeApi.listVehicles(h), financeApi.listInsurance(h), financeApi.listInvestments(h), financeApi.listPensions(h),
    financeApi.listDocuments(h), financeApi.listHouseholdMembers(h),
  ]);
  [
    runtime.accounts, runtime.categories, runtime.categorizationRules, runtime.transactions,
    runtime.importBatches, runtime.recurringRules, runtime.budgets, runtime.bills, runtime.contracts,
    runtime.goals, runtime.debts, runtime.legalCases, runtime.legalEvents, runtime.assets,
    runtime.properties, runtime.vehicles, runtime.insurance, runtime.investments, runtime.pensions,
    runtime.documents, runtime.householdMembers,
  ] = results.map((value) => value || []);
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
      if (!['document-download','profile-close'].includes(el.dataset.action)) el.disabled = true;
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
    await financeApi.createHousehold({ name: formValue(data,'householdName'), countryCode, baseCurrency, ownerUserId: runtime.user.id });
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
    await financeApi.createTransaction({ household_id:h, account_id:formValue(data,'accountId'), category_id:nullValue(data,'categoryId'), occurred_at:new Date(formValue(data,'occurredAt')).toISOString(), amount, currency:account?.currency||currency, description:formValue(data,'description'), counterparty:nullValue(data,'counterparty'), note:nullValue(data,'note'), status:'booked', source:'manual' });
    await refresh('Transaktion gespeichert.'); return;
  }
  if (id === 'transaction-edit') {
    const transactionId=formValue(data,'transactionId');
    const tx=runtime.transactions.find((row)=>row.id===transactionId);
    if (!tx || tx.transfer_group_id) throw new Error('Diese Buchung kann nicht einzeln bearbeitet werden.');
    const account=runtime.accounts.find((a)=>a.account_id===formValue(data,'accountId'));
    if (!account) throw new Error('Konto wurde nicht gefunden.');
    const amount=Math.abs(numberValue(data,'amount'))*(formValue(data,'direction')==='expense'?-1:1);
    await financeApi.updateTransaction(transactionId,{ account_id:account.account_id, category_id:nullValue(data,'categoryId'), occurred_at:new Date(formValue(data,'occurredAt')).toISOString(), amount, currency:account.currency, description:formValue(data,'description'), counterparty:nullValue(data,'counterparty'), note:nullValue(data,'note') });
    await refresh('Transaktion korrigiert.'); return;
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
    await financeApi.upsertBudget({ household_id:h, category_id:formValue(data,'categoryId'), month_start:`${formValue(data,'month')}-01`, amount:numberValue(data,'amount') });
    await refresh('Budget gespeichert.'); return;
  }
  if (id === 'bill-create') {
    await financeApi.createBill({ household_id:h, account_id:nullValue(data,'accountId'), category_id:nullValue(data,'categoryId'), name:formValue(data,'name'), provider:nullValue(data,'provider'), amount:numberValue(data,'amount'), currency, due_date:formValue(data,'dueDate'), status:'open', reference:nullValue(data,'reference') });
    await refresh('Rechnung gespeichert.'); return;
  }
  if (id === 'contract-create') {
    await financeApi.createContract({ household_id:h, category_id:null, name:formValue(data,'name'), provider:nullValue(data,'provider'), contract_type:formValue(data,'contractType'), amount:numberValue(data,'amount'), currency, billing_cadence:formValue(data,'cadence'), next_payment_date:nullValue(data,'nextPaymentDate'), cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null, end_date:nullValue(data,'endDate'), status:'active' });
    await refresh('Vertrag gespeichert.'); return;
  }
  if (id === 'goal-create') {
    await financeApi.createGoal({ household_id:h, name:formValue(data,'name'), target_amount:numberValue(data,'targetAmount'), current_amount:numberValue(data,'currentAmount'), monthly_amount:numberValue(data,'monthlyAmount'), currency, target_date:nullValue(data,'targetDate'), goal_type:formValue(data,'goalType'), status:'active' });
    await refresh('Sparziel gespeichert.'); return;
  }
  if (id === 'debt-create') {
    await financeApi.createDebt({ household_id:h, debt_type:formValue(data,'debtType'), creditor:formValue(data,'creditor'), name:formValue(data,'name'), original_amount:numberValue(data,'originalAmount'), outstanding_amount:numberValue(data,'outstandingAmount'), currency, interest_rate:numberValue(data,'interestRate'), installment_amount:numberValue(data,'installmentAmount'), payment_cadence:'monthly', next_payment_date:nullValue(data,'nextPaymentDate'), status:'active' });
    await refresh('Schuld / Kredit gespeichert.'); return;
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
  if (id === 'vehicle-create') {
    await financeApi.createVehicle({ household_id:h, name:formValue(data,'name'), vehicle_type:formValue(data,'vehicleType'), current_value:numberValue(data,'currentValue'), currency, purchase_price:nullValue(data,'purchasePrice')?numberValue(data,'purchasePrice'):null, purchase_date:nullValue(data,'purchaseDate'), monthly_cost:numberValue(data,'monthlyCost') });
    await refresh('Fahrzeug gespeichert.'); return;
  }
  if (id === 'insurance-create') {
    await financeApi.createInsurance({ household_id:h, name:formValue(data,'name'), provider:nullValue(data,'provider'), policy_type:formValue(data,'policyType')||'other', premium_amount:numberValue(data,'premiumAmount'), currency, billing_cadence:formValue(data,'cadence'), next_payment_date:nullValue(data,'nextPaymentDate'), cancellation_notice_days:nullValue(data,'noticeDays')?numberValue(data,'noticeDays'):null, end_date:nullValue(data,'endDate'), status:'active' });
    await refresh('Versicherung gespeichert.'); return;
  }
  if (id === 'investment-create') {
    await financeApi.createInvestment({ household_id:h, name:formValue(data,'name'), investment_type:formValue(data,'investmentType'), symbol:nullValue(data,'symbol'), quantity:numberValue(data,'quantity'), cost_basis:numberValue(data,'costBasis'), current_value:numberValue(data,'currentValue'), currency, provider:nullValue(data,'provider') });
    await refresh('Investmentposition gespeichert.'); return;
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
    await financeApi.createDocument({ household_id:h, object_type:formValue(data,'objectType')||'general', name:file.name, storage_path:path, mime_type:file.type||'application/octet-stream', file_size:file.size, document_date:nullValue(data,'documentDate'), notes:nullValue(data,'notes') });
    await refresh('Dokument gespeichert.'); return;
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
  if (id === 'csv-import') {
    if (!csvState.parsed || !csvState.file) throw new Error('Bitte zuerst eine CSV-Datei auswählen.');
    const accountId = formValue(data,'accountId');
    const account = runtime.accounts.find((a)=>a.account_id===accountId);
    const mapping = { date:formValue(data,'mapDate'), description:formValue(data,'mapDescription'), counterparty:formValue(data,'mapCounterparty'), amount:formValue(data,'mapAmount'), debit:formValue(data,'mapDebit'), credit:formValue(data,'mapCredit') };
    if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)) throw new Error('Datum, Beschreibung und Betragsspalten müssen zugeordnet sein.');
    const payload = [];
    for (const row of csvState.parsed.rows) {
      const tx = rowToTransaction(row,mapping);
      if (!tx) continue;
      const categoryId = applyCategoryRules(tx,runtime.categorizationRules);
      const externalReference = await transactionFingerprint(accountId,tx);
      payload.push({ household_id:h, account_id:accountId, category_id:categoryId, occurred_at:tx.occurred_at, amount:tx.amount, currency:account?.currency||currency, description:tx.description, counterparty:tx.counterparty, status:'booked', source:'import', external_reference:externalReference });
    }
    const inserted = payload.length ? await financeApi.importTransactions(payload) : [];
    await financeApi.createImportBatch({ household_id:h, account_id:accountId, file_name:csvState.file.name, row_count:csvState.parsed.rows.length, imported_count:inserted.length, skipped_count:Math.max(0,payload.length-inserted.length), status:'completed' });
    csvState.file=null; csvState.parsed=null;
    await refresh(`${inserted.length} Transaktionen importiert.`); return;
  }
}

const deleteMap = {
  categories: (id)=>financeApi.deleteCategory(id), categorization_rules:(id)=>financeApi.deleteCategorizationRule(id), recurring_rules:(id)=>financeApi.deleteRecurringRule(id), budgets:(id)=>financeApi.deleteBudget(id), bills:(id)=>financeApi.deleteBill(id), contracts:(id)=>financeApi.deleteContract(id), savings_goals:(id)=>financeApi.deleteGoal(id), debts:(id)=>financeApi.deleteDebt(id), legal_cases:(id)=>financeApi.deleteLegalCase(id), assets:(id)=>financeApi.deleteAsset(id), properties:(id)=>financeApi.deleteProperty(id), vehicles:(id)=>financeApi.deleteVehicle(id), insurance_policies:(id)=>financeApi.deleteInsurance(id), investments:(id)=>financeApi.deleteInvestment(id), pension_accounts:(id)=>financeApi.deletePension(id),
};

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  const writeActions = new Set(['starter-categories','account-edit','transaction-edit','transaction-delete','delete','bill-paid','goal-progress','debt-balance','legal-event']);
  if (writeActions.has(action) && !canWriteHousehold()) throw new Error('Du hast für diesen Haushalt nur Leserechte.');
  if (action === 'show-form') { document.getElementById(target.dataset.target)?.removeAttribute('hidden'); return; }
  if (action === 'starter-categories') {
    const cfg = countryConfig(runtime.household?.country_code || 'CH');
    const existing = new Set(runtime.categories.map((c)=>`${c.kind}:${c.name.toLowerCase()}`));
    const missing = cfg.starterCategories.filter(([name,kind])=>!existing.has(`${kind}:${name.toLowerCase()}`));
    if (!missing.length) { showToast('Starter-Kategorien sind bereits vorhanden.'); return; }
    for (const [name,kind] of missing) await financeApi.createCategory({household_id:runtime.household.id,name,kind});
    await refresh(`${missing.length} Starter-Kategorien angelegt.`); return;
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
  if (action === 'logout') { await backend.signOut(); runtime.user=null; runtime.household=null; runtime.householdRole=null; closeProfileMenu(); location.hash=''; showAuth(); return; }
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
  if (action === 'transaction-edit') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if (!tx || tx.transfer_group_id) throw new Error('Umbuchungen werden als zusammengehöriges Paar behandelt und können nicht einzeln bearbeitet werden.');
    document.querySelector('#transactionEditId').value=tx.id;
    document.querySelector('#transactionEditDirection').value=Number(tx.amount)<0?'expense':'income';
    document.querySelector('#transactionEditAmount').value=Math.abs(Number(tx.amount));
    document.querySelector('#transactionEditAccount').value=tx.account_id;
    document.querySelector('#transactionEditDate').value=dateTimeLocalValue(new Date(tx.occurred_at));
    document.querySelector('#transactionEditDescription').value=tx.description||'';
    document.querySelector('#transactionEditCategory').value=tx.category_id||'';
    document.querySelector('#transactionEditCounterparty').value=tx.counterparty||'';
    document.querySelector('#transactionEditNote').value=tx.note||'';
    const form=document.querySelector('#transaction-edit'); form?.removeAttribute('hidden'); form?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if (action === 'transaction-delete') {
    if (!canWriteHousehold()) throw new Error('Du hast nur Leserechte.');
    const tx=runtime.transactions.find((row)=>row.id===target.dataset.id);
    if (!tx) throw new Error('Transaktion wurde nicht gefunden.');
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
  if (action === 'bill-paid') { await financeApi.updateBill(target.dataset.id,{status:'paid'}); await refresh('Rechnung als bezahlt markiert.'); return; }
  if (action === 'goal-progress') {
    const value=prompt('Aktueller Stand des Sparziels:',target.dataset.current||'0'); if (value===null) return;
    const n=Number(value); if (!Number.isFinite(n)||n<0) throw new Error('Ungültiger Betrag.');
    const goal=runtime.goals.find((g)=>g.id===target.dataset.id); await financeApi.updateGoal(target.dataset.id,{current_amount:n,status:goal&&n>=Number(goal.target_amount)?'completed':'active'}); await refresh('Sparziel aktualisiert.'); return;
  }
  if (action === 'debt-balance') {
    const value=prompt('Neue Restschuld:',target.dataset.current||'0'); if (value===null) return;
    const n=Number(value); if (!Number.isFinite(n)||n<0) throw new Error('Ungültiger Betrag.');
    await financeApi.updateDebt(target.dataset.id,{outstanding_amount:n,status:n===0?'paid':'active'}); await refresh('Restschuld aktualisiert.'); return;
  }
  if (action === 'legal-event') {
    const caseId=target.dataset.id; const title=prompt('Ereignis / Titel:'); if (!title) return;
    const type=prompt('Typ des Ereignisses:','Notiz')||'Notiz'; const notes=prompt('Notiz (optional):','')||null;
    await financeApi.createLegalEvent({case_id:caseId,household_id:runtime.household.id,event_date:new Date().toISOString().slice(0,10),event_type:type,title,notes}); await refresh('Timeline-Ereignis gespeichert.'); return;
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
    if (target.name === 'kind' && target.closest('#category-create')) {
      const parent = target.closest('form')?.querySelector('[name="parentId"]');
      if (parent) {
        [...parent.options].forEach((option)=>{ if (!option.value) return; option.hidden = option.dataset.kind !== target.value; option.disabled = option.dataset.kind !== target.value; });
        if (parent.selectedOptions[0]?.disabled) parent.value = '';
      }
      return;
    }
    if (target.id === 'csvFile') {
      const file=target.files?.[0]; if (!file) return;
      const parsed=parseCsv(await file.text()); if (!parsed.headers.length) throw new Error('Keine CSV-Kopfzeile erkannt.');
      csvState.file=file; csvState.parsed=parsed;
      const guess=guessMapping(parsed.headers);
      fillSelect(document.querySelector('#mapDate'),parsed.headers,guess.date,false);
      fillSelect(document.querySelector('#mapDescription'),parsed.headers,guess.description,false);
      fillSelect(document.querySelector('#mapCounterparty'),parsed.headers,guess.counterparty,true);
      fillSelect(document.querySelector('#mapAmount'),parsed.headers,guess.amount,true);
      fillSelect(document.querySelector('#mapDebit'),parsed.headers,guess.debit,true);
      fillSelect(document.querySelector('#mapCredit'),parsed.headers,guess.credit,true);
      document.querySelector('#csvPreviewMeta').textContent=`${parsed.rows.length} Datenzeilen · Trennzeichen ${parsed.delimiter==='\t'?'Tab':parsed.delimiter}`;
      document.querySelector('#csvMapping').hidden=false;
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
  if (target.id !== 'adminUserSearch') return;
  uiState.adminQuery = target.value;
  uiState.adminPage = 1;
  uiState.adminExpandedUserId = null;
  render();
  const next = document.querySelector('#adminUserSearch');
  if (next) {
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  }
});

async function enterApp(session) {
  runtime.session=session; runtime.user=session.user;
  authGate.hidden=true; appShell.hidden=false; showLoading();
  try { await loadContext(); render(); }
  catch (error) { pageContent.innerHTML=`<div class="inline-alert"><strong>Daten konnten nicht geladen werden.</strong><span>${escapeHtml(humanError(error))}</span></div>`; }
}

window.addEventListener('hashchange',render);
store.subscribe((state)=>{ setTheme(state.theme); document.documentElement.dataset.depth=state.depth; });

themeButton?.addEventListener('click',cycleTheme);
privacyButton?.addEventListener('click',async()=>{ try { await saveUserPreferences({ privacy_enabled: !privacyEnabled() }); render(); showToast(privacyEnabled() ? 'Privatsphäre-Modus aktiviert.' : 'Finanzwerte wieder sichtbar.'); } catch (error) { showToast(humanError(error),'error'); } });
mobileMenuButton?.addEventListener('click',()=>{ const open=!document.body.classList.contains('mobile-nav-open'); document.body.classList.toggle('mobile-nav-open',open); mobileMenuButton.setAttribute('aria-expanded',String(open)); mobileScrim.hidden=!open; });
mobileScrim?.addEventListener('click',closeMobileNav);
profileButton?.addEventListener('click',(event)=>{ event.stopPropagation(); toggleProfileMenu(); });
document.addEventListener('click',(event)=>{ if (!event.target.closest('#profilePopover') && !event.target.closest('#profileButton')) closeProfileMenu(); });
document.addEventListener('click',async(event)=>{ const target=event.target.closest('#profilePopover [data-action]'); if (!target) return; try { await handleAction(target); } catch (error) { showToast(humanError(error),'error'); } });

hydrateStaticIcons();
setTheme(store.getState().theme);
document.documentElement.dataset.depth=store.getState().depth;
applyPrivacyUI();
const restored = await backend.restoreSession();
if (restored?.user) await enterApp(restored); else showAuth();
