create table if not exists public.debt_enforcement_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  country_code text not null default 'CH' check (country_code = 'CH'),
  creditor text not null check (btrim(creditor) <> ''),
  case_number text,
  office_name text,
  original_amount numeric(14,2) not null check (original_amount >= 0),
  known_interest numeric(14,2) not null default 0 check (known_interest >= 0),
  known_fees numeric(14,2) not null default 0 check (known_fees >= 0),
  monthly_payment_amount numeric(14,2) check (monthly_payment_amount is null or monthly_payment_amount > 0),
  started_on date,
  status text not null default 'open' check (status in ('open','paused','paid','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_enforcement_payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.debt_enforcement_cases(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paid_on date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  source text not null default 'manual' check (source in ('bank_transaction','payroll_garnishment','manual','other')),
  transaction_id uuid references public.transactions(id) on delete set null,
  payroll_period text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists debt_enforcement_cases_user_idx on public.debt_enforcement_cases(user_id,status,created_at desc);
create index if not exists debt_enforcement_payments_case_idx on public.debt_enforcement_payments(case_id,paid_on desc,created_at desc);
create index if not exists debt_enforcement_payments_user_idx on public.debt_enforcement_payments(user_id,paid_on desc);

drop trigger if exists trg_debt_enforcement_cases_touch on public.debt_enforcement_cases;
create trigger trg_debt_enforcement_cases_touch before update on public.debt_enforcement_cases for each row execute function public.touch_updated_at();

alter table public.debt_enforcement_cases enable row level security;
alter table public.debt_enforcement_payments enable row level security;

drop policy if exists debt_enforcement_cases_select_own on public.debt_enforcement_cases;
create policy debt_enforcement_cases_select_own on public.debt_enforcement_cases for select to authenticated using (user_id=auth.uid());
drop policy if exists debt_enforcement_cases_insert_own on public.debt_enforcement_cases;
create policy debt_enforcement_cases_insert_own on public.debt_enforcement_cases for insert to authenticated with check (user_id=auth.uid());
drop policy if exists debt_enforcement_cases_update_own on public.debt_enforcement_cases;
create policy debt_enforcement_cases_update_own on public.debt_enforcement_cases for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists debt_enforcement_cases_delete_own on public.debt_enforcement_cases;
create policy debt_enforcement_cases_delete_own on public.debt_enforcement_cases for delete to authenticated using (user_id=auth.uid());

drop policy if exists debt_enforcement_payments_select_own on public.debt_enforcement_payments;
create policy debt_enforcement_payments_select_own on public.debt_enforcement_payments for select to authenticated using (user_id=auth.uid());
drop policy if exists debt_enforcement_payments_insert_own on public.debt_enforcement_payments;
create policy debt_enforcement_payments_insert_own on public.debt_enforcement_payments for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.debt_enforcement_cases c where c.id=case_id and c.user_id=auth.uid()));
drop policy if exists debt_enforcement_payments_update_own on public.debt_enforcement_payments;
create policy debt_enforcement_payments_update_own on public.debt_enforcement_payments for update to authenticated using (user_id=auth.uid() and exists (select 1 from public.debt_enforcement_cases c where c.id=case_id and c.user_id=auth.uid())) with check (user_id=auth.uid() and exists (select 1 from public.debt_enforcement_cases c where c.id=case_id and c.user_id=auth.uid()));
drop policy if exists debt_enforcement_payments_delete_own on public.debt_enforcement_payments;
create policy debt_enforcement_payments_delete_own on public.debt_enforcement_payments for delete to authenticated using (user_id=auth.uid() and exists (select 1 from public.debt_enforcement_cases c where c.id=case_id and c.user_id=auth.uid()));
