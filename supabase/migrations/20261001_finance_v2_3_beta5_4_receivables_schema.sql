-- Finance V2.3 Beta 5.4 – Forderungen / verliehenes Geld
-- Additiv und idempotent. Bestehende Finanzdaten werden nicht verändert.

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  debtor text not null,
  reason text not null,
  original_amount numeric(18,2) not null check (original_amount > 0),
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  lent_at date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('open','partial','overdue','paid','written_off')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_outstanding_not_above_original check (outstanding_amount <= original_amount)
);

create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  outstanding_after numeric(18,2) not null check (outstanding_after >= 0),
  note text,
  reversed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.receivables
  add column if not exists source_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists source_transaction_id uuid references public.transactions(id) on delete set null;

alter table public.receivable_payments
  add column if not exists payment_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists source text not null default 'history_only';

alter table public.receivable_payments drop constraint if exists receivable_payments_source_check;
alter table public.receivable_payments add constraint receivable_payments_source_check
  check (source in ('created_transaction','history_only'));

alter table public.transactions drop constraint if exists transactions_cashflow_type_check;
alter table public.transactions add constraint transactions_cashflow_type_check
  check (cashflow_type in ('standard','debt_payment','receivable_principal'));

create index if not exists receivables_household_status_idx on public.receivables(household_id,status,due_date);
create index if not exists receivable_payments_receivable_idx on public.receivable_payments(receivable_id,created_at desc);
create index if not exists receivables_source_account_idx on public.receivables(source_account_id);
create index if not exists receivable_payments_account_idx on public.receivable_payments(payment_account_id);

alter table public.receivables enable row level security;
alter table public.receivable_payments enable row level security;

drop policy if exists receivables_member_read on public.receivables;
create policy receivables_member_read on public.receivables for select to authenticated
using (private.has_module_access('debts') and private.is_household_member(household_id));

drop policy if exists receivables_writer_insert on public.receivables;
create policy receivables_writer_insert on public.receivables for insert to authenticated
with check (private.has_module_access('debts') and private.can_write_household(household_id));

drop policy if exists receivables_writer_update on public.receivables;
create policy receivables_writer_update on public.receivables for update to authenticated
using (private.has_module_access('debts') and private.can_write_household(household_id))
with check (private.has_module_access('debts') and private.can_write_household(household_id));

drop policy if exists receivables_writer_delete on public.receivables;
create policy receivables_writer_delete on public.receivables for delete to authenticated
using (private.has_module_access('debts') and private.can_write_household(household_id));

drop policy if exists receivable_payments_member_read on public.receivable_payments;
create policy receivable_payments_member_read on public.receivable_payments for select to authenticated
using (private.has_module_access('debts') and private.is_household_member(household_id));

drop trigger if exists receivables_set_updated_at on public.receivables;
create trigger receivables_set_updated_at before update on public.receivables
for each row execute function private.set_updated_at();
