import { metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';

function moduleVisible(key, moduleAccess, hiddenModules) {
  if (['core','money'].includes(key)) return true;
  return moduleAccess?.[key] === true && !hiddenModules.includes(key);
}

function hubCard({ href, iconName, title, text, meta = '' }) {
  return `<a class="card hub-link-card" href="${href}">
    <span class="hub-link-icon">${icon(iconName)}</span>
    <span class="hub-link-copy"><strong>${title}</strong><span>${text}</span>${meta ? `<small>${meta}</small>` : ''}</span>
    <span class="hub-link-chevron">${icon('chevron-right')}</span>
  </a>`;
}

export function renderMoney({
  accounts = [], transactions = [], documents = [], debts = [], receivables = [], importBatches = [],
  household, profile, fxRates, moduleAccess = {}, hiddenModules = [],
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const liquidTypes = new Set(['checking','savings','cash','wallet']);
  const liquid = accounts.filter((a)=>liquidTypes.has(a.account_type))
    .reduce((sum,a)=>sum + (convertAmount(a.current_balance,a.currency,currency,fxRates) ?? 0),0);
  const recent = transactions.filter((tx)=>tx.status === 'booked').slice(0,5);

  const cards = [
    hubCard({ href:'#/accounts', iconName:'wallet', title:'Konten & Geldbörsen', text:'Bankkonten, Bargeld und Fremdwährungen', meta:`${accounts.length} Konto${accounts.length===1?'':'en'}` }),
    hubCard({ href:'#/transactions', iconName:'list', title:'Transaktionen', text:'Einnahmen, Ausgaben und Umbuchungen', meta:`${transactions.length} Buchung${transactions.length===1?'':'en'}` }),
    hubCard({ href:'#/imports', iconName:'arrow-down-left', title:'Bankdaten importieren', text:'CSV und Kontoauszüge einlesen', meta:importBatches.length?`${importBatches.length} Import${importBatches.length===1?'':'s'}`:'Noch kein Import' }),
    hubCard({ href:'#/documents', iconName:'receipt', title:'Dokumente & Belege', text:'Belege und Finanzdokumente', meta:`${documents.length} Dokument${documents.length===1?'':'e'}` }),
  ];

  if (moduleVisible('debts',moduleAccess,hiddenModules)) {
    cards.push(hubCard({ href:'#/debts', iconName:'credit-card', title:'Schulden & Kredite', text:'Restschulden, Raten und Zahlungen', meta:`${debts.filter((d)=>d.status!=='paid').length} offen` }));
    cards.push(hubCard({ href:'#/receivables', iconName:'banknote', title:'Forderungen', text:'Verliehenes Geld und Rückzahlungen', meta:`${receivables.filter((r)=>r.status!=='paid').length} offen` }));
  }
  if (moduleVisible('legal',moduleAccess,hiddenModules)) {
    cards.push(hubCard({ href:'#/legal', iconName:'shield', title:'Mahnungen & Betreibungen', text:'Offene Fälle und Verlauf' }));
  }

  return `
    ${pageHeader({title:'Geld',subtitle:'Alles, was dein Geld tatsächlich bewegt. Konten und Buchungen bleiben die gemeinsame Datenbasis.'})}
    <div class="grid-hero">
      <article class="card hero-card card--accent">
        <div>
          <div class="hero-label">Verfügbar · ${currency}</div>
          <div class="hero-value">${money(liquid,{currency,locale})}</div>
          <div class="hero-caption">${accounts.length} Konten · ${fxLabel(fxRates,currency)}</div>
        </div>
        <div class="hero-actions">
          <a class="action-button action-button--primary" href="#/transactions?create=expense">${icon('plus')} Ausgabe</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=income">Einnahme</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=transfer">Umbuchung</a>
        </div>
      </article>
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Schnellzugriff</h3><p class="card-subtitle">Die wichtigsten Zahlen aus deinem Geldbereich</p></div></div>
        <div class="hub-mini-grid">
          ${metricCard('Konten',String(accounts.length),'aktive Geldquellen')}
          ${metricCard('Buchungen',String(transactions.length),'im Journal')}
          ${metricCard('Belege',String(documents.length),'gespeichert')}
        </div>
      </article>
    </div>

    ${sectionHeading('Mein Geld','Öffne nur den Bereich, den du gerade brauchst.')}
    <div class="hub-grid">${cards.join('')}</div>

    ${sectionHeading('Letzte Bewegungen','Die jüngsten Buchungen aus allen Konten','<a class="card-link" href="#/transactions">Alle ansehen</a>')}
    <article class="card card-padding">${recent.length ? `<div class="list">${recent.map((tx)=>transactionRow(tx,{locale})).join('')}</div>` : '<div class="table-empty">Noch keine Transaktionen. Nutze das Plus, um die erste Bewegung zu erfassen.</div>'}</article>
  `;
}
