// Integrated Finance consistency baseline
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL(`../${path}`, import.meta.url));

assert.match(read('assets/js/app/config.js'), /version:\s*'2\.3\.17'/);
assert.match(read('index.html'), /boot-fallback\.js/);
assert.match(read('index.html'), /Finance wird geladen/);
assert.doesNotMatch(read('assets/js/app/receipt-controller.js'), /new MutationObserver\(syncVersionLabel\)/);
assert.equal(exists('assets/js/views/fixed-costs.js'), true);
assert.match(read('assets/js/views/fixed-costs.js'), /Fixe Ausgaben \/ Monat/);
assert.match(read('assets/js/main.js'), /fixed-cost-create/);
assert.match(read('assets/js/main.js'), /fixed-cost-edit/);
assert.match(read('assets/js/views/fixed-costs.js'), /Umbuchung \/ Topf/);
assert.match(read('assets/js/views/fixed-costs.js'), /Rücklagen & Umbuchungen \/ Monat/);
assert.match(read('assets/js/views/overview.js'), /Bis zum nächsten Lohn frei/);
assert.match(read('assets/js/views/overview.js'), /Finance hat bemerkt/);
assert.match(read('assets/js/views/overview.js'), /renderMoneyFlow/);
assert.match(read('assets/js/views/overview.js'), /renderCashflowChart/);
assert.match(read('assets/js/views/overview.js'), /renderExpenseDonut/);
assert.equal(exists('assets/js/app/finance-coach.js'), true);
assert.match(read('assets/js/app/finance-coach.js'), /buildFinanceCoach/);
assert.match(read('assets/js/app/charts.js'), /cashflow-svg/);
assert.match(read('assets/js/app/charts.js'), /donut-svg/);
assert.match(read('assets/js/app/charts.js'), /money-flow-svg/);
assert.match(read('assets/js/views/planning.js'), /Fixkosten/);
assert.match(read('assets/js/views/planning.js'), /Daueraufträge & Automatik/);
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
assert.match(read('assets/js/views/intelligence.js'), /Rücklagen & Umbuchungen \/ Monat/);
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
assert.match(read('assets/js/app/finance-model.js'), /unbudgetedFutureExpensesMonth/);
assert.match(read('assets/js/views/intelligence.js'), /moneyText\(snapshot\.unbudgetedFutureExpensesMonth/);
assert.match(read('assets/js/views/transactions.js'), /Ø Ausgaben \/ Monat/);
assert.match(read('assets/js/views/transactions.js'), /monthlyAverage/);

assert.match(read('assets/js/views/budget.js'), /Ausgabenmuster/);
assert.match(read('assets/js/app/budget-engine.js'), /buildBudgetPatterns/);
assert.match(read('assets/js/app/budget-engine.js'), /Gesamte Historie|full_history/);
assert.match(read('assets/js/app/finance-semantics.js'), /semanticType/);
assert.match(read('supabase/migrations/20261004_transaction_reporting_semantics.sql'), /semantic_type/);
assert.match(read('assets/js/views/budget.js'), /budget-suggestion-toggle/);
assert.match(read('assets/js/views/budget.js'), /budget-transaction-edit/);
assert.match(read('assets/js/main.js'), /budgetExpandedMerchantId/);
assert.match(read('assets/js/main.js'), /pendingTransactionEditId/);
assert.match(read('assets/js/views/transactions.js'), /transactionEditMerchant/);
assert.match(read('assets/js/main.js'), /createEconomicTransaction/);
assert.match(read('assets/js/main.js'), /merchantDefaultCategory/);

assert.match(read('supabase/migrations/20261001_finance_recurring_merchant_links.sql'), /merchant_id/);
assert.match(read('assets/js/views/fixed-costs.js'), /Händler \/ Empfänger/);
assert.match(read('assets/js/views/fixed-costs.js'), /fixedCost\$\{suffix\}Merchant/);
assert.match(read('assets/js/main.js'), /merchant_id:merchantId/);
assert.match(read('assets/js/main.js'), /default_category_id/);
assert.match(read('assets/js/app/finance-api.js'), /merchants\(name,normalized_key,default_category_id\)/);
assert.match(read('assets/js/app/finance-model.js'), /merchantMatch/);
assert.match(read('assets/js/app/budget-engine.js'), /rule\.merchant_id/);

assert.equal(exists('assets/js/views/merchants.js'), true);
assert.match(read('assets/js/app/config.js'), /merchants: \{ title: 'Händler'/);
assert.match(read('assets/js/main.js'), /renderMerchants/);
assert.match(read('assets/js/main.js'), /merchant-create/);
assert.match(read('assets/js/main.js'), /merchant-edit/);
assert.match(read('assets/js/main.js'), /normalizeMerchantKey/);
assert.match(read('assets/js/views/merchants.js'), /Standardkategorie/);
assert.match(read('assets/js/views/merchants.js'), /Verwendung/);
assert.match(read('assets/js/views/merchants.js'), /merchantSearch/);

const mainSource=read('assets/js/main.js');
const recurringStart=mainSource.indexOf("if (id === 'recurring-create')");
const recurringEnd=mainSource.indexOf("if (id === 'fixed-cost-create')",recurringStart);
const recurringBlock=mainSource.slice(recurringStart,recurringEnd);
assert.doesNotMatch(recurringBlock,/merchant_id:merchantId/);
assert.doesNotMatch(recurringBlock,/merchant\?\.name/);
assert.match(recurringBlock,/category_id:direction==='transfer'\?null:nullValue\(data,'categoryId'\)/);

assert.doesNotMatch(read('assets/js/app/config.js'), /route: 'merchants'/);
assert.match(read('assets/js/app/config.js'), /merchants: \{ title: 'Händler', eyebrow: 'Einstellungen' \}/);
assert.match(read('assets/js/views/settings.js'), /Stammdaten/);
assert.match(read('assets/js/views/settings.js'), /href:['"]#\/merchants/);

assert.equal(exists('assets/js/app/recurrence.js'), true);
assert.match(read('assets/js/views/recurring.js'), /effectiveNextDate/);
assert.match(read('assets/js/views/fixed-costs.js'), /effectiveNextDate/);
assert.match(read('assets/js/views/budget.js'), /Variabel ausgegeben/);
assert.match(read('assets/js/views/budget.js'), /Nicht im variablen Budget/);
assert.match(read('assets/js/app/finance-model.js'), /unbudgetedActualVariableExpensesMonth/);
assert.match(read('assets/js/app/budget-engine.js'), /fixedRows/);
assert.match(read('assets/js/app/budget-engine.js'), /savingRows/);
assert.match(read('assets/js/app/budget-engine.js'), /taxRows/);
assert.match(read('assets/js/main.js'), /Diese Planung ist verknüpft mit/);
assert.match(read('assets/js/main.js'), /Diese Schuld hat eine Zahlungshistorie/);
assert.match(read('assets/js/views/bills.js'), /data-action="bill-edit"/);
assert.match(read('assets/js/views/bills.js'), /data-action="contract-edit"/);
assert.match(read('assets/js/views/bills.js'), /contract-recurring-remove/);
assert.match(read('assets/js/views/insurance.js'), /insurance-recurring-remove/);
assert.match(read('assets/js/views/insurance.js'), /name="status"/);
assert.match(read('assets/js/main.js'), /status:id==='insurance-edit'/);
assert.match(read('assets/js/views/settings.js'), /Sprache & Region/);


assert.equal(exists('assets/js/app/transaction-engine.js'), true);
assert.equal(exists('assets/js/app/finance-insights.js'), true);
assert.equal(exists('assets/js/app/finance-cycle.js'), true);
assert.match(read('assets/js/app/finance-cycle.js'), /fallbackDay=25/);
assert.match(read('assets/js/app/budget-engine.js'), /resolveFinanceCycle/);
assert.match(read('assets/js/app/transaction-engine.js'), /createEconomicTransaction/);
assert.match(read('assets/js/app/transaction-engine.js'), /recordDebtMovement/);
assert.match(read('assets/js/app/transaction-engine.js'), /recordReceivableMovement/);
assert.match(read('assets/js/app/transaction-engine.js'), /recordTaxMovement/);
assert.match(read('assets/js/app/finance-api.js'), /record_tax_payment_v2/);
assert.match(read('assets/js/app/finance-api.js'), /record_receivable_payment_v3/);
assert.match(read('supabase/migrations/20261003_finance_managed_payment_linkage.sql'), /reverse_tax_payment_v2/);
assert.match(read('assets/js/views/settings.js'), /Mein Profil/);
assert.match(read('assets/js/views/settings.js'), /Basiswährung/);
assert.match(read('assets/js/main.js'), /onboarding_completed_at/);
assert.match(read('assets/js/main.js'), /routeSection/);
