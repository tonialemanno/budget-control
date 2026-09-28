# Beta 12 UX Reset Foundation — Test Report

Version: `69.0.0-beta.12`

## Automated verification

The complete existing `tests/check_*.py` suite passes on the Beta 12 working tree. The user-bank-samples check reports its normal skip because external sample files are not shipped in the application packer; its process exit code is 0.

Additional Beta 12 checks verify:

- onboarding target version is 3
- existing users are not exempt from the new onboarding requirement
- current main-account balance uses the balance-anchor API
- liabilities are stored separately from assets
- debt repayments are modelled as transfers to liability accounts
- Overview/My Money asset lists exclude liabilities
- dedicated debt UI areas exist
- Switzerland and Germany use separate merchant/provider knowledge
- country starter categories are applied only after explicit onboarding choice
- five primary navigation groups are present
- login and Back/Home actions do not expose the legacy module launcher
- country-finance registry is part of the service-worker startup assets
- release version markers are consistent

## Protected regression checks

Existing tests still validate:

- current-balance anchor behaviour
- protected financial calculations
- SG/TG tax reference logic
- Swiss debt-enforcement module
- onboarding persistence
- subscription lifecycle / tax-year UUID guard
- lifecycle consolidation and no function-patching regression
- unique DOM IDs
- local static asset availability

## Manual Beta smoke test required

For Toni and Ana, test with no explanation of the interface:

1. Log in and confirm that the new setup appears even for an existing user.
2. Confirm country and main-account balance.
3. Add or confirm one debt and verify the bank balance does not change because of the debt.
4. Save setup and open Overview.
5. Verify “What you have” contains only assets and “What you owe” contains liabilities.
6. Confirm country-appropriate merchant/category behaviour.
7. Import historical bank data and confirm the user-entered current balance remains authoritative.
8. Check that all pre-existing transactions/documents are still present.

Any step where the tester asks “where do I need to go?” should be treated as a UX finding rather than explained away.
