import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const config = read('assets/js/app/config.js');
const api = read('assets/js/app/finance-api.js');
const main = read('assets/js/main.js');
const admin = read('assets/js/views/admin.js');
const receivables = read('assets/js/views/receivables.js');
const migration = read('supabase/migrations/20261001_finance_v2_4_receivables_presence.sql');
const geo = read('functions/api/geo.js');

assert.match(config, /receivables/);
assert.match(main, /renderReceivables/);
assert.match(main, /receivable-payment-create/);
assert.match(api, /recordReceivablePayment/);
assert.match(admin, /last_seen_at/);
assert.match(receivables, /Wer schuldet dir Geld/);
assert.match(migration, /create table if not exists public\.receivables/);
assert.match(migration, /last_seen_at/);
assert.match(geo, /CH:\s*'CHF'/);
assert.match(geo, /IT:\s*'EUR'/);
console.log('V2.4 receivables/presence/geo assertions OK');
