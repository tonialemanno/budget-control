alter table public.transactions
  add column if not exists semantic_type text null,
  add column if not exists exclude_from_reports boolean not null default false;

alter table public.transactions
  drop constraint if exists transactions_semantic_type_check;

alter table public.transactions
  add constraint transactions_semantic_type_check
  check (
    semantic_type is null or semantic_type in (
      'earned_income',
      'other_income',
      'refund',
      'receivable_repayment',
      'internal_transfer',
      'fixed_expense',
      'variable_expense',
      'tax_payment',
      'tax_refund',
      'saving',
      'debt_payment',
      'receivable_principal',
      'ignored'
    )
  );

comment on column public.transactions.semantic_type is
  'Optional user override for the economic meaning of a transaction. Null means Finance infers the meaning.';
comment on column public.transactions.exclude_from_reports is
  'When true, the transaction remains in the ledger but is excluded from dashboards and reports.';
