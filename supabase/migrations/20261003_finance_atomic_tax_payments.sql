-- Atomic tax payment + account transaction linkage.
-- Keeps the tax ledger and account ledger in one PostgreSQL transaction.

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
  if not private.can_write_household(p_household_id)
     or not private.has_module_access('tax') then
    raise exception 'Keine Berechtigung für Steuerzahlungen in diesem Haushalt.';
  end if;

  if p_payment_type not in ('payment','refund','interest_payment','interest_credit') then
    raise exception 'Unbekannte Art der Steuerzahlung.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Der Steuerbetrag muss grösser als 0 sein.';
  end if;
  if p_source not in ('created_transaction','linked_transaction','history_only') then
    raise exception 'Unbekannte Zahlungsquelle.';
  end if;

  select * into v_case
  from public.tax_cases
  where id=p_tax_case_id and household_id=p_household_id
  for update;
  if not found then
    raise exception 'Steuerfall wurde nicht gefunden.';
  end if;

  if p_obligation_id is not null and not exists (
    select 1 from public.tax_obligations o
    where o.id=p_obligation_id
      and o.household_id=p_household_id
      and o.tax_case_id=p_tax_case_id
  ) then
    raise exception 'Steuerforderung gehört nicht zu diesem Steuerfall.';
  end if;

  v_refund := p_payment_type in ('refund','interest_credit');
  v_treatment := case when v_refund then 'tax_refund' else 'tax_payment' end;
  v_category := case when v_refund then 'Steuerrückerstattung' else 'Steuerzahlung' end;

  if p_source='created_transaction' then
    if p_account_id is null then
      raise exception 'Bitte ein Zahlungskonto auswählen.';
    end if;
    select * into v_account
    from public.accounts
    where id=p_account_id
      and household_id=p_household_id
      and is_archived=false;
    if not found then
      raise exception 'Zahlungskonto wurde nicht gefunden.';
    end if;
    if v_account.currency<>v_case.currency then
      raise exception 'Steuerfall und Zahlungskonto müssen dieselbe Währung haben.';
    end if;

    insert into public.transactions(
      household_id,account_id,occurred_at,amount,currency,description,counterparty,note,
      status,source,cashflow_type,tax_relevant,tax_category,tax_year,tax_section_key,tax_treatment
    ) values (
      p_household_id,
      v_account.id,
      case when coalesce(p_paid_at,current_date)=current_date
        then now()
        else coalesce(p_paid_at,current_date)::timestamptz + time '12:00'
      end,
      case when v_refund then abs(p_amount) else -abs(p_amount) end,
      v_case.currency,
      case when v_refund
        then 'Steuerrückerstattung '||v_case.tax_year
        else 'Steuerzahlung '||v_case.tax_year
      end,
      'Steuerverwaltung',
      coalesce(nullif(trim(p_reference),''),nullif(trim(p_notes),'')),
      'booked','manual','standard',true,v_category,v_case.tax_year,'tax_account',v_treatment
    ) returning id into v_tx_id;

  elsif p_source='linked_transaction' then
    if p_transaction_id is null then
      raise exception 'Bitte eine bestehende Kontobuchung auswählen.';
    end if;

    select * into v_tx
    from public.transactions
    where id=p_transaction_id and household_id=p_household_id
    for update;
    if not found then
      raise exception 'Kontobuchung wurde nicht gefunden.';
    end if;
    if v_tx.status<>'booked'
       or v_tx.transfer_group_id is not null
       or v_tx.cashflow_type<>'standard' then
      raise exception 'Nur eine normale gebuchte Kontobewegung kann verknüpft werden.';
    end if;
    if v_tx.currency<>v_case.currency or abs(v_tx.amount)<>p_amount then
      raise exception 'Betrag und Währung der Kontobuchung müssen zur Steuerzahlung passen.';
    end if;
    if (v_refund and v_tx.amount<=0) or (not v_refund and v_tx.amount>=0) then
      raise exception 'Die Richtung der Kontobuchung passt nicht zur Steuerzahlung.';
    end if;
    if exists (select 1 from public.tax_payments p where p.transaction_id=v_tx.id) then
      raise exception 'Diese Kontobuchung ist bereits mit einer Steuerzahlung verknüpft.';
    end if;
    if exists (select 1 from public.debt_payments p where p.transaction_id=v_tx.id and p.reversed_at is null) then
      raise exception 'Diese Kontobuchung gehört bereits zu einer Schuldzahlung.';
    end if;
    if exists (select 1 from public.receivable_payments p where p.transaction_id=v_tx.id and p.reversed_at is null) then
      raise exception 'Diese Kontobuchung gehört bereits zu einer Forderungsrückzahlung.';
    end if;
    if exists (select 1 from public.bills b where b.paid_transaction_id=v_tx.id and b.status='paid') then
      raise exception 'Diese Kontobuchung gehört bereits zu einer bezahlten Rechnung.';
    end if;

    update public.transactions
    set tax_relevant=true,
        tax_category=v_category,
        tax_year=v_case.tax_year,
        tax_section_key='tax_account',
        tax_treatment=v_treatment,
        updated_at=now()
    where id=v_tx.id;
    v_tx_id := v_tx.id;

  else
    v_tx_id := null;
  end if;

  insert into public.tax_payments(
    household_id,tax_case_id,obligation_id,payment_type,amount,currency,paid_at,
    transaction_id,reference,notes
  ) values (
    p_household_id,p_tax_case_id,p_obligation_id,p_payment_type,p_amount,v_case.currency,
    coalesce(p_paid_at,current_date),v_tx_id,nullif(trim(p_reference),''),nullif(trim(p_notes),'')
  )
  returning * into v_payment;

  return v_payment;
end;
$function$;

revoke all on function public.record_tax_payment_v2(uuid,uuid,uuid,text,numeric,date,text,text,text,uuid,uuid) from public;
grant execute on function public.record_tax_payment_v2(uuid,uuid,uuid,text,numeric,date,text,text,text,uuid,uuid) to authenticated;
