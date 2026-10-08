import assert from 'node:assert/strict';
import fs from 'node:fs';

const edge=fs.readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../assets/js/app/backend.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../assets/js/views/admin.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../assets/js/views/profile.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');

assert.match(edge,/action === "delete_self"/);
assert.match(edge,/action === "delete_user"/);
assert.match(edge,/assertUserDeletionSafe/);
assert.match(edge,/list_owned_storage_objects_v1/);
assert.match(edge,/purge_user_finance_v1/);
assert.match(edge,/admin\.auth\.admin\.deleteUser\(userId, false\)/);
assert.match(edge,/enrich_demo_instance_v1/);
assert.match(backend,/adminDeleteUser/);
assert.match(backend,/deleteOwnAccount/);
assert.match(admin,/Benutzer endgültig löschen/);
assert.match(profile,/Mein Konto endgültig löschen/);
assert.match(main,/account-delete-self/);
assert.match(main,/admin-user-delete/);
assert.match(main,/confirmation\.trim\(\)\.toLowerCase\(\)!==email\.toLowerCase\(\)/);

console.log('account deletion wiring assertions OK');
