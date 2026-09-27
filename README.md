# aione

One repository, two release states:

- branch `stable`: protected production/test baseline used by Ana.
- branch `beta`: all active development and Beta testing.

Current Beta: `69.0.0-beta.8`.

## Beta 69 direction

Beta 69 is the new desktop generation of aione. It is not a rewrite of the financial core. Existing authentication, Supabase data, transactions, balances, permissions and financial calculations remain the reference until each area is deliberately migrated and regression-tested.

Foundation priorities:

1. Desktop shell and simpler top navigation.
2. Central user context: country, canton/state, municipality, base currency and language.
3. Translation files outside application logic.
4. Country/region modules with Switzerland first and SG/TG as the first cantons.
5. Clear separation of system availability, licensed modules, user permissions and personal visibility.
6. Existing button/action audit before adding broad new features.
7. Swiss debt-enforcement module as an early functional Beta feature.
8. Traceable official-data sources and explicit warnings for estimates.

The mobile version must remain usable but is not the current design priority.

Run over HTTP(S), not `file://`.

Current integrity checks remain in `tests/`. The legacy runtime stays in place until a migrated area has been tested against the current behavior.

Read `docs/BETA69_FOUNDATION.md` and `docs/BETA69_FOUNDATION_B.md` before the next migration step.

## Beta 69 onboarding

Beta 69.0.0-beta.4 introduced onboarding version 2. Users confirm jurisdiction, base currency and a main account before continuing. Existing data is reused; the wizard does not duplicate an account unless the user explicitly chooses to create one.

## Beta 69.0.0-beta.5

Swiss debt enforcement is now an early functional Beta module. It is visible only for CH user context and stores per-user data behind Supabase RLS. Estimates are explicitly non-binding planning values.


## Beta 69.0.0-beta.7

Beta 7 is the first consolidated UX pass after live testing: viewport-safe dialogs, visible logout/chat/notifications, faster startup through deferred noncritical loads, explicit Admin module saving, clearer account/transaction/planning workflows, multi-file bank handling, quote/Offerte support, exact AI review rows, region-aware SG/TG 2026 tax references and a more customer-oriented document/settings experience. See `docs/BETA69_BETA7_TEST_REPORT.md`.


## Beta 69.0.0-beta.8

Beta 8 starts the controlled cleanup phase. The `renderAll()` and `view()` lifecycle chains are consolidated into one implementation each; their previous aione/v68.1/Beta-69 wrapper assignments are removed without changing financial calculations or Supabase data structures. A regression test prevents these two lifecycle functions from returning to patch-on-patch overrides.
