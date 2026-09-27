-- Beta 69.0.0-beta.10
-- Onboarding asks for the CURRENT balance, not a historical opening balance.
-- The balance-anchor model already exists in production; this migration only
-- repairs onboarding-created accounts that were saved before the frontend
-- started populating the anchor fields. No transactions are changed.

update public.accounts
set balance_anchor_date = created_at::date,
    balance_anchor_amount = opening_balance,
    updated_at = now()
where notes = 'Ersteinrichtung aione'
  and balance_anchor_date is null
  and balance_anchor_amount is null;
