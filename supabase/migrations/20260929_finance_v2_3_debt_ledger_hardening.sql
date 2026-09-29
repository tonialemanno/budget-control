create or replace function private.validate_debt_links()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.currency is distinct from old.currency
     and exists (
       select 1 from public.debt_payments p
       where p.debt_id = old.id
     ) then
    raise exception 'Debt currency cannot be changed after payments exist';
  end if;

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
before insert or update of household_id, currency, payment_account_id, recurring_rule_id
on public.debts
for each row execute function private.validate_debt_links();

create or replace function private.guard_debt_payment_update()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_has_later boolean;
  v_debt public.debts%rowtype;
  v_restored_status text;
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

    select * into v_debt
    from public.debts
    where id = old.debt_id and household_id = old.household_id
    for update;

    if not found then
      raise exception 'Debt does not belong to this household';
    end if;

    if v_debt.outstanding_amount <> old.outstanding_after
       or v_debt.next_payment_date is distinct from old.next_payment_date_after then
      raise exception 'Debt was corrected after this payment; automatic reversal is no longer safe';
    end if;

    v_restored_status := case
      when v_debt.status = 'paid' and old.outstanding_before > 0 then old.debt_status_before
      else v_debt.status
    end;

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
          status = v_restored_status,
          next_payment_date = old.next_payment_date_before,
          updated_at = now()
      where id = old.debt_id and household_id = old.household_id;

    update public.recurring_rules r
      set next_date = coalesce(old.next_payment_date_before, r.next_date),
          active = (v_restored_status = 'active' and old.outstanding_before > 0),
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
