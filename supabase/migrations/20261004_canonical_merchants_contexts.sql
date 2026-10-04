-- Canonical merchants, aliases, counterparties and transaction contexts.
-- Keeps bank descriptions untouched while allowing Finance to attach clean semantics.

create table if not exists public.merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  alias_name text not null,
  normalized_key text not null,
  payment_processor text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(household_id, normalized_key)
);

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_key text not null,
  kind text not null default 'person',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, kind, normalized_key)
);

create table if not exists public.transaction_contexts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_key text not null,
  context_type text not null default 'other',
  vehicle_id uuid references public.vehicles(id) on delete set null,
  starts_on date,
  ends_on date,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, normalized_key)
);

alter table public.transactions add column if not exists counterparty_id uuid references public.counterparties(id) on delete set null;
alter table public.transactions add column if not exists context_id uuid references public.transaction_contexts(id) on delete set null;
alter table public.transactions add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;
alter table public.transactions add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

create index if not exists merchant_aliases_merchant_idx on public.merchant_aliases(merchant_id);
create index if not exists transactions_counterparty_idx on public.transactions(counterparty_id);
create index if not exists transactions_context_idx on public.transactions(context_id);
create index if not exists transactions_vehicle_idx on public.transactions(vehicle_id);
create index if not exists transactions_recurring_rule_idx on public.transactions(recurring_rule_id);

alter table public.merchant_aliases enable row level security;
alter table public.counterparties enable row level security;
alter table public.transaction_contexts enable row level security;

drop policy if exists merchant_aliases_read on public.merchant_aliases;
create policy merchant_aliases_read on public.merchant_aliases
for select to authenticated using (private.is_household_member(household_id));

drop policy if exists merchant_aliases_write on public.merchant_aliases;
create policy merchant_aliases_write on public.merchant_aliases
for all to authenticated using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));

drop policy if exists counterparties_read on public.counterparties;
create policy counterparties_read on public.counterparties
for select to authenticated using (private.is_household_member(household_id));

drop policy if exists counterparties_write on public.counterparties;
create policy counterparties_write on public.counterparties
for all to authenticated using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));

drop policy if exists transaction_contexts_read on public.transaction_contexts;
create policy transaction_contexts_read on public.transaction_contexts
for select to authenticated using (private.is_household_member(household_id));

drop policy if exists transaction_contexts_write on public.transaction_contexts;
create policy transaction_contexts_write on public.transaction_contexts
for all to authenticated using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));

create or replace function public.merge_merchant_records(
  p_household_id uuid,
  p_source_merchant_id uuid,
  p_target_merchant_id uuid
) returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare
  v_source public.merchants%rowtype;
  v_target public.merchants%rowtype;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;
  if p_source_merchant_id=p_target_merchant_id then
    return p_target_merchant_id;
  end if;

  select * into v_source from public.merchants
  where id=p_source_merchant_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Quellhändler nicht gefunden.'; end if;

  select * into v_target from public.merchants
  where id=p_target_merchant_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Zielhändler nicht gefunden.'; end if;

  insert into public.merchant_aliases(household_id,merchant_id,alias_name,normalized_key,payment_processor)
  values(p_household_id,v_target.id,v_source.name,v_source.normalized_key,null)
  on conflict(household_id,normalized_key)
  do update set merchant_id=excluded.merchant_id, alias_name=excluded.alias_name;

  update public.merchant_aliases set merchant_id=v_target.id
  where household_id=p_household_id and merchant_id=v_source.id;

  update public.transactions set merchant_id=v_target.id
  where household_id=p_household_id and merchant_id=v_source.id;

  update public.recurring_rules set merchant_id=v_target.id
  where household_id=p_household_id and merchant_id=v_source.id;

  update public.budgets target
  set amount=greatest(target.amount,source.amount), updated_at=now()
  from public.budgets source
  where source.household_id=p_household_id
    and source.merchant_id=v_source.id
    and target.household_id=p_household_id
    and target.merchant_id=v_target.id
    and target.month_start=source.month_start;

  delete from public.budgets source
  where source.household_id=p_household_id
    and source.merchant_id=v_source.id
    and exists(
      select 1 from public.budgets target
      where target.household_id=p_household_id
        and target.merchant_id=v_target.id
        and target.month_start=source.month_start
    );

  update public.budgets set merchant_id=v_target.id
  where household_id=p_household_id and merchant_id=v_source.id;

  if v_target.default_category_id is null and v_source.default_category_id is not null then
    update public.merchants set default_category_id=v_source.default_category_id,updated_at=now()
    where id=v_target.id;
  end if;

  delete from public.merchants where id=v_source.id;
  return v_target.id;
end;
$$;

revoke all on function public.merge_merchant_records(uuid,uuid,uuid) from public,anon;
grant execute on function public.merge_merchant_records(uuid,uuid,uuid) to authenticated;
