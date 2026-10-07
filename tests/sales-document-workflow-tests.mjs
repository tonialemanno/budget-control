import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nextSalesDocumentNumber,
  salesDocumentDefaults,
  expandSalesDocumentText,
  salesPaymentCandidates,
  renderSalesDocuments,
} from '../assets/js/views/sales-documents.js';

const docs=[
  {document_type:'invoice',document_number:'RE-2026-0002'},
  {document_type:'quote',document_number:'OF-2026-0008'},
];
assert.equal(nextSalesDocumentNumber(docs,'invoice',new Date('2026-10-07T12:00:00Z')),'RE-2026-0003');
assert.equal(nextSalesDocumentNumber(docs,'quote',new Date('2026-10-07T12:00:00Z')),'OF-2026-0009');

const defaults=salesDocumentDefaults({company_name:'agazone-finance',default_payment_days:14,default_tax_rate:8.1},'Fallback');
assert.equal(defaults.senderName,'agazone-finance');
assert.equal(defaults.paymentDays,14);
assert.equal(defaults.taxRate,8.1);
assert.match(defaults.invoiceIntro,/Rechnung|Leistungen/);

assert.equal(
  expandSalesDocumentText('Hallo {Kunde}, {Dokumentnummer} ist bis {Fälligkeitsdatum} zahlbar.',{
    recipientName:'Abacus',documentNumber:'RE-2026-0001',dueDate:'2026-11-06',
  }),
  'Hallo Abacus, RE-2026-0001 ist bis 2026-11-06 zahlbar.',
);

const invoice={id:'i1',document_type:'invoice',issue_date:'2026-10-01',currency:'CHF',total:1124.55,status:'sent'};
const transactions=[
  {id:'exact',occurred_at:'2026-10-08T10:00:00Z',amount:1124.55,currency:'CHF',status:'booked',description:'Abacus Umantis AG',transfer_group_id:null},
  {id:'other',occurred_at:'2026-10-08T10:00:00Z',amount:1000,currency:'CHF',status:'booked',description:'Andere Zahlung',transfer_group_id:null},
  {id:'outgoing',occurred_at:'2026-10-08T10:00:00Z',amount:-1124.55,currency:'CHF',status:'booked',description:'Ausgabe',transfer_group_id:null},
  {id:'transfer',occurred_at:'2026-10-08T10:00:00Z',amount:1124.55,currency:'CHF',status:'booked',description:'Umbuchung',transfer_group_id:'g1'},
];
const candidates=salesPaymentCandidates(invoice,transactions,[]);
assert.equal(candidates[0].id,'exact');
assert.equal(candidates.some((row)=>row.id==='outgoing'),false);
assert.equal(candidates.some((row)=>row.id==='transfer'),false);

const html=renderSalesDocuments({
  salesDocuments:[{...invoice,document_number:'RE-2026-0001',recipient_name:'Abacus Umantis AG',due_date:'2026-11-06',subtotal:1050,tax_total:74.55,items:[]}],
  salesDocumentSettings:{company_name:'agazone-finance',logo_storage_path:'h/branding/logo.png',default_payment_days:30,auto_receipt_on_payment:true},
  salesDocumentTemplates:[{id:'t1',document_type:'invoice',section:'intro',name:'Standard Kunde',content:'Guten Tag {Kunde}'}],
  salesDocumentPayments:[],
  transactions,
  household:{id:'h1',name:'Privat',base_currency:'CHF'},
  profile:{display_name:'Toni',locale:'de-CH'},
  canWrite:true,
});
assert.match(html,/Dokumenteinstellungen · Logo, Absender & Textbausteine/);
assert.match(html,/Logo ist hinterlegt/);
assert.match(html,/Standard Kunde/);
assert.match(html,/Zahlung zuordnen/);
assert.match(html,/automatisch eine Quittung/i);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/width:210mm/);
assert.match(main,/@page\{size:A4/);
assert.match(main,/linkSalesDocumentPayment/);
assert.match(main,/createReceiptFromInvoice/);
assert.match(main,/uploadSalesDocumentLogo/);
assert.match(main,/salesDocumentTemplates/);

const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
assert.match(api,/sales_document_settings/);
assert.match(api,/sales_document_templates/);
assert.match(api,/sales_document_payments/);
assert.match(api,/link_sales_document_payment_v1/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261007132000_sales_document_business_workflow.sql',import.meta.url),'utf8');
assert.match(migration,/create table if not exists public\.sales_document_settings/);
assert.match(migration,/create table if not exists public\.sales_document_templates/);
assert.match(migration,/create table if not exists public\.sales_document_payments/);
assert.match(migration,/link_sales_document_payment_v1/);
assert.match(migration,/private\.can_write_household/);

const settings=fs.readFileSync(new URL('../assets/js/views/settings.js',import.meta.url),'utf8');
assert.match(settings,/Rechnungen & Dokumente/);
assert.match(settings,/Logo, Absender, Zahlungsdaten und Textbausteine/);

console.log('sales document business workflow assertions OK');
