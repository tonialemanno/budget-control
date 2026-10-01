import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL(`../${path}`, import.meta.url));

assert.match(read('assets/js/app/config.js'), /version:\s*'2\.3\.0-beta-5\.5'/);
assert.match(read('assets/js/app/backend.js'), /__FINANCE_CONFIG__/);
assert.match(read('assets/js/app/backend.js'), /\/api\/geo/);
assert.match(read('assets/js/main.js'), /geoContext/);
assert.match(read('assets/js/main.js'), /clearPresence/);
assert.match(read('assets/js/views/accounts.js'), /suggestedCurrency/);
assert.match(read('assets/js/views/receivables.js'), /suggestedCurrency/);
assert.match(read('index.html'), /runtime-config\.js/);
assert.match(read('supabase/migrations/20261001_finance_v2_3_beta5_5_security_hardening.sql'), /user_presence_select_own/);
assert.match(read('supabase/migrations/20261001_finance_v2_3_beta5_5_security_hardening.sql'), /security invoker/i);
for (const path of ['Dockerfile','docker-compose.yml','runtime-config.js','runtime-config.local.example.js','supabase/config.toml','docs/LOCAL-DEVELOPMENT.md']) {
  assert.equal(exists(path), true, `${path} is required`);
}
console.log('Beta 5.5 integration assertions OK');
