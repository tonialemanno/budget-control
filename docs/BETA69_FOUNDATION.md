# aione Beta 69 — Foundation

## Purpose

Beta 69 is the new desktop generation of aione. The goal is a simpler, guided product while preserving the proven financial core until each area has been migrated and tested.

This phase does not reinterpret existing calculations and does not replace the current Supabase/auth/data model without an explicit migration plan.

## Release boundaries

### Stable

- Protected reference/test environment.
- Ana continues testing it.
- No direct development.
- Findings are documented and fixed in Beta first.

### Beta

- Single active development branch.
- Cloudflare Pages is the Beta test environment.
- UI restructuring, bug fixes and later feature work happen here first.

## Product principles

1. A visible action must work completely.
2. The user must understand where they are, what they can do and what happens after an action.
3. Complex financial/legal concepts must be explained in plain language.
4. Existing business logic is not silently simplified or reinterpreted.
5. Estimates must be clearly marked as estimates.
6. Official documents, authority decisions and professional advice override aione estimates.

## Desktop information architecture

Target top-level areas:

- Overview
- Money
  - Accounts
  - Transactions
  - Planning / recurring payments
  - Reconciliation / import
- Obligations
  - Taxes
  - Debt enforcement
  - Loans later
- Documents
- Planner
- Insights / AI
- Settings
- Admin (permission-gated)

Mobile must remain usable, but desktop is the current design priority.

## Central user context

The application will resolve one central context per user/workspace:

- country
- canton/state/region
- municipality
- official municipality identifier where available
- base currency
- language
- relevant tax/reference year

Modules must consume this shared context instead of guessing these values independently.

## Country and regional structure

```text
src/regions/
  ch/
    common/
    sg/
    tg/
  de/
    common/
```

Switzerland and Germany share one product but not all terminology, legal workflows, tax logic or official data sources.

For Switzerland, canton and municipality are first-class context. SG and TG are the first canton modules.

## Internationalization

Runtime UI strings will be moved out of feature/business logic.

Initial maintained locales:

- de-CH
- fr-CH
- it-CH
- en

Romanian is not part of the actively maintained Beta 69 locale set. Existing legacy strings are not deleted until the corresponding UI has migrated.

Country-specific German terminology can later use de-DE overrides.

## Swiss debt enforcement — early Beta module

Debt enforcement is an early Beta feature because bank transactions alone do not show the complete payment history when wage garnishment is involved.

Minimum record:

- creditor
- debt-enforcement number
- debt-enforcement office
- original claim
- interest/costs where known
- already paid
- remaining amount
- status
- important dates
- documents
- notes

Payment sources:

- bank transaction
- payroll / wage garnishment
- manual payment
- other documented payment

The module may calculate an estimated remaining duration from the current remaining amount and observed/entered payment rate. It must never present that estimate as an official end date.

Required warning pattern:

> Estimate for planning only. Interest, fees, changes to garnishment, additional claims and official decisions can change the actual amount or duration. Verify against the competent authority/creditor documents.

## Taxes and official-data integrations

Official APIs/open data are preferred when a documented and stable source exists.

Every imported tax/reference dataset should carry:

- source name
- source identifier or URL
- source year
- retrieved/updated date
- calculation/data version

Tax outputs must distinguish:

- confirmed user/authority data
- imported official reference data
- aione calculation
- estimate/projection

An estimate must display a verification warning.

## Permissions and modules

These concepts remain separate:

1. System availability.
2. Plan/license entitlement.
3. User read/write permission.
4. Personal dashboard visibility.

Personal hiding must never grant access to something the user is not entitled to use.

## Migration strategy

For each existing feature:

1. Document current behavior.
2. Add or confirm regression checks.
3. Move code behind a clear module boundary.
4. Preserve data model and results.
5. Rebuild the UI workflow.
6. Test on Beta.
7. Only then remove the legacy implementation.

## First implementation sequence

### Foundation A
- establish Beta 69 version markers
- create dedicated i18n files
- establish regional ownership
- keep legacy runtime behavior intact

### Foundation B
- central app context
- new desktop shell/top navigation
- route/view registry
- permission-aware module registry
- i18n loader

### Foundation C
- migrate Accounts and Transactions into the new shell
- audit every action/button
- correct currency presentation through central context

### Foundation D
- onboarding wizard
- CH/DE setup
- CH canton + municipality setup
- SG/TG official-data source layer

### Foundation E
- Swiss debt-enforcement module
- payment history including payroll/garnishment
- remaining balance and clearly labelled planning estimate

Only after these foundations are stable do we expand to loans, backup/restore, tax-package export, trial and trustee licensing.
