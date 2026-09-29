-- Finance V2.3 Beta 4 — Debt ledger and payment integrity
-- Adds editable debt scheduling, payment history, transaction linking and recurring-rule linkage.

alter table public.transactions
  add column if not exists cashflow_type text not null default 'standard';

alter table public.transactions
  drop constraint if exists transactions_cashflow_type_check;

alter table public.transactions
  add constraint transactions_cashflow_type_check
  check (cashflow_type in ('standard', 'debt_payment'));

comment on column public.transactions.cashflow_type is
  'Financial meaning of the cash movement. debt_payment is split into principal vs interest/fees by debt_payments.';

alter table public.debts
  add column if not exists payment_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

create unique index if not exists debts_recurring_rule_unique
  on public.debts(recurring_rule_id)
  where recurring_rule_id is not null;

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  payment_account_id uuid references public.accounts(id) on delete set null,
  paid_at date not null,
  amount numeric not null check (amount > 0),
  principal_amount numeric not null check (principal_amount >= 0),
  interest_amount numeric not null default 0 check (interest_amount >= 0),
  fee_amount numeric not null default 0 check (fee_amount >= 0),
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  source text not null check (source in ('created_transaction','linked_transaction','history_only')),
  note text,
  outstanding_before numeric not null check (outstanding_before >= 0),
  outstanding_after numeric not null check (outstanding_after >= 0),
  debt_status_before text not null check (debt_status_before in ('active','paid','paused','defaulted')),
  next_payment_date_before date,
  next_payment_date_after date,
  advance_next_date boolean not null default true,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint debt_payments_parts_match check (amount = principal_amount + interest_amount + fee_amount),
  constraint debt_payments_transaction_shape check (
    reversed_at is not null
    or (source = 'history_only' and transaction_id is null)
    or (source in ('created_transaction','linked_transaction') and transaction_id is not null)
  )
);

create index if not exists debt_payments_household_debt_idx
  on public.debt_payments(household_id, debt_id, paid_at desc, created_at desc);
create unique index if not exists debt_payments_active_transaction_unique
  on public.debt_payments(transaction_id)
  where transaction_id is not null and reversed_at is null;

alter table public.debt_payments enable row level security;

drop policy if exists debt_payments_member_read on public.debt_payments;
create policy debt_payments_member_read
  on public.debt_payments for select to authenticated
  using (private.is_household_member(household_id));

drop policy if exists debt_payments_writer_insert on public.debt_payments;
create policy debt_payments_writer_insert
  on public.debt_payments for insert to authenticated
  with check (private.can_write_household(household_id));

drop policy if exists debt_payments_writer_update on public.debt_payments;
create policy debt_payments_writer_update
  on public.debt_payments for update to authenticated
  using (private.can_write_household(household_id))
  with check (private.can_write_household(household_id));

drop policy if exists debt_payments_module_access_gate on public.debt_payments;
create policy debt_payments_module_access_gate
  on public.debt_payments as restrictive for all to authenticated
  using ((select private.has_module_access('debts')))
  with check ((select private.has_module_access('debts')));

grant select, insert, update on public.debt_payments to authenticated;
revoke delete on public.debt_payments from authenticated;

create or replace function private.validate_debt_links()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if new.payment_account_id is not null and not exists (
    select 1 from public.accounts a
    where a.id = new.payment_account_id and a.household_id = new.household_id
  ) then
    raise exception 'Payment account does not belong to this household';
  end if;

  if new.recurring_rule_id is not null and not exists (
    select 1 from public.recurring_rules r
    where r.id = new.recurring_rule_id and r.household_id = new.household_id
  ) then
    raise exception 'Recurring rule does not belong to this household';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_debt_links() from public, authenticated;

drop trigger if exists debts_validate_links on public.debts;
create trigger debts_validate_links
before insert or update of household_id, payment_account_id, recurring_rule_id
on public.debts
for each row execute function private.validate_debt_links();

