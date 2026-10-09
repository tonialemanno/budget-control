import { icon } from './icons.js';
import { dateLabel, escapeHtml, money, progress } from './format.js';
import { t } from './i18n.js';

export function pageHeader({ kicker = '', title, subtitle = '', actions = '' }) {
  return `
    <header class="page-header page-header--actions">
      <div>
        ${kicker ? `<p class="page-kicker">${escapeHtml(t(kicker))}</p>` : ''}
        <h2 class="page-heading">${escapeHtml(t(title))}</h2>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(t(subtitle))}</p>` : ''}
      </div>
      ${actions ? `<div class="page-header-actions">${actions}</div>` : ''}
    </header>`;
}

export function sectionHeading(title, subtitle = '', action = '') {
  return `
    <div class="section-heading">
      <div><h2>${escapeHtml(t(title))}</h2>${subtitle ? `<p>${escapeHtml(t(subtitle))}</p>` : ''}</div>
      ${action}
    </div>`;
}

export function emptyState(iconName, title, text, action = '') {
  return `<div class="card empty-state"><span class="empty-state-icon">${icon(iconName)}</span><h3>${escapeHtml(t(title))}</h3><p>${escapeHtml(t(text))}</p>${action ? `<div class="empty-state-action">${action}</div>` : ''}</div>`;
}

export function formShell(id, title, subtitle, fields, { hidden = true, submitLabel = 'Speichern', extraActions = '' } = {}) {
  return `
    <form class="card card-padding form-card" id="${id}" data-form="${id}" ${hidden ? 'hidden' : ''}>
      <div class="card-heading"><div><h3 class="card-title">${escapeHtml(t(title))}</h3><p class="card-subtitle">${escapeHtml(t(subtitle))}</p></div></div>
      <div class="form-grid form-grid--2">${fields}</div>
      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">${escapeHtml(t(submitLabel))}</button>
        <button class="action-button action-button--secondary" type="button" data-action="hide-form" data-target="${id}">${escapeHtml(t('Abbrechen'))}</button>
        ${extraActions}
      </div>
    </form>`;
}

export function metricCard(label, value, note = '', tone = '') {
  return `<article class="card metric-card"><div class="metric-label">${escapeHtml(t(label))}</div><div class="metric-value">${value}</div>${note ? `<div class="metric-note ${tone ? `metric-note--${tone}` : ''}">${escapeHtml(t(note))}</div>` : ''}</article>`;
}

function mobileLabelTableRow(row, headers = []) {
  let index = 0;
  return String(row).replace(/<td(\s[^>]*)?>/g, (match, attrs = '') => {
    const label = headers[index++] || '';
    return `<td${attrs || ''} data-label="${escapeHtml(t(label))}">`;
  });
}

export function dataTable({ headers, rows, emptyText = 'Noch keine Daten vorhanden.' }) {
  if (!rows?.length) return `<div class="table-empty">${escapeHtml(t(emptyText))}</div>`;
  const labelledRows = rows.map((row) => mobileLabelTableRow(row, headers));
  return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(t(h))}</th>`).join('')}</tr></thead><tbody>${labelledRows.join('')}</tbody></table></div>`;
}

export function filePicker({ id, name = 'file', accept = '', capture = '', required = false, disabled = false, multiple = false, label = 'Datei auswählen' } = {}) {
  const safeId = escapeHtml(id || 'file-picker');
  const attrs = [
    `id="${safeId}"`,
    `name="${escapeHtml(name)}"`,
    'type="file"',
    'class="file-picker__input"',
    'data-file-picker',
    accept ? `accept="${escapeHtml(accept)}"` : '',
    capture ? `capture="${escapeHtml(capture)}"` : '',
    required ? 'required' : '',
    disabled ? 'disabled' : '',
    multiple ? 'multiple' : '',
  ].filter(Boolean).join(' ');
  return `<span class="file-picker">
    <input ${attrs}>
    <label class="file-picker__button" for="${safeId}">${escapeHtml(t(label))}</label>
    <span class="file-picker__name" data-file-name>${escapeHtml(t('Keine Datei ausgewählt'))}</span>
  </span>`;
}

export function statusPill(status, label = '') {
  const normalized = String(status || '').toLowerCase();
  let tone = 'neutral';
  if (['paid','active','completed','booked','owner'].includes(normalized)) tone = 'positive';
  if (['open','pending','paused','viewer','editor','admin'].includes(normalized)) tone = 'warning';
  if (['overdue','defaulted','cancelled','failed'].includes(normalized)) tone = 'negative';
  return `<span class="status-pill status-pill--${tone}">${escapeHtml(t(label || status || '—'))}</span>`;
}

export function editButton(action, id, label = 'Bearbeiten') {
  return `<button class="table-action" type="button" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}">${escapeHtml(t(label))}</button>`;
}

