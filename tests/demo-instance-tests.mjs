import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderAdmin } from '../assets/js/views/admin.js';

const backend=fs.readFileSync(new URL('../assets/js/app/backend.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_demo_instance_auth_context.sql',import.meta.url),'utf8');

assert.match(backend,/adminCreateDemo/);
assert.match(main,/admin-demo-create/);
assert.match(main,/admin-demo-copy/);
assert.match(edge,/action === "create_demo"/);
assert.match(edge,/provision_demo_instance/);
assert.match(edge,/demoPassword/);
assert.match(migration,/create table if not exists public\.demo_instances/);
assert.match(migration,/create or replace function public\.provision_demo_instance/);
assert.match(migration,/request\.jwt\.claim\.sub/);
assert.match(migration,/Demo Haushalt/);
assert.match(migration,/Demo Immobilien AG/);
assert.match(migration,/Vanguard FTSE All-World/);
assert.match(migration,/Säule 3a/);
assert.match(migration,/Ferien vorgestreckt/);
assert.match(migration,/Zahnarztrechnung/);
assert.match(migration,/revoke all on function public\.provision_demo_instance/);
assert.match(migration,/grant execute on function public\.provision_demo_instance\(uuid,text\) to service_role/);

const html=renderAdmin({
  adminUsers:[],
  productModules:[],
  demoCredentials:{email:'demo@example.com',password:'Demo-AbCd2345!7'},
});
assert.match(html,/Gesicherter Demo-Referenzstand/);
assert.match(html,/demo@example\.com/);
assert.match(html,/Demo-AbCd2345!7/);
assert.match(html,/admin-demo-copy/);
assert.match(html,/Nur Demo-Passwort erneuern/);
assert.match(html,/Referenzstand wiederherstellen/);
assert.match(html,/9\. Oktober 2026/);
assert.match(html,/399 Buchungen/);
assert.match(html,/admin-demo-restore/);
assert.match(backend,/adminRestoreDemoBaseline/);
assert.match(main,/admin-demo-restore/);
assert.match(edge,/action === "restore_demo_baseline"/);
assert.match(edge,/restore_demo_golden_v1/);
assert.match(html,/admin-demo-password-reset/);
assert.match(backend,/adminResetDemoPassword/);
assert.match(main,/admin-demo-password-reset/);
assert.match(edge,/action === "reset_demo_password"/);
const passwordOnlyBranch=edge.split('if (action === "reset_demo_password") {')[1]?.split('if (action === "set_password") {')[0]||'';
assert.match(passwordOnlyBranch,/updateUserById/);
assert.doesNotMatch(passwordOnlyBranch,/provision_demo_instance|enrich_demo_instance_v1|deleteUser|delete\(/);

console.log('demo instance tests passed');
