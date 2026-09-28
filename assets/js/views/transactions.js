import { money, dateLabel, dateTimeLocalValue, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { emptyState, pageHeader } from '../app/components.js';

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

export function renderTransactions({ accounts = [], categories = [], transactions = [], household } = {}) {
  const currency = household?.base_currency || 'CHF';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRows = transactions.filter((tx) => new Date(tx.occurred_at) >= monthStart && tx.status === 'booked');
  const income = monthRows.filter((tx) => Number(tx.amount) > 0).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenses = Math.abs(monthRows.filter((tx) => Number(tx.amount) < 0).reduce((sum, tx) => sum + Number(tx.amount), 0));

  const categoryOptions = categories.map((category) =>
    `<option value="${category.id}">${escapeHtml(category.name)} · ${category.kind === 'income' ? 'Einnahme' : 'Ausgabe'}</option>`
  ).join('');

  return `
    ${pageHeader({
      title: 'Transaktionen',
      subtitle: 'Einnahmen und Ausgaben manuell erfassen. Kategorien können direkt hier neu angelegt werden.',
    })}

    <div class="page-actions">
      <button class="action-button action-button--primary" id="transactionFormToggle" type="button" ${accounts.length ? '' : 'disabled'}>${icon('plus')} Transaktion erfassen</button>
      <button class="action-button action-button--secondary" id="categoryFormToggle" type="button">${icon('plus')} Kategorie</button>
    </div>

    ${accounts.length ? '' : `
      <div class="inline-alert">
        <strong>Zuerst ein Konto erfassen.</strong>
        <span>Eine Transaktion benötigt ein Zielkonto.</span>
      </div>`}

    <form class="card card-padding form-card" id="transactionForm" hidden>
      <div class="card-heading">
        <div><h3 class="card-title">Neue Transaktion</h3><p class="card-subtitle">Manuelle Buchung</p></div>
      </div>

      <div class="form-grid form-grid--2">
        <label class="field">
          <span>Typ</span>
          <select class="text-control" name="direction" required>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>

        <label class="field">
          <span>Betrag</span>
          <input class="text-control" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required placeholder="0.00">
        </label>

        <label class="field">
          <span>Konto</span>
          <select class="text-control" name="accountId" required>
            ${accounts.map((account) => `<option value="${account.account_id}">${escapeHtml(account.name)} · ${escapeHtml(account.currency)}</option>`).join('')}
          </select>
        </label>

        <label class="field">
          <span>Datum / Zeit</span>
          <input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}">
        </label>

        <label class="field form-grid-span">
          <span>Beschreibung</span>
          <input class="text-control" name="description" autocomplete="off" required placeholder="z. B. Migros">
        </label>

        <label class="field">
          <span>Kategorie</span>
          <select class="text-control" name="categoryId">
            <option value="">Ohne Kategorie</option>
            ${categoryOptions}
          </select>
        </label>

        <label class="field">
          <span>Gegenpartei</span>
          <input class="text-control" name="counterparty" autocomplete="off" placeholder="optional">
        </label>
      </div>

      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">Transaktion speichern</button>
        <button class="action-button action-button--secondary" id="transactionFormCancel" type="button">Abbrechen</button>
      </div>
    </form>

    <form class="card card-padding form-card" id="categoryForm" hidden>
      <div class="card-heading">
        <div><h3 class="card-title">Neue Kategorie</h3><p class="card-subtitle">Direkt verfügbar für neue Transaktionen</p></div>
      </div>

      <div class="form-grid form-grid--2">
        <label class="field">
          <span>Name</span>
          <input class="text-control" name="name" autocomplete="off" required placeholder="z. B. Lebensmittel">
        </label>
        <label class="field">
          <span>Art</span>
          <select class="text-control" name="kind" required>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
      </div>

      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">Kategorie speichern</button>
        <button class="action-button action-button--secondary" id="categoryFormCancel" type="button">Abbrechen</button>
      </div>
    </form>

    <div class="metric-grid" style="margin-bottom:16px">
      <article class="card metric-card"><div class="metric-label">Einnahmen</div><div class="metric-value">${money(income, { currency })}</div><div class="metric-note">aktueller Monat</div></article>
      <article class="card metric-card"><div class="metric-label">Ausgaben</div><div class="metric-value">${money(expenses, { currency })}</div><div class="metric-note">aktueller Monat</div></article>
      <article class="card metric-card"><div class="metric-label">Saldo</div><div class="metric-value">${money(income - expenses, { currency })}</div><div class="metric-note ${income - expenses >= 0 ? 'metric-note--positive' : 'metric-note--warning'}">aktueller Monat</div></article>
    </div>

    <article class="card card-padding">
      ${transactions.length
        ? `<div class="list">${transactions.map(transactionRow).join('')}</div>`
        : emptyState('list', 'Noch keine Transaktionen', 'Erfasse deine erste Einnahme oder Ausgabe.')}
    </article>
  `;
}
