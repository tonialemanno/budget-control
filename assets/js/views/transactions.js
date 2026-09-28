import { demoData } from '../app/demo-data.js';
import { money } from '../app/format.js';
import { demoBanner, pageHeader, transactionRow } from '../app/components.js';

export function renderTransactions() {
  return `
    ${pageHeader({ title: 'Transaktionen', subtitle: 'Einnahmen, Ausgaben und Umbuchungen in einer gemeinsamen, verständlichen Sicht.' })}
    ${demoBanner()}
    <div class="metric-grid" style="margin-bottom:16px">
      <article class="card metric-card"><div class="metric-label">Einnahmen</div><div class="metric-value">${money(demoData.summary.incomeMonth)}</div><div class="metric-note">September</div></article>
      <article class="card metric-card"><div class="metric-label">Ausgaben</div><div class="metric-value">${money(demoData.summary.spendingMonth)}</div><div class="metric-note">September</div></article>
      <article class="card metric-card"><div class="metric-label">Saldo</div><div class="metric-value">${money(demoData.summary.incomeMonth - demoData.summary.spendingMonth)}</div><div class="metric-note metric-note--positive">positiver Cashflow</div></article>
    </div>
    <article class="card card-padding"><div class="list">${demoData.transactions.map(transactionRow).join('')}</div></article>`;
}
