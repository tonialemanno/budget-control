-- Finance V2.3 Beta 4.1 – stabilization
-- Bill-payment integrity, import-batch repair, security-invoker hardening and FK indexes.

alter table public.bills
  add column if not exists paid_transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists paid_at date,
  add column if not exists payment_source text;

alter table public.bills
  drop constraint if exists bills_payment_source_check;
alter table public.bills
  add constraint bills_payment_source_check
  check (payment_source is null or payment_source in ('created_transaction','linked_transaction'));

create unique index if not exists bills_paid_transaction_unique
  on public.bills(paid_transaction_id)
  where paid_transaction_id is not null;

create index if not exists bills_paid_transaction_idx on public.bills(paid_transaction_id);

create or replace function private.validate_bill_payment_state()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if new.status = 'paid' then
    if new.paid_transaction_id is null or new.paid_at is null or new.payment_source is null then
      raise exception 'Paid bills require a linked payment transaction';
    end if;

    select * into v_tx
    from public.transactions
    where id = new.paid_transaction_id and household_id = new.household_id;

    if not found then raise exception 'Bill payment transaction does not belong to this household'; end if;
    if v_tx.status <> 'booked' or v_tx.amount >= 0 or v_tx.transfer_group_id is not null or v_tx.cashflow_type <> 'standard' then
      raise exception 'Bill payment must be a booked outgoing standard transaction';
    end if;
    if v_tx.currency <> new.currency or abs(v_tx.amount) <> new.amount then
      raise exception 'Bill payment amount/currency must match the bill';
    end if;
    if new.account_id is distinct from v_tx.account_id then
      new.account_id := v_tx.account_id;
    end if;
  else
    if new.paid_transaction_id is not null or new.paid_at is not null or new.payment_source is not null then
      raise exception 'Only paid bills can keep payment linkage';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_bill_payment_state() from public, authenticated;

drop trigger if exists bills_validate_payment_state on public.bills;
create trigger bills_validate_payment_state
before insert or update of household_id,account_id,amount,currency,status,paid_transaction_id,paid_at,payment_source
on public.bills
for each row execute function private.validate_bill_payment_state();