export function accountCard(account, { locale = 'de-CH', canWrite = false, projection = null, isPrimary = false } = {}) {
  const typeLabel = ({
    checking:'Zahlungskonto', savings:'Sparkonto', cash:'Bargeld', credit_card:'Kreditkarte', wallet:'Onlinekonto / Wallet',
    investment:'Investmentkonto', pension:'Vorsorgekonto', other:'Sonstiges',
  })[account.account_type] || 'Konto';
  const localizedTypeLabel=t(typeLabel);
  const projectionHtml=projection ? `
    <div class="account-projection">
      <span>${escapeHtml(t('Prognose bis'))} ${new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(projection.targetDate)}</span>
      <strong>${money(projection.projectedBalance,{currency:account.currency,locale})}</strong>
      <small>${escapeHtml(t('Geplant'))} ${projection.monthlyNet>=0?'+':'−'}${money(Math.abs(projection.monthlyNet),{currency:account.currency,locale})} ${escapeHtml(t('/ Monat'))}</small>
    </div>` : '';
  return `
    <article class="card account-card">
      <div class="account-card-head">
        <div><div class="account-name">${escapeHtml(account.name)} ${isPrimary ? statusPill('active','Hauptkonto') : ''}</div><div class="account-kind">${escapeHtml(account.institution_name || localizedTypeLabel)} · ${t(account.visibility === 'household' ? 'Haushalt' : 'Privat')}</div></div>
        <span class="list-row-leading">${icon(account.account_type === 'cash' ? 'banknote' : 'wallet')}</span>
      </div>
      <div class="account-balance">${money(account.current_balance, { currency: account.currency, locale })}</div>
      <div class="account-change">${escapeHtml(account.currency)} · ${escapeHtml(t('Stand-Anker'))} ${dateLabel(account.balance_anchor_at, locale)}</div>
      ${projectionHtml}
      <div class="card-footer-actions">
        ${canWrite ? `<button class="table-action" type="button" data-action="account-edit" data-id="${escapeHtml(account.account_id)}">${escapeHtml(t('Bearbeiten / korrigieren'))}</button>` : ''}
        ${isPrimary ? '' : `<button class="table-action" type="button" data-action="account-set-primary" data-id="${escapeHtml(account.account_id)}">${escapeHtml(t('Als Hauptkonto festlegen'))}</button>`}
      </div>
    </article>`;
}

export function transactionRow(tx, { locale = 'de-CH', canWrite = false, interactive = false } = {}) {
  const positive = Number(tx.amount) >= 0;
  const transfer = Boolean(tx.transfer_group_id);
  const tag=interactive?'button':'div';
  const attrs=interactive
    ? ` type="button" data-action="overview-transaction-edit" data-id="${escapeHtml(tx.id)}" aria-label="Buchung öffnen und bearbeiten"`
    : '';
  return `
    <${tag} class="list-row transaction-row${interactive?' transaction-row--interactive':''}"${attrs}>
      <div class="list-row-main">
        <span class="list-row-leading ${positive ? 'list-row-leading--green' : ''}">${icon(transfer ? 'repeat' : positive ? 'arrow-down-left' : 'arrow-up-right')}</span>
        <div><div class="list-row-title">${escapeHtml(tx.description)}</div><div class="list-row-meta">${escapeHtml(tx.categories?.name || t(transfer ? 'Umbuchung' : 'Ohne Kategorie'))} · ${escapeHtml(tx.accounts?.name || '')} · ${dateLabel(tx.occurred_at, locale)}</div></div>
      </div>
      <div class="list-row-trailing">
        <div class="amount ${positive ? 'amount--positive' : 'amount--negative'}">${money(tx.amount, { sign: positive, currency: tx.currency, locale })}</div>
        ${canWrite ? `<div class="row-actions">${transfer ? '' : `<button class="table-action" type="button" data-action="transaction-edit" data-id="${escapeHtml(tx.id)}">${escapeHtml(t('Bearbeiten'))}</button><button class="table-action" type="button" data-action="transaction-make-recurring" data-id="${escapeHtml(tx.id)}">${escapeHtml(t('Wiederkehrend'))}</button>`}<button class="table-action table-action--danger" type="button" data-action="transaction-delete" data-id="${escapeHtml(tx.id)}">${escapeHtml(t(transfer ? 'Umbuchung löschen' : 'Löschen'))}</button></div>` : ''}
      </div>
    </${tag}>`;
}

export function goalProgress(goal, locale) {
  const pct = progress(goal.current_amount, goal.target_amount);
  return `<div class="progress-track"><div class="progress-fill progress-fill--green" style="--progress:${pct.toFixed(1)}%"></div></div><div class="progress-meta"><span>${pct.toFixed(0)} %</span><strong>${money(goal.current_amount,{currency:goal.currency,locale})} / ${money(goal.target_amount,{currency:goal.currency,locale})}</strong></div>`;
}

export function deleteButton(table, id, label = 'Löschen') {
  return `<button class="table-action table-action--danger" type="button" data-action="delete" data-table="${escapeHtml(table)}" data-id="${escapeHtml(id)}">${escapeHtml(t(label))}</button>`;
}
