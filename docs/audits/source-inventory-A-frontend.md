# App erstellungen — Source inventory A: Frontend and functions

Repo: `tonialemanno/budget-control` · Source branch `beta` · EON project `budget-control` · 2026-10-21.

This is an exact path/byte-size index; `inspected` denotes partial code inspection, not complete approval. Pending entries need per-file documentation after AxiomSeal confirmation.

## root (7 files)

| File | Bytes | Stage |
|---|---:|---|
| `docker-compose.yml` | 200 | pending |
| `index.html` | 5604 | pending |
| `manifest.webmanifest` | 426 | pending |
| `runtime-config.js` | 61 | inspected |
| `runtime-config.local.example.js` | 148 | pending |
| `sw.js` | 328 | pending |
| `version.json` | 167 | pending |

## assets/css (8 files)

| File | Bytes | Stage |
|---|---:|---|
| `assets/css/base.css` | 1122 | pending |
| `assets/css/components.css` | 89078 | pending |
| `assets/css/document-preview.css` | 2085 | pending |
| `assets/css/forms.css` | 23948 | pending |
| `assets/css/layout.css` | 1981 | pending |
| `assets/css/receipt.css` | 2600 | pending |
| `assets/css/responsive.css` | 27846 | pending |
| `assets/css/tokens.css` | 3287 | pending |

## assets/js (2 files)

| File | Bytes | Stage |
|---|---:|---|
| `assets/js/boot-fallback.js` | 887 | pending |
| `assets/js/main.js` | 407451 | pending |

## assets/js/app (48 files)

| File | Bytes | Stage |
|---|---:|---|
| `assets/js/app/backend.js` | 9741 | inspected |
| `assets/js/app/budget-engine.js` | 12019 | pending |
| `assets/js/app/categorization.js` | 6348 | pending |
| `assets/js/app/category-ranking.js` | 1844 | pending |
| `assets/js/app/charts.js` | 16889 | pending |
| `assets/js/app/components.js` | 9432 | pending |
| `assets/js/app/config.js` | 1514 | pending |
| `assets/js/app/csv-import.js` | 27376 | pending |
| `assets/js/app/dashboard-integrity.js` | 2420 | pending |
| `assets/js/app/deferred-settings.js` | 1278 | pending |
| `assets/js/app/demo-data.js` | 2918 | pending |
| `assets/js/app/document-preview.js` | 3491 | pending |
| `assets/js/app/duplicate-intelligence.js` | 7938 | pending |
| `assets/js/app/finance-api.js` | 32936 | inspected |
| `assets/js/app/finance-coach.js` | 19842 | pending |
| `assets/js/app/finance-cycle.js` | 3417 | pending |
| `assets/js/app/finance-insights.js` | 19114 | pending |
| `assets/js/app/finance-model.js` | 14376 | pending |
| `assets/js/app/finance-semantics.js` | 7166 | inspected |
| `assets/js/app/financial-effects.js` | 1872 | pending |
| `assets/js/app/format.js` | 4498 | pending |
| `assets/js/app/fx.js` | 1310 | pending |
| `assets/js/app/goal-planning.js` | 3953 | pending |
| `assets/js/app/i18n-ui-catalog.js` | 249301 | pending |
| `assets/js/app/i18n.js` | 184216 | pending |
| `assets/js/app/icons.js` | 4930 | pending |
| `assets/js/app/import-file.js` | 669 | pending |
| `assets/js/app/import-intelligence.js` | 2247 | pending |
| `assets/js/app/learning-intelligence.js` | 1152 | pending |
| `assets/js/app/merchant-review-draft.js` | 2688 | pending |
| `assets/js/app/ml-categorization.js` | 6851 | pending |
| `assets/js/app/pdf-import.js` | 14453 | pending |
| `assets/js/app/projections.js` | 2458 | pending |
| `assets/js/app/receipt-controller.js` | 23070 | pending |
| `assets/js/app/receipt-ocr.js` | 24464 | pending |
| `assets/js/app/recurrence.js` | 2645 | pending |
| `assets/js/app/recurring-planning.js` | 2178 | pending |
| `assets/js/app/release-guard.js` | 2144 | inspected |
| `assets/js/app/review-queue.js` | 4855 | pending |
| `assets/js/app/router.js` | 11079 | inspected |
| `assets/js/app/savings-compass.js` | 5125 | pending |
| `assets/js/app/session-guard.js` | 2074 | inspected |
| `assets/js/app/setup-model.js` | 2540 | pending |
| `assets/js/app/statistics-model.js` | 3528 | pending |
| `assets/js/app/store.js` | 859 | pending |
| `assets/js/app/transaction-engine.js` | 10083 | pending |
| `assets/js/app/user-preferences.js` | 1847 | pending |
| `assets/js/app/vehicle-costs.js` | 2679 | pending |

