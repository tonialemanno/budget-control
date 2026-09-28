-- Finance V2.3 – integrated workflows.
-- Adds tax export metadata, merchant budgets, savings/cash transfer conversion,
-- editable vehicle/insurance details and an investment trade ledger.

insert into public.product_modules (key, label, group_name, sort_order, is_core, is_available)
values ('tax','Steuern & Steuerberater','Planung',55,false,true)
on conflict (key) do update
set label=excluded.label, group_name=excluded.group_name, sort_order=excluded.sort_order, is_available=true;

insert into public.user_module_access (user_id, module_key, enabled)
select u.id, 'tax', true from auth.users u
on conflict (user_id, module_key) do nothing;

alter table public.households
  add column if not exists tax_region_code text;

alter table public.transactions
  add column if not exists tax_relevant boolean not null default false,
  add column if not exists tax_category text;

alter table public.documents
  add column if not exists tax_relevant boolean not null default false,
  add column if not exists tax_year integer,
  add column if not exists tax_category text;

alter table public.vehicles
  add column if not exists odometer_km integer,
  add column if not exists license_plate text;

alter table public.vehicles
  drop constraint if exists vehicles_odometer_km_check;
alter table public.vehicles
  add constraint vehicles_odometer_km_check check (odometer_km is null or odometer_km >= 0);

alter table public.insurance_policies
  add column if not exists policy_number text,
  add column if not exists last_paid_date date,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.contracts
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Budgets can target either a category or one specific merchant.
alter table public.budgets
  add column if not exists merchant_id uuid references public.merchants(id) on delete cascade;

alter table public.budgets alter column category_id drop not null;
alter table public.budgets drop constraint if exists budgets_household_id_category_id_month_start_key;
alter table public.budgets drop constraint if exists budgets_scope_check;
alter table public.budgets add constraint budgets_scope_check
  check ((category_id is not null and merchant_id is null) or (category_id is null and merchant_id is not null));

create unique index if not exists budgets_category_scope_unique
  on public.budgets(household_id, category_id, month_start)
  where category_id is not null;
create unique index if not exists budgets_merchant_scope_unique
  on public.budgets(household_id, merchant_id, month_start)
  where merchant_id is not null;
create index if not exists budgets_merchant_idx on public.budgets(merchant_id);

