import { demoData } from '../app/demo-data.js';
import { money, percent, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { accountCard, budgetItem, demoBanner, pageHeader, sectionHeading, upcomingRow } from '../app/components.js';

export function renderOverview({ depth = 'standard' } = {}) {
  const d = demoData;
  const simple = depth === 'simple';
  const expert = depth === 'expert';

  return `
    ${pageHeader({ kicker: shortDate(), title: 'Deine Finanzen auf einen Blick', subtitle: 'Wichtige Informationen zuerst. Details bleiben dort, wo du sie brauchst.' })}
    ${demoBanner()}

    <div class="grid-hero">
      <article class="card card--accent hero-card">
        <div>
          <div class="hero-label">Verfügbar bis Monatsende</div>
          <div class="hero-value">${money(d.summary.availableMonth, { decimals: 0 })}</div>
          <div class="hero-caption"><strong>Im Plan</strong> · nach Fixkosten und Rückstellungen</div>
        </div>
        <div class="hero-actions">
          <a class="action-button action-button--primary" href="#/budget">${icon('chart')} Budget ansehen</a>
          <a class="action-button action-button--secondary" href="#/transactions">${icon('list')} Bewegungen</a>
        </div>
      </article>

      <div class="metric-grid">
        <article class="card metric-card"><div class="metric-label">Liquidität</div><div class="metric-value">${money(d.summary.totalCash, { decimals: 0 })}</div><div class="metric-note">über alle Konten</div></article>
        <article class="card metric-card"><div class="metric-label">Nettovermögen</div><div class="metric-value">${money(d.summary.netWorth, { decimals: 0 })}</div><div class="metric-note metric-note--positive">+ CHF 1'970 seit August</div></article>
        ${simple ? '' : `<article class="card metric-card"><div class="metric-label">Sparquote</div><div class="metric-value">${percent(d.summary.savingsRate, 0)}</div><div class="metric-note">aktueller Monat</div></article>`}
        ${expert ? `<article class="card metric-card"><div class="metric-label">Rückstellungen</div><div class="metric-value">${money(d.summary.reserves, { decimals: 0 })}</div><div class="metric-note">für bekannte Verpflichtungen</div></article>` : ''}
      </div>
    </div>

    ${sectionHeading('Mein Geld', 'Konten und Bargeld', '#/accounts')}
    <div class="grid-3">${d.accounts.map(accountCard).join('')}</div>

    <div class="grid-main-aside" style="margin-top:16px">
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Demnächst</h3><p class="card-subtitle">Nächste erwartete Zahlungen</p></div><a class="card-link" href="#/bills">Rechnungen</a></div>
        <div class="list">${d.upcoming.slice(0, simple ? 3 : 4).map(upcomingRow).join('')}</div>
      </article>
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Budget September</h3><p class="card-subtitle">Variable Kategorien</p></div><a class="card-link" href="#/budget">Details</a></div>
        ${d.budgets.slice(0, simple ? 2 : 4).map(budgetItem).join('')}
      </article>
    </div>
  `;
}
