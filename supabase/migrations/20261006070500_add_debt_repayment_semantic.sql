-- Finance: distinguish historical loan/debt repayments from consumption.
-- The bank transaction remains a real cash outflow; only reporting semantics change.

alter table public.transactions
  drop constraint if exists transactions_semantic_type_check;

alter table public.transactions
  add constraint transactions_semantic_type_check
  check (
    semantic_type is null
    or semantic_type = any (array[
      'earned_income'::text,
      'other_income'::text,
      'refund'::text,
      'receivable_repayment'::text,
      'debt_repayment'::text,
      'internal_transfer'::text,
      'fixed_expense'::text,
      'variable_expense'::text,
      'tax_payment'::text,
      'tax_refund'::text,
      'saving'::text,
      'debt_payment'::text,
      'receivable_principal'::text,
      'asset_acquisition'::text,
      'ignored'::text
    ])
  );
