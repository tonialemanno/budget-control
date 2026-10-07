import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const transactions = readFileSync(new URL('../assets/js/views/transactions.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../assets/js/views/admin.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261004_admin_reset_and_activity_cascade_fix.sql', import.meta.url), 'utf8');

assert.match(transactions, /transactionEditOptionalDetails/);
assert.match(transactions, /Zusätzliche Zuordnung · Kontext oder Fahrzeug/);
assert.match(transactions, /transactionEditVehicleTypeField" hidden/);
assert.match(transactions, /transactionCreateVehicleTypeField" hidden/);
assert.match(main, /admin-finance-reset/);
assert.match(main, /admin_reset_user_finance/);
assert.match(main, /transactionEditVehicleName/);
assert.match(admin, /Spendy-Daten zurücksetzen/);
assert.match(migration, /paid_transaction_id=null/);
assert.match(migration, /delete from public\.debt_payments/);
assert.match(migration, /delete from public\.receivable_payments/);
assert.match(migration, /not exists \(select 1 from public\.households/);

console.log('transaction-progressive-reset-tests: ok');