create or replace function private.protect_paid_bill_transaction()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if not exists (
    select 1 from public.bills b
    where b.paid_transaction_id = old.id and b.status = 'paid'
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Paid bill transactions must be unlinked from the bill first';
  end if;

  if new.household_id is distinct from old.household_id
     or new.account_id is distinct from old.account_id
     or new.occurred_at is distinct from old.occurred_at
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.status is distinct from old.status
     or new.transfer_group_id is distinct from old.transfer_group_id
     or new.cashflow_type is distinct from old.cashflow_type then
    raise exception 'Paid bill transaction financial fields are managed by the bill payment';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_paid_bill_transaction() from public, authenticated;

drop trigger if exists transactions_protect_paid_bill on public.transactions;
create trigger transactions_protect_paid_bill
before update or delete on public.transactions
for each row execute function private.protect_paid_bill_transaction();

create or replace function public.pay_bill_v2(
  p_household_id uuid,
  p_bill_id uuid,
  p_source text,
  p_paid_at date default null,
  p_account_id uuid default null,
  p_transaction_id uuid default null
)
returns public.bills
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_bill public.bills%rowtype;
  v_account public.accounts%rowtype;
  v_tx public.transactions%rowtype;
  v_tx_id uuid;
  v_paid_at date;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and household_id = p_household_id
  for update;

  if not found then raise exception 'Rechnung nicht gefunden.'; end if;
  if v_bill.status = 'paid' then raise exception 'Rechnung ist bereits bezahlt.'; end if;
  if v_bill.amount <= 0 then raise exception 'Eine Rechnung mit Betrag 0 kann nicht als Zahlung verbucht werden.'; end if;

  if p_source = 'created_transaction' then
    select * into v_account
    from public.accounts
    where id = coalesce(p_account_id, v_bill.account_id)
      and household_id = p_household_id
      and is_archived = false;

    if not found then raise exception 'Bitte ein gültiges Zahlungskonto auswählen.'; end if;
    if v_account.currency <> v_bill.currency then raise exception 'Rechnung und Zahlungskonto müssen dieselbe Währung haben.'; end if;

    v_paid_at := coalesce(p_paid_at, current_date);
    insert into public.transactions(
      household_id, account_id, category_id, occurred_at, amount, currency,
      description, counterparty, note, status, source, cashflow_type
    ) values (
      p_household_id, v_account.id, v_bill.category_id, v_paid_at::timestamptz,
      -v_bill.amount, v_bill.currency, 'Rechnung: ' || v_bill.name,
      v_bill.provider, v_bill.reference, 'booked', 'manual', 'standard'
    ) returning id into v_tx_id;

  elsif p_source = 'linked_transaction' then
    if p_transaction_id is null then raise exception 'Bitte eine bestehende Buchung auswählen.'; end if;

    select * into v_tx
    from public.transactions
    where id = p_transaction_id and household_id = p_household_id
    for update;

    if not found then raise exception 'Buchung nicht gefunden.'; end if;
    if v_tx.status <> 'booked' or v_tx.amount >= 0 or v_tx.transfer_group_id is not null or v_tx.cashflow_type <> 'standard' then
      raise exception 'Nur eine gebuchte Ausgangsbuchung kann als Rechnungszahlung verknüpft werden.';
    end if;
    if v_tx.currency <> v_bill.currency or abs(v_tx.amount) <> v_bill.amount then
      raise exception 'Betrag und Währung der Buchung müssen zur Rechnung passen.';
    end if;
    if exists (select 1 from public.bills b where b.paid_transaction_id = v_tx.id and b.id <> v_bill.id) then
      raise exception 'Diese Buchung ist bereits mit einer anderen Rechnung verknüpft.';
    end if;
    if exists (select 1 from public.debt_payments p where p.transaction_id = v_tx.id and p.reversed_at is null) then
      raise exception 'Diese Buchung gehört bereits zu einer Schuldzahlung.';
    end if;

    if v_bill.category_id is not null and v_tx.category_id is null then
      update public.transactions set category_id = v_bill.category_id, updated_at = now() where id = v_tx.id;
    end if;
    v_tx_id := v_tx.id;
    v_paid_at := (v_tx.occurred_at at time zone current_setting('TimeZone'))::date;
  else
    raise exception 'Unbekannte Zahlungsart.';
  end if;

  update public.bills
  set status = 'paid', paid_transaction_id = v_tx_id, paid_at = v_paid_at,
      payment_source = p_source, updated_at = now()
  where id = v_bill.id
  returning * into v_bill;

  return v_bill;
end;
$$;

grant execute on function public.pay_bill_v2(uuid,uuid,text,date,uuid,uuid) to authenticated;

create or replace function public.unpay_bill_v2(p_household_id uuid, p_bill_id uuid)
returns public.bills
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_bill public.bills%rowtype;
  v_tx_id uuid;
  v_source text;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  select * into v_bill
  from public.bills
  where id = p_bill_id and household_id = p_household_id
  for update;

  if not found then raise exception 'Rechnung nicht gefunden.'; end if;
  if v_bill.status <> 'paid' or v_bill.paid_transaction_id is null then
    raise exception 'Rechnung hat keine aktive Zahlung.';
  end if;

  v_tx_id := v_bill.paid_transaction_id;
  v_source := v_bill.payment_source;

  update public.bills
  set status = 'open', paid_transaction_id = null, paid_at = null,
      payment_source = null, updated_at = now()
  where id = v_bill.id
  returning * into v_bill;

  if v_source = 'created_transaction' then
    delete from public.transactions where id = v_tx_id and household_id = p_household_id;
  end if;

  return v_bill;
end;
$$;

grant execute on function public.unpay_bill_v2(uuid,uuid) to authenticated;

-- Repair the two historical beta imports: imported rows were written in the same second
-- as their batch but lost import_batch_id in the old client flow.
update public.transactions t
set import_batch_id = b.id,
    updated_at = now()
from public.import_batches b
where t.import_batch_id is null
  and t.source = 'import'
  and t.household_id = b.household_id
  and t.account_id = b.account_id
  and date_trunc('second', t.created_at) = date_trunc('second', b.created_at);

-- The exposed RPCs already perform explicit permission checks; run them with caller rights
-- so RLS remains an additional enforcement layer.
alter function public.convert_transaction_to_transfer(uuid,uuid,uuid,numeric,text) security invoker;
alter function public.record_investment_trade(uuid,uuid,date,text,numeric,numeric,numeric,text) security invoker;

-- Cover foreign-key lookup paths reported by the database advisor.
create index if not exists contracts_account_idx on public.contracts(account_id);
create index if not exists debt_payments_created_by_idx on public.debt_payments(created_by);
create index if not exists debt_payments_debt_idx on public.debt_payments(debt_id);
create index if not exists debt_payments_payment_account_idx on public.debt_payments(payment_account_id);
create index if not exists debt_payments_reversed_by_idx on public.debt_payments(reversed_by);
create index if not exists debts_payment_account_idx on public.debts(payment_account_id);
create index if not exists insurance_policies_account_idx on public.insurance_policies(account_id);
create index if not exists insurance_policies_category_idx on public.insurance_policies(category_id);
create index if not exists investment_transactions_created_by_idx on public.investment_transactions(created_by);
create index if not exists merchants_default_category_idx on public.merchants(default_category_id);
create index if not exists savings_goal_sources_recurring_rule_idx on public.savings_goal_sources(recurring_rule_id);
