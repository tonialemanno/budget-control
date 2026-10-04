-- Canonical merchants, counterparties and transaction context.
-- Raw bank descriptions remain untouched; these structures are semantic links only.

create table if not exists public.merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  alias_name text not null,
  normalized_key text not null,
  payment_processor text null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(household_id, normalized_key)
);

create index if not exists merchant_aliases_merchant_idx
  on public.merchant_aliases(merchant_id);

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_key text not null,
  kind text not null default 'other'
    check (kind in ('person','authority','employer','organization','payment_processor','other')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, kind, normalized_key)
);

create table if not exists public.transaction_contexts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_key text not null,
  context_type text not null default 'other'
    check (context_type in ('trip','project','vehicle','life_event','other')),
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  starts_on date null,
  ends_on date null,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, normalized_key)
);

alter table public.transactions
  add column if not exists counterparty_id uuid null references public.counterparties(id) on delete set null,
  add column if not exists context_id uuid null references public.transaction_contexts(id) on delete set null,
  add column if not exists vehicle_id uuid null references public.vehicles(id) on delete set null,
  add column if not exists recurring_rule_id uuid null references public.recurring_rules(id) on delete set null;

create index if not exists transactions_counterparty_idx on public.transactions(counterparty_id);
create index if not exists transactions_context_idx on public.transactions(context_id);
create index if not exists transactions_vehicle_idx on public.transactions(vehicle_id);
create index if not exists transactions_recurring_rule_idx on public.transactions(recurring_rule_id);

alter table public.transactions
  drop constraint if exists transactions_semantic_type_check;

alter table public.transactions
  add constraint transactions_semantic_type_check
  check (
    semantic_type is null or semantic_type in (
      'earned_income','other_income','refund','receivable_repayment',
      'internal_transfer','fixed_expense','variable_expense','tax_payment',
      'tax_refund','saving','debt_payment','receivable_principal',
      'asset_acquisition','ignored'
    )
  );

alter table public.merchant_aliases enable row level security;
alter table public.counterparties enable row level security;
alter table public.transaction_contexts enable row level security;

drop policy if exists merchant_aliases_read on public.merchant_aliases;
create policy merchant_aliases_read on public.merchant_aliases
for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists merchant_aliases_write on public.merchant_aliases;
create policy merchant_aliases_write on public.merchant_aliases
for all to authenticated
using (private.can_write_household(household_id))
with check (
  private.can_write_household(household_id)
  and exists (
    select 1 from public.merchants m
    where m.id=merchant_aliases.merchant_id
      and m.household_id=merchant_aliases.household_id
  )
);

drop policy if exists counterparties_read on public.counterparties;
create policy counterparties_read on public.counterparties
for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists counterparties_write on public.counterparties;
create policy counterparties_write on public.counterparties
for all to authenticated
using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));

drop policy if exists transaction_contexts_read on public.transaction_contexts;
create policy transaction_contexts_read on public.transaction_contexts
for select to authenticated
using (private.is_household_member(household_id));

drop policy if exists transaction_contexts_write on public.transaction_contexts;
create policy transaction_contexts_write on public.transaction_contexts
for all to authenticated
using (private.can_write_household(household_id))
with check (
  private.can_write_household(household_id)
  and (
    vehicle_id is null
    or exists (
      select 1 from public.vehicles v
      where v.id=transaction_contexts.vehicle_id
        and v.household_id=transaction_contexts.household_id
    )
  )
);

revoke all on public.merchant_aliases from anon;
revoke all on public.counterparties from anon;
revoke all on public.transaction_contexts from anon;
grant select,insert,update,delete on public.merchant_aliases to authenticated;
grant select,insert,update,delete on public.counterparties to authenticated;
grant select,insert,update,delete on public.transaction_contexts to authenticated;

create or replace function public.merge_merchants_v2(
  p_household_id uuid,
  p_canonical_merchant_id uuid,
  p_duplicate_merchant_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_canonical public.merchants%rowtype;
  v_duplicate public.merchants%rowtype;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;
  if p_canonical_merchant_id=p_duplicate_merchant_id then
    return p_canonical_merchant_id;
  end if;

  select * into v_canonical
  from public.merchants
  where id=p_canonical_merchant_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Zielhändler nicht gefunden.'; end if;

  select * into v_duplicate
  from public.merchants
  where id=p_duplicate_merchant_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Doppelter Händler nicht gefunden.'; end if;

  insert into public.merchant_aliases(household_id,merchant_id,alias_name,normalized_key)
  values(p_household_id,v_canonical.id,v_duplicate.name,v_duplicate.normalized_key)
  on conflict(household_id,normalized_key) do update
  set merchant_id=excluded.merchant_id,
      alias_name=excluded.alias_name;

  update public.merchant_aliases
  set merchant_id=v_canonical.id
  where household_id=p_household_id
    and merchant_id=v_duplicate.id;

  update public.transactions
  set merchant_id=v_canonical.id, updated_at=now()
  where household_id=p_household_id
    and merchant_id=v_duplicate.id;

  update public.recurring_rules
  set merchant_id=v_canonical.id, updated_at=now()
  where household_id=p_household_id
    and merchant_id=v_duplicate.id;

  delete from public.budgets duplicate_budget
  where duplicate_budget.household_id=p_household_id
    and duplicate_budget.merchant_id=v_duplicate.id
    and exists (
      select 1
      from public.budgets canonical_budget
      where canonical_budget.household_id=p_household_id
        and canonical_budget.merchant_id=v_canonical.id
        and canonical_budget.month_start=duplicate_budget.month_start
    );

  update public.budgets
  set merchant_id=v_canonical.id
  where household_id=p_household_id
    and merchant_id=v_duplicate.id;

  if v_canonical.default_category_id is null and v_duplicate.default_category_id is not null then
    update public.merchants
    set default_category_id=v_duplicate.default_category_id,
        updated_at=now()
    where id=v_canonical.id;
  end if;

  delete from public.merchants
  where id=v_duplicate.id and household_id=p_household_id;

  return v_canonical.id;
end;
$$;

revoke all on function public.merge_merchants_v2(uuid,uuid,uuid) from public, anon;
grant execute on function public.merge_merchants_v2(uuid,uuid,uuid) to authenticated;

comment on table public.merchant_aliases is
  'Bank and payment-provider spellings that resolve to one canonical merchant.';
comment on table public.counterparties is
  'People, authorities, employers and organizations involved in a transaction without pretending they are merchants.';
comment on table public.transaction_contexts is
  'Optional trip/project/life-event context such as Ferien Italien 2026.';
comment on column public.transactions.recurring_rule_id is
  'Links a booked transaction to the recurring rule it fulfills.';
comment on column public.transactions.vehicle_id is
  'Optional vehicle affected by the transaction, for purchase, maintenance or running cost.';
