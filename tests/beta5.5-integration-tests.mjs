import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL(`../${path}`, import.meta.url));

assert.match(read('assets/js/app/config.js'), /version:\s*'2\.3\.0-beta-5\.4'/);
assert.match(read('index.html'), /boot-fallback\.js/);
assert.match(read('index.html'), /Finance wird geladen/);
assert.doesNotMatch(read('assets/js/app/receipt-controller.js'), /new MutationObserver\(syncVersionLabel\)/);
assert.equal(exists('assets/js/views/fixed-costs.js'), true);
assert.match(read('assets/js/views/fixed-costs.js'), /Fixe Ausgaben \/ Monat/);
assert.match(read('assets/js/main.js'), /fixed-cost-create/);
assert.match(read('assets/js/main.js'), /fixed-cost-edit/);
assert.match(read('assets/js/views/fixed-costs.js'), /Umbuchung \/ Topf/);
assert.match(read('assets/js/views/fixed-costs.js'), /Fixe Umbuchungen \/ Monat/);
assert.match(read('assets/js/views/overview.js'), /Einnahmen \/ Monat/);
assert.match(read('assets/js/views/overview.js'), /Fixe Ausgaben \/ Monat/);
assert.match(read('assets/js/views/overview.js'), /Weitere geplante Ausgaben/);
assert.match(read('assets/js/views/overview.js'), /Fixe Umbuchungen \/ Monat/);
assert.match(read('assets/js/main.js'), /destination_account_id/);
assert.equal(exists('assets/js/app/projections.js'), true);
assert.match(read('assets/js/app/projections.js'), /projectedBalance/);
assert.match(read('assets/js/app/projections.js'), /destination_account_id===account\.account_id/);
assert.match(read('assets/js/app/components.js'), /Prognose bis/);
assert.match(read('assets/js/app/components.js'), /Geplant/);
assert.match(read('supabase/migrations/20261001_finance_recurring_transfers.sql'), /direction in \('income','expense','transfer'\)/);
assert.match(read('supabase/migrations/20261001_finance_recurring_transfers.sql'), /destination_account_id/);
assert.match(read('supabase/migrations/20261001_finance_v2_3_beta5_5_security_hardening.sql'), /user_presence_select_own/);
for (const path of ['Dockerfile','docker-compose.yml','runtime-config.js','supabase/config.toml']) {
  assert.equal(exists(path), true, `${path} is required`);
}
console.log('Production recovery integration assertions OK');
