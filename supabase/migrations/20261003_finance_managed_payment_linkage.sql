-- Complete atomic linkage for receivable repayments and reversible tax payments.

create or replace function public.record_receivable_payment_v3(
  p_household_id uuid,
  p_receivable_id uuid,
  p_amount numeric,
  p_paid_at date default current_date,
  p_note text default null,
  p_source text default 'created_transaction',
  p_payment_account_id uuid default null,
  p_transaction_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_r public.receivables%rowtype;
  v_account public.accounts%rowtype;
  v_existing_tx public.transactions%rowtype;
  v_remaining numeric(18,2);
  v_pid uuid;
  v_tx uuid;
  v_status text;
begin
  if not private.has_module_access('debts') or not private.can_write_household(p_household_id) then
    raise exception 'Not allowed';
  end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_source not in ('created_transaction','linked_transaction','history_only') then raise exception 'Unknown payment source'; end if;

  select * into v_r
  from public.receivables
  where id=p_receivable_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Receivable not found'; end if;
  if v_r.status in ('paid','written_off') then raise exception 'Receivable is already closed'; end if;
  if p_amount>v_r.outstanding_amount then raise exception 'Payment exceeds outstanding receivable'; end if;

  if p_source='created_transaction' then
    if p_payment_account_id is null then raise exception 'Payment account is required'; end if;
    select * into v_account
    from public.accounts
    where id=p_payment_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Payment account not found'; end if;
    if v_account.currency<>v_r.currency then raise exception 'Payment account currency must match receivable currency'; end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,note,status,source,cashflow_type
    ) values (
      p_household_id,p_payment_account_id,
      case when coalesce(p_paid_at,current_date)=current_date then now()
           else coalesce(p_paid_at,current_date)::timestamptz + time '12:00' end,
      abs(p_amount),v_r.currency,
      'Rückzahlung: '||v_r.debtor||' – '||v_r.reason,
      v_r.debtor,nullif(trim(p_note),''),'booked','manual','receivable_principal'
    ) returning id into v_tx;

  elsif p_source='linked_transaction' then
    if p_transaction_id is null then raise exception 'Transaction is required'; end if;
    select * into v_existing_tx
    from public.transactions
    where id=p_transaction_id and household_id=p_household_id
    for update;
    if not found then raise exception 'Transaction not found'; end if;
    if v_existing_tx.status<>'booked' or v_existing_tx.transfer_group_id is not null or v_existing_tx.cashflow_type<>'standard' then
      raise exception 'Only a standard booked transaction can be linked';
    end if;
    if v_existing_tx.amount<=0 or v_existing_tx.currency<>v_r.currency or abs(v_existing_tx.amount)<>p_amount then
      raise exception 'Transaction amount or currency does not match receivable payment';
    end if;
    if exists(select 1 from public.receivable_payments p where p.transaction_id=v_existing_tx.id and p.reversed_at is null)
       or exists(select 1 from public.debt_payments p where p.transaction_id=v_existing_tx.id and p.reversed_at is null)
       or exists(select 1 from public.bills b where b.paid_transaction_id=v_existing_tx.id and b.status='paid')
       or exists(select 1 from public.tax_payments p where p.transaction_id=v_existing_tx.id) then
      raise exception 'Transaction is already linked to another managed movement';
    end if;

    update public.transactions set cashflow_type='receivable_principal',updated_at=now() where id=v_existing_tx.id;
    v_tx:=v_existing_tx.id;
    p_payment_account_id:=v_existing_tx.account_id;
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
    nullif(trim(p_note),''),case when p_source='history_only' then null else p_payment_account_id end,
    v_tx,p_source
  ) returning id into v_pid;

  update public.receivables set outstanding_amount=v_remaining,status=v_status where id=v_r.id;
  return v_pid;
end;
$function$;

