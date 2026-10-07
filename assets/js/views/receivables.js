import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';

const STATUS_LABELS={open:'Offen',partial:'Teilweise zurückbezahlt',overdue:'Überfällig',paid:'Bezahlt',written_off:'Abgeschrieben'};
const effectiveStatus=(r)=>['paid','written_off'].includes(r.status)?r.status:(r.due_date&&r.due_date<dateInputValue()?'overdue':(r.status||'open'));
const currencyOptions=(selected='CHF')=>['CHF','EUR','USD','GBP'].map((c)=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
const accountOptions=(accounts)=>accounts.map((a)=>`<option value="${a.account_id}" data-currency="${escapeHtml(a.currency)}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');

export function renderReceivables({receivables=[],receivablePayments=[],accounts=[],transactions=[],household,profile,fxRates,canWrite=false,receivableExpandedId=null}={}) {
  const currency=household?.base_currency||'CHF', locale=profile?.locale||'de-CH';
  const cv=(v,from)=>convertAmount(v,from||currency,currency,fxRates)??0;
  const open=receivables.filter((r)=>!['paid','written_off'].includes(effectiveStatus(r)));
  const total=open.reduce((s,r)=>s+cv(r.outstanding_amount,r.currency),0);
  const people=new Set(open.map((r)=>String(r.debtor||'').trim().toLowerCase()).filter(Boolean));
  const overdue=open.filter((r)=>effectiveStatus(r)==='overdue').length;
  const accountOpts=accountOptions(accounts);

  const createFields=`
    <label class="field"><span>Person</span><input class="text-control" name="debtor" required placeholder="z. B. Marco"></label>
    <label class="field"><span>Grund</span><input class="text-control" name="reason" required placeholder="z. B. Ferien vorgestreckt"></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Währung</span><select class="text-control" name="currency">${currencyOptions(currency)}</select></label>
    <label class="field"><span>Verliehen am</span><input class="text-control" name="lentAt" type="date" value="${dateInputValue()}" required></label>
    <label class="field"><span>Rückzahlung erwartet</span><input class="text-control" name="dueDate" type="date"></label>
    <label class="field form-grid-span"><span>Auszahlungskonto</span><select class="text-control" name="sourceAccountId"><option value="">— Nur Forderung erfassen / bereits früher verliehen —</option>${accountOpts}</select><small>Mit Konto erstellt ALEMANNO BUCHHALTUNG zusätzlich die Auszahlung. Die Kontowährung muss zur Forderung passen.</small></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" rows="3"></textarea></label>`;
  const linkedPaymentTxIds=new Set(receivablePayments.filter((p)=>!p.reversed_at&&p.transaction_id).map((p)=>p.transaction_id));
  const paymentTransactionOptions=transactions.filter((tx)=>
    tx.status==='booked' && !tx.transfer_group_id && tx.cashflow_type==='standard' &&
    Number(tx.amount)>0 && !linkedPaymentTxIds.has(tx.id)
  ).map((tx)=>`<option value="${tx.id}" data-currency="${escapeHtml(tx.currency)}" data-amount="${Math.abs(Number(tx.amount||0))}" data-date="${dateInputValue(new Date(tx.occurred_at))}">${escapeHtml(dateLabel(tx.occurred_at,locale))} · ${escapeHtml(tx.description)} · ${money(tx.amount,{currency:tx.currency,locale})}</option>`).join('');
  const paymentFields=`
    <input type="hidden" name="receivableId" id="receivablePaymentId">
    <label class="field"><span>Datum</span><input class="text-control" name="paidAt" id="receivablePaymentDate" type="date" value="${dateInputValue()}" required></label>
    <label class="field"><span>Rückzahlung</span><input class="text-control" name="amount" id="receivablePaymentAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Verbuchen über</span><select class="text-control" name="source" id="receivablePaymentSource"><option value="created_transaction">Kontoeingang erstellen</option><option value="linked_transaction">Bestehenden Kontoeingang verknüpfen</option><option value="history_only">Nur im Forderungsverlauf erfassen</option></select></label>
    <label class="field" id="receivablePaymentAccountField"><span>Eingangskonto</span><select class="text-control" name="paymentAccountId" id="receivablePaymentAccount"><option value="">Bitte wählen</option>${accountOpts}</select><small>ALEMANNO BUCHHALTUNG erstellt denselben Vorgang gleichzeitig als Kontoeingang.</small></label>
    <label class="field form-grid-span" id="receivablePaymentTransactionField" hidden><span>Bestehender Kontoeingang</span><select class="text-control" name="transactionId" id="receivablePaymentTransaction"><option value="">Bitte wählen</option>${paymentTransactionOptions}</select><small>Nur positive, noch nicht verknüpfte Standardbuchungen werden angeboten.</small></label>
    <div class="inline-alert form-grid-span" id="receivablePaymentHistoryInfo" hidden><strong>Nur Verlauf.</strong><span>Der Kontostand wird nicht verändert. Nutze das nur, wenn die Rückzahlung ausserhalb von ALEMANNO BUCHHALTUNG bereits berücksichtigt wurde.</span></div>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" id="receivablePaymentNote" rows="3"></textarea></label>`;

  const rows=receivables.map((r)=>{
    const history=receivablePayments.filter((p)=>p.receivable_id===r.id&&!p.reversed_at), status=effectiveStatus(r);
    return `<tr><td><strong>${escapeHtml(r.debtor)}</strong><div class="table-meta">${escapeHtml(r.reason)}</div></td><td>${money(r.outstanding_amount,{currency:r.currency||currency,locale})}</td><td>${money(r.original_amount,{currency:r.currency||currency,locale})}</td><td>${dateLabel(r.lent_at,locale)}</td><td>${r.due_date?dateLabel(r.due_date,locale):'—'}</td><td>${statusPill(status,STATUS_LABELS[status]||status)}</td><td><div class="table-actions"><button class="table-action" type="button" data-action="receivable-history" data-id="${r.id}">${history.length?`Verlauf (${history.length})`:'Verlauf'}</button>${canWrite&&Number(r.outstanding_amount)>0&&!['paid','written_off'].includes(status)?`<button class="table-action" type="button" data-action="receivable-payment-open" data-id="${r.id}">Zahlung erhalten</button>`:''}${canWrite&&!history.length?deleteButton('receivables',r.id):''}</div></td></tr>`;
  });

  const selected=receivables.find((r)=>r.id===receivableExpandedId);
  let historyCard='';
  if(selected){
    const history=receivablePayments.filter((p)=>p.receivable_id===selected.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const latest=history.find((p)=>!p.reversed_at)?.id;
    const hrows=history.map((p)=>`<tr><td>${dateLabel(p.paid_at,locale)}${p.reversed_at?`<div class="table-meta">${statusPill('cancelled','Storniert')}</div>`:''}</td><td>${money(p.amount,{currency:p.currency||selected.currency,locale})}</td><td>${money(p.outstanding_after,{currency:p.currency||selected.currency,locale})}</td><td>${escapeHtml(p.note||'')}${p.source==='created_transaction'?'<div class="table-meta">Kontobewegung erstellt</div>':p.source==='linked_transaction'?'<div class="table-meta">Kontobewegung verknüpft</div>':'<div class="table-meta">Nur Verlauf</div>'}</td><td>${canWrite&&!p.reversed_at&&p.id===latest?`<button class="table-action table-action--danger" type="button" data-action="receivable-payment-reverse" data-id="${p.id}">Stornieren</button>`:''}</td></tr>`);
    historyCard=`<article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Verlauf · ${escapeHtml(selected.debtor)}</h3><p class="card-subtitle">${escapeHtml(selected.reason)} · offen ${money(selected.outstanding_amount,{currency:selected.currency,locale})}</p></div><button class="table-action" type="button" data-action="receivable-history-close">Schliessen</button></div>${dataTable({headers:['Datum','Rückzahlung','Rest danach','Notiz',''],rows:hrows,emptyText:'Noch keine Rückzahlungen erfasst.'})}</article>`;
  }

  return `${pageHeader({title:'Forderungen',subtitle:'Geld, das du verliehen hast. Es zählt zum Vermögen, ist aber nicht frei verfügbar.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="receivable-create">${icon('plus')} Geld verleihen</button>`:''})}
    ${canWrite?formShell('receivable-create','Geld verleihen','Person, Grund, Betrag und Rückzahlungstermin erfassen',createFields,{hidden:true,submitLabel:'Forderung speichern'}):''}
    ${canWrite?formShell('receivable-payment-create','Rückzahlung erhalten','Teil- oder Vollzahlung verbuchen',paymentFields,{hidden:true,submitLabel:'Rückzahlung verbuchen'}):''}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Aktuell offen',money(total,{currency,locale}),fxLabel(fxRates,currency))}${metricCard('Personen',String(people.size),'mit offenem Betrag')}${metricCard('Überfällig',String(overdue),'mit überschrittenem Termin',overdue?'warning':'')}${metricCard('Positionen',String(receivables.length),'inkl. erledigte')}</div>
    <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Was bekomme ich noch von wem?</h3><p class="card-subtitle">Person, Grund, offener Betrag und Termin.</p></div></div>${dataTable({headers:['Person / Grund','Offen','Ursprünglich','Verliehen','Fällig','Status',''],rows,emptyText:'Noch keine Forderungen erfasst.'})}</article>${historyCard}`;
}
