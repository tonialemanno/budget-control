import { demoData } from '../app/demo-data.js';
import { money } from '../app/format.js';
import { demoBanner, pageHeader } from '../app/components.js';

function chartPath(values) {
  const width = 720, height = 180, pad = 10;
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)[0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
  return { line, area };
}

export function renderWealth() {
  const { line, area } = chartPath(demoData.wealthSeries);
  const gross = demoData.assets.reduce((sum, item) => sum + item.value, 0);
  return `
    ${pageHeader({ title: 'Vermögen', subtitle: 'Vermögenswerte und Verbindlichkeiten werden getrennt geführt; das Nettovermögen ist nur das Ergebnis daraus.' })}
    ${demoBanner()}
    <div class="grid-main-aside">
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Nettovermögen</h3><p class="card-subtitle">12-Monats-Demo</p></div><span class="status-pill status-pill--positive">+6.0 %</span></div>
        <div class="hero-value" style="font-size:42px">${money(demoData.summary.netWorth)}</div>
        <div class="chart-shell"><svg class="sparkline" viewBox="0 0 720 180" preserveAspectRatio="none"><g class="chart-grid"><line x1="0" x2="720" y1="45" y2="45"/><line x1="0" x2="720" y1="90" y2="90"/><line x1="0" x2="720" y1="135" y2="135"/></g><path class="area" d="${area}"/><path class="line" d="${line}"/></svg></div>
        <div class="chart-labels"><span>Okt 25</span><span>Jan 26</span><span>Apr 26</span><span>Jul 26</span><span>Sep 26</span></div>
      </article>
      <div class="stack">
        <article class="card card-padding"><div class="metric-label">Vermögenswerte</div><div class="metric-value">${money(gross)}</div><div class="metric-note">Liquidität, Rücklagen, Sachwerte</div></article>
        <article class="card card-padding"><div class="metric-label">Verbindlichkeiten</div><div class="metric-value">${money(demoData.liabilities)}</div><div class="metric-note">aktive Schulden und Kredite</div></article>
      </div>
    </div>
    <div class="section-heading"><div><h2>Zusammensetzung</h2><p>V1 Demo</p></div></div>
    <div class="grid-3">${demoData.assets.map(a => `<article class="card metric-card"><div class="metric-label">${a.label}</div><div class="metric-value">${money(a.value, { decimals: 0 })}</div><div class="metric-note">Vermögenswert</div></article>`).join('')}</div>`;
}
