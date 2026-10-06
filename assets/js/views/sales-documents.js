import { metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

const TYPE_LABELS = Object.freeze({ invoice:'Rechnung', quote:'Offerte', receipt:'Quittung' });
const STATUS_LABELS = Object.freeze({ draft:'Entwurf', sent:'Versendet', accepted:'Angenommen', paid:'Bezahlt', cancelled:'Storniert', expired:'Abgelaufen' });
const PREFIXES = Object.freeze({ invoice:'RE', quote:'OF', receipt:'QU' });

export function salesDocumentTypeLabel(type) {
  return TYPE_LABELS[type] || 'Dokument';
}

export function nextSalesDocumentNumber(documents = [], type = 'invoice', date = new Date()) {
  const year = date.getFullYear();
  const prefix = PREFIXES[type] || 'DO';
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  let max = 0;
  for (const row of documents) {
    if (row.document_type !== type) continue;
    const match = String(row.document_number || '').match(pattern);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

function itemRow() {
  return `<div class="card card-padding" data-sales-item>
    <div class="form-grid form-grid--2">
      <label class="field form-grid-span"><span>Position / Leistung</span><input class="text-control" name="itemDescription" required placeholder="z. B. Beratung, Reparatur, Verkauf"></label>
      <label class="field"><span>Menge</span><input class="text-control" name="itemQuantity" type="number" min="0.001" step="0.001" value="1" required></label>
      <label class="field"><span>Einzelpreis</span><input class="text-control" name="itemUnitPrice" type="number" min="0" step="0.01" value="0.00" required></label>
      <label class="field"><span>Steuer %</span><input class="text-control" name="itemTaxRate" type="number" min="0" max="100" step="0.01" value="0"></label>
      <div class="field"><span>&nbsp;</span><button class="table-action table-action--danger" type="button" data-action="sales-document-remove-item">Position entfernen</button></div>
    </div>
  </div>`;
}

function tone(status) {
  if (['paid','accepted'].includes(status)) return 'active';
  if (status === 'sent') return 'pending';
  if (['cancelled','expired'].includes(status)) return 'warning';
  return 'open';
}

function nextStatus(row) {
  if (row.document_type === 'invoice') return row.status === 'draft' ? ['sent','Als versendet markieren'] : row.status === 'sent' ? ['paid','Als bezahlt markieren'] : null;
  if (row.document_type === 'quote') return row.status === 'draft' ? ['sent','Als versendet markieren'] : row.status === 'sent' ? ['accepted','Als angenommen markieren'] : null;
  return null;
}

export function renderSalesDocuments({ salesDocuments = [], household, profile, canWrite = false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const today = dateInputValue();
  const plus30 = dateInputValue(new Date(Date.now() + 30 * 86400000));
  const invoiceCount = salesDocuments.filter((row)=>row.document_type==='invoice').length;
  const openInvoices = salesDocuments.filter((row)=>row.document_type==='invoice' && ['draft','sent'].includes(row.status));
  const quoteCount = salesDocuments.filter((row)=>row.document_type==='quote').length;
  const receiptCount = salesDocuments.filter((row)=>row.document_type==='receipt').length;
  const convertedQuoteIds = new Set(salesDocuments.filter((row)=>row.document_type==='invoice' && row.source_document_id).map((row)=>row.source_document_id));
  const defaultSender = profile?.display_name || household?.name || '';

  const rows = salesDocuments.map((row)=>{
    const next = nextStatus(row);
    const converted = row.document_type === 'quote' && convertedQuoteIds.has(row.id);
    const actions = `<div class="row-actions">
      <button class="table-action" type="button" data-action="sales-document-print" data-id="${escapeHtml(row.id)}">Drucken / PDF</button>
      ${canWrite && next ? `<button class="table-action" type="button" data-action="sales-document-status" data-id="${escapeHtml(row.id)}" data-status="${next[0]}">${next[1]}</button>` : ''}
      ${canWrite && row.document_type==='quote' && !converted && !['cancelled','expired'].includes(row.status) ? `<button class="table-action" type="button" data-action="sales-document-convert" data-id="${escapeHtml(row.id)}">In Rechnung umwandeln</button>` : ''}
      ${canWrite ? `<button class="table-action table-action--danger" type="button" data-action="sales-document-delete" data-id="${escapeHtml(row.id)}">Löschen</button>` : ''}
    </div>`;
    const secondary = row.document_type === 'invoice' && row.due_date
      ? `Fällig ${dateLabel(row.due_date,locale)}`
      : row.document_type === 'quote' && row.valid_until
        ? `Gültig bis ${dateLabel(row.valid_until,locale)}`
        : `Ausgestellt ${dateLabel(row.issue_date,locale)}`;
    return `<div class="list-row"><div class="list-row-main"><span class="list-row-leading">${icon('receipt')}</span><div><div class="list-row-title">${escapeHtml(row.document_number)} · ${escapeHtml(salesDocumentTypeLabel(row.document_type))}</div><div class="list-row-meta">${escapeHtml(row.recipient_name)} · ${secondary}</div></div></div><div class="list-row-trailing"><div class="amount">${money(row.total,{currency:row.currency||currency,locale})}</div>${statusPill(tone(row.status),STATUS_LABELS[row.status]||row.status)}${actions}</div></div>`;
  }).join('');

  const form = canWrite ? `
    <form class="card card-padding form-card" id="sales-document-create" data-form="sales-document-create" hidden>
      <div class="card-heading"><div><h3 class="card-title" id="salesDocumentFormTitle">Rechnung erstellen</h3><p class="card-subtitle">Ausgangsdokument für einen Kunden oder Empfänger. Die Summe wird beim Speichern serverseitig aus den Positionen berechnet.</p></div><span class="list-row-leading">${icon('receipt')}</span></div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Dokumenttyp</span><select class="text-control" name="documentType" id="salesDocumentType"><option value="invoice">Rechnung</option><option value="quote">Offerte</option><option value="receipt">Quittung</option></select></label>
        <label class="field"><span>Nummer</span><input class="text-control" name="documentNumber" id="salesDocumentNumber" value="${escapeHtml(nextSalesDocumentNumber(salesDocuments,'invoice'))}" required></label>
        <label class="field"><span>Datum</span><input class="text-control" name="issueDate" id="salesDocumentIssueDate" type="date" value="${today}" required></label>
        <label class="field" id="salesInvoiceDueField"><span>Fällig am</span><input class="text-control" name="dueDate" id="salesDocumentDueDate" type="date" value="${plus30}"></label>
        <label class="field" id="salesQuoteValidField" hidden><span>Offerte gültig bis</span><input class="text-control" name="validUntil" id="salesDocumentValidUntil" type="date" value="${plus30}"></label>
        <label class="field"><span>Währung</span><select class="text-control" name="currency"><option value="CHF" ${currency==='CHF'?'selected':''}>CHF</option><option value="EUR" ${currency==='EUR'?'selected':''}>EUR</option><option value="USD" ${currency==='USD'?'selected':''}>USD</option><option value="GBP" ${currency==='GBP'?'selected':''}>GBP</option></select></label>
        <label class="field"><span>Absender / Firma</span><input class="text-control" name="senderName" value="${escapeHtml(defaultSender)}" placeholder="Dein Name oder Firma"></label>
        <label class="field form-grid-span"><span>Absenderadresse</span><textarea class="text-control" name="senderAddress" rows="2" placeholder="Strasse, PLZ Ort"></textarea></label>
        <label class="field"><span>MWST-/USt-/IVA-Nr.</span><input class="text-control" name="senderTaxId" placeholder="optional"></label>
        <label class="field"><span>Empfänger / Kunde</span><input class="text-control" name="recipientName" required></label>
        <label class="field form-grid-span"><span>Empfängeradresse</span><textarea class="text-control" name="recipientAddress" rows="2"></textarea></label>
        <label class="field form-grid-span"><span>Einleitungstext</span><textarea class="text-control" name="introText" rows="2" placeholder="optional"></textarea></label>
      </div>
      <div class="card-heading" style="margin-top:16px"><div><h3 class="card-title">Positionen</h3><p class="card-subtitle">Steuersatz pro Position frei wählbar. 0 % ist erlaubt.</p></div><button class="action-button action-button--secondary" type="button" data-action="sales-document-add-item">${icon('plus')} Position</button></div>
      <div class="stack" id="salesDocumentItems">${itemRow()}</div>
      <template id="salesDocumentItemTemplate">${itemRow()}</template>
      <div class="form-grid form-grid--2" style="margin-top:16px">
        <label class="field form-grid-span"><span>Zahlungstext</span><textarea class="text-control" name="paymentText" rows="2" placeholder="z. B. Zahlbar innert 30 Tagen"></textarea></label>
        <label class="field form-grid-span"><span>Schlusstext</span><textarea class="text-control" name="closingText" rows="2" placeholder="optional"></textarea></label>
        <label class="field form-grid-span"><span>Interne Notiz</span><textarea class="text-control" name="notes" rows="2" placeholder="wird nicht als Position gedruckt"></textarea></label>
      </div>
      <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="hide-form" data-target="sales-document-create">Abbrechen</button><button class="action-button action-button--primary" type="submit">Dokument speichern</button></div>
    </form>` : '';

  return `
    ${pageHeader({title:'Rechnungen, Offerten & Quittungen',subtitle:'Dokumente, die du selbst an andere ausstellst. Zu zahlende Rechnungen bleiben separat unter „Zu zahlende Rechnungen & Verträge“.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="sales-document-new" data-document-type="invoice">${icon('plus')} Rechnung erstellen</button><button class="action-button action-button--secondary" type="button" data-action="sales-document-new" data-document-type="quote">${icon('plus')} Offerte schreiben</button><button class="action-button action-button--secondary" type="button" data-action="sales-document-new" data-document-type="receipt">${icon('plus')} Quittung ausstellen</button>`:''})}
    ${form}
    <div class="metric-grid" style="margin:16px 0">${metricCard('Offene Rechnungen',String(openInvoices.length),`${invoiceCount} Rechnungen total`)}${metricCard('Offerten',String(quoteCount),'Entwürfe, versendet oder angenommen')}${metricCard('Quittungen',String(receiptCount),'ausgestellte Zahlungsbestätigungen')}</div>
    <div class="inline-alert"><strong>Kontostände bleiben getrennt.</strong><span>„Versendet“, „Angenommen“ oder „Bezahlt“ ist der Dokumentstatus. Eine echte Zahlung wird weiterhin als Transaktion erfasst.</span></div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Ausgangsdokumente</h3><p class="card-subtitle">${salesDocuments.length} Dokumente</p></div></div>${rows?`<div class="list">${rows}</div>`:'<div class="table-empty">Noch keine Rechnungen, Offerten oder Quittungen erstellt.</div>'}</article>`;
}
