# Changelog

## 69.0.0-beta.6 — onboarding persistence fix

- Fixed a login race condition that could reopen onboarding before the saved profile had finished loading.
- Onboarding now waits for a confirmed profile state before deciding whether it is required.
- Completed onboarding closes automatically if a stale transient context was shown.
- No financial calculations, accounts, transactions or debt-enforcement data were changed.

## 69.0.0-beta.5 — Swiss debt enforcement

- Added the first functional Swiss debt-enforcement module.
- Added creditor, case/reference, office, original claim, known interest/costs, status and monthly payment fields.
- Added payment history with payroll/wage-garnishment, bank, manual and other documented payment sources.
- Added calculated paid/outstanding balances and a clearly labelled remaining-duration estimate.
- Added CH-only navigation gating; German legal logic remains separate.
- Added RLS-protected Supabase tables for cases and payments.
- Added de-CH, fr-CH, it-CH and English strings in external locale files.
- Existing financial calculations remain unchanged; only the Beta bridge gained generic authenticated request/toast access for modular features.

## 69.0.0-beta.4 — guided onboarding

- Added a blocking four-step first-run wizard for Beta 69 onboarding version 2.
- Country/region/municipality, base currency and supported language are confirmed before the app is used.
- Existing users can select an existing main account; new users can create the first bank account with a positive or negative opening balance.
- Onboarding writes through the existing authenticated API/RLS path and only marks completion after all required steps succeed.
- Added external translation keys for the new wizard in de-CH, fr-CH, it-CH, en and de-DE.
- Existing financial calculation functions remain unchanged.

## 69.0.0-beta.3 — Foundation C: country, region and money context

- Added CH/DE region registry with all Swiss cantons and German Bundesländer.
- Added explicit profile fields for country code, generic region code, Swiss canton code and municipality.
- Marked SG and TG as the first canton data modules.
- Removed Romanian from the active Beta language selector while retaining database compatibility for existing legacy values.
- Prepared the database constraint for French.
- Added a central money formatter/converter for new Beta components.
- Added an additive shared-database migration; no financial data was deleted or rewritten.

## 69.0.0-beta.2 — Foundation B / desktop shell

- Added central normalized app context for country, region, municipality, base currency and language.
- Added runtime JSON i18n loader and de-DE locale foundation.
- Added one permission-aware module registry for the new desktop navigation.
- Added the first visible Beta 69 desktop top navigation while keeping mobile unchanged.
- Added a minimal legacy bridge; existing routing and business logic remain the source of truth.
- No Supabase schema or finance calculation changes.

## 69.0.0-beta.1 — Beta 69 foundation

- Started the Beta 69 desktop architecture without changing existing business behavior.
- Added dedicated i18n files for de-CH, fr-CH, it-CH and English.
- Added the country/region structure with Switzerland, St. Gallen, Thurgau and Germany placeholders.
- Defined central context requirements for country, canton/state, municipality, base currency and language.
- Defined the early Swiss debt-enforcement module boundary.
- Defined source/version/warning requirements for tax and official-data integrations.
- Updated Beta version and service-worker cache markers.
- Existing Stable financial/business logic remains the reference until migrated and regression-tested.

## 68.1.1-beta.1 — structural refactor step 1

- No new application feature.
- Preserved Stable baseline before refactoring.
- Externalized existing CSS while preserving the three-block cascade order.
- Externalized existing JavaScript without changing application code.
- Added a Beta-specific service-worker cache and precache entries for extracted assets.
- Added architecture/refactoring/test documentation and integrity checks.

## 68.1.0 — Stable baseline

Existing complete aione application before modular refactoring.
