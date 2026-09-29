create or replace function private.protect_active_debt_payment_transaction()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_linked boolean;
begin
  select exists (
    select 1 from public.debt_payments p
    where p.transaction_id = old.id
      and p.reversed_at is null
  ) into v_linked;

  if not v_linked then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Active debt payment transactions must be reversed from the debt ledger';
  end if;

  if new.household_id is distinct from old.household_id
     or new.account_id is distinct from old.account_id
     or new.occurred_at is distinct from old.occurred_at
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.status is distinct from old.status
     or new.transfer_group_id is distinct from old.transfer_group_id
     or new.cashflow_type is distinct from old.cashflow_type then
    raise exception 'Active debt payment transaction financial fields are managed by the debt ledger';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_active_debt_payment_transaction() from public, authenticated;

drop trigger if exists transactions_protect_active_debt_payment on public.transactions;
create trigger transactions_protect_active_debt_payment
before update or delete on public.transactions
for each row execute function private.protect_active_debt_payment_transaction();
