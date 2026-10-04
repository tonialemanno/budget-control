alter table public.transactions
  add column if not exists income_kind text,
  add column if not exists analytics_excluded boolean not null default false;

alter table public.transactions
  drop constraint if exists transactions_income_kind_check;

alter table public.transactions
  add constraint transactions_income_kind_check
  check (
    income_kind is null
    or income_kind in ('salary','side_income','refund','repayment','sale','gift','other','not_income')
  );

comment on column public.transactions.income_kind is
  'Economic meaning of positive cashflow for analytics. Null means Finance must infer or ask the user.';
comment on column public.transactions.analytics_excluded is
  'Keeps the ledger entry but excludes it from income/expense analytics when true.';