create or replace function private.prepare_debt_payment()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_debt public.debts%rowtype;
  v_account public.accounts%rowtype;
  v_tx public.transactions%rowtype;
  v_tx_id uuid;
  v_after numeric;
  v_next date;
begin
  if new.reversed_at is not null or new.reversed_by is not null then
    raise exception 'A new payment cannot be created as reversed';
  end if;

  select * into v_debt
  from public.debts
  where id = new.debt_id and household_id = new.household_id
  for update;

  if not found then
    raise exception 'Debt does not belong to this household';
  end if;

  if new.amount <= 0 or new.principal_amount < 0 or new.interest_amount < 0 or new.fee_amount < 0 then
    raise exception 'Payment amounts must be positive';
  end if;

  if new.amount <> new.principal_amount + new.interest_amount + new.fee_amount then
    raise exception 'Payment total must equal principal plus interest plus fees';
  end if;

  if new.principal_amount > v_debt.outstanding_amount then
    raise exception 'Principal payment exceeds outstanding debt';
  end if;

  new.currency := v_debt.currency;
  new.outstanding_before := v_debt.outstanding_amount;
  new.debt_status_before := v_debt.status;
  new.next_payment_date_before := v_debt.next_payment_date;
  new.created_by := auth.uid();

  if new.source = 'created_transaction' then
    if new.payment_account_id is null then
      raise exception 'A payment account is required';
    end if;

    select * into v_account
    from public.accounts
    where id = new.payment_account_id and household_id = new.household_id and is_archived = false;

    if not found then
      raise exception 'Payment account does not belong to this household';
    end if;

    if v_account.currency <> v_debt.currency then
      raise exception 'Debt payment and account must use the same currency';
    end if;

    insert into public.transactions (
      household_id, account_id, occurred_at, amount, currency, description, counterparty,
      note, status, source, cashflow_type
    ) values (
      new.household_id,
      v_account.id,
      new.paid_at::timestamptz,
      -new.amount,
      v_debt.currency,
      'Schuldenzahlung: ' || v_debt.name,
      v_debt.creditor,
      new.note,
      'booked',
      'manual',
      'debt_payment'
    ) returning id into v_tx_id;

    new.transaction_id := v_tx_id;
  elsif new.source = 'linked_transaction' then
    if new.transaction_id is null then
      raise exception 'A transaction is required';
    end if;

    select * into v_tx
    from public.transactions
    where id = new.transaction_id and household_id = new.household_id
    for update;

    if not found then
      raise exception 'Transaction does not belong to this household';
    end if;
    if v_tx.status <> 'booked' or v_tx.amount >= 0 or v_tx.transfer_group_id is not null then
      raise exception 'Only a booked outgoing transaction can be linked';
    end if;
    if v_tx.currency <> v_debt.currency or abs(v_tx.amount) <> new.amount then
      raise exception 'Linked transaction amount/currency must match the debt payment';
    end if;
    if exists (
      select 1 from public.debt_payments p
      where p.transaction_id = v_tx.id and p.reversed_at is null
    ) then
      raise exception 'Transaction is already linked to a debt payment';
    end if;

    new.payment_account_id := v_tx.account_id;
    update public.transactions
      set cashflow_type = 'debt_payment', updated_at = now()
      where id = v_tx.id;
  elsif new.source = 'history_only' then
    new.transaction_id := null;
    new.payment_account_id := null;
  else
    raise exception 'Unknown debt payment source';
  end if;

  v_after := v_debt.outstanding_amount - new.principal_amount;
  new.outstanding_after := v_after;

  v_next := v_debt.next_payment_date;
  if v_after = 0 then
    v_next := null;
  elsif new.advance_next_date and v_debt.next_payment_date is not null then
    if v_debt.payment_cadence = 'weekly' then
      v_next := v_debt.next_payment_date + 7;
    elsif v_debt.payment_cadence = 'monthly' then
      v_next := (v_debt.next_payment_date + interval '1 month')::date;
    elsif v_debt.payment_cadence = 'quarterly' then
      v_next := (v_debt.next_payment_date + interval '3 months')::date;
    elsif v_debt.payment_cadence = 'annual' then
      v_next := (v_debt.next_payment_date + interval '1 year')::date;
    end if;
  end if;
  new.next_payment_date_after := v_next;

  update public.debts
    set outstanding_amount = v_after,
        status = case when v_after = 0 then 'paid' else status end,
        next_payment_date = v_next,
        updated_at = now()
    where id = v_debt.id;

  if v_debt.recurring_rule_id is not null then
    update public.recurring_rules
      set next_date = coalesce(v_next, next_date),
          active = (v_after > 0),
          updated_at = now()
      where id = v_debt.recurring_rule_id;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_debt_payment() from public, authenticated;

