import { icon } from './icons.js';
import { dateLabel, escapeHtml, money, progress } from './format.js';

export function pageHeader({ kicker = '', title, subtitle = '', actions = '' }) {
  return `
    <header class="page-header page-header--actions">
      <div>
        ${kicker ? `<p class="page-kicker">${escapeHtml(kicker)}</p>` : ''}
        <h2 class="page-heading">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-header-actions">${actions}</div>` : ''}
    </header>`;
}

export function sectionHeading(title, subtitle = '', action = '') {
  return `
    <div class="section-heading">
      <div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
      ${action}
    </div>`;
}

export function emptyState(iconName, title, text, action = '') {
  return `<div class="card empty-state"><span class="empty-state-icon">${icon(iconName)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${action ? `<div class="empty-state-action">${action}</div>` : ''}</div>`;
}

export function formShell(id, title, subtitle, fields, { hidden = true, submitLabel = 'Speichern', extraActions = '' } = {}) {
  return `
    <form class="card card-padding form-card" id="${id}" data-form="${id}" ${hidden ? 'hidden' : ''}>
      <div class="card-heading"><div><h3 class="card-title">${escapeHtml(title)}</h3><p class="card-subtitle">${escapeHtml(subtitle)}</p></div></div>
      <div class="form-grid form-grid--2">${fields}</div>
      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">${escapeHtml(submitLabel)}</button>
        <button class="action-button action-button--secondary" type="button" data-action="hide-form" data-target="${id}">Abbrechen</button>
        ${extraActions}
      </div>
    </form>`;
}

export function metricCard(label, value, note = '', tone = '') {
  return `<article class="card metric-card"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${value}</div>${note ? `<div class="metric-note ${tone ? `metric-note--${tone}` : ''}">${escapeHtml(note)}</div>` : ''}</article>`;
}

export function dataTable({ headers, rows, emptyText = 'Noch keine Daten vorhanden.' }) {
  if (!rows?.length) return `<div class="table-empty">${escapeHtml(emptyText)}</div>`;
  return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function statusPill(status, label = '') {
  const normalized = String(status || '').toLowerCase();
  let tone = 'neutral';
  if (['paid','active','completed','booked','owner'].includes(normalized)) tone = 'positive';
  if (['open','pending','paused','viewer','editor','admin'].includes(normalized)) tone = 'warning';
  if (['overdue','defaulted','cancelled','failed'].includes(normalized)) tone = 'negative';
  return `<span class="status-pill status-pill--${tone}">${escapeHtml(label || status || '—')}</span>`;
}

export function accountCard(account, { locale = 'de-CH' } = {}) {
  const typeLabel = ({ checking:'Zahlungskonto', savings:'Sparkonto', cash:'Bargeld', credit_card:'Kreditkarte', investment:'Investmentkonto', pension:'Vorsorgekonto', other:'Sonstiges' })[account.account_type] || 'Konto';
  return `
    <article class="card account-card">
      <div class="account-card-head">
        <div><div class="account-name">${escapeHtml(account.name)}</div><div class="account-kind">${escapeHtml(account.institution_name || typeLabel)} · ${account.visibility === 'household' ? 'Haushalt' : 'Privat'}</div></div>
        <span class="list-row-leading">${icon(account.account_type === 'cash' ? 'banknote' : 'wallet')}</span>
      </div>
      <div class="account-balance">${money(account.current_balance, { currency: account.currency, locale })}</div>
      <div class="account-change">Stand-Anker: ${dateLabel(account.balance_anchor_at, locale)}</div>
    </article>`;
}

export function transactionRow(tx, { locale = 'de-CH' } = {}) {
  const positive = Number(tx.amount) >= 0;
  return `
    <div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading ${positive ? 'list-row-leading--green' : ''}">${icon(tx.transfer_group_id ? 'repeat' : positive ? 'arrow-down-left' : 'arrow-up-right')}</span>
        <div><div class="list-row-title">${escapeHtml(tx.description)}</div><div class="list-row-meta">${escapeHtml(tx.categories?.name || 'Ohne Kategorie')} · ${escapeHtml(tx.accounts?.name || '')} · ${dateLabel(tx.occurred_at, locale)}</div></div>
      </div>
      <div class="list-row-trailing"><div class="amount ${positive ? 'amount--positive' : 'amount--negative'}">${money(tx.amount, { sign: positive, currency: tx.currency, locale })}</div></div>
    </div>`;
}

export function goalProgress(goal, locale) {
  const pct = progress(goal.current_amount, goal.target_amount);
  return `<div class="progress-track"><div class="progress-fill progress-fill--green" style="--progress:${pct.toFixed(1)}%"></div></div><div class="progress-meta"><span>${pct.toFixed(0)} %</span><strong>${money(goal.current_amount,{currency:goal.currency,locale})} / ${money(goal.target_amount,{currency:goal.currency,locale})}</strong></div>`;
}

export function deleteButton(table, id, label = 'Löschen') {
  return `<button class="table-action table-action--danger" type="button" data-action="delete" data-table="${escapeHtml(table)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}
