import { MODULES, NAV_ITEMS, PAGE_META } from './app/config.js';
import { store } from './app/store.js';
import { backend } from './app/backend.js';
import { financeApi } from './app/finance-api.js';
import { escapeHtml } from './app/format.js';
import { icon, hydrateStaticIcons } from './app/icons.js';
import { renderOverview } from './views/overview.js';
import { renderAccounts } from './views/accounts.js';
import { renderTransactions } from './views/transactions.js';
import { renderBudget } from './views/budget.js';
import { renderBills } from './views/bills.js';
import { renderGoals } from './views/goals.js';
import { renderDebts } from './views/debts.js';
import { renderWealth } from './views/wealth.js';
import { renderSettings } from './views/settings.js';
import { renderAdmin } from './views/admin.js';

const views = {
  overview: renderOverview,
  accounts: renderAccounts,
  transactions: renderTransactions,
  budget: renderBudget,
  bills: renderBills,
  goals: renderGoals,
  debts: renderDebts,
  wealth: renderWealth,
  settings: renderSettings,
  admin: renderAdmin,
};

const runtime = {
  session: null,
  user: null,
  profile: null,
  household: null,
  accounts: [],
  categories: [],
  transactions: [],
  adminRole: null,
  adminUsers: [],
};

const authGate = document.querySelector('#authGate');
const appShell = document.querySelector('#appShell');
const pageContent = document.querySelector('#pageContent');
const pageTitle = document.querySelector('#pageTitle');
const pageEyebrow = document.querySelector('#pageEyebrow');
const desktopNav = document.querySelector('#desktopNav');
const mobileNav = document.querySelector('#mobileNav');
const themeButton = document.querySelector('#themeButton');
const mobileMenuButton = document.querySelector('#mobileMenuButton');
const mobileScrim = document.querySelector('#mobileScrim');
const profileButton = document.querySelector('#profileButton');
const profileAvatar = document.querySelector('#profileAvatar');
const profileName = document.querySelector('#profileName');
const profileMeta = document.querySelector('#profileMeta');

function enabledNavItems() {
  return NAV_ITEMS.filter((item) =>
    MODULES[item.module]?.enabled !== false && (!item.adminOnly || Boolean(runtime.adminRole))
  );
}

