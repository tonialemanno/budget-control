# Beta 69.0.0-beta.10 — current-balance anchor fix

## Defect

Onboarding explicitly asks for an **Aktueller Kontostand**. Until beta.9 the frontend stored that number only as `accounts.opening_balance`. The account-balance model then added imported historical transaction entries again, so importing bank history immediately after onboarding changed the already-current balance a second time.

Example reproduced during testing: an onboarding balance of `-827.97` was shown as a substantially lower balance after historical bank movements were imported.

## Fix

- New onboarding accounts write the entered current balance to the existing `balance_anchor_amount` and set `balance_anchor_date` to the local onboarding date.
- Accounts created later through the normal **+ Konto** flow use the same current-balance anchor semantics.
- `opening_balance` is retained for backward compatibility, but the existing `account_balances` database view gives the balance anchor precedence.
- A narrowly scoped migration repairs onboarding-created accounts that still have no anchor. It changes no transactions.
- `accountBalanceAsOf()` starts from the authoritative current `account_balances.balance` and reconstructs past balances backwards from posted entries. Pending transactions are excluded, matching the database balance semantics.

## Regression guard

`tests/check_balance_anchor_model.py` verifies the onboarding payload, normal account-creation path, migration scope, absence of transaction mutation, and backward balance reconstruction. The regression scenario explicitly anchors **CHF 12,413.75 today**, imports posted movements spanning roughly twelve months, and requires the current balance to remain exactly CHF 12,413.75 while older dates are reconstructed from the imported movements.

## Database scope

The production database already contained the balance-anchor columns and anchor-aware `account_balances` view. Beta.10 does not introduce a new balance schema; it correctly connects onboarding to the model that already exists.

## Live verification

Before repair, the reproduced onboarding account had `opening_balance = -827.97`, no balance anchor, and the legacy calculation produced `-2380.11` after historical imports. After applying `aione_v690_onboarding_balance_anchor_fix`, the anchor amount is `-827.97` and the anchor-aware balance is again `-827.97`.
