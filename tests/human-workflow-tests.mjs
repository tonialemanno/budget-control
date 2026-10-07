import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const config=read('assets/js/app/config.js');
const main=read('assets/js/main.js');
const index=read('index.html');
const accounts=read('assets/js/views/accounts.js');
const imports=read('assets/js/views/imports.js');
const transactions=read('assets/js/views/transactions.js');
const planning=read('assets/js/views/planning.js');
const settings=read('assets/js/views/settings.js');
const ch=read('assets/js/country/ch.js');
const api=read('assets/js/app/finance-api.js');

assert.match(config,/route: 'review'/);
assert.match(config,/route: 'projects'/);
assert.match(config,/review: \{ title: 'Zu prüfen'/);
assert.match(index,/id="searchButton"/);
assert.match(main,/renderReview/);
assert.match(main,/renderSearch/);
assert.match(main,/renderProjects/);
assert.match(main,/last_visit_at/);
assert.match(main,/applyInformationDepth/);
assert.match(main,/reconcileImportedOwnTransfers/);
assert.match(main,/ownAccountForReference/);
assert.match(main,/review-link-transfer/);
assert.match(main,/createTransactionChangeLog/);
assert.match(accounts,/externalAccountRef/);
assert.match(imports,/Gegenkonto \/ IBAN/);
assert.match(imports,/Bankreferenz \/ Zweck/);
assert.match(transactions,/Originale Bankdaten anzeigen/);
assert.match(transactions,/usableBookingCategory/);
assert.match(planning,/Feste Zahlungen/);
assert.match(planning,/Automatik im Detail/);
assert.match(planning,/#\/sales-documents/);
assert.match(planning,/Rechnungen \/ Offerten erstellen/);
assert.match(settings,/Einfach zeigt nur Alltagsfelder/);
assert.match(ch,/Rückerstattung/);
assert.match(ch,/Rechts- & Gerichtskosten/);
assert.doesNotMatch(ch,/\['Sparen','expense'\]/);
assert.match(api,/counterparty_account_ref/);
assert.match(api,/import_raw_data/);
assert.match(api,/transaction_change_log/);

for(const path of [
  'assets/js/app/review-queue.js',
  'assets/js/views/review.js',
  'assets/js/views/search.js',
  'assets/js/views/projects.js',
  'supabase/migrations/20261005214921_finance_review_import_context_history.sql',
  'supabase/migrations/20261005215723_finance_semantic_category_cleanup.sql',
  'supabase/migrations/20261005220116_finance_account_balance_external_ref.sql',
  'supabase/migrations/20261005220205_finance_runtime_schema_r24.sql',
]) assert.equal(fs.existsSync(new URL(`../${path}`,import.meta.url)),true,`${path} missing`);

console.log('human workflow assertions OK');
