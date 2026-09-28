import { MODULES, NAV_ITEMS, PAGE_META } from './app/config.js';
import { store } from './app/store.js';
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
};

const pageContent = document.querySelector('#pageContent');
const pageTitle = document.querySelector('#pageTitle');
const pageEyebrow = document.querySelector('#pageEyebrow');
const desktopNav = document.querySelector('#desktopNav');
const mobileNav = document.querySelector('#mobileNav');
const themeButton = document.querySelector('#themeButton');
const mobileMenuButton = document.querySelector('#mobileMenuButton');
const mobileScrim = document.querySelector('#mobileScrim');

function enabledNavItems() {
  return NAV_ITEMS.filter((item) => MODULES[item.module]?.enabled !== false);
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

function render() {
  const state = store.getState();
  const route = resolveRoute();

  const meta = PAGE_META[route] || PAGE_META.overview;
  pageTitle.textContent = meta.title;
  pageEyebrow.textContent = meta.eyebrow;
  document.title = `${meta.title} · Finance`;

  const renderer = views[route] || views.overview;
  pageContent.innerHTML = renderer({ ...state });

  document.querySelectorAll('[data-route]').forEach((el) => {
    if (el.dataset.route === route) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  bindPageControls();
  closeMobileNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
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
}

renderNavigation();
hydrateStaticIcons();
setTheme(store.getState().theme);
render();

window.addEventListener('hashchange', render);
store.subscribe((state) => {
  setTheme(state.theme);
  if (resolveRoute() === 'settings' || resolveRoute() === 'overview') render();
});

themeButton.addEventListener('click', cycleTheme);
mobileMenuButton.addEventListener('click', () => {
  const open = !document.body.classList.contains('mobile-nav-open');
  document.body.classList.toggle('mobile-nav-open', open);
  mobileMenuButton.setAttribute('aria-expanded', String(open));
  mobileScrim.hidden = !open;
});
mobileScrim.addEventListener('click', closeMobileNav);
