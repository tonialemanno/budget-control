import { money, shortDate, dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { emptyState, pageHeader, sectionHeading } from '../app/components.js';

function accountTypeLabel(type) {
  return {
    checking: 'Zahlungskonto',
    savings: 'Sparkonto',
    cash: 'Bargeld',
    investment: 'Investment',
    pension: 'Vorsorge',
    other: 'Konto',
  }[type] || 'Konto';
}

function accountCard(account) {
  return `
    <article class="card account-card">
      <div class="account-card-head">
        <div>
          <div class="account-name">${escapeHtml(account.name)}</div>
          <div class="account-kind">${escapeHtml(account.institution_name || accountTypeLabel(account.account_type))}</div>
        </div>
        <span class="list-row-leading">${icon(account.account_type === 'cash' ? 'banknote' : 'wallet')}</span>
      </div>
      <div class="account-balance">${money(account.current_balance, { currency: account.currency })}</div>
      <div class="account-change">Stand ab ${dateLabel(account.balance_anchor_at)}</div>
    </article>`;
}

function transactionRow(tx) {
  const positive = Number(tx.amount) >= 0;
  return `
    <div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading ${positive ? 'list-row-leading--green' : ''}">${icon(positive ? 'arrow-down-left' : 'arrow-up-right')}</span>
        <div>
          <div class="list-row-title">${escapeHtml(tx.description)}</div>
          <div class="list-row-meta">${escapeHtml(tx.categories?.name || 'Ohne Kategorie')} · ${escapeHtml(tx.accounts?.name || '')} · ${dateLabel(tx.occurred_at)}</div>
        </div>
      </div>
      <div class="list-row-trailing">
        <div class="amount ${positive ? 'amount--positive' : 'amount--negative'}">${money(tx.amount, { sign: positive, currency: tx.currency })}</div>
      </div>
    </div>`;
}

export function renderOverview({ accounts = [], transactions = [], household } = {}) {
  const currency = household?.base_currency || 'CHF';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const liquidAccounts = accounts.filter((account) => ['checking', 'savings', 'cash'].includes(account.account_type));
  const liquidity = liquidAccounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0);

  const monthTransactions = transactions.filter((tx) => new Date(tx.occurred_at) >= monthStart && tx.status === 'booked');
  const income = monthTransactions.filter((tx) => Number(tx.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenses = Math.abs(monthTransactions.filter((tx) => Number(tx.amount) < 0).reduce((sum, tx) => sum + Number(tx.amount), 0));
  const cashflow = income - expenses;

  return `
    ${pageHeader({
      kicker: shortDate(),
      title: 'Deine Finanzen auf einen Blick',
      subtitle: 'Live-Daten aus deinem Finance Core. Historische Importe verändern einen ausdrücklich gesetzten aktuellen Kontostand nicht rückwirkend.',
    })}

    <div class="grid-hero">
      <article class="card card--accent hero-card">
        <div>
          <div class="hero-label">Liquidität</div>
          <div class="hero-value">${money(liquidity, { decimals: 0, currency })}</div>
          <div class="hero-caption">${liquidAccounts.length} aktive ${liquidAccounts.length === 1 ? 'Geldquelle' : 'Geldquellen'}</div>
        </div>
        <div class="hero-actions">
          <a class="action-button action-button--primary" href="#/accounts">${icon('plus')} Konto erfassen</a>
          <a class="action-button action-button--secondary" href="#/transactions">${icon('list')} Transaktionen</a>
        </div>
      </article>

      <div class="metric-grid">
        <article class="card metric-card">
          <div class="metric-label">Einnahmen</div>
          <div class="metric-value">${money(income, { decimals: 0, currency })}</div>
          <div class="metric-note">aktueller Monat</div>
        </article>
        <article class="card metric-card">
          <div class="metric-label">Ausgaben</div>
          <div class="metric-value">${money(expenses, { decimals: 0, currency })}</div>
          <div class="metric-note">aktueller Monat</div>
        </article>
        <article class="card metric-card">
          <div class="metric-label">Cashflow</div>
          <div class="metric-value">${money(cashflow, { decimals: 0, currency })}</div>
          <div class="metric-note ${cashflow >= 0 ? 'metric-note--positive' : 'metric-note--warning'}">${cashflow >= 0 ? 'positiv' : 'negativ'}</div>
        </article>
      </div>
    </div>

    ${sectionHeading('Mein Geld', 'Konten und Bargeld', '#/accounts')}
    ${accounts.length
      ? `<div class="grid-3">${accounts.slice(0, 6).map(accountCard).join('')}</div>`
      : emptyState('wallet', 'Noch kein Konto', 'Erfasse deinen aktuellen Kontostand. Dieser wird als verbindlicher Stand ab jetzt gespeichert.')}

    ${sectionHeading('Letzte Bewegungen', 'Die zuletzt erfassten Transaktionen', '#/transactions')}
    <article class="card card-padding">
      ${transactions.length
        ? `<div class="list">${transactions.slice(0, 6).map(transactionRow).join('')}</div>`
        : `<div class="empty-state empty-state--compact"><span class="empty-state-icon">${icon('list')}</span><h3>Noch keine Transaktionen</h3><p>Neue Buchungen erscheinen hier sofort.</p></div>`}
    </article>
  `;
}
