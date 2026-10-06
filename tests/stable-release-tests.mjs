import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const config=read('assets/js/app/config.js');
const index=read('index.html');
const ci=read('.github/workflows/ci.yml');
const main=read('assets/js/main.js');
const bills=read('assets/js/views/bills.js');
const settings=read('assets/js/views/settings.js');

assert.match(config,/version:\s*'2\.4\.3'/);
assert.doesNotMatch(config,/version:\s*'[^']*beta/i);
assert.match(index,/<title>Finance<\/title>/);
assert.match(index,/Stable 2\.4/);
assert.doesNotMatch(index,/Working Beta/);
assert.match(ci,/\- stable/);
assert.match(ci,/finance-v2\.3\.0-stable\.zip/);
assert.doesNotMatch(bills,/\\`/,'bills view must not contain escaped template delimiters');
assert.doesNotMatch(bills,/\\\$\{/,'bills view must not contain escaped template interpolation');
assert.doesNotMatch(main,/const\s+_v\d+\w*\s*=|renderAll\s*=\s*function/,'stable must not reintroduce patch-wrapper chains');
assert.doesNotMatch(read('assets/js/app/receipt-controller.js'),/new MutationObserver\(syncVersionLabel\)/);
assert.match(settings,/Sprache & Region/);
assert.match(read('assets/js/views/budget.js'),/Variabel ausgegeben/);
assert.match(read('assets/js/views/budget.js'),/Nicht im variablen Budget/);
assert.match(read('assets/js/app/budget-engine.js'),/calculateBudgetSummary/);
assert.match(read('assets/js/app/finance-semantics.js'),/semanticType/);
assert.match(read('assets/js/app/recurrence.js'),/effectiveNextDate/);
assert.match(read('assets/js/views/recurring.js'),/Nächster Plantermin/);
assert.match(read('assets/js/views/fixed-costs.js'),/Nächster Plantermin/);
assert.match(main,/Diese Planung ist verknüpft mit/);
assert.match(main,/Diese Schuld hat eine Zahlungshistorie/);

console.log('Stable release guard assertions OK');

assert.match(main,/allowed\.add\('merchants'\)/,'settings merchant route must be reachable even when hidden from primary navigation');

assert.match(read('assets/js/app/finance-model.js'), /remainingPlannedExpensesMonth/);
assert.match(read('assets/js/app/finance-model.js'), /budgetedOpenBillsMonth/);
assert.match(read('assets/js/app/finance-coach.js'), /snapshot\.remainingPlannedExpensesMonth/);
assert.match(read('assets/js/views/intelligence.js'), /Davon noch ausstehend/);
assert.match(read('assets/js/views/recurring.js'), /recurring-edit/);
assert.match(main,/if \(id === 'recurring-edit'\)/);
assert.match(main,/if \(action === 'recurring-edit'\)/);
assert.match(read('assets/js/app/budget-engine.js'), /const fixed=budget\.merchant_id \?/,'category budgets must remain variable unless the budget itself is merchant-scoped');

assert.match(read('assets/js/app/config.js'), /releaseChannel/);
assert.match(index,/releaseVersionPill/);
assert.match(index,/releaseChannelLabel/);
assert.match(main,/applyReleaseChannelUI/);
assert.match(main,/APP_CONFIG\.releaseChannel/);
assert.match(main,/releaseUiMeta/);
assert.match(main,/APP_CONFIG\.version/);
assert.match(main,/shortRelease\.toUpperCase/);
assert.doesNotMatch(main,/V2\.3 · Beta 5\.4/,'login must not contain a stale hard-coded version');
assert.match(config,/releaseId/);
assert.match(config,/schemaVersion/);
assert.match(main,/ensureCurrentRelease/);
assert.match(main,/ensureRuntimeCompatibility/);
assert.match(main,/enforceSessionGuard/);
assert.match(main,/clearPresence/);
assert.match(read('assets/js/views/settings.js'),/sessionTimeoutSelect/);
assert.match(read('assets/js/views/admin.js'),/Inaktiv/);
assert.match(read('_headers'),/\/version\.json/);
assert.match(read('_headers'),/\/assets\/\*/);
assert.match(read('supabase/migrations/20261004_session_release_guard.sql'),/get_finance_runtime_state/);
