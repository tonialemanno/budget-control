# Regression test matrix

| Area | Static/startup | Beta DB functional |
|---|---:|---:|
| HTML/CSS/JS startup | yes | — |
| Manifest/service-worker assets | yes | yes |
| Login screen | yes | yes |
| Login/logout/session refresh | — | yes |
| Accounts | — | yes |
| Reserves/locked funds | — | yes |
| Transactions | — | yes |
| Transfers | — | yes |
| Payment planning/recurring | — | yes |
| Bank import | — | yes |
| Duplicate detection | — | yes |
| Bank reconciliation | — | yes |
| Documents | — | yes |
| Invoices | — | yes |
| CHF/EUR | — | yes |
| Taxes | — | yes |
| Forecast/Finance OS | — | yes |
| AI/intelligence | — | yes |
| Permissions/feature gates | — | yes |
| Admin/support | — | yes |
| Planner | — | yes |
| PWA install/update/offline | partial | yes |
| Mobile navigation | viewport smoke | yes |

## Phase-1 acceptance gate

- each original CSS block is byte-identical after extraction
- both original JavaScript blocks are byte-identical after extraction
- actual DOM ID set is unchanged
- manifest/icon bytes are unchanged
- JavaScript syntax parses
- all local startup assets return HTTP 200
- Chromium loads the login screen with no authenticated session

Authenticated domain testing uses the shared production Supabase project by current product decision. Automated static/regression checks must therefore be complemented by a manual Beta login and end-to-end smoke test on non-destructive workflows; database changes remain additive and backward-compatible.
