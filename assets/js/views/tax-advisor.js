import { dataTable, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';

const CH_CANTONS = [
  ['AG','Aargau'],['AI','Appenzell Innerrhoden'],['AR','Appenzell Ausserrhoden'],['BE','Bern'],['BL','Basel-Landschaft'],['BS','Basel-Stadt'],['FR','Freiburg'],['GE','Genf'],['GL','Glarus'],['GR','Graubünden'],['JU','Jura'],['LU','Luzern'],['NE','Neuenburg'],['NW','Nidwalden'],['OW','Obwalden'],['SG','St. Gallen'],['SH','Schaffhausen'],['SO','Solothurn'],['SZ','Schwyz'],['TG','Thurgau'],['TI','Tessin'],['UR','Uri'],['VD','Waadt'],['VS','Wallis'],['ZG','Zug'],['ZH','Zürich'],
];

export function renderTaxAdvisor({ transactions = [], debtPayments = [], documents = [], household, profile, fxRates, taxYear, canWrite=false, canAdminHousehold=false } = {}) {
  const baseCurrency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const year = Number(taxYear) || new Date().getFullYear();
  const taxTransactions = transactions.filter((tx)=>tx.tax_relevant && new Date(tx.occurred_at).getFullYear()===year);
  const taxDocuments = documents.filter((doc)=>doc.tax_relevant && Number(doc.tax_year || new Date(doc.document_date || doc.created_at).getFullYear())===year);
  const receiptByTx = new Map();
  for (const doc of documents.filter((d)=>d.object_type==='transaction' && d.object_id)) {
    const list=receiptByTx.get(doc.object_id)||[]; list.push(doc); receiptByTx.set(doc.object_id,list);
  }
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const expenseBase = taxTransactions.reduce((sum,tx)=>sum + consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),0);
  const missing = taxTransactions.filter((tx)=>!receiptByTx.has(tx.id));
  const years=[year-2,year-1,year,year+1];
  const cantonOptions=CH_CANTONS.map(([code,name])=>`<option value="${code}" ${household?.tax_region_code===code?'selected':''}>${code} · ${name}</option>`).join('');
  const rows=taxTransactions.map((tx)=>{
    const receipts=receiptByTx.get(tx.id)||[];
    const payment=paymentMap.get(tx.id);
    const displayedAmount=payment
      ? -(Number(payment.interest_amount||0)+Number(payment.fee_amount||0))
      : Number(tx.amount);
    const amountNote=payment?'<div class="table-meta">nur Zins & Gebühren</div>':'';
    return `<tr><td>${dateLabel(tx.occurred_at,locale)}</td><td><strong>${escapeHtml(tx.description)}</strong><div class="table-meta">${escapeHtml(tx.tax_category||tx.categories?.name||'Nicht spezifiziert')}</div></td><td>${money(displayedAmount,{currency:tx.currency,locale})}${amountNote}</td><td>${receipts.length?statusPill('active',`${receipts.length} Beleg${receipts.length===1?'':'e'}`):statusPill('pending','Beleg fehlt')}</td><td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="tax-receipt" data-id="${tx.id}">${icon('plus')} Beleg</button><button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="false">Entfernen</button>`:''}</div></td></tr>`;
  });
  return `
    ${pageHeader({title:'Steuerberater',subtitle:'Steuerrelevante Buchungen und Belege für den Export an deinen Steuerberater. Die finale steuerliche Beurteilung bleibt beim Kanton bzw. Steuerberater.',actions:`<button class="action-button action-button--primary" type="button" data-action="tax-export-csv" data-year="${year}">${icon('arrow-down-left')} CSV exportieren</button>`})}
    <input id="taxReceiptInput" type="file" accept="image/*,application/pdf" capture="environment" hidden>
    <div class="grid-main-aside">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Steuerprofil</h3><p class="card-subtitle">Kanton/Region und Steuerjahr für deine Unterlagen</p></div></div>
        <form id="tax-settings" data-form="tax-settings" class="form-grid form-grid--2">
          <label class="field"><span>Steuerjahr</span><select class="text-control" id="taxYearSelect" name="taxYear">${years.map((y)=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>
          ${household?.country_code==='CH'?`<label class="field"><span>Kanton</span><select class="text-control" name="regionCode" ${canAdminHousehold?'':'disabled'}><option value="">Bitte wählen</option>${cantonOptions}</select></label>`:`<label class="field"><span>Region / Bundesland</span><input class="text-control" name="regionCode" ${canAdminHousehold?'':'disabled'} value="${escapeHtml(household?.tax_region_code||'')}" placeholder="z. B. BY"></label>`}
          ${canAdminHousehold?`<div class="form-actions form-grid-span"><button class="action-button action-button--secondary" type="submit">Steuerprofil speichern</button></div>`:`<div class="form-grid-span toolbar-note">Kanton/Region kann nur durch Owner oder Haushalts-Admin geändert werden.</div>`}
        </form>
        <div class="inline-alert" style="margin-top:14px"><strong>Offizielle Regeln sind kontextabhängig.</strong><span>Die App markiert und exportiert deine Daten, entscheidet aber nicht verbindlich über Abzugsfähigkeit. Für CH verwenden wir offizielle ESTV-/Kantonsquellen als Referenz; eine vollständige, maschinenlesbare Abzugs-API für alle persönlichen Fälle ist nicht vorausgesetzt.</span></div>
      </article>
      <div class="metric-grid">
        ${metricCard('Markierte Ausgaben',money(expenseBase,{currency:baseCurrency,locale}),`${taxTransactions.length} Buchungen · ${fxLabel(fxRates,baseCurrency)}`)}
        ${metricCard('Belege',String(taxDocuments.length),'steuerrelevante Dokumente')}
        ${metricCard('Belege fehlen',String(missing.length),missing.length?'prüfen':'vollständig',missing.length?'warning':'positive')}
      </div>
    </div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerrelevante Buchungen ${year}</h3><p class="card-subtitle">Belege können direkt per Foto/PDF an die Buchung gehängt werden.</p></div></div>${dataTable({headers:['Datum','Buchung','Betrag','Beleg',''],rows,emptyText:'Noch keine steuerrelevanten Buchungen markiert.'})}</article>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Offizielle Referenzen</h3><p class="card-subtitle">Für die fachliche Prüfung</p></div></div><div class="stack compact-copy">${household?.country_code==='CH'?`<p><a class="card-link" href="https://www.estv.admin.ch/de/steuerrechner-steuern-berechnen" target="_blank" rel="noreferrer">ESTV Steuerrechner</a> · individuelle Berechnungen und kantonale Grunddaten.</p><p><a class="card-link" href="https://www.estv.admin.ch/de/steuerfuesse-abzuege-und-tarife-der-schweiz" target="_blank" rel="noreferrer">ESTV Steuerfüsse, Abzüge und Tarife</a> · offizielle Übersicht.</p>`:`<p><a class="card-link" href="https://www.elster.de/eportal/start" target="_blank" rel="noreferrer">ELSTER</a> · offizielles Portal der deutschen Steuerverwaltung.</p><p>Die Deutschland-Regellogik bleibt getrennt von der Schweizer Kantonslogik und wird später über eine eigene Tax-Provider-Schicht erweitert.</p>`}</div></article>`;
}
