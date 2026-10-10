import { filePicker, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

const TYPE_LABELS = Object.freeze({ invoice:'Rechnung', quote:'Offerte', receipt:'Quittung' });
const TYPE_LABELS_DE = Object.freeze({ invoice:'Rechnung', quote:'Angebot', receipt:'Quittung' });
const STATUS_LABELS = Object.freeze({ draft:'Entwurf', sent:'Versendet', accepted:'Angenommen', paid:'Bezahlt', cancelled:'Storniert', expired:'Abgelaufen' });
const PREFIXES = Object.freeze({ invoice:'RE', quote:'OF', receipt:'QU' });

export const SALES_DOCUMENT_TEXT_DEFAULTS = Object.freeze({
  quoteIntro:'Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgende Offerte.',
  invoiceIntro:'Vielen Dank für Ihren Auftrag. Wir stellen Ihnen folgende Leistungen in Rechnung.',
  receiptIntro:'Wir bestätigen den Eingang Ihrer Zahlung.',
  payment:'Zahlbar innert {Zahlungsfrist} Tagen ohne Abzug.',
  closing:'Vielen Dank für Ihr Vertrauen. Für Fragen stehen wir Ihnen gerne zur Verfügung.',
});

export function salesDocumentTypeLabel(type,countryCode='CH') {
  const labels=countryCode==='DE'?TYPE_LABELS_DE:TYPE_LABELS;
  return labels[type] || 'Dokument';
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

export function salesDocumentDefaults(settings = {}, fallbackSender = '', countryCode='CH') {
  const quoteIntroDefault=countryCode==='DE'?'Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.':SALES_DOCUMENT_TEXT_DEFAULTS.quoteIntro;
  const paymentDefault=countryCode==='DE'?'Zahlbar innerhalb von {Zahlungsfrist} Tagen ohne Abzug.':SALES_DOCUMENT_TEXT_DEFAULTS.payment;
  return {
    senderName: settings?.company_name || fallbackSender || '',
    senderAddress: settings?.company_address || '',
    senderTaxId: settings?.tax_id || '',
    paymentDays: Math.max(0, Number(settings?.default_payment_days ?? 30) || 30),
    quoteValidDays: Math.max(0, Number(settings?.default_quote_valid_days ?? 30) || 30),
    taxRate: Math.max(0, Number(settings?.default_tax_rate ?? 0) || 0),
    quoteIntro: settings?.default_quote_intro || quoteIntroDefault,
    invoiceIntro: settings?.default_invoice_intro || SALES_DOCUMENT_TEXT_DEFAULTS.invoiceIntro,
    receiptIntro: settings?.default_receipt_intro || SALES_DOCUMENT_TEXT_DEFAULTS.receiptIntro,
    paymentText: settings?.default_payment_text || paymentDefault,
    closingText: settings?.default_closing_text || SALES_DOCUMENT_TEXT_DEFAULTS.closing,
  };
}

export function expandSalesDocumentText(text, context = {}) {
  const replacements={
    '{Kunde}':context.recipientName||'',
    '{Dokumentnummer}':context.documentNumber||'',
    '{Datum}':context.issueDate||'',
    '{Fälligkeitsdatum}':context.dueDate||'',
    '{Total}':context.total||'',
    '{Zahlungsfrist}':String(context.paymentDays ?? ''),
  };
  let result=String(text||'');
  for(const [token,value] of Object.entries(replacements)) result=result.split(token).join(String(value??''));
  return result;
}

function paymentTotal(documentId,payments=[]) {
  return payments.filter((row)=>row.sales_document_id===documentId).reduce((sum,row)=>sum+Number(row.amount||0),0);
}

export function salesPaymentCandidates(invoice, transactions = [], payments = []) {
  if(!invoice || invoice.document_type!=='invoice') return [];
  const linkedIds=new Set(payments.map((row)=>row.transaction_id).filter(Boolean));
  const paid=paymentTotal(invoice.id,payments);
  const remaining=Math.max(0,Number(invoice.total||0)-paid);
  const issueTime=new Date(invoice.issue_date||0).getTime();
  return (transactions||[])
    .filter((tx)=>{
      const occurred=new Date(tx.occurred_at||0).getTime();
      return Number(tx.amount)>0
        && tx.status==='booked'
        && !tx.transfer_group_id
        && String(tx.currency||'')===String(invoice.currency||'')
        && !linkedIds.has(tx.id)
        && (!Number.isFinite(issueTime) || !Number.isFinite(occurred) || occurred>=issueTime-7*86400000);
    })
    .map((tx)=>({...tx,_difference:Math.abs(Number(tx.amount||0)-remaining)}))
    .sort((a,b)=>a._difference-b._difference || new Date(b.occurred_at)-new Date(a.occurred_at))
    .slice(0,8);
}

function itemRow(defaultTaxRate = 0) {
  return `<div class="card card-padding" data-sales-item>
    <div class="form-grid form-grid--2">
      <label class="field form-grid-span"><span>Position / Leistung</span><input class="text-control" name="itemDescription" required placeholder="z. B. Beratung, Reparatur, Verkauf"></label>
      <label class="field"><span>Menge</span><input class="text-control" name="itemQuantity" type="number" min="0.001" step="0.001" value="1" required></label>
      <label class="field"><span>Einzelpreis</span><input class="text-control" name="itemUnitPrice" type="number" min="0" step="0.01" value="0.00" required></label>
      <label class="field"><span>Steuer %</span><input class="text-control" name="itemTaxRate" type="number" min="0" max="100" step="0.001" value="${escapeHtml(String(defaultTaxRate))}"></label>
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
  if (row.document_type === 'invoice') return row.status === 'draft' ? ['sent','Als versendet markieren'] : null;
  if (row.document_type === 'quote') return row.status === 'draft' ? ['sent','Als versendet markieren'] : row.status === 'sent' ? ['accepted','Als angenommen markieren'] : null;
  return null;
}

function templateOptions(templates,section,type) {
  const rows=(templates||[]).filter((row)=>row.section===section && (row.document_type==='all'||row.document_type===type));
  return `<option value="">Textbaustein wählen …</option>${rows.map((row)=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('')}`;
}

function paymentOptions(invoice,transactions,payments,locale) {
  const candidates=salesPaymentCandidates(invoice,transactions,payments);
  if(!candidates.length) return '<div class="list-row-meta" style="margin-top:6px">Noch kein passender Zahlungseingang erkannt. ALEMANNO BUCHHALTUNG prüft neue positive Buchungen automatisch.</div>';
  return `<div class="settings-inline-control" style="margin-top:8px">
    <select class="select-control" data-sales-payment-select data-document-id="${escapeHtml(invoice.id)}">
      ${candidates.map((tx,index)=>`<option value="${escapeHtml(tx.id)}" ${index===0?'selected':''}>${escapeHtml(dateLabel(tx.occurred_at,locale))} · ${escapeHtml(tx.counterparty||tx.description||'Eingang')} · ${escapeHtml(money(tx.amount,{currency:tx.currency,locale}))}${tx._difference<0.005?' · exakter Betrag':''}</option>`).join('')}
    </select>
    <button class="table-action" type="button" data-action="sales-document-payment-link" data-id="${escapeHtml(invoice.id)}">Zahlung zuordnen</button>
  </div>`;
}

function settingsPanel({settings,templates,household,profile,canWrite}) {
  if(!canWrite) return '';
  const countryCode=household?.country_code||'CH';
  const isDE=countryCode==='DE';
  const quoteSingular=isDE?'Angebot':'Offerte';
  const quotePlural=isDE?'Angebote':'Offerten';
  const defaults=salesDocumentDefaults(settings,profile?.display_name||household?.name||'',countryCode);
  const logoNote=settings?.logo_storage_path?'Logo ist hinterlegt. Ein neues Bild ersetzt es beim Speichern.':'Noch kein Logo hinterlegt.';
  const templateRows=(templates||[]).map((row)=>`<div class="list-row"><div class="list-row-main"><div><div class="list-row-title">${escapeHtml(row.name)}</div><div class="list-row-meta">${escapeHtml(row.document_type==='all'?'Alle':salesDocumentTypeLabel(row.document_type,countryCode))} · ${escapeHtml(({intro:'Einleitung',payment:'Zahlung',closing:'Schluss'})[row.section]||row.section)}</div></div></div><div class="list-row-trailing"><button class="table-action table-action--danger" type="button" data-action="sales-template-delete" data-id="${escapeHtml(row.id)}">Löschen</button></div></div>`).join('');
  return `
    <section class="card card-padding" style="margin:16px 0" id="salesDocumentSettingsCard">
      <div class="card-heading">
        <div>
          <h2 class="card-title">Dokumenteinstellungen</h2>
          <p class="card-subtitle">Logo, Absender, Zahlungsdaten, Automatik und Textbausteine werden hier zentral gepflegt.</p>
        </div>
        <span class="list-row-leading">${icon('settings')}</span>
      </div>
      <div class="inline-alert" style="margin:12px 0 18px">
        <strong>Automatik ist aktiv.</strong>
        <span>${quotePlural} können in Rechnungen übernommen werden. Passende Zahlungseingänge werden vorgeschlagen. Vollständig bezahlte Rechnungen werden auf „Bezahlt“ gesetzt und können automatisch eine Quittung erzeugen.</span>
      </div>
      <form id="sales-document-settings" data-form="sales-document-settings">
        <div class="card-heading"><div><h3 class="card-title">Absender & Branding</h3><p class="card-subtitle">Einmal pflegen. Diese Angaben werden für neue ${quotePlural}, Rechnungen und Quittungen automatisch übernommen.</p></div></div>
        <div class="form-grid form-grid--2">
          <label class="field"><span>Firma / Absender</span><input class="text-control" name="companyName" value="${escapeHtml(defaults.senderName)}"></label>
          <label class="field"><span>${isDE?'USt-IdNr. / Steuernummer':'MWST-/USt-/IVA-Nr.'}</span><input class="text-control" name="taxId" value="${escapeHtml(settings?.tax_id||'')}"></label>
          <label class="field form-grid-span"><span>Adresse</span><textarea class="text-control" name="companyAddress" rows="2">${escapeHtml(settings?.company_address||'')}</textarea></label>
          <label class="field"><span>E-Mail</span><input class="text-control" name="companyEmail" type="email" value="${escapeHtml(settings?.company_email||'')}"></label>
          <label class="field"><span>Telefon</span><input class="text-control" name="companyPhone" value="${escapeHtml(settings?.company_phone||'')}"></label>
          <label class="field"><span>Webseite</span><input class="text-control" name="companyWebsite" value="${escapeHtml(settings?.company_website||'')}"></label>
          <label class="field"><span>IBAN</span><input class="text-control" name="iban" value="${escapeHtml(settings?.iban||'')}"></label>
          <label class="field"><span>Bank</span><input class="text-control" name="bankName" value="${escapeHtml(settings?.bank_name||'')}"></label>
          <label class="field form-grid-span"><span>Logo</span>${filePicker({id:'salesDocumentLogo',name:'logoFile',accept:'image/png,image/jpeg,image/webp,image/svg+xml'})}<small>${escapeHtml(logoNote)} Empfohlen: PNG/SVG/WebP mit transparentem Hintergrund.</small></label>
          <label class="field"><span>Standard-Zahlungsfrist</span><input class="text-control" name="defaultPaymentDays" type="number" min="0" max="365" value="${defaults.paymentDays}"></label>
          <label class="field"><span>Standard-Gültigkeit ${quoteSingular}</span><input class="text-control" name="defaultQuoteValidDays" type="number" min="0" max="365" value="${defaults.quoteValidDays}"></label>
          <label class="field"><span>Standard-Steuer %</span><input class="text-control" name="defaultTaxRate" type="number" min="0" max="100" step="0.001" value="${escapeHtml(String(defaults.taxRate))}"></label>
          <label class="field"><span>Automatische Quittung</span><span class="settings-inline-control"><input name="autoReceiptOnPayment" type="checkbox" value="true" ${settings?.auto_receipt_on_payment===false?'':'checked'}><span>bei vollständig zugeordneter Zahlung</span></span></label>
          <label class="field form-grid-span"><span>Fusszeile</span><textarea class="text-control" name="footerText" rows="2">${escapeHtml(settings?.footer_text||'')}</textarea></label>
        </div>
        <div class="card-heading" style="margin-top:20px"><div><h3 class="card-title">Standardtexte</h3><p class="card-subtitle">Platzhalter: {Kunde}, {Dokumentnummer}, {Datum}, {Fälligkeitsdatum}, {Total}, {Zahlungsfrist}</p></div></div>
        <div class="form-grid form-grid--2">
          <label class="field form-grid-span"><span>${quoteSingular} · Einleitung</span><textarea class="text-control" name="defaultQuoteIntro" rows="2">${escapeHtml(defaults.quoteIntro)}</textarea></label>
          <label class="field form-grid-span"><span>Rechnung · Einleitung</span><textarea class="text-control" name="defaultInvoiceIntro" rows="2">${escapeHtml(defaults.invoiceIntro)}</textarea></label>
          <label class="field form-grid-span"><span>Quittung · Einleitung</span><textarea class="text-control" name="defaultReceiptIntro" rows="2">${escapeHtml(defaults.receiptIntro)}</textarea></label>
          <label class="field form-grid-span"><span>Zahlungstext</span><textarea class="text-control" name="defaultPaymentText" rows="2">${escapeHtml(defaults.paymentText)}</textarea></label>
          <label class="field form-grid-span"><span>Schlusstext</span><textarea class="text-control" name="defaultClosingText" rows="2">${escapeHtml(defaults.closingText)}</textarea></label>
        </div>
        <div class="form-actions"><button class="action-button action-button--primary" type="submit">Dokumenteinstellungen speichern</button></div>
      </form>

      <div class="card-heading" style="margin-top:26px"><div><h3 class="card-title">Textbausteine</h3><p class="card-subtitle">Wiederverwendbare Texte, die beim Schreiben mit einem Klick eingesetzt werden. Du musst Standardformulierungen nicht jedes Mal neu schreiben.</p></div></div>
      <form id="sales-template-create" data-form="sales-template-create" class="form-grid form-grid--2">
        <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Projektabschluss"></label>
        <label class="field"><span>Dokument</span><select class="text-control" name="documentType"><option value="all">Alle</option><option value="quote">${quoteSingular}</option><option value="invoice">Rechnung</option><option value="receipt">Quittung</option></select></label>
        <label class="field"><span>Bereich</span><select class="text-control" name="section"><option value="intro">Einleitung</option><option value="payment">Zahlung</option><option value="closing">Schluss</option></select></label>
        <label class="field form-grid-span"><span>Text</span><textarea class="text-control" name="content" rows="3" required></textarea></label>
        <div class="form-actions form-grid-span"><button class="action-button action-button--secondary" type="submit">Textbaustein speichern</button></div>
      </form>
      <div class="list" style="margin-top:14px">${templateRows||'<div class="table-empty">Noch keine eigenen Textbausteine.</div>'}</div>
    </section>`;
}

export function renderSalesDocuments({
  salesDocuments = [], salesDocumentSettings = null, salesDocumentTemplates = [], salesDocumentPayments = [],
  transactions = [], household, profile, canWrite = false,
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const countryCode=household?.country_code||'CH';
  const isDE=countryCode==='DE';
  const quoteSingular=isDE?'Angebot':'Offerte';
  const quotePlural=isDE?'Angebote':'Offerten';
  const typeLabel=(type)=>salesDocumentTypeLabel(type,countryCode);
  const defaults=salesDocumentDefaults(salesDocumentSettings,profile?.display_name||household?.name||'',countryCode);
  const today = dateInputValue();
  const plusPayment = dateInputValue(new Date(Date.now() + defaults.paymentDays * 86400000));
  const plusQuote = dateInputValue(new Date(Date.now() + defaults.quoteValidDays * 86400000));
  const invoiceCount = salesDocuments.filter((row)=>row.document_type==='invoice').length;
  const openInvoices = salesDocuments.filter((row)=>row.document_type==='invoice' && !['paid','cancelled'].includes(row.status));
  const quoteCount = salesDocuments.filter((row)=>row.document_type==='quote').length;
  const receiptCount = salesDocuments.filter((row)=>row.document_type==='receipt').length;
  const convertedQuoteIds = new Set(salesDocuments.filter((row)=>row.document_type==='invoice' && row.source_document_id).map((row)=>row.source_document_id));
  const receiptedInvoiceIds = new Set(salesDocuments.filter((row)=>row.document_type==='receipt' && row.source_document_id).map((row)=>row.source_document_id));

  const rows = salesDocuments.map((row)=>{
    const next = nextStatus(row);
    const converted = row.document_type === 'quote' && convertedQuoteIds.has(row.id);
    const paid=paymentTotal(row.id,salesDocumentPayments);
    const remaining=Math.max(0,Number(row.total||0)-paid);
    const linked=salesDocumentPayments.filter((entry)=>entry.sales_document_id===row.id);
    const paymentUi=row.document_type==='invoice' && !['paid','cancelled'].includes(row.status)
      ? paymentOptions(row,transactions,salesDocumentPayments,locale)
      : '';
    const linkedUi=row.document_type==='invoice' && linked.length
      ? `<div class="list-row-meta" style="margin-top:6px">${linked.map((entry)=>`Zahlung ${escapeHtml(money(entry.amount,{currency:row.currency,locale}))}${canWrite?` <button class="table-action" type="button" data-action="sales-document-payment-unlink" data-id="${escapeHtml(row.id)}" data-transaction-id="${escapeHtml(entry.transaction_id)}">lösen</button>`:''}`).join(' · ')}</div>`
      : '';
    const actions = `<div class="row-actions">
      <button class="table-action" type="button" data-action="sales-document-print" data-id="${escapeHtml(row.id)}">Drucken / PDF</button>
      ${canWrite && next ? `<button class="table-action" type="button" data-action="sales-document-status" data-id="${escapeHtml(row.id)}" data-status="${next[0]}">${next[1]}</button>` : ''}
      ${canWrite && row.document_type==='quote' && !converted && !['cancelled','expired'].includes(row.status) ? `<button class="table-action" type="button" data-action="sales-document-convert" data-id="${escapeHtml(row.id)}">In Rechnung umwandeln</button>` : ''}
      ${canWrite && row.document_type==='invoice' && row.status==='paid' && !receiptedInvoiceIds.has(row.id) ? `<button class="table-action" type="button" data-action="sales-document-create-receipt" data-id="${escapeHtml(row.id)}">Quittung erstellen</button>` : ''}
      ${canWrite ? `<button class="table-action table-action--danger" type="button" data-action="sales-document-delete" data-id="${escapeHtml(row.id)}">Löschen</button>` : ''}
    </div>`;
    const secondary = row.document_type === 'invoice' && row.due_date
      ? `Fällig ${dateLabel(row.due_date,locale)}`
      : row.document_type === 'quote' && row.valid_until
        ? `Gültig bis ${dateLabel(row.valid_until,locale)}`
        : `Ausgestellt ${dateLabel(row.issue_date,locale)}`;
    const paymentMeta=row.document_type==='invoice'
      ? ` · bezahlt ${money(paid,{currency:row.currency||currency,locale})} · offen ${money(remaining,{currency:row.currency||currency,locale})}`
      : '';
    return `<div class="list-row sales-document-list-row"><div class="list-row-main"><span class="list-row-leading">${icon('receipt')}</span><div><div class="list-row-title">${escapeHtml(row.document_number)} · ${escapeHtml(typeLabel(row.document_type))}</div><div class="list-row-meta">${escapeHtml(row.recipient_name)} · ${secondary}${paymentMeta}</div>${linkedUi}${paymentUi}</div></div><div class="list-row-trailing"><div class="amount">${money(row.total,{currency:row.currency||currency,locale})}</div>${statusPill(tone(row.status),STATUS_LABELS[row.status]||row.status)}${actions}</div></div>`;
  }).join('');

  const form = canWrite ? `
    <form class="card card-padding form-card" id="sales-document-create" data-form="sales-document-create" hidden>
      <div class="card-heading"><div><h3 class="card-title" id="salesDocumentFormTitle">Rechnung erstellen</h3><p class="card-subtitle">Absender, Zahlungsfrist, Steuer und Standardtexte kommen automatisch aus den Dokumenteinstellungen und können pro Dokument überschrieben werden.</p></div><span class="list-row-leading">${icon('receipt')}</span></div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Dokumenttyp</span><select class="text-control" name="documentType" id="salesDocumentType"><option value="invoice">Rechnung</option><option value="quote">Offerte</option><option value="receipt">Quittung</option></select></label>
        <label class="field"><span>Nummer</span><input class="text-control" name="documentNumber" id="salesDocumentNumber" value="${escapeHtml(nextSalesDocumentNumber(salesDocuments,'invoice'))}" required></label>
        <label class="field"><span>Datum</span><input class="text-control" name="issueDate" id="salesDocumentIssueDate" type="date" value="${today}" required></label>
        <label class="field" id="salesInvoiceDueField"><span>Fällig am</span><input class="text-control" name="dueDate" id="salesDocumentDueDate" type="date" value="${plusPayment}"></label>
        <label class="field" id="salesQuoteValidField" hidden><span>Offerte gültig bis</span><input class="text-control" name="validUntil" id="salesDocumentValidUntil" type="date" value="${plusQuote}"></label>
        <label class="field"><span>Währung</span><select class="text-control" name="currency"><option value="CHF" ${currency==='CHF'?'selected':''}>CHF</option><option value="EUR" ${currency==='EUR'?'selected':''}>EUR</option><option value="USD" ${currency==='USD'?'selected':''}>USD</option><option value="GBP" ${currency==='GBP'?'selected':''}>GBP</option></select></label>
        <label class="field"><span>Absender / Firma</span><input class="text-control" name="senderName" value="${escapeHtml(defaults.senderName)}"></label>
        <label class="field form-grid-span"><span>Absenderadresse</span><textarea class="text-control" name="senderAddress" rows="2">${escapeHtml(defaults.senderAddress)}</textarea></label>
        <label class="field"><span>MWST-/USt-/IVA-Nr.</span><input class="text-control" name="senderTaxId" value="${escapeHtml(defaults.senderTaxId)}"></label>
        <label class="field"><span>Empfänger / Kunde</span><input class="text-control" name="recipientName" required></label>
        <label class="field form-grid-span"><span>Empfängeradresse</span><textarea class="text-control" name="recipientAddress" rows="2"></textarea></label>
        <label class="field"><span>Einleitung · Textbaustein</span><select class="text-control" data-sales-template-select data-sales-target="introText">${templateOptions(salesDocumentTemplates,'intro','invoice')}</select></label>
        <label class="field form-grid-span"><span>Einleitungstext</span><textarea class="text-control" name="introText" rows="3">${escapeHtml(defaults.invoiceIntro)}</textarea></label>
      </div>
      <div class="card-heading" style="margin-top:16px"><div><h3 class="card-title">Positionen</h3><p class="card-subtitle">Steuer wird aus deinen Einstellungen vorausgefüllt und kann je Position geändert werden.</p></div><button class="action-button action-button--secondary" type="button" data-action="sales-document-add-item">${icon('plus')} Position</button></div>
      <div class="stack" id="salesDocumentItems">${itemRow(defaults.taxRate)}</div>
      <template id="salesDocumentItemTemplate">${itemRow(defaults.taxRate)}</template>
      <div class="form-grid form-grid--2" style="margin-top:16px">
        <label class="field"><span>Zahlung · Textbaustein</span><select class="text-control" data-sales-template-select data-sales-target="paymentText">${templateOptions(salesDocumentTemplates,'payment','invoice')}</select></label>
        <label class="field form-grid-span"><span>Zahlungstext</span><textarea class="text-control" name="paymentText" rows="2">${escapeHtml(defaults.paymentText)}</textarea></label>
        <label class="field"><span>Schluss · Textbaustein</span><select class="text-control" data-sales-template-select data-sales-target="closingText">${templateOptions(salesDocumentTemplates,'closing','invoice')}</select></label>
        <label class="field form-grid-span"><span>Schlusstext</span><textarea class="text-control" name="closingText" rows="2">${escapeHtml(defaults.closingText)}</textarea></label>
        <label class="field form-grid-span"><span>Interne Notiz</span><textarea class="text-control" name="notes" rows="2" placeholder="wird nicht gedruckt"></textarea></label>
      </div>
      <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="hide-form" data-target="sales-document-create">Abbrechen</button><button class="action-button action-button--primary" type="submit">Dokument speichern</button></div>
    </form>` : '';

  return `
    ${pageHeader({title:`Rechnungen, ${quotePlural} & Quittungen`,subtitle:'Professionelle Ausgangsdokumente mit Branding, Textbausteinen und Verknüpfung zu echten Zahlungseingängen.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="sales-document-new" data-document-type="invoice">${icon('plus')} Rechnung erstellen</button><button class="action-button action-button--secondary" type="button" data-action="sales-document-new" data-document-type="quote">${icon('plus')} ${quoteSingular} schreiben</button><button class="action-button action-button--secondary" type="button" data-action="sales-document-new" data-document-type="receipt">${icon('plus')} Quittung ausstellen</button>`:''})}
    ${settingsPanel({settings:salesDocumentSettings,templates:salesDocumentTemplates,household,profile,canWrite})}
    ${form}
    <div class="metric-grid" style="margin:16px 0">${metricCard('Offene Rechnungen',String(openInvoices.length),`${invoiceCount} Rechnungen total`)}${metricCard(quotePlural,String(quoteCount),'Entwürfe, versendet oder angenommen')}${metricCard('Quittungen',String(receiptCount),'ausgestellte Zahlungsbestätigungen')}</div>
    <div class="inline-alert"><strong>Zahlungen werden mit echten Kontobuchungen verbunden.</strong><span>ALEMANNO BUCHHALTUNG schlägt passende Zahlungseingänge nach Betrag, Währung und Datum vor. Eine vollständig zugeordnete Rechnung wird bezahlt; auf Wunsch entsteht automatisch eine Quittung.</span></div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Ausgangsdokumente</h3><p class="card-subtitle">${salesDocuments.length} Dokumente</p></div></div>${rows?`<div class="list">${rows}</div>`:'<div class="table-empty">Noch keine Rechnungen, ${quotePlural} oder Quittungen erstellt.</div>'}</article>`;
}
