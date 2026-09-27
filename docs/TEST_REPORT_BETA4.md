# Beta 69.0.0-beta.4 test report

## Scope

Guided onboarding version 2 only. Existing financial calculation logic was not intentionally changed.

## Automated checks passed

- `node --check src/js/app.js`
- `node --check src/core/app-context.js`
- `node --check src/components/onboarding-wizard.js`
- `python tests/check_integrity.py`
- `python tests/check_beta69_foundation_c.py`
- `python tests/check_beta69_onboarding.py`
- local HTML asset-reference existence check

## Regression protection

- All 1,150 Beta 2 legacy DOM IDs are still present.
- Current document contains 1,156 unique IDs and no duplicate IDs.
- Critical financial calculation functions still match the stored Beta 2 function hashes byte-for-byte.
- Stable CSS extraction baselines, bootstrap JavaScript, manifest and icons remain unchanged.

## Manual Beta checks required after Cloudflare deployment

1. Log in with an existing user whose onboarding version is 1.
2. Confirm that the four-step wizard opens and blocks normal app use.
3. Select CH, a canton and municipality; continue.
4. Verify that CHF/EUR and language selections are retained while moving back/forward.
5. Choose an existing account and finish.
6. Reload the page: wizard must not reopen for that user.
7. Confirm Settings shows the same country/region/municipality/base currency/main account.
8. With a second test user, test the "create new account" path including a negative opening balance if appropriate.
9. Confirm normal login, navigation, accounts, transactions, planner and logout still work.

No destructive database migration is included in beta.4.
