CREATE OR REPLACE FUNCTION public.pay_bill_v2(p_household_id uuid, p_bill_id uuid, p_source text, p_paid_at date DEFAULT NULL::date, p_account_id uuid DEFAULT NULL::uuid, p_transaction_id uuid DEFAULT NULL::uuid)
 RETURNS bills
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
  select * into v_bill from public.bills
  where id = p_bill_id and household_id = p_household_id for update;
  if not found then raise exception 'Rechnung nicht gefunden.'; end if;
  if v_bill.status = 'paid' then raise exception 'Rechnung ist bereits bezahlt.'; end if;
  if v_bill.amount <= 0 then raise exception 'Eine Rechnung mit Betrag 0 kann nicht als Zahlung verbucht werden.'; end if;

  if p_source = 'created_transaction' then
    select * into v_account from public.accounts
    where id = coalesce(p_account_id, v_bill.account_id)
      and household_id = p_household_id and is_archived = false;
    if not found then raise exception 'Bitte ein gültiges Zahlungskonto auswählen.'; end if;
    if v_account.currency <> v_bill.currency then raise exception 'Rechnung und Zahlungskonto müssen dieselbe Währung haben.'; end if;
    v_paid_at := coalesce(p_paid_at, current_date);
    insert into public.transactions(
      household_id, account_id, category_id, occurred_at, amount, currency,
      description, counterparty, note, status, source, cashflow_type
    ) values (
      p_household_id, v_account.id, v_bill.category_id,
      case when v_paid_at=current_date then now() else v_paid_at::timestamptz + time '12:00' end,
      -v_bill.amount, v_bill.currency, 'Rechnung: ' || v_bill.name,
      v_bill.provider, v_bill.reference, 'booked', 'manual', 'standard'
    ) returning id into v_tx_id;
  elsif p_source = 'linked_transaction' then
    if p_transaction_id is null then raise exception 'Bitte eine bestehende Buchung auswählen.'; end if;
    select * into v_tx from public.transactions
    where id = p_transaction_id and household_id = p_household_id for update;
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
$function$;

CREATE OR REPLACE FUNCTION private.prepare_debt_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
      case when new.paid_at=current_date then now() else new.paid_at::timestamptz + time '12:00' end,
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
$function$;


update public.transactions t
set occurred_at=t.created_at,
    updated_at=now()
from public.bills b
where b.paid_transaction_id=t.id
  and b.payment_source='created_transaction'
  and t.occurred_at>now()
  and t.occurred_at::date=current_date
  and t.created_at::date=current_date;

update public.transactions t
set occurred_at=t.created_at,
    updated_at=now()
from public.debt_payments p
where p.transaction_id=t.id
  and p.source='created_transaction'
  and p.reversed_at is null
  and t.occurred_at>now()
  and t.occurred_at::date=current_date
  and t.created_at::date=current_date;
