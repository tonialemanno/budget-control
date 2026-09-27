# Beta 69.0.0-beta.9 — cleanup and developer-review test report

Date: 2026-09-27

## Scope

This release is a code-cleanup and Admin bug-fix release. It does not introduce a destructive database migration.

- removed remaining top-level function reassignment/monkey-patch chains from `src/js/app.js`
- removed duplicate named function declarations
- replaced the `_api` reassignment pattern with explicit `rawApi()` and permission-guarded `api()` functions
- removed DOM clone/rebind listener hacks
- preserved the previously effective `accountBalanceAsOf()` implementation and removed only the dead earlier declaration
- retained the protected SG/TG tax calculation as `taxCalcBase()` and composed the existing alimony adjustment in one explicit `taxCalc()` function
- moved Admin per-user module changes to one explicit batch-save flow; the former competing immediate-save and Beta interception handlers are gone
- corrected stale release and service-worker version markers
- renamed the historical version-specific stylesheet asset to `legacy-overrides.css` while preserving its protected bytes and cascade position

## Automated validation

The package is validated with:

- JavaScript syntax checks for every local `.js` file
- legacy DOM-ID preservation and uniqueness
- Stable CSS/bootstrap/manifest/icon hashes
- protected financial-function hashes
- Beta 69 foundation, onboarding, debt-enforcement, quote and SG/TG tax-region tests
- UX consolidation checks
- cleanup architecture guard: no duplicate named declarations, no top-level function reassignment, no legacy `_aione/_v*/_beta*` wrapper aliases, no DOM `cloneNode()` listener rebinds
- local HTTP startup asset checks

The user bank-sample test is skipped when the private sample files are not mounted in the package.

## Backend safety

Beta and Stable intentionally use the same production Supabase project. This cleanup contains no destructive schema change. Future schema/RLS/RPC changes must remain additive and backward-compatible unless explicitly approved otherwise.

## Manual Beta smoke test required

Automated checks cannot certify every authenticated browser workflow. Before promotion, manually verify login/logout, dashboard/navigation, account detail, transactions, payment planning, Admin module batch save/discard, settings, bank import preview/duplicate detection and at least one viewport/dialog pass at 100% and 125% zoom.

## Validation result

All packaged JavaScript syntax checks, JSON parsing, Beta 69 regression checks, cleanup architecture checks, integrity/hash checks and local startup-asset checks pass. The private bank-sample test is skipped because those user files are intentionally not packaged.

A headless Chromium smoke test was attempted in the build environment but Chromium did not reach the local HTTP server and timed out while reporting missing host DBus services. No application JavaScript exception was produced. This environment result is not counted as a browser pass; the manual Cloudflare Beta smoke test below remains required.

## Deliberate remaining architecture work

`src/js/app.js` remains the legacy runtime and is still large. Beta 9 cleans its runtime composition and removes the known patch-on-patch mechanisms; it does not claim that every business domain has already been extracted into the target folder structure. Splitting finance/auth/import domains without characterization tests would create more risk than value for this review. Core and domain extraction therefore remains the controlled Phase 4/5 work described in `REFACTORING_PLAN.md`.