create table if not exists public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  trade_date date not null,
  side text not null check (side in ('buy','sell')),
  quantity numeric(24,8) not null check (quantity > 0),
  unit_price numeric(18,8) not null check (unit_price >= 0),
  fees numeric(18,2) not null default 0 check (fees >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  realized_gain numeric(18,2) not null default 0,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists investment_transactions_household_idx
  on public.investment_transactions(household_id, trade_date desc);
create index if not exists investment_transactions_investment_idx
  on public.investment_transactions(investment_id, trade_date desc);

alter table public.investment_transactions enable row level security;
grant select, insert, delete on public.investment_transactions to authenticated;

drop policy if exists investment_transactions_member_read on public.investment_transactions;
create policy investment_transactions_member_read on public.investment_transactions
for select to authenticated using (private.is_household_member(household_id));

drop policy if exists investment_transactions_writer_insert on public.investment_transactions;
create policy investment_transactions_writer_insert on public.investment_transactions
for insert to authenticated with check (private.can_write_household(household_id));

drop policy if exists investment_transactions_writer_delete on public.investment_transactions;
create policy investment_transactions_writer_delete on public.investment_transactions
for delete to authenticated using (private.can_write_household(household_id));

drop policy if exists module_access_gate on public.investment_transactions;
create policy module_access_gate on public.investment_transactions as restrictive
for all to authenticated
using ((select private.has_module_access('investments')))
with check ((select private.has_module_access('investments')));

-- Tax metadata is only visible/useful when the tax module is enabled.
-- Transactions/documents remain Finance-Core data; the tax fields do not hide the underlying object.

create or replace function public.convert_transaction_to_transfer(
  p_household_id uuid,
  p_transaction_id uuid,
  p_to_account_id uuid,
  p_to_amount numeric default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_tx public.transactions%rowtype;
  v_to public.accounts%rowtype;
  v_group uuid := gen_random_uuid();
  v_amount numeric;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  select * into v_tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id
   for update;
  if not found then raise exception 'Transaktion nicht gefunden.'; end if;
  if v_tx.transfer_group_id is not null then raise exception 'Transaktion ist bereits eine Umbuchung.'; end if;
  if v_tx.amount >= 0 then raise exception 'Nur ein Abgang kann als Umbuchung umgewandelt werden.'; end if;

  select * into v_to from public.accounts
   where id=p_to_account_id and household_id=p_household_id and is_archived=false;
  if not found then raise exception 'Zielkonto nicht gefunden.'; end if;
  if v_to.id=v_tx.account_id then raise exception 'Quell- und Zielkonto müssen verschieden sein.'; end if;

  if v_to.currency=v_tx.currency then
    v_amount := abs(v_tx.amount);
  else
    v_amount := p_to_amount;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Bei Währungswechsel muss der Zielbetrag angegeben werden.';
    end if;
  end if;

  update public.transactions
     set transfer_group_id=v_group,
         category_id=null,
         tax_relevant=false,
         tax_category=null,
         updated_at=now()
   where id=v_tx.id;

  insert into public.transactions (
    household_id, account_id, category_id, occurred_at, amount, currency,
    description, counterparty, note, status, source, transfer_group_id
  ) values (
    p_household_id, v_to.id, null, v_tx.occurred_at, v_amount, v_to.currency,
    coalesce(nullif(p_description,''), 'Umbuchung'), null,
    'Aus bestehender Buchung als interne Umbuchung erkannt.', 'booked', 'manual', v_group
  );

  return v_group;
end;
$$;

revoke all on function public.convert_transaction_to_transfer(uuid,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.convert_transaction_to_transfer(uuid,uuid,uuid,numeric,text) to authenticated;

create or replace function public.record_investment_trade(
  p_household_id uuid,
  p_investment_id uuid,
  p_trade_date date,
  p_side text,
  p_quantity numeric,
  p_unit_price numeric,
  p_fees numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_inv public.investments%rowtype;
  v_new_qty numeric;
  v_new_cost numeric;
  v_avg_cost numeric;
  v_basis_reduction numeric;
  v_realized numeric := 0;
  v_trade_id uuid;
begin
  if not private.can_write_household(p_household_id) or not private.has_module_access('investments') then
    raise exception 'Keine Berechtigung für Investments.';
  end if;
  if p_side not in ('buy','sell') or p_quantity <= 0 or p_unit_price < 0 or coalesce(p_fees,0) < 0 then
    raise exception 'Ungültige Handelsdaten.';
  end if;

  select * into v_inv from public.investments
   where id=p_investment_id and household_id=p_household_id
   for update;
  if not found then raise exception 'Investmentposition nicht gefunden.'; end if;

  if p_side='buy' then
    v_new_qty := v_inv.quantity + p_quantity;
    v_new_cost := v_inv.cost_basis + (p_quantity*p_unit_price) + coalesce(p_fees,0);
  else
    if p_quantity > v_inv.quantity then raise exception 'Es können nicht mehr Anteile verkauft werden als vorhanden.'; end if;
    v_avg_cost := case when v_inv.quantity > 0 then v_inv.cost_basis / v_inv.quantity else 0 end;
    v_basis_reduction := v_avg_cost * p_quantity;
    v_realized := (p_quantity*p_unit_price) - coalesce(p_fees,0) - v_basis_reduction;
    v_new_qty := v_inv.quantity - p_quantity;
    v_new_cost := greatest(0, v_inv.cost_basis - v_basis_reduction);
  end if;

  update public.investments
     set quantity=v_new_qty,
         cost_basis=v_new_cost,
         current_value=case when v_new_qty=0 then 0 else v_new_qty*p_unit_price end,
         updated_at=now()
   where id=v_inv.id;

  insert into public.investment_transactions (
    investment_id, household_id, trade_date, side, quantity, unit_price, fees,
    currency, realized_gain, notes
  ) values (
    v_inv.id, p_household_id, p_trade_date, p_side, p_quantity, p_unit_price,
    coalesce(p_fees,0), v_inv.currency, v_realized, p_notes
  ) returning id into v_trade_id;

  return jsonb_build_object(
    'trade_id',v_trade_id,'quantity',v_new_qty,'cost_basis',v_new_cost,
    'current_value',case when v_new_qty=0 then 0 else v_new_qty*p_unit_price end,
    'realized_gain',v_realized
  );
end;
$$;

revoke all on function public.record_investment_trade(uuid,uuid,date,text,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.record_investment_trade(uuid,uuid,date,text,numeric,numeric,numeric,text) to authenticated;