## assets/js/country (3 files)

| File | Bytes | Stage |
|---|---:|---|
| `assets/js/country/ch.js` | 2606 | pending |
| `assets/js/country/de.js` | 3165 | pending |
| `assets/js/country/index.js` | 247 | pending |

## assets/js/views (40 files)

| File | Bytes | Stage |
|---|---:|---|
| `assets/js/views/accounts.js` | 7865 | pending |
| `assets/js/views/admin.js` | 16442 | pending |
| `assets/js/views/bills.js` | 14537 | pending |
| `assets/js/views/budget.js` | 12670 | pending |
| `assets/js/views/categories.js` | 12021 | pending |
| `assets/js/views/category-workspace.js` | 843 | pending |
| `assets/js/views/dashboards.js` | 21654 | pending |
| `assets/js/views/debts.js` | 15615 | pending |
| `assets/js/views/documents.js` | 5135 | pending |
| `assets/js/views/family.js` | 4651 | pending |
| `assets/js/views/fixed-costs.js` | 14002 | pending |
| `assets/js/views/goals.js` | 19888 | pending |
| `assets/js/views/import-history.js` | 1162 | pending |
| `assets/js/views/imports.js` | 12045 | pending |
| `assets/js/views/insurance.js` | 8369 | pending |
| `assets/js/views/intelligence.js` | 9029 | pending |
| `assets/js/views/investments.js` | 7929 | pending |
| `assets/js/views/legal.js` | 4460 | pending |
| `assets/js/views/merchants.js` | 19037 | pending |
| `assets/js/views/money.js` | 7500 | pending |
| `assets/js/views/overview.js` | 29127 | pending |
| `assets/js/views/pension.js` | 3836 | pending |
| `assets/js/views/planning.js` | 9368 | pending |
| `assets/js/views/profile.js` | 7255 | pending |
| `assets/js/views/projects.js` | 4127 | pending |
| `assets/js/views/property.js` | 3483 | pending |
| `assets/js/views/receivables.js` | 9843 | pending |
| `assets/js/views/recurring.js` | 9318 | pending |
| `assets/js/views/review.js` | 9652 | pending |
| `assets/js/views/sales-documents.js` | 27593 | pending |
| `assets/js/views/savings-compass.js` | 7430 | pending |
| `assets/js/views/search.js` | 6617 | pending |
| `assets/js/views/settings.js` | 17413 | pending |
| `assets/js/views/setup.js` | 16491 | pending |
| `assets/js/views/statistics.js` | 16100 | pending |
| `assets/js/views/tax-advisor.js` | 61489 | pending |
| `assets/js/views/transactions.js` | 73270 | pending |
| `assets/js/views/vehicles.js` | 11701 | pending |
| `assets/js/views/wealth.js` | 4262 | pending |
| `assets/js/views/year-closing.js` | 8827 | pending |

## functions/api (1 files)

| File | Bytes | Stage |
|---|---:|---|
| `functions/api/geo.js` | 640 | inspected |

