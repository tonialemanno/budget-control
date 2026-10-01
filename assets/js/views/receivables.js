import { emptyState, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';

function statusLabel(status) {
  return ({ open:'Offen', paused:'Pausiert', paid:'Bezahlt' })[status] || status;
}

function paymentRows(receivable, payments, locale, canWrite) {
  const rows = payments.filter((p)=>p.receivable_id===receivable.id);
  if (!rows.length) return '<p class="card-subtitle">Noch keine Rückzahlungen erfasst.</p>';
  return `<div class="list">${rows.map((payment,index)=>{
    const reversed=Boolean(payment.reversed_at);
    const latestActive=!reversed && !rows.some((other)=>!other.reversed_at && (String(other.paid_at)>String(payment.paid_at) || (String(other.paid_at)===String(payment.paid_at) && String(other.created_at)>String(payment.created_at))));
    return `<div class="list-row"><div class="list-row-main"><span class="list-row-leading">${icon('arrow-down-left')}</span><div><div class="list-row-title">${dateLabel(payment.paid_at,locale)}</div><div class="list-row-meta">${reversed?'Storniert':`Rest danach ${money(payment.outstanding_after,{currency:payment.currency,locale})}`}${payment.note?` · ${escapeHtml(payment.note)}`:''}</div></div></div><div class="list-row-trailing"><div class="amount amount--positive">${money(payment.amount,{currency:payment.currency,locale})}</div>${canWrite&&latestActive?`<button class="table-action table-action--danger" type="button" data-action="receivable-payment-reverse" data-id="${payment.id}">Stornieren</button>`:''}</div></div>`;
  }).join('')}</div>`;
}

export function renderReceivables({
  receivables=[], receivablePayments=[], household, profile, fxRates, geoContext,
  canWrite=false, receivableExpandedId=null,
}={}) {
  const baseCurrency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const preferredCurrency=geoContext?.currency||baseCurrency;
  const active=receivables.filter((row)=>row.status!=='paid' && Number(row.outstanding_amount)>0);
  const outstanding=active.reduce((sum,row)=>sum+(convertAmount(row.outstanding_amount,row.currency,baseCurrency,fxRates)??0),0);
  const original=receivables.reduce((sum,row)=>sum+(convertAmount(row.original_amount,row.currency,baseCurrency,fxRates)??0),0);
  const repaid=receivablePayments.filter((p)=>!p.reversed_at).reduce((sum,p)=>sum+(convertAmount(p.amount,p.currency,baseCurrency,fxRates)??0),0);

  const currencyOptions=['CHF','EUR','USD','GBP'].map((currency)=>`<option value="${currency}" ${currency===preferredCurrency?'selected':''}>${currency}</option>`).join('');
  const createFields=`
    <label class="field"><span>Wer schuldet dir Geld?</span><input class="text-control" name="debtorName" required placeholder="z. B. Andy"></label>
    <label class="field"><span>Grund</span><input class="text-control" name="reason" required placeholder="z. B. geliehen für Reparatur"></label>
    <label class="field"><span>Ursprünglicher Betrag</span><input class="text-control" name="originalAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Offen</span><input class="text-control" name="outstandingAmount" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Währung</span><select class="text-control" name="currency">${currencyOptions}</select></label>
    <label class="field"><span>Vereinbarte Rate</span><input class="text-control" name="installmentAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Fällig am</span><input class="text-control" name="dueDate" type="date"></label>
    <label class="field"><span>Status</span><select class="text-control" name="status"><option value="open">Offen</option><option value="paused">Pausiert</option><option value="paid">Bezahlt</option></select></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" rows="3"></textarea></label>`;

  const paymentFields=`
    <input type="hidden" name="receivableId" id="receivablePaymentId">
    <label class="field"><span>Datum</span><input class="text-control" name="paidAt" id="receivablePaymentDate" type="date" required value="${dateInputValue()}"></label>
    <label class="field"><span>Rückzahlung</span><input class="text-control" name="amount" id="receivablePaymentAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" rows="2" placeholder="optional"></textarea></label>`;

  const rows=receivables.map((row)=>{
    const expanded=receivableExpandedId===row.id;
    const pill=row.status==='paid'?statusPill('active','Bezahlt'):row.status==='paused'?statusPill('pending','Pausiert'):statusPill('open','Offen');
    return `<article class="card card-padding">
      <div class="card-heading"><div><h3 class="card-title">${escapeHtml(row.debtor_name)}</h3><p class="card-subtitle">${escapeHtml(row.reason)}${row.due_date?` · fällig ${dateLabel(row.due_date,locale)}`:''}</p></div>${pill}</div>
      <div class="metric-grid" style="margin-bottom:12px">
        ${metricCard('Noch offen',money(row.outstanding_amount,{currency:row.currency,locale}),row.installment_amount>0?`Rate ${money(row.installment_amount,{currency:row.currency,locale})}`:'keine feste Rate')}
        ${metricCard('Ursprünglich',money(row.original_amount,{currency:row.currency,locale}),'Forderungsbetrag')}
      </div>
      ${row.notes?`<p class="card-subtitle">${escapeHtml(row.notes)}</p>`:''}
      <div class="card-footer-actions">
        ${canWrite&&row.status!=='paid'?`<button class="action-button action-button--primary" type="button" data-action="receivable-payment-open" data-id="${row.id}">Rückzahlung erfassen</button>`:''}
        <button class="table-action" type="button" data-action="${expanded?'receivable-history-close':'receivable-history'}" data-id="${row.id}">${expanded?'Verlauf schliessen':'Verlauf'}</button>
        ${canWrite?`<button class="table-action table-action--danger" type="button" data-action="delete" data-table="receivables" data-id="${row.id}">Löschen</button>`:''}
      </div>
      ${expanded?`<div class="receivable-history"><h4>Rückzahlungen</h4>${paymentRows(row,receivablePayments,locale,canWrite)}</div>`:''}
    </article>`;
  }).join('');

  return `
    ${pageHeader({title:'Forderungen',subtitle:'Geld, das andere dir schulden – Person, Grund, Restbetrag und Rückzahlungen.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="receivable-create">${icon('plus')} Forderung</button>`:''})}
    ${canWrite?formShell('receivable-create','Neue Forderung','Geliehenes Geld oder private Forderung erfassen',createFields,{hidden:true,submitLabel:'Forderung speichern'}):''}
    ${canWrite?formShell('receivable-payment-create','Rückzahlung erfassen','Der offene Betrag wird automatisch reduziert',paymentFields,{hidden:true,submitLabel:'Rückzahlung speichern'}):''}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Offene Forderungen',money(outstanding,{currency:baseCurrency,locale}),`${active.length} offen`)}
      ${metricCard('Ursprünglich',money(original,{currency:baseCurrency,locale}),`${receivables.length} Forderungen`)}
      ${metricCard('Zurückbezahlt',money(repaid,{currency:baseCurrency,locale}),'aktive Rückzahlungen','positive')}
    </div>
    <div class="stack">${rows||emptyState('credit-card','Keine Forderungen','Wenn du jemandem Geld leihst, kannst du hier Restbetrag und Rückzahlungen verfolgen.')}</div>`;
}
