# Beta 69.0.0-beta.11 — Subscription lifecycle completion

## Basis

Built from the verified complete Beta 69.0.0-beta.10 current-balance-anchor packer supplied by the project owner.

## Changes

- Frontend permissions now use the server-side `my_effective_features()` result instead of rebuilding plan logic independently in the client.
- Subscription state is loaded through `my_subscription_context()`.
- Trial, grace/read-only and deletion-due states are shown in the UI.
- Top-level write actions are disabled when their effective feature is not writable.
- Admin subscription management saves plan, Family status and seats as one explicit action through `admin_update_user_subscription()`.
- Admin can extend a Trial through `admin_extend_trial()`.
- The module administration plan switch preserves the Family setting instead of silently resetting it.
- New tax-year drafts are inserted unless a persisted UUID exists, preventing requests with `id=undefined`.
- Beta 10 current-balance-anchor behavior is unchanged.

## Verification

- `node --check src/js/app.js`: PASS
- Full `tests/check_*.py` suite: PASS, except `check_user_bank_samples.py` which SKIPs because external user bank sample files are not bundled.
- Duplicate DOM IDs: none.
- Cleanup regression guard: no top-level function patch/reassignment chains and no duplicate named declarations.
- Static assets: all return HTTP 200 through the local test server.
- `icon-192.png` and `icon-512.png`: byte-identical to Beta 10.

## Supabase state

The subscription/Trial/Family schema and RPC migrations are already live in the connected Supabase project. Their migration-history entries are documented in `BETA69_BETA11_SUPABASE_STATE.md`.

The Supabase security advisor currently reports warnings for authenticated access to several `SECURITY DEFINER` functions. The subscription helper functions contain caller checks, but the advisor warnings are not considered resolved by this release. They should be cleaned up before a broad production/customer rollout.
