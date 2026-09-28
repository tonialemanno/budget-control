import { demoData } from '../app/demo-data.js';
import { money } from '../app/format.js';
import { icon } from '../app/icons.js';
import { accountCard, demoBanner, pageHeader, sectionHeading, transactionRow } from '../app/components.js';

export function renderAccounts() {
  return `
    ${pageHeader({ title: 'Konten', subtitle: 'Ein ruhiger Überblick über verfügbare Mittel. Bankintegration, CSV und manuelle Konten können später dieselbe Oberfläche speisen.' })}
    ${demoBanner()}
    <div class="grid-3">${demoData.accounts.map(accountCard).join('')}</div>
    ${sectionHeading('Letzte Bewegungen', 'Über alle Konten', '#/transactions')}
    <article class="card card-padding">
      <div class="list">${demoData.transactions.slice(0, 5).map(transactionRow).join('')}</div>
    </article>
    <div class="grid-2" style="margin-top:16px">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Kontostand gesamt</h3><p class="card-subtitle">Liquidität ohne Vermögenswerte</p></div><span class="list-row-leading">${icon('wallet')}</span></div><div class="hero-value" style="font-size:36px">${money(demoData.summary.totalCash)}</div></article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Datenquellen</h3><p class="card-subtitle">V1 Architektur</p></div><span class="list-row-leading list-row-leading--green">${icon('shield')}</span></div><div class="chip-row"><span class="chip chip--active">Manuell</span><span class="chip">CSV</span><span class="chip">Banking Provider</span></div></article>
    </div>`;
}
