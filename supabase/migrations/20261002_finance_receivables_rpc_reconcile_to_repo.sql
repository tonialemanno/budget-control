-- Finance V2.3 Beta 5.4 – RPCs für Forderungen.
-- Transaktionen für verliehenes Geld sind Vermögensverschiebungen, keine Ausgaben/Einnahmen.

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
) returns uuid
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_id uuid;
  v_tx uuid;
  v_account public.accounts%rowtype;
begin
  if not private.has_module_access('debts') or not private.can_write_household(p_household_id) then
    raise exception 'Not allowed';
  end if;
  if nullif(trim(p_debtor),'') is null or nullif(trim(p_reason),'') is null then
    raise exception 'Person and reason are required';
  end if;
  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_currency not in ('CHF','EUR','USD','GBP') then
    raise exception 'Unsupported currency';
  end if;

  if p_create_transaction then
    if p_source_account_id is null then raise exception 'Source account is required'; end if;
    select * into v_account
    from public.accounts
    where id=p_source_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Source account not found'; end if;
    if v_account.currency<>p_currency then raise exception 'Source account currency must match receivable currency'; end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,note,status,source,cashflow_type
    ) values (
      p_household_id,p_source_account_id,coalesce(p_lent_at,current_date)::timestamptz + time '12:00',
      -abs(p_original_amount),p_currency,
      'Geld verliehen: '||trim(p_debtor)||' – '||trim(p_reason),
      trim(p_debtor),nullif(trim(p_notes),''),'booked','manual','receivable_principal'
    ) returning id into v_tx;
  end if;

  insert into public.receivables(
    household_id,debtor,reason,original_amount,outstanding_amount,currency,lent_at,due_date,status,notes,
    source_account_id,source_transaction_id
  ) values (
    p_household_id,trim(p_debtor),trim(p_reason),p_original_amount,p_original_amount,p_currency,
    coalesce(p_lent_at,current_date),p_due_date,
    case when p_due_date is not null and p_due_date<current_date then 'overdue' else 'open' end,
    nullif(trim(p_notes),''),p_source_account_id,v_tx
  ) returning id into v_id;

  return v_id;
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
) returns uuid
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_r public.receivables%rowtype;
  v_account public.accounts%rowtype;
  v_remaining numeric(18,2);
  v_pid uuid;
  v_tx uuid;
  v_status text;
begin
  if not private.has_module_access('debts') or not private.can_write_household(p_household_id) then
    raise exception 'Not allowed';
  end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

  select * into v_r
  from public.receivables
  where id=p_receivable_id and household_id=p_household_id
  for update;

  if not found then raise exception 'Receivable not found'; end if;
  if v_r.status in ('paid','written_off') then raise exception 'Receivable is already closed'; end if;
  if p_amount>v_r.outstanding_amount then raise exception 'Payment exceeds outstanding receivable'; end if;

  if p_create_transaction then
    if p_payment_account_id is null then raise exception 'Payment account is required'; end if;
    select * into v_account
    from public.accounts
    where id=p_payment_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Payment account not found'; end if;
    if v_account.currency<>v_r.currency then raise exception 'Payment account currency must match receivable currency'; end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,note,status,source,cashflow_type
    ) values (
      p_household_id,p_payment_account_id,coalesce(p_paid_at,current_date)::timestamptz + time '12:00',
      abs(p_amount),v_r.currency,
      'Rückzahlung: '||v_r.debtor||' – '||v_r.reason,
      v_r.debtor,nullif(trim(p_note),''),'booked','manual','receivable_principal'
    ) returning id into v_tx;
  end if;

  v_remaining:=round((v_r.outstanding_amount-p_amount)::numeric,2);
  v_status:=case
    when v_remaining=0 then 'paid'
    when v_r.due_date is not null and v_r.due_date<current_date then 'overdue'
    else 'partial'
  end;

  insert into public.receivable_payments(
    receivable_id,household_id,paid_at,amount,currency,outstanding_after,note,payment_account_id,transaction_id,source
  ) values (
    v_r.id,p_household_id,coalesce(p_paid_at,current_date),p_amount,v_r.currency,v_remaining,
    nullif(trim(p_note),''),p_payment_account_id,v_tx,
    case when p_create_transaction then 'created_transaction' else 'history_only' end
  ) returning id into v_pid;

  update public.receivables
  set outstanding_amount=v_remaining,status=v_status
  where id=v_r.id;

  return v_pid;
end;
$$;

create or replace function public.reverse_receivable_payment_v2(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_p public.receivable_payments%rowtype;
  v_r public.receivables%rowtype;
  v_latest uuid;
  v_restored numeric(18,2);
  v_status text;
begin
  select * into v_p from public.receivable_payments where id=p_payment_id for update;
  if not found then raise exception 'Receivable payment not found'; end if;
  if v_p.reversed_at is not null then raise exception 'Receivable payment is already reversed'; end if;
  if not private.has_module_access('debts') or not private.can_write_household(v_p.household_id) then
    raise exception 'Not allowed';
  end if;

  select id into v_latest
  from public.receivable_payments
  where receivable_id=v_p.receivable_id and reversed_at is null
  order by created_at desc,id desc
  limit 1;

  if v_latest is distinct from v_p.id then
    raise exception 'Only the latest active receivable payment can be reversed';
  end if;

  select * into v_r from public.receivables where id=v_p.receivable_id for update;
  v_restored:=least(v_r.original_amount,v_r.outstanding_amount+v_p.amount);
  v_status:=case
    when v_r.due_date is not null and v_r.due_date<current_date then 'overdue'
    when v_restored=v_r.original_amount then 'open'
    else 'partial'
  end;

  update public.receivable_payments set reversed_at=now() where id=v_p.id;
  update public.receivables set outstanding_amount=v_restored,status=v_status where id=v_r.id;

  if v_p.source='created_transaction' and v_p.transaction_id is not null then
    delete from public.transactions where id=v_p.transaction_id;
  end if;
end;
$$;

create or replace function public.delete_receivable_v2(
  p_household_id uuid,
  p_receivable_id uuid
) returns void
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_r public.receivables%rowtype;
  v_count integer;
begin
  if not private.has_module_access('debts') or not private.can_write_household(p_household_id) then
    raise exception 'Not allowed';
  end if;

  select * into v_r
  from public.receivables
  where id=p_receivable_id and household_id=p_household_id
  for update;

  if not found then raise exception 'Receivable not found'; end if;

  select count(*) into v_count
  from public.receivable_payments
  where receivable_id=p_receivable_id and reversed_at is null;

  if v_count>0 then raise exception 'Receivable with payment history cannot be deleted'; end if;

  delete from public.receivables where id=p_receivable_id;
  if v_r.source_transaction_id is not null then
    delete from public.transactions where id=v_r.source_transaction_id;
  end if;
end;
$$;

revoke all on function public.create_receivable_v2(uuid,text,text,numeric,text,date,date,text,uuid,boolean) from public;
grant execute on function public.create_receivable_v2(uuid,text,text,numeric,text,date,date,text,uuid,boolean) to authenticated;
revoke all on function public.record_receivable_payment_v2(uuid,uuid,numeric,date,text,uuid,boolean) from public;
grant execute on function public.record_receivable_payment_v2(uuid,uuid,numeric,date,text,uuid,boolean) to authenticated;
revoke all on function public.reverse_receivable_payment_v2(uuid) from public;
grant execute on function public.reverse_receivable_payment_v2(uuid) to authenticated;
revoke all on function public.delete_receivable_v2(uuid,uuid) from public;
grant execute on function public.delete_receivable_v2(uuid,uuid) to authenticated;
