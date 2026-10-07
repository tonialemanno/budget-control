import { pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { accountShare } from '../app/finance-insights.js';

function moduleVisible(key, moduleAccess, hiddenModules) {
  if (['core','money'].includes(key)) return true;
  return moduleAccess?.[key] === true && !hiddenModules.includes(key);
}

function accountTypeLabel(type) {
  return ({
    checking:'Zahlungskonto',savings:'Sparkonto',cash:'Bargeld',credit_card:'Kreditkarte',
    wallet:'Onlinekonto / Wallet',investment:'Investmentkonto',pension:'Vorsorgekonto',other:'Sonstiges',
  })[type] || type || 'Konto';
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
  household, profile, fxRates, moduleAccess = {}, hiddenModules = [], canWrite=false,
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const liquidTypes = new Set(['checking','savings','cash','wallet']);
  const liquid = accounts.filter((a)=>liquidTypes.has(a.account_type))
    .reduce((sum,a)=>sum + (convertAmount(a.current_balance,a.currency,currency,fxRates) ?? 0),0);
  const recent = transactions.filter((tx)=>tx.status === 'booked').slice(0,6);
  const shares=accountShare(accounts,currency,fxRates);
  const accountMap=new Map(shares.map((row)=>[row.account.account_id,row.share]));

  const cards = [
    hubCard({ href:'#/transactions', iconName:'list', title:'Alle Transaktionen', text:'Einnahmen, Ausgaben und Umbuchungen', meta:`${transactions.length} Buchung${transactions.length===1?'':'en'}` }),
    hubCard({ href:'#/imports', iconName:'arrow-down-left', title:'Bankdaten importieren', text:'CSV und Kontoauszüge einlesen', meta:importBatches.length?`${importBatches.length} Import${importBatches.length===1?'':'s'}`:'Noch kein Import' }),
    hubCard({ href:'#/documents', iconName:'receipt', title:'Dokumente & Belege', text:'Belege und Finanzdokumente', meta:`${documents.length} Dokument${documents.length===1?'':'e'}` }),
    hubCard({ href:'#/projects', iconName:'folder', title:'Anlässe & Projekte', text:'Scheidung, Ferien, Umzug oder andere zusammengehörende Kosten' }),
    hubCard({ href:'#/categories', iconName:'layout-grid', title:'Kategorien & Händler', text:'Automatische Zuordnung konfigurieren' }),
  ];

  if (moduleVisible('debts',moduleAccess,hiddenModules)) {
    cards.push(hubCard({ href:'#/debts', iconName:'credit-card', title:'Schulden & Kredite', text:'Restschulden, Raten und Zahlungen', meta:`${debts.filter((d)=>d.status!=='paid').length} offen` }));
    cards.push(hubCard({ href:'#/receivables', iconName:'banknote', title:'Forderungen', text:'Verliehenes Geld und Rückzahlungen', meta:`${receivables.filter((r)=>r.status!=='paid').length} offen` }));
  }
  if (moduleVisible('legal',moduleAccess,hiddenModules)) {
    cards.push(hubCard({ href:'#/legal', iconName:'shield', title:'Mahnungen & Betreibungen', text:'Offene Fälle und Verlauf' }));
  }

  return `
    ${pageHeader({
      title:'Geld',
      subtitle:'Konten und Geldbewegungen an einem Ort. Jede Aktion erzeugt oder filtert dieselben Transaktionen, die auch Übersicht, Budget und weitere Module verwenden.',
      actions:canWrite?'<a class="action-button action-button--primary" href="#/accounts?create=account">'+icon('plus')+' Konto</a>':''
    })}

    <article class="card card--accent wallet-summary-card">
      <div><span class="hero-label">Verfügbar · ${currency}</span><div class="hero-value">${money(liquid,{currency,locale})}</div><span class="hero-caption">${accounts.length} Konten · ${fxLabel(fxRates,currency)}</span></div>
      <div class="wallet-summary-actions">
        ${canWrite?'<a class="action-button action-button--primary" href="#/transactions?create=expense">'+icon('plus')+' Ausgabe</a>':''}
        ${canWrite?'<a class="action-button action-button--secondary" href="#/transactions?create=income">Einnahme</a>':''}
        ${canWrite&&accounts.length>1?'<a class="action-button action-button--secondary" href="#/transactions?create=transfer">Umbuchen</a>':''}
      </div>
    </article>

    ${sectionHeading('Meine Geldbörsen','Direkte Aktionen pro Konto')}
    <div class="wallet-card-grid">
      ${accounts.length ? accounts.map((account)=>{
        const share=accountMap.get(account.account_id)||0;
        const balanceBase=convertAmount(account.current_balance,account.currency,currency,fxRates);
        return `<article class="card wallet-card">
          <div class="wallet-card-head">
            <span class="wallet-card-icon">${icon(account.account_type==='cash'?'banknote':'wallet')}</span>
            <div><strong>${escapeHtml(account.name)}</strong><span>${escapeHtml(account.institution_name||accountTypeLabel(account.account_type))} · ${escapeHtml(account.currency)}</span></div>
            <a class="icon-button wallet-edit-link" href="#/accounts" aria-label="Konten verwalten">${icon('settings')}</a>
          </div>
          <div class="wallet-card-balance">${money(account.current_balance,{currency:account.currency,locale})}</div>
          ${account.currency!==currency&&balanceBase!==null?`<div class="wallet-card-base">≈ ${money(balanceBase,{currency,locale})}</div>`:''}
          <div class="insight-track wallet-share-track"><span style="--insight-progress:${Math.max(0,Math.min(100,share))}%"></span></div>
          <div class="wallet-card-actions">
            ${canWrite?`<a href="#/transactions?create=income&account=${account.account_id}"><span>${icon('arrow-down-left')}</span>Hinzufügen</a>`:''}
            ${canWrite?`<a href="#/transactions?create=expense&account=${account.account_id}"><span>${icon('arrow-up-right')}</span>Abziehen</a>`:''}
            ${canWrite&&accounts.length>1?`<a href="#/transactions?create=transfer&account=${account.account_id}"><span>${icon('repeat')}</span>Umbuchen</a>`:''}
            <a href="#/transactions?account=${account.account_id}"><span>${icon('chart')}</span>Bericht</a>
          </div>
        </article>`;
      }).join('') : `<article class="card onboarding-empty"><span class="onboarding-empty-icon">${icon('wallet')}</span><div><h3>Noch keine Geldbörse.</h3><p>Lege dein erstes Konto mit dem heutigen Kontostand an.</p></div>${canWrite?'<a class="action-button action-button--primary" href="#/accounts?create=account">Konto anlegen</a>':''}</article>`}
    </div>

    ${sectionHeading('Geld verwalten','Weitere Bereiche, wenn du sie brauchst')}
    <div class="hub-grid">${cards.join('')}</div>

    ${sectionHeading('Letzte Bewegungen','Die jüngsten Buchungen aus allen Konten','<a class="card-link" href="#/transactions">Alle ansehen</a>')}
    <article class="card card-padding">${recent.length ? `<div class="list">${recent.map((tx)=>transactionRow(tx,{locale})).join('')}</div>` : '<div class="table-empty">Noch keine Transaktionen. Nutze das Plus, um die erste Bewegung zu erfassen.</div>'}</article>
  `;
}
