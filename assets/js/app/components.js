import { icon } from './icons.js';
import { money, progress } from './format.js';

export function pageHeader({ kicker = 'Montag, 28. September', title, subtitle = '' }) {
  return `
    <header class="page-header">
      <p class="page-kicker">${kicker}</p>
      <h2 class="page-heading">${title}</h2>
      ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
    </header>`;
}

export function demoBanner() {
  return `
    <div class="banner">
      <div class="banner-copy">
        <span class="banner-icon">${icon('info')}</span>
        <div><strong>V1 Style-Prototyp</strong><p>Alle Beträge auf dieser Oberfläche sind Demonstrationsdaten.</p></div>
      </div>
      <span class="badge">Demo</span>
    </div>`;
}

export function sectionHeading(title, subtitle = '', link = '') {
  return `
    <div class="section-heading">
      <div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      ${link ? `<a class="card-link" href="${link}">Alle anzeigen</a>` : ''}
    </div>`;
}

export function accountCard(account) {
  const positive = account.change >= 0;
  return `
    <article class="card account-card">
      <div class="account-card-head">
        <div><div class="account-name">${account.name}</div><div class="account-kind">${account.provider} · ${account.type}</div></div>
        <span class="list-row-leading">${icon(account.icon)}</span>
      </div>
      <div class="account-balance">${money(account.balance)}</div>
      <div class="account-change"><strong>${positive ? '+' : ''}${money(account.change)}</strong> diesen Monat</div>
    </article>`;
}

export function transactionRow(tx) {
  const positive = tx.amount >= 0;
  return `
    <div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading ${positive ? 'list-row-leading--green' : ''}">${icon(tx.icon)}</span>
        <div><div class="list-row-title">${tx.title}</div><div class="list-row-meta">${tx.category} · ${tx.account} · ${tx.date}</div></div>
      </div>
      <div class="list-row-trailing"><div class="amount ${positive ? 'amount--positive' : 'amount--negative'}">${positive ? '+' : ''}${money(tx.amount)}</div></div>
    </div>`;
}

export function upcomingRow(item) {
  const positive = item.amount >= 0;
  return `
    <div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading ${positive ? 'list-row-leading--green' : 'list-row-leading--orange'}">${icon(item.icon)}</span>
        <div><div class="list-row-title">${item.title}</div><div class="list-row-meta">${item.meta} · ${item.state}</div></div>
      </div>
      <div class="list-row-trailing"><div class="amount ${positive ? 'amount--positive' : ''}">${positive ? '+' : ''}${money(item.amount)}</div></div>
    </div>`;
}

export function budgetItem(item) {
  const pct = progress(item.spent, item.limit);
  const tone = pct >= 90 ? 'progress-fill--red' : pct >= 75 ? 'progress-fill--orange' : '';
  return `
    <div class="budget-item">
      <div class="budget-head"><strong>${item.name}</strong><span>${money(item.spent)} / ${money(item.limit)}</span></div>
      <div class="progress-track"><div class="progress-fill ${tone}" style="--progress:${pct.toFixed(1)}%"></div></div>
      <div class="progress-meta"><span>${pct.toFixed(0)} % genutzt</span><strong>${money(item.limit - item.spent)} frei</strong></div>
    </div>`;
}

export function goalCard(goal) {
  const pct = progress(goal.current, goal.target);
  return `
    <article class="card card-padding">
      <div class="card-heading"><div><h3 class="card-title">${goal.name}</h3><p class="card-subtitle">Ziel: ${goal.due}</p></div><span class="status-pill status-pill--positive">${pct.toFixed(0)} %</span></div>
      <div class="metric-value">${money(goal.current)}</div>
      <div class="progress-track" style="margin-top:16px"><div class="progress-fill progress-fill--green" style="--progress:${pct.toFixed(1)}%"></div></div>
      <div class="progress-meta"><span>Gespart</span><strong>Ziel ${money(goal.target)}</strong></div>
    </article>`;
}

export function emptyState(iconName, title, text) {
  return `<div class="card empty-state"><span class="empty-state-icon">${icon(iconName)}</span><h3>${title}</h3><p>${text}</p></div>`;
}