function renderNavigation() {
  const items = enabledNavItems();
  const grouped = items.reduce((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  desktopNav.innerHTML = Object.entries(grouped).map(([group, links]) => `
    <div class="nav-group-label">${group}</div>
    ${links.map((item) => `<a class="nav-item" href="#/${item.route}" data-route="${item.route}">${icon(item.icon)}<span>${item.label}</span></a>`).join('')}
  `).join('');

  const mobileItems = items.filter((item) => item.mobile).slice(0, 5);
  mobileNav.innerHTML = mobileItems.map((item) => `<a href="#/${item.route}" data-route="${item.route}">${icon(item.icon)}<span>${item.label}</span></a>`).join('');
}

function resolveRoute() {
  const requested = (location.hash || '#/overview').replace(/^#\//, '').split('?')[0];
  const allowed = new Set([...enabledNavItems().map((item) => item.route), 'settings']);
  return allowed.has(requested) ? requested : 'overview';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const current = store.getState().theme;
  const next = order[(order.indexOf(current) + 1) % order.length];
  store.setState({ theme: next }, { persistPreferences: true });
}

function closeMobileNav() {
  document.body.classList.remove('mobile-nav-open');
  mobileMenuButton.setAttribute('aria-expanded', 'false');
  mobileScrim.hidden = true;
}

function countryLabel(code) {
  return code === 'DE' ? 'Deutschland' : 'Schweiz';
}

function updateProfileUI() {
  const fallbackName = runtime.user?.email?.split('@')[0] || 'Privat';
  const name = runtime.profile?.display_name || fallbackName;
  const initial = name.trim().charAt(0).toUpperCase() || 'F';

  profileAvatar.textContent = initial;
  profileName.textContent = name;
  profileMeta.textContent = runtime.household
    ? `${countryLabel(runtime.household.country_code)} · ${runtime.household.base_currency}`
    : runtime.user?.email || '';
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
  }, 3200);
}

function humanAuthError(error) {
  const message = String(error?.message || error || '');
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist nicht korrekt.';
  if (/email not confirmed/i.test(message)) return 'Dieser Benutzer ist noch nicht freigeschaltet.';
  return message || 'Die Anmeldung konnte nicht abgeschlossen werden.';
}

function showAuth(notice = '') {
  appShell.hidden = true;
  authGate.hidden = false;

  authGate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-mark" aria-hidden="true">${icon('wallet')}</span>
        <div><strong>Finance</strong><span>Finance Core V1.3</span></div>
      </div>
      <div class="auth-copy">
        <span class="eyebrow">Finance Core</span>
        <h1>Willkommen zurück</h1>
        <p>Benutzerkonten werden durch einen Administrator angelegt.</p>
      </div>
      ${notice ? `<div class="inline-alert inline-alert--success">${escapeHtml(notice)}</div>` : ''}
      <form class="auth-form" id="authForm">
        <label class="field">
          <span>E-Mail</span>
          <input class="text-control" name="email" type="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span>Passwort</span>
          <input class="text-control" name="password" type="password" autocomplete="current-password" minlength="8" required>
        </label>
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
      const result = await backend.signIn({
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
      });
      await enterApp({ ...result, user: result.user });
    } catch (error) {
      errorBox.textContent = humanAuthError(error);
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

function showLoading(title = 'Daten werden geladen …') {
  pageTitle.textContent = 'Finance';
  pageEyebrow.textContent = 'Finance Core';
  pageContent.innerHTML = `
    <div class="loading-state">
      <span class="loading-spinner" aria-hidden="true"></span>
      <strong>${escapeHtml(title)}</strong>
    </div>`;
}

async function loadFinanceData() {
  if (!runtime.household) return;

  const householdId = runtime.household.id;
  const [accounts, categories, transactions] = await Promise.all([
    financeApi.listAccounts(householdId),
    financeApi.listCategories(householdId),
    financeApi.listTransactions(householdId),
  ]);

  runtime.accounts = accounts || [];
  runtime.categories = categories || [];
  runtime.transactions = transactions || [];
}

async function loadContext() {
  runtime.profile = await financeApi.getProfile(runtime.user.id);
  runtime.adminRole = await financeApi.getAdminRole(runtime.user.id);
  runtime.adminUsers = [];

  if (runtime.adminRole) {
    const adminResult = await backend.adminListUsers();
    runtime.adminUsers = adminResult?.users || [];
  }

  const households = await financeApi.listHouseholds();
  runtime.household = households?.[0] || null;

  if (runtime.household) {
    await loadFinanceData();
  } else {
    runtime.accounts = [];
    runtime.categories = [];
    runtime.transactions = [];
  }

  updateProfileUI();
}

function renderSetup() {
  desktopNav.innerHTML = '';
  mobileNav.innerHTML = '';
  pageTitle.textContent = 'Einrichtung';
  pageEyebrow.textContent = 'Finance Core';
  document.title = 'Einrichtung · Finance';

  const displayName = runtime.profile?.display_name || '';

  pageContent.innerHTML = `
    <header class="page-header">
      <p class="page-kicker">Einmalige Grundeinrichtung</p>
      <h2 class="page-heading">Dein neuer Finance Core</h2>
      <p class="page-subtitle">Land und Basiswährung werden zentral gespeichert. Länderlogik bleibt dadurch getrennt und kann später sauber erweitert werden.</p>
    </header>

    <form class="card card-padding setup-card" id="setupForm">
      <div class="form-grid form-grid--2">
        <label class="field">
          <span>Anzeigename</span>
          <input class="text-control" name="displayName" value="${escapeHtml(displayName)}" required>
        </label>
        <label class="field">
          <span>Haushalt</span>
          <input class="text-control" name="householdName" value="Privat" required>
        </label>
        <label class="field">
          <span>Land</span>
          <select class="text-control" name="countryCode" id="countryCode" required>
            <option value="CH">Schweiz</option>
            <option value="DE">Deutschland</option>
          </select>
        </label>
        <label class="field">
          <span>Basiswährung</span>
          <select class="text-control" name="baseCurrency" id="baseCurrency" required>
            <option value="CHF">CHF</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>
      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">Finance Core starten</button>
      </div>
    </form>`;

  const country = document.querySelector('#countryCode');
  const currency = document.querySelector('#baseCurrency');
  country?.addEventListener('change', () => {
    currency.value = country.value === 'DE' ? 'EUR' : 'CHF';
  });

  document.querySelector('#setupForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    const countryCode = String(data.get('countryCode'));
    const baseCurrency = String(data.get('baseCurrency'));

    submit.disabled = true;
    try {
      runtime.profile = await financeApi.updateProfile(runtime.user.id, {
        display_name: String(data.get('displayName') || '').trim(),
        country_code: countryCode,
        base_currency: baseCurrency,
        locale: countryCode === 'DE' ? 'de-DE' : 'de-CH',
        onboarding_completed_at: new Date().toISOString(),
      });

      runtime.household = await financeApi.createHousehold({
        name: String(data.get('householdName') || '').trim(),
        countryCode,
        baseCurrency,
        ownerUserId: runtime.user.id,
      });

      await loadFinanceData();
      renderNavigation();
      updateProfileUI();
      location.hash = '#/overview';
      render();
      showToast('Finance Core wurde eingerichtet.');
    } catch (error) {
      showToast(error.message || 'Einrichtung fehlgeschlagen.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function render() {
  if (!runtime.user) return;
  if (!runtime.household) {
    renderSetup();
    return;
  }

  renderNavigation();

  const state = store.getState();
  const route = resolveRoute();

  const meta = PAGE_META[route] || PAGE_META.overview;
  pageTitle.textContent = meta.title;
  pageEyebrow.textContent = meta.eyebrow;
  document.title = `${meta.title} · Finance`;

  const renderer = views[route] || views.overview;
  pageContent.innerHTML = renderer({
    ...state,
    ...runtime,
  });

  document.querySelectorAll('[data-route]').forEach((el) => {
    if (el.dataset.route === route) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  bindPageControls();
  closeMobileNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function refreshAndRender(message = '') {
  await loadFinanceData();
  render();
  if (message) showToast(message);
}

function bindPageControls() {
  const themeSelect = document.querySelector('#themeSelect');
  const depthSelect = document.querySelector('#depthSelect');

  themeSelect?.addEventListener('change', (event) => {
    store.setState({ theme: event.target.value }, { persistPreferences: true });
  });

  depthSelect?.addEventListener('change', (event) => {
    store.setState({ depth: event.target.value }, { persistPreferences: true });
  });

  const accountForm = document.querySelector('#accountForm');
  document.querySelector('#accountFormToggle')?.addEventListener('click', () => {
    accountForm.hidden = !accountForm.hidden;
    if (!accountForm.hidden) accountForm.querySelector('input[name="name"]')?.focus();
  });
  document.querySelector('#accountFormCancel')?.addEventListener('click', () => {
    accountForm.hidden = true;
  });
  accountForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    submit.disabled = true;

    try {
      await financeApi.createAccount({
        household_id: runtime.household.id,
        name: String(data.get('name') || '').trim(),
        account_type: String(data.get('accountType')),
        institution_name: String(data.get('institutionName') || '').trim() || null,
        currency: String(data.get('currency')),
        balance_anchor_amount: Number(data.get('balance') || 0),
        balance_anchor_at: new Date().toISOString(),
      });
      await refreshAndRender('Konto wurde gespeichert.');
    } catch (error) {
      showToast(error.message || 'Konto konnte nicht gespeichert werden.', 'error');
      submit.disabled = false;
    }
  });

  const transactionForm = document.querySelector('#transactionForm');
  document.querySelector('#transactionFormToggle')?.addEventListener('click', () => {
    if (!transactionForm) return;
    transactionForm.hidden = !transactionForm.hidden;
    if (!transactionForm.hidden) transactionForm.querySelector('input[name="amount"]')?.focus();
  });
  document.querySelector('#transactionFormCancel')?.addEventListener('click', () => {
    transactionForm.hidden = true;
  });
  transactionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    const accountId = String(data.get('accountId'));
    const account = runtime.accounts.find((item) => item.account_id === accountId);
    const rawAmount = Math.abs(Number(data.get('amount') || 0));
    const amount = data.get('direction') === 'income' ? rawAmount : -rawAmount;
    submit.disabled = true;

    try {
      await financeApi.createTransaction({
        household_id: runtime.household.id,
        account_id: accountId,
        category_id: String(data.get('categoryId') || '') || null,
        occurred_at: new Date(String(data.get('occurredAt'))).toISOString(),
        amount,
        currency: account?.currency || runtime.household.base_currency,
        description: String(data.get('description') || '').trim(),
        counterparty: String(data.get('counterparty') || '').trim() || null,
        status: 'booked',
        source: 'manual',
      });
      await refreshAndRender('Transaktion wurde gespeichert.');
    } catch (error) {
      showToast(error.message || 'Transaktion konnte nicht gespeichert werden.', 'error');
      submit.disabled = false;
    }
  });

  const categoryForm = document.querySelector('#categoryForm');
  document.querySelector('#categoryFormToggle')?.addEventListener('click', () => {
    if (!categoryForm) return;
    categoryForm.hidden = !categoryForm.hidden;
    if (!categoryForm.hidden) categoryForm.querySelector('input[name="name"]')?.focus();
  });
  document.querySelector('#categoryFormCancel')?.addEventListener('click', () => {
    categoryForm.hidden = true;
  });
  categoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    submit.disabled = true;

    try {
      await financeApi.createCategory({
        household_id: runtime.household.id,
        name: String(data.get('name') || '').trim(),
        kind: String(data.get('kind')),
      });
      await refreshAndRender('Kategorie wurde gespeichert.');
    } catch (error) {
      showToast(error.message || 'Kategorie konnte nicht gespeichert werden.', 'error');
      submit.disabled = false;
    }
  });

  const adminUserForm = document.querySelector('#adminUserForm');
  adminUserForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    submit.disabled = true;

    try {
      await backend.adminCreateUser({
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
        displayName: String(data.get('displayName') || '').trim(),
      });
      const adminResult = await backend.adminListUsers();
      runtime.adminUsers = adminResult?.users || [];
      render();
      showToast('Benutzer wurde erstellt und ist sofort freigeschaltet.');
    } catch (error) {
      showToast(error.message || 'Benutzer konnte nicht erstellt werden.', 'error');
      submit.disabled = false;
    }
  });
}

