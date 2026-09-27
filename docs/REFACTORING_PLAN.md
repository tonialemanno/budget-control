# aione refactoring plan

## Release model: one codebase

Git is the release boundary.

- `stable-68.1.0` is the protected baseline tag.
- `beta` is the integration branch for every refactor, bug fix and later feature.
- Production must deploy only a tested Stable tag/commit.
- Beta must deploy the Beta branch.
- Stable is updated only by promoting the exact tested Beta commit.

This is one codebase with release states, not two separately maintained applications.

## Phase 0 — secure and inventory

Status: completed.

1. Preserve original files byte-for-byte and record SHA-256 hashes.
2. Create the Stable Git commit/tag before app-code changes.
3. Inventory CSS/JS structure, global state, Supabase access, permissions, PWA/version handling and major business areas.
4. Define the regression gate.

## Phase 1 — safe mechanical extraction

Status: completed for Beta step 1.

1. Externalize the three existing top-level CSS blocks into three external CSS files, preserving content, order and the two existing style-element IDs by moving those IDs to the corresponding `<link>` elements.
2. Externalize the startup error handler unchanged.
3. Externalize the main application IIFE unchanged.
4. Keep script placement/execution order unchanged.
5. Give the Beta service worker its own cache identity and precache the new external startup assets.
6. Verify byte hashes, JavaScript syntax, DOM IDs, local asset loading and browser startup.

The first step deliberately does not reorganize CSS semantically or split business JavaScript. That would combine too many risk sources in one change.

## Phase 2 — CSS decomposition without redesign

1. Capture visual reference states at desktop/mobile for login, Home, Dashboard, Accounts, Transactions, Planner and Settings.
2. Move CSS gradually toward `tokens.css`, `base.css`, `layout.css`, `components.css`, `desktop.css`, `mobile.css`.
3. Preserve cascade order and specificity. Keep a temporary `legacy-overrides.css` where ownership is not yet proven.
4. Do not merge/simplify selectors just because they look redundant.
5. Run visual comparison after each extraction commit.

## Phase 3 — Beta/Stable Supabase separation

Prerequisite: a separate Supabase Beta project/test environment must exist.

1. Introduce runtime environment configuration; no service-role secret may be shipped to the browser.
2. Stable points only to production Supabase.
3. Beta points only to Beta Supabase.
4. Reproduce schema/RLS/RPC/functions in Beta through versioned migrations.
5. Use dedicated Beta users and test data.
6. Add a release check that blocks Beta-to-Stable promotion if Beta configuration points to production.

No production database structure is changed merely for refactoring.

## Phase 4 — extract the core

Small commits, one responsibility at a time:

1. `core/config.js`
2. `core/api.js`
3. `core/auth.js`
4. `core/permissions.js`
5. `core/state.js`
6. `core/currency.js`
7. `core/navigation.js`
8. `core/pwa.js`

The existing global application scope remains compatibility glue until all callers of an extracted area have migrated and passed regression tests.

## Phase 5 — business-domain extraction

Order by dependency/risk, not screen order:

1. categories/classification
2. accounts/wealth read models
3. transactions/transfers
4. planned/recurring payments
5. import and duplicate detection
6. bank reconciliation
7. taxes/annual costs
8. documents/invoices
9. planner
10. family/support/admin
11. forecast/Finance OS tools
12. intelligence/chat/feedback

No business rule is reinterpreted during movement.

## Phase 6 — financial characterization tests

Before any financial algorithm is rewritten, capture the current behavior for:

- account balances
- income/expense effects
- transfers
- reserves/locked funds
- freely available money
- annual costs
- forecasts
- CHF/EUR handling
- taxes and allocations
- import parsing and duplicate detection

A later behavior change requires an explicit product decision and a separate test change.

## Phase 7 — migrations and release discipline

1. Every schema/RLS/RPC/function change gets an ordered migration file.
2. Apply migrations to Beta first.
3. Run full regression/data checks.
4. Promote the exact tested commit and migration set.
5. Tag a semantic version and align service-worker cache identity with it.
6. Maintain the changelog.

## Stable promotion gate

A Beta commit becomes Stable only when startup/PWA checks, the full functional checklist, financial characterization tests, mobile smoke tests, console/runtime checks and migration reproducibility all pass against the Beta environment.