create or replace function public.reverse_receivable_payment_v2(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
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
  if not private.has_module_access('debts') or not private.can_write_household(v_p.household_id) then raise exception 'Not allowed'; end if;

  select id into v_latest from public.receivable_payments
  where receivable_id=v_p.receivable_id and reversed_at is null
  order by created_at desc,id desc limit 1;
  if v_latest is distinct from v_p.id then raise exception 'Only the latest active receivable payment can be reversed'; end if;

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
  elsif v_p.source='linked_transaction' and v_p.transaction_id is not null then
    update public.transactions
    set cashflow_type='standard',updated_at=now()
    where id=v_p.transaction_id and cashflow_type='receivable_principal';
  end if;
end;
$function$;

revoke all on function public.record_receivable_payment_v3(uuid,uuid,numeric,date,text,text,uuid,uuid) from public;
grant execute on function public.record_receivable_payment_v3(uuid,uuid,numeric,date,text,text,uuid,uuid) to authenticated;

alter table public.tax_payments add column if not exists payment_source text;
update public.tax_payments
set payment_source=case when transaction_id is null then 'history_only' else 'linked_transaction' end
where payment_source is null;
alter table public.tax_payments alter column payment_source set default 'history_only';
alter table public.tax_payments alter column payment_source set not null;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='tax_payments_payment_source_check') then
    alter table public.tax_payments add constraint tax_payments_payment_source_check
      check (payment_source in ('created_transaction','linked_transaction','history_only'));
  end if;
end $$;

create or replace function public.record_tax_payment_v2(
  p_household_id uuid,
  p_tax_case_id uuid,
  p_obligation_id uuid default null,
  p_payment_type text default 'payment',
  p_amount numeric default null,
  p_paid_at date default current_date,
  p_reference text default null,
  p_notes text default null,
  p_source text default 'created_transaction',
  p_account_id uuid default null,
  p_transaction_id uuid default null
)
returns public.tax_payments
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_case public.tax_cases%rowtype;
  v_account public.accounts%rowtype;
  v_tx public.transactions%rowtype;
  v_payment public.tax_payments%rowtype;
  v_tx_id uuid;
  v_refund boolean;
  v_treatment text;
  v_category text;
