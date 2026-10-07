import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../assets/js/views/profile.js',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../assets/js/views/settings.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261007154500_user_locale_self_service.sql',import.meta.url),'utf8');

assert.match(profile,/id="profileLocaleSelect"/);
assert.match(settings,/id="localeSelect"/);
assert.match(main,/target\.id === 'localeSelect' \|\| target\.id === 'profileLocaleSelect'/);
assert.match(main,/saveCurrentUserLocale/);
assert.match(main,/route === 'profile'/);
assert.match(api,/setMyLocale/);
assert.match(api,/set_my_locale_v1/);
assert.match(migration,/auth\.uid\(\)/);
assert.match(migration,/p_locale not in \('de-CH','de-DE','it-CH','it-IT','en-CH','en-GB'\)/);
assert.match(migration,/security definer/i);

console.log('personal language preference assertions OK');
