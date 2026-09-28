-- Manual-first operational modules for the testable Finance V2 beta.

create table public.product_modules (
  key text primary key,
  label text not null,
  group_name text not null,
  sort_order integer not null default 0,
  is_core boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.product_modules (key, label, group_name, sort_order, is_core)
values
  ('core','Finance Core','Finance Core',10,true),
  ('money','Mein Geld','Finance Core',20,true),
  ('budget','Budget & Planung','Planung',30,false),
  ('bills','Rechnungen & Verträge','Planung',40,false),
  ('goals','Sparen & Ziele','Planung',50,false),
  ('debts','Schulden & Kredite','Verbindlichkeiten',60,false),
  ('legal','Mahnung / Betreibung / Inkasso','Verbindlichkeiten',70,false),
  ('family','Familie & Haushalt','Haushalt',80,false),
  ('wealth','Vermögen','Vermögen',90,false),
  ('property','Immobilien','Vermögen',100,false),
  ('vehicles','Fahrzeuge / Mobilität','Vermögen',110,false),
  ('insurance','Versicherungen','Vermögen',120,false),
  ('investments','Investments','Vermögen',130,false),
  ('pension','Vorsorge','Vermögen',140,false),
  ('intelligence','Finance Intelligence','Analyse',150,false)
on conflict (key) do update
set label = excluded.label,
    group_name = excluded.group_name,
    sort_order = excluded.sort_order,
    is_core = excluded.is_core;

create table public.user_module_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null references public.product_modules(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_key)
);

insert into public.user_module_access (user_id, module_key, enabled)
select u.id, m.key, true
from auth.users u
cross join public.product_modules m
on conflict (user_id, module_key) do nothing;

create or replace function private.seed_user_modules()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  insert into public.user_module_access (user_id, module_key, enabled)
  select new.id, m.key, true
  from public.product_modules m
  where m.is_available = true
  on conflict (user_id, module_key) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_seed_modules on auth.users;
