# Beta 12 — UX Reset Foundation

Version: `69.0.0-beta.12`

## Product goal

Beta 12 starts from one rule: **aione should understand complicated finances so the user does not have to.**

The financial core, current-balance anchor, transactions, documents, permissions and subscription model remain protected. Beta 12 changes how the user is guided through that capability.

## UX rules introduced in this stage

1. A normal user sees five primary areas: **Übersicht**, **Mein Geld**, **Planen**, **Dokumente**, **Mehr**.
2. The old module launcher is no longer the normal entry point after login or from Back/Home controls.
3. A user does not need a finance term to understand the next action.
4. Missing data must lead to a useful next step instead of an unexplained empty dashboard.
5. Detailed/advanced functions remain available, but are no longer the first layer of navigation.

## Assets and liabilities are separate

This is a hard accounting and UX rule.

Example:

- Bank account today: CHF 12'000
- Mortgage outstanding: CHF 350'000

The bank account remains **CHF 12'000**. It is never changed to a negative value because a mortgage exists.

Beta 12 stores/views:

- bank accounts, savings, cash and other assets as `asset_class = asset`
- mortgage/loan/credit-card/private debt and similar obligations as `asset_class = liability`

The user-facing Overview and My Money areas have separate sections:

- **What you have** — accounts, cash and reserves only
- **What you owe** — loans, mortgages and debts only

Only an explicitly labelled overall financial-position/net-worth view may subtract liabilities from assets.

### Monthly payments

A debt's full outstanding balance is not treated as this month's expense. A monthly repayment is a separate planned cash flow. In the current data model, onboarding-created repayments are stored as recurring transfers from the selected asset account to the liability account. This reduces cash and outstanding debt separately when booked.

## Onboarding version 3 — everyone tests it

Beta 12 raises the required onboarding version from 2 to 3. This intentionally applies to existing users as well as new users.

Existing data is **not deleted**. The new setup asks the user to consciously confirm/save:

1. country / region / municipality / language / base currency
2. main account and its current balance today
3. existing or new debts/loans as separate liabilities
4. category starting mode
5. final review before saving

For an existing main account, saving the setup moves its authoritative balance anchor to today using the balance entered by the user. Historical imported transactions remain history and do not alter that current balance a second time.

## Country-specific categories and recognition

Beta 12 separates three concepts that previously looked mixed together:

1. **Category** — e.g. groceries, housing, phone/internet, taxes, debt costs
2. **Merchant/provider recognition** — e.g. Migros or Swisscom in Switzerland; REWE or Vodafone in Germany
3. **Personal rule** — a user's own confirmed mapping

Merchant/provider names are not categories.

### Switzerland (`CH`)

Starter categories use Swiss wording and the merchant library can recognise examples such as Migros, Coop, Denner, Swisscom, Sunrise, SBB, common Swiss health insurers and other Swiss providers.

### Germany (`DE`)

Starter categories use German wording and the merchant library can recognise examples such as REWE, EDEKA, Kaufland, Deutsche Telekom, Vodafone, Deutsche Bahn, German health insurers and other German providers.

CH provider names are not loaded as DE-specific recognition knowledge and vice versa. Global providers may remain in a small generic layer.

### New-user category behaviour

The Supabase `handle_new_user()` trigger no longer inserts one fixed category list for every new account. After country selection, onboarding offers:

- recommended country starter categories, or
- an empty/personal start.

Existing categories are not deleted because historical transactions can reference them. Existing users can keep them and optionally add missing country starter categories.

## Supabase live-state note

The shared live Supabase project was changed so `public.handle_new_user()` now creates the profile and Trial subscription only; it no longer pre-seeds categories. This was applied directly with `execute_sql` and verified afterwards.

This exact live change still needs to be pulled into formal migration history with the Supabase CLI workflow before a clean-room database rebuild can be called fully reproducible. No migration filename was invented manually.

## Security status

The Supabase security advisor was rerun after the trigger change. No new warning was introduced by Beta 12. Pre-existing warnings remain for authenticated-callable `SECURITY DEFINER` helper functions and for disabled leaked-password protection. These remain a separate hardening task before a public customer rollout.

## Not yet part of this first stage

This foundation does **not** claim that the entire application is already simplified. The following remain later UX migration work:

- full redesign of the Overview around “What do I have / what is due / what remains / what needs attention?”
- transaction review as guided questions instead of filter-heavy tables
- simplified Planning creation flows
- document upload/classification guidance
- tax screens rewritten around plain-language outcomes
- advanced wealth/FIRE terminology moved behind explanations
- settings reduction and contextual category creation across all relevant flows

The purpose of Beta 12 foundation is to establish the rules and data boundaries safely before those screens are rebuilt.
