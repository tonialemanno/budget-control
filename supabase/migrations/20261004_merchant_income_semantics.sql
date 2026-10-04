alter table public.merchants
  add column if not exists default_income_kind text;

alter table public.merchants
  drop constraint if exists merchants_default_income_kind_check;

alter table public.merchants
  add constraint merchants_default_income_kind_check
  check (
    default_income_kind is null
    or default_income_kind in ('salary','side_income','refund','repayment','sale','gift','other','not_income')
  );

comment on column public.merchants.default_income_kind is
  'Default economic meaning applied only to positive incoming transactions from this merchant.';
