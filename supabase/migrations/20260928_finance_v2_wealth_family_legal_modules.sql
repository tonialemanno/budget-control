-- Wealth, family privacy and country-process objects.

alter table public.accounts
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private','household')),
  add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;

update public.accounts set owner_user_id = created_by where owner_user_id is null;
alter table public.accounts alter column owner_user_id set not null;
alter table public.accounts alter column owner_user_id set default auth.uid();

drop policy if exists accounts_select_member on public.accounts;
create policy accounts_select_member on public.accounts for select to authenticated
using (
  private.is_household_member(household_id)
  and (visibility = 'household' or owner_user_id = (select auth.uid()))
);

drop policy if exists transactions_select_member on public.transactions;
create policy transactions_select_member on public.transactions for select to authenticated
using (
  private.is_household_member(household_id)
  and exists (
    select 1 from public.accounts a
    where a.id = transactions.account_id
      and a.household_id = transactions.household_id
      and (a.visibility = 'household' or a.owner_user_id = (select auth.uid()))
  )
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  asset_type text not null check (asset_type in ('cash_other','valuable','business_interest','other')),
  name text not null,
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  acquired_date date,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  property_type text not null default 'home' check (property_type in ('home','apartment','land','investment','other')),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  purchase_date date,
  purchase_price numeric(18,2) check (purchase_price is null or purchase_price >= 0),
  monthly_running_cost numeric(18,2) not null default 0 check (monthly_running_cost >= 0),
  renovation_reserve numeric(18,2) not null default 0 check (renovation_reserve >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  vehicle_type text not null default 'car' check (vehicle_type in ('car','motorcycle','bike','other')),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  purchase_date date,
  purchase_price numeric(18,2) check (purchase_price is null or purchase_price >= 0),
  monthly_cost numeric(18,2) not null default 0 check (monthly_cost >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  provider text,
  policy_type text not null default 'other',
  premium_amount numeric(18,2) not null default 0 check (premium_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  billing_cadence text not null default 'monthly' check (billing_cadence in ('monthly','quarterly','semiannual','annual')),
  start_date date,
  end_date date,
  cancellation_notice_days integer check (cancellation_notice_days is null or cancellation_notice_days >= 0),
  next_payment_date date,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  investment_type text not null check (investment_type in ('stock','etf','fund','bond','crypto','cash','other')),
  symbol text,
  quantity numeric(24,8) not null default 0 check (quantity >= 0),
  cost_basis numeric(18,2) not null default 0 check (cost_basis >= 0),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  provider text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pension_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  country_code text not null check (country_code in ('CH','DE')),
  pension_type text not null,
  provider text,
  name text not null,
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  annual_contribution numeric(18,2) not null default 0 check (annual_contribution >= 0),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  country_code text not null check (country_code in ('CH','DE')),
  case_type text not null check (case_type in ('reminder','collection','debt_enforcement','court_dunning','enforcement','other')),
  creditor text not null,
  reference text,
  original_amount numeric(18,2) not null default 0 check (original_amount >= 0),
  outstanding_amount numeric(18,2) not null default 0 check (outstanding_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  status text not null default 'open',
  next_action_date date,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  event_date date not null,
  event_type text not null,
  title text not null,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  object_type text,
  object_id uuid,
  name text not null,
  storage_path text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  document_date date,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index assets_household_idx on public.assets(household_id);
create index properties_household_idx on public.properties(household_id);
create index vehicles_household_idx on public.vehicles(household_id);
create index insurance_household_idx on public.insurance_policies(household_id);
create index investments_household_idx on public.investments(household_id);
create index pension_household_idx on public.pension_accounts(household_id);
create index legal_cases_household_idx on public.legal_cases(household_id);
create index legal_events_case_idx on public.legal_case_events(case_id, event_date);
create index documents_household_idx on public.documents(household_id, created_at desc);
create index accounts_owner_user_idx on public.accounts(owner_user_id);

alter table public.assets enable row level security;
alter table public.properties enable row level security;
alter table public.vehicles enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.investments enable row level security;
alter table public.pension_accounts enable row level security;
alter table public.legal_cases enable row level security;
alter table public.legal_case_events enable row level security;
alter table public.documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['assets','properties','vehicles','insurance_policies','investments','pension_accounts','legal_cases','legal_case_events','documents']
  loop
    execute format('create policy %I_member_read on public.%I for select to authenticated using (private.is_household_member(household_id))', t, t);
    execute format('create policy %I_writer_insert on public.%I for insert to authenticated with check (private.can_write_household(household_id))', t, t);
    if t <> 'documents' and t <> 'legal_case_events' then
      execute format('create policy %I_writer_update on public.%I for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id))', t, t);
    end if;
    execute format('create policy %I_writer_delete on public.%I for delete to authenticated using (private.can_write_household(household_id))', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['assets','properties','vehicles','insurance_policies','investments','pension_accounts','legal_cases']
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t, t);
  end loop;
end $$;