begin
  if not private.can_write_household(p_household_id) or not private.has_module_access('tax') then raise exception 'Not allowed'; end if;
  if p_payment_type not in ('payment','refund','interest_payment','interest_credit') then raise exception 'Unknown tax payment type'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Tax payment amount must be greater than zero'; end if;
  if p_source not in ('created_transaction','linked_transaction','history_only') then raise exception 'Unknown payment source'; end if;

  select * into v_case from public.tax_cases where id=p_tax_case_id and household_id=p_household_id for update;
  if not found then raise exception 'Tax case not found'; end if;
  if p_obligation_id is not null and not exists(
    select 1 from public.tax_obligations where id=p_obligation_id and household_id=p_household_id and tax_case_id=p_tax_case_id
  ) then raise exception 'Tax obligation does not belong to case'; end if;

  v_refund:=p_payment_type in ('refund','interest_credit');
  v_treatment:=case when v_refund then 'tax_refund' else 'tax_payment' end;
  v_category:=case when v_refund then 'Steuerrückerstattung' else 'Steuerzahlung' end;

  if p_source='created_transaction' then
    if p_account_id is null then raise exception 'Payment account is required'; end if;
    select * into v_account from public.accounts where id=p_account_id and household_id=p_household_id and is_archived=false;
    if not found then raise exception 'Payment account not found'; end if;
    if v_account.currency<>v_case.currency then raise exception 'Account currency must match tax case'; end if;
    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,note,status,source,cashflow_type,
      tax_relevant,tax_category,tax_year,tax_section_key,tax_treatment
    ) values (
      p_household_id,v_account.id,
      case when coalesce(p_paid_at,current_date)=current_date then now() else coalesce(p_paid_at,current_date)::timestamptz + time '12:00' end,
      case when v_refund then abs(p_amount) else -abs(p_amount) end,v_case.currency,
      case when v_refund then 'Steuerrückerstattung '||v_case.tax_year else 'Steuerzahlung '||v_case.tax_year end,
      'Steuerverwaltung',coalesce(nullif(trim(p_reference),''),nullif(trim(p_notes),'')),
      'booked','manual','standard',true,v_category,v_case.tax_year,'tax_account',v_treatment
    ) returning id into v_tx_id;
  elsif p_source='linked_transaction' then
    if p_transaction_id is null then raise exception 'Transaction is required'; end if;
    select * into v_tx from public.transactions where id=p_transaction_id and household_id=p_household_id for update;
    if not found then raise exception 'Transaction not found'; end if;
    if v_tx.status<>'booked' or v_tx.transfer_group_id is not null or v_tx.cashflow_type<>'standard' then raise exception 'Only a standard booked transaction can be linked'; end if;
    if v_tx.tax_relevant then raise exception 'Transaction is already tax-relevant; unlink or use another transaction'; end if;
    if v_tx.currency<>v_case.currency or abs(v_tx.amount)<>p_amount then raise exception 'Transaction amount or currency does not match tax payment'; end if;
    if (v_refund and v_tx.amount<=0) or (not v_refund and v_tx.amount>=0) then raise exception 'Transaction direction does not match tax payment'; end if;
    if exists(select 1 from public.tax_payments p where p.transaction_id=v_tx.id)
       or exists(select 1 from public.debt_payments p where p.transaction_id=v_tx.id and p.reversed_at is null)
       or exists(select 1 from public.receivable_payments p where p.transaction_id=v_tx.id and p.reversed_at is null)
       or exists(select 1 from public.bills b where b.paid_transaction_id=v_tx.id and b.status='paid') then
      raise exception 'Transaction is already linked to another managed movement';
    end if;
    update public.transactions set tax_relevant=true,tax_category=v_category,tax_year=v_case.tax_year,
      tax_section_key='tax_account',tax_treatment=v_treatment,updated_at=now() where id=v_tx.id;
    v_tx_id:=v_tx.id;
  end if;

  insert into public.tax_payments(
    household_id,tax_case_id,obligation_id,payment_type,amount,currency,paid_at,transaction_id,reference,notes,payment_source
  ) values (
    p_household_id,p_tax_case_id,p_obligation_id,p_payment_type,p_amount,v_case.currency,coalesce(p_paid_at,current_date),
    v_tx_id,nullif(trim(p_reference),''),nullif(trim(p_notes),''),p_source
  ) returning * into v_payment;
  return v_payment;
end;
$function$;

create or replace function public.reverse_tax_payment_v2(p_household_id uuid,p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $function$
declare
  v_payment public.tax_payments%rowtype;
begin
  select * into v_payment from public.tax_payments
  where id=p_payment_id and household_id=p_household_id
  for update;
  if not found then raise exception 'Tax payment not found'; end if;
  if not private.can_write_household(p_household_id) or not private.has_module_access('tax') then raise exception 'Not allowed'; end if;

  delete from public.tax_payments where id=v_payment.id;

  if v_payment.payment_source='created_transaction' and v_payment.transaction_id is not null then
    delete from public.transactions where id=v_payment.transaction_id;
  elsif v_payment.payment_source='linked_transaction' and v_payment.transaction_id is not null then
    update public.transactions
    set tax_relevant=false,tax_category=null,tax_year=null,tax_section_key=null,tax_treatment=null,updated_at=now()
    where id=v_payment.transaction_id
      and tax_section_key='tax_account'
      and tax_treatment in ('tax_payment','tax_refund');
  end if;
end;
$function$;

revoke all on function public.reverse_tax_payment_v2(uuid,uuid) from public;
grant execute on function public.reverse_tax_payment_v2(uuid,uuid) to authenticated;