drop trigger if exists debt_payments_prepare on public.debt_payments;
create trigger debt_payments_prepare
before insert on public.debt_payments
for each row execute function private.prepare_debt_payment();

create or replace function private.guard_debt_payment_update()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_has_later boolean;
begin
  if old.reversed_at is null and new.reversed_at is not null then
    select exists (
      select 1 from public.debt_payments p
      where p.debt_id = old.debt_id
        and p.reversed_at is null
        and p.id <> old.id
        and (p.created_at, p.id) > (old.created_at, old.id)
    ) into v_has_later;

    if v_has_later then
      raise exception 'Only the latest active debt payment can be reversed';
    end if;

    new.household_id := old.household_id;
    new.debt_id := old.debt_id;
    new.transaction_id := old.transaction_id;
    new.payment_account_id := old.payment_account_id;
    new.paid_at := old.paid_at;
    new.amount := old.amount;
    new.principal_amount := old.principal_amount;
    new.interest_amount := old.interest_amount;
    new.fee_amount := old.fee_amount;
    new.currency := old.currency;
    new.source := old.source;
    new.note := old.note;
    new.outstanding_before := old.outstanding_before;
    new.outstanding_after := old.outstanding_after;
    new.debt_status_before := old.debt_status_before;
    new.next_payment_date_before := old.next_payment_date_before;
    new.next_payment_date_after := old.next_payment_date_after;
    new.advance_next_date := old.advance_next_date;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.reversed_at := now();
    new.reversed_by := auth.uid();

    update public.debts
      set outstanding_amount = old.outstanding_before,
          status = old.debt_status_before,
          next_payment_date = old.next_payment_date_before,
          updated_at = now()
      where id = old.debt_id and household_id = old.household_id;

    update public.recurring_rules r
      set next_date = coalesce(old.next_payment_date_before, r.next_date),
          active = (old.debt_status_before = 'active' and old.outstanding_before > 0),
          updated_at = now()
      from public.debts d
      where d.id = old.debt_id and d.recurring_rule_id = r.id;

    return new;
  end if;

  if old.reversed_at is not null and new.reversed_at is not null
     and old.transaction_id is distinct from new.transaction_id
     and new.transaction_id is null then
    return new;
  end if;

  raise exception 'Debt payments are immutable; reverse the latest payment instead';
end;
$$;

revoke all on function private.guard_debt_payment_update() from public, authenticated;

drop trigger if exists debt_payments_guard_update on public.debt_payments;
create trigger debt_payments_guard_update
before update on public.debt_payments
for each row execute function private.guard_debt_payment_update();

create or replace function private.after_debt_payment_reversal()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if old.reversed_at is null and new.reversed_at is not null and old.transaction_id is not null then
    if old.source = 'created_transaction' then
      delete from public.transactions where id = old.transaction_id;
    elsif old.source = 'linked_transaction' then
      update public.transactions
        set cashflow_type = 'standard', updated_at = now()
        where id = old.transaction_id;
    end if;
  end if;
  return null;
end;
$$;

revoke all on function private.after_debt_payment_reversal() from public, authenticated;

drop trigger if exists debt_payments_after_reversal on public.debt_payments;
create trigger debt_payments_after_reversal
after update on public.debt_payments
for each row execute function private.after_debt_payment_reversal();
