
create or replace function private.protect_receivable_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_linked boolean;
begin
  select (
    exists (
      select 1
      from public.receivables r
      where r.source_transaction_id = old.id
    )
    or exists (
      select 1
      from public.receivable_payments p
      where p.transaction_id = old.id
        and p.reversed_at is null
    )
  ) into v_linked;

  if not v_linked then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Forderungsbuchungen werden über Forderungen verwaltet und können hier nicht gelöscht werden.';
  end if;

  if new.household_id is distinct from old.household_id
     or new.account_id is distinct from old.account_id
     or new.occurred_at is distinct from old.occurred_at
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.status is distinct from old.status
     or new.transfer_group_id is distinct from old.transfer_group_id
     or new.cashflow_type is distinct from old.cashflow_type then
    raise exception 'Finanzielle Felder einer Forderungsbuchung werden über Forderungen verwaltet.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_receivable_transaction() from public, anon, authenticated;

drop trigger if exists transactions_protect_receivable on public.transactions;
create trigger transactions_protect_receivable
before update or delete on public.transactions
for each row execute function private.protect_receivable_transaction();


create or replace function private.validate_debt_payment_link_target()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if new.source <> 'linked_transaction' then
    return new;
  end if;

  if new.transaction_id is null then
    raise exception 'Für eine verknüpfte Schuldzahlung ist eine Buchung erforderlich.';
  end if;

  select * into v_tx
  from public.transactions
  where id = new.transaction_id
    and household_id = new.household_id;

  if not found then
    raise exception 'Buchung wurde nicht gefunden.';
  end if;

  if coalesce(v_tx.cashflow_type,'standard') <> 'standard' then
    raise exception 'Nur eine normale Bankbuchung kann mit einer Schuldzahlung verknüpft werden.';
  end if;

  if exists (
    select 1 from public.bills b
    where b.paid_transaction_id = v_tx.id
      and b.status = 'paid'
  ) then
    raise exception 'Diese Buchung ist bereits mit einer bezahlten Rechnung verknüpft.';
  end if;

  if exists (
    select 1 from public.receivables r
    where r.source_transaction_id = v_tx.id
  ) or exists (
    select 1 from public.receivable_payments p
    where p.transaction_id = v_tx.id
      and p.reversed_at is null
  ) then
    raise exception 'Diese Buchung gehört zu einer Forderung.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_debt_payment_link_target() from public, anon, authenticated;

drop trigger if exists debt_payments_00_validate_link_target on public.debt_payments;
create trigger debt_payments_00_validate_link_target
before insert on public.debt_payments
for each row execute function private.validate_debt_payment_link_target();


create or replace function private.guard_managed_transaction_transfer()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.transfer_group_id is null
     and new.transfer_group_id is not null
     and coalesce(old.cashflow_type,'standard') <> 'standard' then
    raise exception 'Verwaltete Finanzbuchungen können nicht in Umbuchungen umgewandelt werden.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_managed_transaction_transfer() from public, anon, authenticated;

drop trigger if exists transactions_guard_managed_transfer on public.transactions;
create trigger transactions_guard_managed_transfer
before update of transfer_group_id on public.transactions
for each row execute function private.guard_managed_transaction_transfer();
