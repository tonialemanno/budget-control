import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTransactions } from '../assets/js/views/transactions.js';
import { renderDebts } from '../assets/js/views/debts.js';

const household={id:'h1',base_currency:'CHF'};
const profile={locale:'de-CH'};
const accounts=[
  {account_id:'a1',name:'Lohnkonto',currency:'CHF',account_type:'checking',current_balance:5000},
  {account_id:'a2',name:'Sparkonto',currency:'CHF',account_type:'savings',current_balance:2000},
];
const now=new Date().toISOString();
const baseTx=(id,amount,cashflow='standard')=>({
  id,household_id:'h1',account_id:'a1',category_id:null,merchant_id:null,
  occurred_at:now,amount,currency:'CHF',description:id,counterparty:'Demo',
  status:'booked',source:'manual',cashflow_type:cashflow,transfer_group_id:null,
  accounts:{name:'Lohnkonto'},categories:null,merchants:null,
});

const receivable=baseTx('recv1',-300,'receivable_principal');
let html=renderTransactions({
  accounts,transactions:[receivable],bills:[],debtPayments:[],household,profile,
  fxRates:{},canWrite:true,moduleAccess:{tax:true},
});
assert.match(html,/Forderung anzeigen/);
assert.doesNotMatch(html,/data-action="transaction-edit"/);
assert.doesNotMatch(html,/data-action="transaction-make-recurring"/);
assert.doesNotMatch(html,/data-action="transaction-delete"/);

const billTx=baseTx('billtx',-120,'standard');
html=renderTransactions({
  accounts,transactions:[billTx],bills:[{id:'b1',status:'paid',paid_transaction_id:'billtx'}],
  debtPayments:[],household,profile,fxRates:{},canWrite:true,moduleAccess:{tax:true},
});
assert.match(html,/Rechnung anzeigen/);
assert.doesNotMatch(html,/data-action="transaction-edit"/);
assert.doesNotMatch(html,/data-action="transaction-delete"/);

const normalTx=baseTx('normal1',-75,'standard');
html=renderTransactions({
  accounts,transactions:[normalTx],bills:[],debtPayments:[],household,profile,
  fxRates:{},canWrite:true,moduleAccess:{tax:true},
});
assert.match(html,/data-action="transaction-edit"/);
assert.match(html,/data-action="transaction-delete"/);

const debt={
  id:'d1',household_id:'h1',name:'Demo Schuld',creditor:'Demo',debt_type:'private',
  original_amount:1000,outstanding_amount:1000,currency:'CHF',interest_rate:0,
  installment_amount:100,payment_cadence:'monthly',next_payment_date:'2026-11-01',
  status:'active',recurring_rule_id:null,
};
const debtHtml=renderDebts({
  debts:[debt],debtPayments:[],accounts,
  transactions:[receivable,billTx,normalTx],
  bills:[{id:'b1',status:'paid',paid_transaction_id:'billtx'}],
  recurringRules:[],household,profile,fxRates:{},canWrite:true,
});
assert.match(debtHtml,/value="normal1"/,'ordinary outgoing transaction should be linkable to a debt payment');
assert.doesNotMatch(debtHtml,/value="recv1"/,'receivable transaction must not be offered as debt payment');
assert.doesNotMatch(debtHtml,/value="billtx"/,'paid bill transaction must not be offered as debt payment');

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_managed_transaction_link_guards.sql',import.meta.url),'utf8');
const receipt=fs.readFileSync(new URL('../assets/js/app/receipt-controller.js',import.meta.url),'utf8');
const preview=fs.readFileSync(new URL('../assets/js/app/document-preview.js',import.meta.url),'utf8');

assert.match(main,/Forderungsbuchungen werden unter Forderungen verwaltet/);
assert.match(main,/bezahlt.*Rechnung|bezahlten Rechnung/s);
assert.match(migration,/transactions_protect_receivable/);
assert.match(migration,/debt_payments_00_validate_link_target/);
assert.match(migration,/transactions_guard_managed_transfer/);
assert.match(migration,/cashflow_type/);
assert.match(receipt,/import \{ getLocale, t \} from '\.\/i18n\.js'/);
assert.match(preview,/import \{ t \} from '\.\/i18n\.js'/);
assert.doesNotMatch(receipt,/confirm\('Es gibt bereits eine sehr ähnliche Bankbuchung/);
assert.doesNotMatch(preview,/alert\(`Vorschau konnte nicht geöffnet werden/);

console.log('managed transaction linkage assertions OK');
