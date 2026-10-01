-- Finance V2.4: receivables ledger, presence heartbeat and module registration.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

insert into public.product_modules (key, label, group_name, sort_order, is_core, is_available)
values ('receivables','Forderungen','Verbindlichkeiten',65,false,true)
on conflict (key) do update
set label=excluded.label,
    group_name=excluded.group_name,
    sort_order=excluded.sort_order,
    is_core=excluded.is_core,
    is_available=excluded.is_available;

insert into public.user_module_access (user_id, module_key, enabled)
select u.id, 'receivables', true
from auth.users u
on conflict (user_id, module_key) do nothing;

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  debtor_name text not null,
  reason text not null,
  original_amount numeric(18,2) not null check (original_amount > 0),
  outstanding_amount numeric(18,2) not null check (outstanding_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  installment_amount numeric(18,2) not null default 0 check (installment_amount >= 0),
  due_date date,
  status text not null default 'open' check (status in ('open','paused','paid')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_outstanding_not_above_original check (outstanding_amount <= original_amount)
);

create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  paid_at date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  outstanding_before numeric(18,2) not null check (outstanding_before >= 0),
  outstanding_after numeric(18,2) not null check (outstanding_after >= 0),
  receivable_status_before text not null check (receivable_status_before in ('open','paused','paid')),
  note text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists receivables_household_status_idx
  on public.receivables(household_id, status, due_date);
create index if not exists receivable_payments_receivable_idx
  on public.receivable_payments(receivable_id, paid_at desc, created_at desc);

alter table public.receivables enable row level security;
alter table public.receivable_payments enable row level security;

drop policy if exists receivables_member_read on public.receivables;
create policy receivables_member_read on public.receivables for select to authenticated
using (private.is_household_member(household_id));
drop policy if exists receivables_writer_insert on public.receivables;
create policy receivables_writer_insert on public.receivables for insert to authenticated
with check (private.can_write_household(household_id));
drop policy if exists receivables_writer_update on public.receivables;
create policy receivables_writer_update on public.receivables for update to authenticated
using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));
drop policy if exists receivables_writer_delete on public.receivables;
create policy receivables_writer_delete on public.receivables for delete to authenticated
using (private.can_write_household(household_id));
drop policy if exists receivables_module_access_gate on public.receivables;
create policy receivables_module_access_gate on public.receivables as restrictive for all to authenticated
using ((select private.has_module_access('receivables')))
with check ((select private.has_module_access('receivables')));

drop policy if exists receivable_payments_member_read on public.receivable_payments;
create policy receivable_payments_member_read on public.receivable_payments for select to authenticated
using (private.is_household_member(household_id));
drop policy if exists receivable_payments_writer_insert on public.receivable_payments;
create policy receivable_payments_writer_insert on public.receivable_payments for insert to authenticated
with check (private.can_write_household(household_id));
drop policy if exists receivable_payments_writer_update on public.receivable_payments;
create policy receivable_payments_writer_update on public.receivable_payments for update to authenticated
using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));
drop policy if exists receivable_payments_module_access_gate on public.receivable_payments;
create policy receivable_payments_module_access_gate on public.receivable_payments as restrictive for all to authenticated
using ((select private.has_module_access('receivables')))
with check ((select private.has_module_access('receivables')));

grant select, insert, update, delete on public.receivables to authenticated;
grant select, insert, update on public.receivable_payments to authenticated;
revoke delete on public.receivable_payments from authenticated;

drop trigger if exists receivables_set_updated_at on public.receivables;
create trigger receivables_set_updated_at
before update on public.receivables
for each row execute function private.set_updated_at();

create or replace function public.record_receivable_payment(
  p_household_id uuid,
  p_receivable_id uuid,
  p_paid_at date,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_receivable public.receivables%rowtype;
  v_payment_id uuid;
  v_after numeric(18,2);
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'No write access to household';
  end if;
  if not private.has_module_access('receivables') then
    raise exception 'Receivables module is not enabled';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment must be greater than zero';
  end if;

  select * into v_receivable
  from public.receivables
  where id=p_receivable_id and household_id=p_household_id
  for update;

  if not found then raise exception 'Receivable not found'; end if;
  if v_receivable.status='paid' or v_receivable.outstanding_amount=0 then
    raise exception 'Receivable is already paid';
  end if;
  if p_amount > v_receivable.outstanding_amount then
    raise exception 'Payment exceeds outstanding amount';
  end if;

  v_after := v_receivable.outstanding_amount - p_amount;

  insert into public.receivable_payments (
    household_id, receivable_id, paid_at, amount, currency,
    outstanding_before, outstanding_after, receivable_status_before, note
  ) values (
    p_household_id, p_receivable_id, coalesce(p_paid_at,current_date), p_amount, v_receivable.currency,
    v_receivable.outstanding_amount, v_after, v_receivable.status, nullif(trim(p_note),'')
  ) returning id into v_payment_id;

  update public.receivables
  set outstanding_amount=v_after,
      status=case when v_after=0 then 'paid' when status='paid' then 'open' else status end,
      updated_at=now()
  where id=p_receivable_id;

  return v_payment_id;
end;
$$;

create or replace function public.reverse_receivable_payment(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_payment public.receivable_payments%rowtype;
begin
  select * into v_payment
  from public.receivable_payments
  where id=p_payment_id
  for update;

  if not found then raise exception 'Payment not found'; end if;
  if not private.can_write_household(v_payment.household_id) then
    raise exception 'No write access to household';
  end if;
  if v_payment.reversed_at is not null then
    raise exception 'Payment already reversed';
  end if;
  if exists (
    select 1 from public.receivable_payments p
    where p.receivable_id=v_payment.receivable_id
      and p.reversed_at is null
      and (p.paid_at, p.created_at) > (v_payment.paid_at, v_payment.created_at)
  ) then
    raise exception 'Only the latest active payment can be reversed';
  end if;

  update public.receivable_payments
  set reversed_at=now(), reversed_by=auth.uid()
  where id=v_payment.id;

  update public.receivables
  set outstanding_amount=v_payment.outstanding_before,
      status=v_payment.receivable_status_before,
      updated_at=now()
  where id=v_payment.receivable_id;
end;
$$;

grant execute on function public.record_receivable_payment(uuid,uuid,date,numeric,text) to authenticated;
grant execute on function public.reverse_receivable_payment(uuid) to authenticated;
