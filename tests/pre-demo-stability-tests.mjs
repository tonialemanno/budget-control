import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

const config=read('assets/js/app/config.js');
const backend=read('assets/js/app/backend.js');
const receipt=read('assets/js/app/receipt-controller.js');
const main=read('assets/js/main.js');
const docPreview=read('assets/js/app/document-preview.js');
const receivableMigration=read('supabase/migrations/20261002_finance_receivables_rpc_reconcile_to_repo.sql');
const demoMigration=read('supabase/migrations/20261002_finance_demo_reset_paid_bill_unlink.sql');
const receivableSameDayMigration=read('supabase/migrations/20261002_finance_receivables_same_day_balance_fix.sql');

assert.match(config,/host\.endsWith\('\.aione-test\.pages\.dev'\).*host !== 'aione-test\.pages\.dev'/s);
assert.equal((backend.match(/fetchWithTimeout\(/g)||[]).length>=6,true,'all network/storage paths should use bounded requests');
assert.match(backend,/storage\/v1\/object\/.*45000/s);
assert.match(receipt,/new AbortController\(\)/);
assert.match(receipt,/3500/);

assert.match(receivableMigration,/private\.has_module_access\('debts'\)/);
assert.doesNotMatch(receivableMigration,/private\.has_module_access\('receivables'\)/);
assert.match(receivableSameDayMigration,/coalesce\(p_lent_at,current_date\)=current_date then now\(\)/);
assert.match(receivableSameDayMigration,/coalesce\(p_paid_at,current_date\)=current_date then now\(\)/);
assert.match(receivableSameDayMigration,/cashflow_type='receivable_principal'/);

assert.match(demoMigration,/paid_transaction_id=null/);
assert.match(demoMigration,/delete from public\.households where id = v_old_household/);
assert.match(demoMigration,/contracts[\s\S]*recurring_rule_id/);
assert.match(demoMigration,/insurance_policies[\s\S]*recurring_rule_id/);
assert.match(demoMigration,/debts[\s\S]*recurring_rule_id/);

const handlerSource=[main,receipt,docPreview].join('\n');
const viewDir=path.join(root,'assets/js/views');
const viewFiles=fs.readdirSync(viewDir).filter((name)=>name.endsWith('.js')).map((name)=>path.join(viewDir,name));
viewFiles.push(path.join(root,'assets/js/app/components.js'));

const missingActions=[];
const missingForms=[];
for(const file of viewFiles){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/data-action=["']([^"'$]+)["']/g)){
    const action=match[1];
    if(!handlerSource.includes(action)) missingActions.push(action);
  }
  for(const match of source.matchAll(/data-form=["']([^"'$]+)["']/g)){
    const form=match[1];
    if(!handlerSource.includes(form)) missingForms.push(form);
  }
}
assert.deepEqual([...new Set(missingActions)],[],'rendered actions must have a handler');
assert.deepEqual([...new Set(missingForms)],[],'rendered forms must have a handler');

console.log('pre-demo stability assertions OK');
