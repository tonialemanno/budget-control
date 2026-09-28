import { demoData } from '../app/demo-data.js';
import { demoBanner, pageHeader, upcomingRow } from '../app/components.js';
import { icon } from '../app/icons.js';

export function renderBills() {
  return `
    ${pageHeader({ title: 'Rechnungen', subtitle: 'Kommende Verpflichtungen zuerst. Verträge und Dokumente können später mit denselben Objekten verknüpft werden.' })}
    ${demoBanner()}
    <div class="grid-main-aside">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Nächste Zahlungen</h3><p class="card-subtitle">September / Oktober</p></div></div><div class="list">${demoData.upcoming.map(upcomingRow).join('')}</div></article>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Status</h3><p class="card-subtitle">Verpflichtungen</p></div><span class="list-row-leading list-row-leading--orange">${icon('receipt')}</span></div><div class="metric-value">3</div><div class="metric-note">Zahlungen in den nächsten 7 Tagen</div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Dokumente</h3><p class="card-subtitle">V1 Platzhalter</p></div><span class="list-row-leading">${icon('shield')}</span></div><p class="card-subtitle">Dokumentablage und QR-Rechnungsparser werden später als eigene Services angebunden.</p></article>
      </div>
    </div>`;
}
