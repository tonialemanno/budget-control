// Integrated Finance consistency baseline
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

assert.equal(exists('assets/js/app/finance-model.js'), true);
assert.match(read('assets/js/views/overview.js'), /buildFinanceSnapshot/);
assert.match(read('assets/js/views/intelligence.js'), /buildFinanceSnapshot/);
assert.match(read('assets/js/views/intelligence.js'), /Offene Forderungen/);
assert.match(read('assets/js/views/intelligence.js'), /Fixe Umbuchungen \/ Monat/);
assert.match(read('assets/js/app/finance-model.js'), /receivablesOutstanding/);
assert.match(read('assets/js/app/finance-model.js'), /plannedVariableMonthly/);
assert.match(read('assets/js/app/finance-model.js'), /fixedTransfersMonthly/);
assert.match(read('assets/js/main.js'), /syncContractRecurring/);
assert.match(read('assets/js/main.js'), /syncInsuranceRecurring/);
assert.match(read('assets/js/main.js'), /syncRecurringSourceFromRule/);
assert.match(read('supabase/migrations/20261001_finance_recurring_source_links.sql'), /contracts.*recurring_rule_id/s);
assert.match(read('supabase/migrations/20261001_finance_recurring_source_links.sql'), /insurance_policies.*recurring_rule_id/s);

assert.match(read('supabase/migrations/20261001_finance_goal_account_links.sql'), /savings_goals/);
assert.match(read('assets/js/views/goals.js'), /Topf \/ Konto/);
assert.match(read('assets/js/views/goals.js'), /Automatisch auf/);
assert.match(read('assets/js/views/goals.js'), /current_balance/);
assert.match(read('assets/js/main.js'), /goalCreateAccount/);
assert.match(read('assets/js/main.js'), /account_id:account\?\.account_id/);
assert.match(read('assets/js/views/settings.js'), /localeSelect/);
assert.match(read('assets/js/views/admin.js'), /admin-set-locale/);
assert.match(read('assets/js/app/backend.js'), /adminSetLocale/);
assert.match(read('supabase/functions/admin-users/index.ts'), /set_locale/);

assert.match(read('assets/js/app/format.js'), /export function moneyText/);
assert.match(read('assets/js/views/overview.js'), /moneyText\(snapshot\.plannedFutureExpensesMonth/);
assert.match(read('assets/js/views/intelligence.js'), /moneyText\(snapshot\.plannedFutureExpensesMonth/);
assert.match(read('assets/js/views/transactions.js'), /Ø Ausgaben \/ Monat/);
assert.match(read('assets/js/views/transactions.js'), /monthlyAverage/);

assert.match(read('assets/js/views/budget.js'), /Ausgabenmuster & Budgetvorschläge/);
assert.match(read('assets/js/views/budget.js'), /budget-suggestion-toggle/);
assert.match(read('assets/js/views/budget.js'), /budget-transaction-edit/);
assert.match(read('assets/js/main.js'), /budgetExpandedMerchantId/);
assert.match(read('assets/js/main.js'), /pendingTransactionEditId/);
assert.match(read('assets/js/views/transactions.js'), /transactionEditMerchant/);
assert.match(read('assets/js/main.js'), /merchant_id:nullValue\(data,'merchantId'\)/);
