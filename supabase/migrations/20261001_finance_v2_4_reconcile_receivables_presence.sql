-- Finance V2.4 reconciliation.
-- Keeps the live V2.3 receivables ledger as the source of truth and makes fresh local resets converge to it.

-- Normalize receivables created by the temporary V2.4 bootstrap migration.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='receivables' and column_name='debtor_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='receivables' and column_name='debtor'
  ) then
    alter table public.receivables rename column debtor_name to debtor;
  end if;
end $$;

alter table public.receivables
  drop column if exists installment_amount,
  add column if not exists lent_at date,
  add column if not exists source_account_id uuid,
  add column if not exists source_transaction_id uuid;

update public.receivables set lent_at=current_date where lent_at is null;
alter table public.receivables alter column lent_at set default current_date;
alter table public.receivables alter column lent_at set not null;

alter table public.receivables drop constraint if exists receivables_status_check;
alter table public.receivables add constraint receivables_status_check
  check (status in ('open','partial','overdue','paid','written_off'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='receivables_source_account_id_fkey') then
    alter table public.receivables
      add constraint receivables_source_account_id_fkey
      foreign key (source_account_id) references public.accounts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='receivables_source_transaction_id_fkey') then
    alter table public.receivables
      add constraint receivables_source_transaction_id_fkey
      foreign key (source_transaction_id) references public.transactions(id) on delete set null;
  end if;
end $$;

alter table public.receivable_payments
  drop column if exists outstanding_before,
  drop column if exists receivable_status_before,
  drop column if exists reversed_by,
  add column if not exists payment_account_id uuid,
  add column if not exists transaction_id uuid,
  add column if not exists source text;

update public.receivable_payments set source='history_only' where source is null;
alter table public.receivable_payments alter column source set default 'history_only';
alter table public.receivable_payments alter column source set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='receivable_payments_payment_account_id_fkey') then
    alter table public.receivable_payments
      add constraint receivable_payments_payment_account_id_fkey
      foreign key (payment_account_id) references public.accounts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='receivable_payments_transaction_id_fkey') then
    alter table public.receivable_payments
      add constraint receivable_payments_transaction_id_fkey
      foreign key (transaction_id) references public.transactions(id) on delete set null;
  end if;
end $$;

-- Receivable principal transfers are balance movements, not consumption.
alter table public.transactions drop constraint if exists transactions_cashflow_type_check;
alter table public.transactions add constraint transactions_cashflow_type_check
  check (cashflow_type in ('standard','debt_payment','receivable_principal'));

-- Presence is written only through authenticated RPCs and read server-side by admin-users.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  route text,
  app_version text,
  device_label text
);
alter table public.user_presence enable row level security;
revoke all on table public.user_presence from anon, authenticated;

