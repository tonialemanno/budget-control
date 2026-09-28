-- Finance V1 Core Foundation
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  country_code text check (country_code is null or country_code in ('CH','DE')),
  base_currency text check (base_currency is null or base_currency in ('CHF','EUR')),
  locale text not null default 'de-CH',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  country_code text not null check (country_code in ('CH','DE')),
  base_currency text not null check (base_currency in ('CHF','EUR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  account_type text not null check (
    account_type in ('checking','savings','cash','credit_card','loan','mortgage','investment','pension','other')
  ),
  institution_name text,
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  balance_anchor_amount numeric(18,2) not null default 0,
  balance_anchor_at timestamptz not null default now(),
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  icon text,
  color text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  occurred_at timestamptz not null,
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  description text not null,
  counterparty text,
  note text,
  status text not null default 'booked' check (status in ('booked','pending')),
  source text not null default 'manual' check (source in ('manual','import','system')),
  transfer_group_id uuid,
  external_reference text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_household_idx on public.accounts(household_id);
create index categories_household_idx on public.categories(household_id);
create index categories_parent_idx on public.categories(parent_id);
create index transactions_household_idx on public.transactions(household_id);
create index transactions_account_occurred_idx on public.transactions(account_id, occurred_at desc);
create index transactions_category_idx on public.transactions(category_id);
create index transactions_transfer_group_idx on public.transactions(transfer_group_id);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger households_set_updated_at before update on public.households
for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, locale)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''), ''),
    'de-CH'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_new_household_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (household_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger on_household_created
after insert on public.households
for each row execute function public.handle_new_household_owner();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.can_admin_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner','admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy profiles_select_own on public.profiles for select using (user_id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy households_select_member on public.households for select using (public.is_household_member(id));
create policy households_insert_owner on public.households for insert with check (owner_user_id = auth.uid());
create policy households_update_admin on public.households for update using (public.can_admin_household(id)) with check (public.can_admin_household(id));
create policy households_delete_owner on public.households for delete using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.household_members hm
    where hm.household_id = id and hm.user_id = auth.uid() and hm.role = 'owner'
  )
);

create policy household_members_select_member on public.household_members for select using (public.is_household_member(household_id));
create policy household_members_insert_admin on public.household_members for insert with check (public.can_admin_household(household_id));
create policy household_members_update_admin on public.household_members for update using (public.can_admin_household(household_id)) with check (public.can_admin_household(household_id));
create policy household_members_delete_admin on public.household_members for delete using (
  public.can_admin_household(household_id)
  and not (user_id = auth.uid() and role = 'owner')
);

create policy accounts_select_member on public.accounts for select using (public.is_household_member(household_id));
create policy accounts_insert_writer on public.accounts for insert with check (public.can_write_household(household_id));
create policy accounts_update_writer on public.accounts for update using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
create policy accounts_delete_admin on public.accounts for delete using (public.can_admin_household(household_id));

create policy categories_select_member on public.categories for select using (public.is_household_member(household_id));
create policy categories_insert_writer on public.categories for insert with check (public.can_write_household(household_id));
create policy categories_update_writer on public.categories for update using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
create policy categories_delete_admin on public.categories for delete using (public.can_admin_household(household_id));

create policy transactions_select_member on public.transactions for select using (public.is_household_member(household_id));
create policy transactions_insert_writer on public.transactions for insert with check (
  public.can_write_household(household_id)
  and exists (select 1 from public.accounts a where a.id = account_id and a.household_id = transactions.household_id)
  and (
    category_id is null
    or exists (select 1 from public.categories c where c.id = category_id and c.household_id = transactions.household_id)
  )
);
create policy transactions_update_writer on public.transactions for update using (public.can_write_household(household_id)) with check (
  public.can_write_household(household_id)
  and exists (select 1 from public.accounts a where a.id = account_id and a.household_id = transactions.household_id)
  and (
    category_id is null
    or exists (select 1 from public.categories c where c.id = category_id and c.household_id = transactions.household_id)
  )
);
create policy transactions_delete_writer on public.transactions for delete using (public.can_write_household(household_id));

create or replace view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.household_id,
  a.name,
  a.currency,
  a.balance_anchor_amount,
  a.balance_anchor_at,
  (
    a.balance_anchor_amount
    + coalesce(sum(t.amount) filter (
        where t.status = 'booked'
          and t.occurred_at > a.balance_anchor_at
      ), 0)
  )::numeric(18,2) as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

grant select on public.account_balances to authenticated;
