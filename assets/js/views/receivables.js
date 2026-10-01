import { emptyState, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';

function statusMeta(status) {
  const map = {
    open: ['open', 'Offen'],
    partial: ['pending', 'Teilweise bezahlt'],
    overdue: ['pending', 'Überfällig'],
    paid: ['active', 'Bezahlt'],
    written_off: ['pending', 'Abgeschrieben'],
  };
  return map[status] || ['open', status || 'Offen'];
}

function accountOptions(accounts, selectedCurrency) {
  return accounts
    .filter((account) => !selectedCurrency || account.currency === selectedCurrency)
    .map((account) => `<option value="${account.account_id}" data-currency="${escapeHtml(account.currency)}">${escapeHtml(account.name)} · ${escapeHtml(account.currency)}</option>`)
    .join('');
}

function paymentHistory(receivable, payments, locale, canWrite) {
  const rows = payments.filter((payment) => payment.receivable_id === receivable.id);
  if (!rows.length) return '<p class="card-subtitle">Noch keine Rückzahlungen erfasst.</p>';

  const active = rows.filter((payment) => !payment.reversed_at);
  const latest = [...active].sort((a,b) => {
    const created = String(b.created_at || '').localeCompare(String(a.created_at || ''));
    if (created) return created;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];

  return `<div class="list">${rows.map((payment) => {
    const reversed = Boolean(payment.reversed_at);
    const source = payment.source === 'created_transaction'
      ? 'Kontobuchung'
      : payment.source === 'linked_transaction'
        ? 'verknüpfte Buchung'
        : 'nur Verlauf';
    return `<div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading">${icon('arrow-down-left')}</span>
        <div>
          <div class="list-row-title">${dateLabel(payment.paid_at, locale)}</div>
          <div class="list-row-meta">${reversed ? 'Storniert' : `Rest danach ${money(payment.outstanding_after,{currency:payment.currency,locale})}`} · ${escapeHtml(source)}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</div>
        </div>
      </div>
      <div class="list-row-trailing">
        <div class="amount amount--positive">${money(payment.amount,{currency:payment.currency,locale})}</div>
        ${canWrite && !reversed && latest?.id === payment.id
          ? `<button class="table-action table-action--danger" type="button" data-action="receivable-payment-reverse" data-id="${payment.id}">Stornieren</button>`
          : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

export function renderReceivables({
  receivables = [], receivablePayments = [], accounts = [], household, profile, fxRates, geoContext,
  canWrite = false, receivableExpandedId = null,
} = {}) {
  const baseCurrency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const preferredCurrency = geoContext?.currency || baseCurrency;

  const active = receivables.filter((row) => !['paid','written_off'].includes(row.status) && Number(row.outstanding_amount) > 0);
  const outstanding = active.reduce((sum,row) => sum + (convertAmount(row.outstanding_amount,row.currency,baseCurrency,fxRates) ?? 0), 0);
  const original = receivables.reduce((sum,row) => sum + (convertAmount(row.original_amount,row.currency,baseCurrency,fxRates) ?? 0), 0);
  const repaid = receivablePayments
    .filter((payment) => !payment.reversed_at)
    .reduce((sum,payment) => sum + (convertAmount(payment.amount,payment.currency,baseCurrency,fxRates) ?? 0), 0);

  const currencies = ['CHF','EUR','USD','GBP'];
  const currencyOptions = currencies
    .map((currency) => `<option value="${currency}" ${currency===preferredCurrency?'selected':''}>${currency}</option>`)
    .join('');

  const createFields = `
    <label class="field"><span>Wer schuldet dir Geld?</span><input class="text-control" name="debtor" required placeholder="z. B. Andy"></label>
    <label class="field"><span>Grund</span><input class="text-control" name="reason" required placeholder="z. B. Geld geliehen für Reparatur"></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="originalAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Währung</span><select class="text-control" name="currency" id="receivableCurrency">${currencyOptions}</select><small>Vorschlag nach aktuellem Land; frei änderbar.</small></label>
    <label class="field"><span>Verliehen am</span><input class="text-control" name="lentAt" type="date" value="${dateInputValue()}" required></label>
    <label class="field"><span>Rückzahlung fällig</span><input class="text-control" name="dueDate" type="date"></label>
    <label class="field form-grid-span checkbox-field"><input type="checkbox" name="createTransaction" id="receivableCreateTransaction"><span>Auszahlung auch als Kontobuchung erfassen</span></label>
    <label class="field form-grid-span"><span>Auszahlungskonto</span><select class="text-control" name="sourceAccountId" id="receivableSourceAccount"><option value="">Bitte wählen, falls Kontobuchung aktiviert ist</option>${accountOptions(accounts, null)}</select><small>Bei einer Kontobuchung müssen Konto und Forderung dieselbe Währung haben.</small></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" rows="3" placeholder="optional"></textarea></label>`;

  const paymentFields = `
    <input type="hidden" name="receivableId" id="receivablePaymentId">
    <label class="field"><span>Datum</span><input class="text-control" name="paidAt" id="receivablePaymentDate" type="date" required value="${dateInputValue()}"></label>
    <label class="field"><span>Rückzahlung</span><input class="text-control" name="amount" id="receivablePaymentAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Art</span><select class="text-control" name="paymentMode" id="receivablePaymentMode"><option value="created_transaction">Auf Konto erhalten</option><option value="history_only">Nur im Verlauf erfassen</option></select></label>
    <label class="field"><span>Empfangskonto</span><select class="text-control" name="paymentAccountId" id="receivablePaymentAccount"><option value="">Bitte wählen</option>${accountOptions(accounts, null)}</select><small>Nur erforderlich, wenn die Rückzahlung als Kontobuchung erfasst wird.</small></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" rows="2" placeholder="optional"></textarea></label>`;

  const cards = receivables.map((row) => {
    const [tone,label] = statusMeta(row.status);
    const payments = receivablePayments.filter((payment) => payment.receivable_id === row.id && !payment.reversed_at);
    const expanded = receivableExpandedId === row.id;
    const sourceAccount = accounts.find((account) => account.account_id === row.source_account_id);
    const canDelete = payments.length === 0;

    return `<article class="card card-padding">
      <div class="card-heading">
        <div>
          <h3 class="card-title">${escapeHtml(row.debtor)}</h3>
          <p class="card-subtitle">${escapeHtml(row.reason)} · verliehen ${dateLabel(row.lent_at,locale)}${row.due_date ? ` · fällig ${dateLabel(row.due_date,locale)}` : ''}</p>
        </div>
        ${statusPill(tone,label)}
      </div>
      <div class="metric-grid" style="margin-bottom:12px">
        ${metricCard('Noch offen',money(row.outstanding_amount,{currency:row.currency,locale}),`${payments.length} Rückzahlung${payments.length===1?'':'en'}`)}
        ${metricCard('Ursprünglich',money(row.original_amount,{currency:row.currency,locale}),sourceAccount ? `aus ${escapeHtml(sourceAccount.name)}` : 'manuell erfasst')}
      </div>
      ${row.notes ? `<p class="card-subtitle">${escapeHtml(row.notes)}</p>` : ''}
      <div class="card-footer-actions">
        ${canWrite && !['paid','written_off'].includes(row.status)
          ? `<button class="action-button action-button--primary" type="button" data-action="receivable-payment-open" data-id="${row.id}">Rückzahlung erfassen</button>`
          : ''}
        <button class="table-action" type="button" data-action="${expanded?'receivable-history-close':'receivable-history'}" data-id="${row.id}">${expanded?'Verlauf schliessen':'Verlauf'}</button>
        ${canWrite && canDelete
          ? `<button class="table-action table-action--danger" type="button" data-action="delete" data-table="receivables" data-id="${row.id}">Löschen</button>`
          : ''}
      </div>
      ${expanded ? `<div class="receivable-history"><h4>Rückzahlungen</h4>${paymentHistory(row,receivablePayments,locale,canWrite)}</div>` : ''}
    </article>`;
  }).join('');

  return `
    ${pageHeader({
      title:'Forderungen',
      subtitle:'Geld, das andere dir schulden – wer, warum, wie viel noch offen ist und was bereits zurückbezahlt wurde.',
      actions:canWrite ? `<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="receivable-create">${icon('plus')} Forderung</button>` : '',
    })}
    ${geoContext?.currency ? `<div class="inline-alert inline-alert--success"><strong>Währungsvorschlag: ${escapeHtml(geoContext.currency)}</strong><span>Erkannt über Länderkontext ${escapeHtml(geoContext.country || '')}; die Auswahl bleibt manuell änderbar.</span></div>` : ''}
    ${canWrite ? formShell('receivable-create','Neue Forderung','Verliehenes Geld erfassen',createFields,{hidden:true,submitLabel:'Forderung speichern'}) : ''}
    ${canWrite ? formShell('receivable-payment-create','Rückzahlung erfassen','Restbetrag und optional Kontostand werden konsistent aktualisiert',paymentFields,{hidden:true,submitLabel:'Rückzahlung speichern'}) : ''}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Offene Forderungen',money(outstanding,{currency:baseCurrency,locale}),`${active.length} offen`)}
      ${metricCard('Ursprünglich',money(original,{currency:baseCurrency,locale}),`${receivables.length} Forderung${receivables.length===1?'':'en'}`)}
      ${metricCard('Zurückbezahlt',money(repaid,{currency:baseCurrency,locale}),'aktive Rückzahlungen','positive')}
    </div>
    <div class="stack">${cards || emptyState('credit-card','Keine Forderungen','Wenn du jemandem Geld leihst, kannst du hier Restbetrag und Rückzahlungen verfolgen.')}</div>`;
}