create trigger on_auth_user_seed_modules
after insert on auth.users
for each row execute function private.seed_user_modules();
revoke execute on function private.seed_user_modules() from public, anon, authenticated;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month_start date not null,
  amount numeric(18,2) not null check (amount >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, month_start)
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  direction text not null check (direction in ('income','expense')),
  description text not null,
  counterparty text,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  cadence text not null check (cadence in ('weekly','monthly','quarterly','semiannual','annual')),
  next_date date not null,
  end_date date,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  provider text,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  due_date date not null,
  status text not null default 'open' check (status in ('open','paid','overdue','cancelled')),
  reference text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  provider text,
  contract_type text not null default 'contract' check (contract_type in ('contract','subscription','membership')),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  billing_cadence text not null default 'monthly' check (billing_cadence in ('monthly','quarterly','semiannual','annual','oneoff')),
  start_date date,
  end_date date,
  cancellation_notice_days integer check (cancellation_notice_days is null or cancellation_notice_days >= 0),
  next_payment_date date,
  status text not null default 'active' check (status in ('active','paused','cancelled','expired')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null check (target_amount > 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  monthly_amount numeric(18,2) not null default 0 check (monthly_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  target_date date,
  goal_type text not null default 'custom' check (goal_type in ('emergency','tax','holiday','vehicle','home','wedding','custom')),
  status text not null default 'active' check (status in ('active','completed','paused')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  debt_type text not null check (debt_type in ('personal_loan','mortgage','leasing','credit_card','installment','overdraft','private','tax','health_insurance','other')),
  creditor text not null,
  name text not null,
  original_amount numeric(18,2) not null check (original_amount >= 0),
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  interest_rate numeric(8,4) not null default 0 check (interest_rate >= 0),
  installment_amount numeric(18,2) not null default 0 check (installment_amount >= 0),
  payment_cadence text not null default 'monthly' check (payment_cadence in ('weekly','monthly','quarterly','annual','manual')),
  next_payment_date date,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','paid','paused','defaulted')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  field_name text not null default 'description' check (field_name in ('description','counterparty')),
  match_type text not null default 'contains' check (match_type in ('contains','starts_with','exact')),
  match_value text not null,
  priority integer not null default 100,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  file_name text not null,
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  status text not null default 'completed' check (status in ('processing','completed','failed')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index transactions_household_external_reference_uq
on public.transactions(household_id, external_reference)
where external_reference is not null;
create index budgets_household_month_idx on public.budgets(household_id, month_start);
create index recurring_household_next_idx on public.recurring_rules(household_id, next_date) where active = true;
create index bills_household_due_idx on public.bills(household_id, due_date);
create index contracts_household_next_idx on public.contracts(household_id, next_payment_date);
create index goals_household_idx on public.savings_goals(household_id);
create index debts_household_idx on public.debts(household_id);
create index rules_household_idx on public.categorization_rules(household_id, priority);
create index import_batches_household_idx on public.import_batches(household_id, created_at desc);
create index user_module_access_user_idx on public.user_module_access(user_id);

alter table public.product_modules enable row level security;
alter table public.user_module_access enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.bills enable row level security;
alter table public.contracts enable row level security;
alter table public.savings_goals enable row level security;
alter table public.debts enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.import_batches enable row level security;

create policy product_modules_authenticated_read on public.product_modules for select to authenticated using (is_available = true);
create policy user_module_access_own_read on public.user_module_access for select to authenticated using (user_id = (select auth.uid()));

create policy budgets_member_read on public.budgets for select to authenticated using (private.is_household_member(household_id));
create policy budgets_writer_insert on public.budgets for insert to authenticated with check (private.can_write_household(household_id));
create policy budgets_writer_update on public.budgets for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy budgets_writer_delete on public.budgets for delete to authenticated using (private.can_write_household(household_id));

create policy recurring_member_read on public.recurring_rules for select to authenticated using (private.is_household_member(household_id));
create policy recurring_writer_insert on public.recurring_rules for insert to authenticated with check (private.can_write_household(household_id));
create policy recurring_writer_update on public.recurring_rules for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy recurring_writer_delete on public.recurring_rules for delete to authenticated using (private.can_write_household(household_id));

create policy bills_member_read on public.bills for select to authenticated using (private.is_household_member(household_id));
create policy bills_writer_insert on public.bills for insert to authenticated with check (private.can_write_household(household_id));
create policy bills_writer_update on public.bills for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy bills_writer_delete on public.bills for delete to authenticated using (private.can_write_household(household_id));

create policy contracts_member_read on public.contracts for select to authenticated using (private.is_household_member(household_id));
create policy contracts_writer_insert on public.contracts for insert to authenticated with check (private.can_write_household(household_id));
create policy contracts_writer_update on public.contracts for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy contracts_writer_delete on public.contracts for delete to authenticated using (private.can_write_household(household_id));

create policy goals_member_read on public.savings_goals for select to authenticated using (private.is_household_member(household_id));
create policy goals_writer_insert on public.savings_goals for insert to authenticated with check (private.can_write_household(household_id));
create policy goals_writer_update on public.savings_goals for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy goals_writer_delete on public.savings_goals for delete to authenticated using (private.can_write_household(household_id));

create policy debts_member_read on public.debts for select to authenticated using (private.is_household_member(household_id));
create policy debts_writer_insert on public.debts for insert to authenticated with check (private.can_write_household(household_id));
create policy debts_writer_update on public.debts for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy debts_writer_delete on public.debts for delete to authenticated using (private.can_write_household(household_id));

create policy rules_member_read on public.categorization_rules for select to authenticated using (private.is_household_member(household_id));
create policy rules_writer_insert on public.categorization_rules for insert to authenticated with check (private.can_write_household(household_id));
create policy rules_writer_update on public.categorization_rules for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy rules_writer_delete on public.categorization_rules for delete to authenticated using (private.can_write_household(household_id));

create policy import_batches_member_read on public.import_batches for select to authenticated using (private.is_household_member(household_id));
create policy import_batches_writer_insert on public.import_batches for insert to authenticated with check (private.can_write_household(household_id));
create policy import_batches_writer_update on public.import_batches for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));

do $$
declare t text;
begin
  foreach t in array array['budgets','recurring_rules','bills','contracts','savings_goals','debts','categorization_rules']
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t, t);
  end loop;
end $$;

create trigger user_module_access_set_updated_at
before update on public.user_module_access
for each row execute function private.set_updated_at();
