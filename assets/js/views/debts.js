import { demoData } from '../app/demo-data.js';
import { money } from '../app/format.js';
import { demoBanner, pageHeader } from '../app/components.js';

export function renderDebts() {
  const total = demoData.debts.reduce((sum, debt) => sum + debt.outstanding, 0);
  return `
    ${pageHeader({ title: 'Schulden', subtitle: 'Restschuld, Rate und nächste Zahlung stehen im Vordergrund. Detailanalysen können später ergänzt werden.' })}
    ${demoBanner()}
    <div class="grid-hero">
      <article class="card hero-card"><div><div class="hero-label">Offene Verbindlichkeiten</div><div class="hero-value">${money(total, { decimals: 0 })}</div><div class="hero-caption">über ${demoData.debts.length} aktive Verpflichtungen</div></div></article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Nächste Rate</h3><p class="card-subtitle">Privatkredit</p></div></div><div class="metric-value">${money(demoData.debts[0].next)}</div><div class="metric-note">fällig ${demoData.debts[0].due}</div></article>
    </div>
    <div class="section-heading"><div><h2>Aktive Verpflichtungen</h2><p>Kredite und Karten</p></div></div>
    <article class="card card-padding"><table class="data-table"><thead><tr><th>Verpflichtung</th><th>Zins</th><th>Nächste Zahlung</th><th>Restschuld</th></tr></thead><tbody>${demoData.debts.map((d) => `<tr><td><div class="table-title">${d.name}</div><div class="table-meta">${d.provider}</div></td><td>${d.rate.toFixed(1)} %</td><td>${money(d.next)} · ${d.due}</td><td class="amount">${money(d.outstanding)}</td></tr>`).join('')}</tbody></table></article>`;
}