create or replace function public.touch_user_presence(
  p_route text default null,
  p_app_version text default null,
  p_device_label text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into public.user_presence(user_id,last_seen_at,route,app_version,device_label)
  values (
    v_uid, now(), nullif(left(trim(p_route),120),''),
    nullif(left(trim(p_app_version),80),''),
    nullif(left(trim(p_device_label),80),'')
  )
  on conflict (user_id) do update
    set last_seen_at=excluded.last_seen_at,
        route=excluded.route,
        app_version=excluded.app_version,
        device_label=excluded.device_label;
end;
$$;

create or replace function public.clear_user_presence()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.user_presence where user_id=auth.uid();
$$;

-- Canonical receivable creation. Optional source transaction keeps account balance correct.
create or replace function public.create_receivable_v2(
  p_household_id uuid,
  p_debtor text,
  p_reason text,
  p_original_amount numeric,
  p_currency text,
  p_lent_at date default current_date,
  p_due_date date default null,
  p_notes text default null,
  p_source_account_id uuid default null,
  p_create_transaction boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_receivable_id uuid;
  v_transaction_id uuid;
  v_account public.accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.can_write_household(p_household_id) then raise exception 'Not allowed'; end if;
  if not private.has_module_access('receivables') then raise exception 'Receivables module is not enabled'; end if;
  if nullif(trim(p_debtor),'') is null then raise exception 'Debtor is required'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reason is required'; end if;
  if p_original_amount is null or p_original_amount<=0 then raise exception 'Amount must be greater than zero'; end if;
  if p_currency not in ('CHF','EUR','USD','GBP') then raise exception 'Unsupported currency'; end if;

  if p_create_transaction then
    if p_source_account_id is null then raise exception 'Source account is required'; end if;
    select * into v_account
      from public.accounts
      where id=p_source_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Source account not found'; end if;
    if v_account.currency<>p_currency then raise exception 'Source account currency must match receivable currency'; end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,
      note,status,source,cashflow_type
    ) values (
      p_household_id,p_source_account_id,coalesce(p_lent_at,current_date)::timestamptz + time '12:00',
      -abs(p_original_amount),p_currency,
      'Geld verliehen: '||trim(p_debtor)||' – '||trim(p_reason),
      trim(p_debtor),nullif(trim(p_notes),''),'booked','manual','receivable_principal'
    ) returning id into v_transaction_id;
  end if;

  insert into public.receivables(
    household_id,debtor,reason,original_amount,outstanding_amount,currency,lent_at,due_date,
    status,notes,source_account_id,source_transaction_id
  ) values (
    p_household_id,trim(p_debtor),trim(p_reason),p_original_amount,p_original_amount,p_currency,
    coalesce(p_lent_at,current_date),p_due_date,
    case when p_due_date is not null and p_due_date<current_date then 'overdue' else 'open' end,
    nullif(trim(p_notes),''),p_source_account_id,v_transaction_id
  ) returning id into v_receivable_id;

  return v_receivable_id;
end;
$$;

create or replace function public.record_receivable_payment_v2(
  p_household_id uuid,
  p_receivable_id uuid,
  p_amount numeric,
  p_paid_at date default current_date,
  p_note text default null,
  p_payment_account_id uuid default null,
  p_create_transaction boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_receivable public.receivables%rowtype;
  v_account public.accounts%rowtype;
  v_remaining numeric(18,2);
  v_payment_id uuid;
  v_transaction_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.can_write_household(p_household_id) then raise exception 'Not allowed'; end if;
  if not private.has_module_access('receivables') then raise exception 'Receivables module is not enabled'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

  select * into v_receivable
    from public.receivables
    where id=p_receivable_id and household_id=p_household_id
    for update;

  if not found then raise exception 'Receivable not found'; end if;
  if v_receivable.status in ('paid','written_off') then raise exception 'Receivable is already closed'; end if;
  if p_amount>v_receivable.outstanding_amount then raise exception 'Payment exceeds outstanding receivable'; end if;

  if p_create_transaction then
    if p_payment_account_id is null then raise exception 'Payment account is required'; end if;
    select * into v_account
      from public.accounts
      where id=p_payment_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Payment account not found'; end if;
    if v_account.currency<>v_receivable.currency then raise exception 'Payment account currency must match receivable currency'; end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,
      note,status,source,cashflow_type
    ) values (
      p_household_id,p_payment_account_id,coalesce(p_paid_at,current_date)::timestamptz + time '12:00',
      abs(p_amount),v_receivable.currency,
      'Rückzahlung: '||v_receivable.debtor||' – '||v_receivable.reason,
      v_receivable.debtor,nullif(trim(p_note),''),'booked','manual','receivable_principal'
    ) returning id into v_transaction_id;
  end if;

  v_remaining := round((v_receivable.outstanding_amount-p_amount)::numeric,2);
  v_status := case
    when v_remaining=0 then 'paid'
    when v_receivable.due_date is not null and v_receivable.due_date<current_date then 'overdue'
    else 'partial'
  end;

  insert into public.receivable_payments(
    receivable_id,household_id,paid_at,amount,currency,outstanding_after,note,
    payment_account_id,transaction_id,source
  ) values (
    v_receivable.id,p_household_id,coalesce(p_paid_at,current_date),p_amount,
    v_receivable.currency,v_remaining,nullif(trim(p_note),''),
    p_payment_account_id,v_transaction_id,
    case when p_create_transaction then 'created_transaction' else 'history_only' end
  ) returning id into v_payment_id;

  update public.receivables
    set outstanding_amount=v_remaining,status=v_status,updated_at=now()
    where id=v_receivable.id;

  return v_payment_id;
end;
$$;

create or replace function public.reverse_receivable_payment_v2(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_payment public.receivable_payments%rowtype;
  v_receivable public.receivables%rowtype;
  v_latest uuid;
  v_restored numeric(18,2);
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_payment
    from public.receivable_payments
    where id=p_payment_id
    for update;

  if not found then raise exception 'Receivable payment not found'; end if;
  if v_payment.reversed_at is not null then raise exception 'Receivable payment is already reversed'; end if;
  if not private.can_write_household(v_payment.household_id) then raise exception 'Not allowed'; end if;
  if not private.has_module_access('receivables') then raise exception 'Receivables module is not enabled'; end if;

  select id into v_latest
    from public.receivable_payments
    where receivable_id=v_payment.receivable_id and reversed_at is null
    order by created_at desc,id desc
    limit 1;

  if v_latest is distinct from v_payment.id then
    raise exception 'Only the latest active receivable payment can be reversed';
  end if;

  select * into v_receivable
    from public.receivables
    where id=v_payment.receivable_id
    for update;

  v_restored := least(v_receivable.original_amount,v_receivable.outstanding_amount+v_payment.amount);
  v_status := case
    when v_receivable.due_date is not null and v_receivable.due_date<current_date then 'overdue'
    when v_restored=v_receivable.original_amount then 'open'
    else 'partial'
  end;

  update public.receivable_payments set reversed_at=now() where id=v_payment.id;
  update public.receivables
    set outstanding_amount=v_restored,status=v_status,updated_at=now()
    where id=v_receivable.id;

  if v_payment.source='created_transaction' and v_payment.transaction_id is not null then
    delete from public.transactions where id=v_payment.transaction_id;
  end if;
end;
$$;

create or replace function public.delete_receivable_v2(
  p_household_id uuid,
  p_receivable_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_receivable public.receivables%rowtype;
  v_active_payments integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.can_write_household(p_household_id) then raise exception 'Not allowed'; end if;
  if not private.has_module_access('receivables') then raise exception 'Receivables module is not enabled'; end if;

  select * into v_receivable
    from public.receivables
    where id=p_receivable_id and household_id=p_household_id
    for update;

  if not found then raise exception 'Receivable not found'; end if;

  select count(*) into v_active_payments
    from public.receivable_payments
    where receivable_id=p_receivable_id and reversed_at is null;

  if v_active_payments>0 then raise exception 'Receivable with payment history cannot be deleted'; end if;

  delete from public.receivables where id=p_receivable_id;
  if v_receivable.source_transaction_id is not null then
    delete from public.transactions where id=v_receivable.source_transaction_id;
  end if;
end;
$$;

-- Remove only the temporary overloads introduced by the V2.4 bootstrap migration.
drop function if exists public.record_receivable_payment(uuid,uuid,date,numeric,text);
drop function if exists public.reverse_receivable_payment(uuid);

-- Direct payment deletion is not part of the public workflow.
drop policy if exists receivable_payments_writer_delete on public.receivable_payments;
revoke delete on public.receivable_payments from authenticated;

-- Lock privileged RPC entry points to authenticated sessions only.
revoke execute on function public.touch_user_presence(text,text,text) from public, anon;
revoke execute on function public.clear_user_presence() from public, anon;
revoke execute on function public.create_receivable_v2(uuid,text,text,numeric,text,date,date,text,uuid,boolean) from public, anon;
revoke execute on function public.record_receivable_payment_v2(uuid,uuid,numeric,date,text,uuid,boolean) from public, anon;
revoke execute on function public.reverse_receivable_payment_v2(uuid) from public, anon;
revoke execute on function public.delete_receivable_v2(uuid,uuid) from public, anon;

grant execute on function public.touch_user_presence(text,text,text) to authenticated;
grant execute on function public.clear_user_presence() to authenticated;
grant execute on function public.create_receivable_v2(uuid,text,text,numeric,text,date,date,text,uuid,boolean) to authenticated;
grant execute on function public.record_receivable_payment_v2(uuid,uuid,numeric,date,text,uuid,boolean) to authenticated;
grant execute on function public.reverse_receivable_payment_v2(uuid) to authenticated;
grant execute on function public.delete_receivable_v2(uuid,uuid) to authenticated;