async function enterApp(session) {
  runtime.session = session;
  runtime.user = session.user;

  authGate.hidden = true;
  appShell.hidden = false;
  showLoading();

  try {
    await loadContext();
    render();
  } catch (error) {
    showToast(error.message || 'Daten konnten nicht geladen werden.', 'error');
    pageContent.innerHTML = `
      <div class="inline-alert">
        <strong>Daten konnten nicht geladen werden.</strong>
        <span>${escapeHtml(error.message || '')}</span>
      </div>`;
  }
}

async function bootstrap() {
  hydrateStaticIcons();
  setTheme(store.getState().theme);

  const restored = await backend.restoreSession();
  if (!restored?.user) {
    showAuth();
    return;
  }

  await enterApp(restored);
}

window.addEventListener('hashchange', render);

store.subscribe((state) => {
  setTheme(state.theme);
  if (runtime.user && runtime.household && (resolveRoute() === 'settings' || resolveRoute() === 'overview')) {
    render();
  }
});

themeButton.addEventListener('click', cycleTheme);

mobileMenuButton.addEventListener('click', () => {
  const open = !document.body.classList.contains('mobile-nav-open');
  document.body.classList.toggle('mobile-nav-open', open);
  mobileMenuButton.setAttribute('aria-expanded', String(open));
  mobileScrim.hidden = !open;
});

mobileScrim.addEventListener('click', closeMobileNav);

profileButton.addEventListener('click', async () => {
  if (!window.confirm('Von Finance abmelden?')) return;
  await backend.signOut();
  runtime.session = null;
  runtime.user = null;
  runtime.profile = null;
  runtime.household = null;
  runtime.accounts = [];
  runtime.categories = [];
  runtime.transactions = [];
  runtime.adminRole = null;
  runtime.adminUsers = [];
  showAuth();
});

bootstrap();
