-- Preserve bank import context, support own-account recognition, and persist reversible transaction changes.

alter table public.accounts
  add column if not exists external_account_ref text;

comment on column public.accounts.external_account_ref is
  'Optional bank account identifier such as IBAN or provider account reference. Used only for import matching.';

alter table public.transactions
  add column if not exists bank_reference text,
  add column if not exists counterparty_account_ref text,
  add column if not exists import_raw_data jsonb,
  add column if not exists import_source_page integer;

comment on column public.transactions.bank_reference is
  'Reference supplied by the bank export, if available.';
comment on column public.transactions.counterparty_account_ref is
  'Counter-account identifier/IBAN supplied by the bank export, if available.';
comment on column public.transactions.import_raw_data is
  'Preserved original import row/context so later parsers can re-evaluate the booking without losing bank information.';
comment on column public.transactions.import_source_page is
  '1-based source PDF page if known.';

create index if not exists accounts_household_external_account_ref_idx
  on public.accounts(household_id, external_account_ref)
  where external_account_ref is not null;

create index if not exists transactions_household_counterparty_account_ref_idx
  on public.transactions(household_id, counterparty_account_ref)
  where counterparty_account_ref is not null;

create table if not exists public.transaction_change_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  action_type text not null,
  label text not null,
  before_data jsonb not null default '[]'::jsonb,
  after_data jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

alter table public.transaction_change_log enable row level security;

drop policy if exists transaction_change_log_read on public.transaction_change_log;
create policy transaction_change_log_read
on public.transaction_change_log
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists transaction_change_log_insert on public.transaction_change_log;
create policy transaction_change_log_insert
on public.transaction_change_log
for insert
to authenticated
with check (private.can_write_household(household_id) and created_by = (select auth.uid()));

drop policy if exists transaction_change_log_update on public.transaction_change_log;
create policy transaction_change_log_update
on public.transaction_change_log
for update
to authenticated
using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));

revoke all on public.transaction_change_log from anon;
grant select, insert, update on public.transaction_change_log to authenticated;

create index if not exists transaction_change_log_household_created_idx
  on public.transaction_change_log(household_id, created_at desc);
