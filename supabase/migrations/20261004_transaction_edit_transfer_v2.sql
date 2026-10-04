-- Convert any standalone transaction leg into a real internal transfer.
-- The edited transaction stays the bank truth. Finance either links an existing
-- opposite bank leg or creates only the missing counterpart.

create or replace function public.convert_transaction_to_transfer_v2(
  p_household_id uuid,
  p_transaction_id uuid,
  p_other_account_id uuid,
  p_amount numeric default null,
  p_other_amount numeric default null,
  p_other_transaction_id uuid default null,
  p_occurred_at timestamptz default null,
  p_description text default null,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_tx public.transactions%rowtype;
  v_current_account public.accounts%rowtype;
  v_other_account public.accounts%rowtype;
  v_other_tx public.transactions%rowtype;
  v_group uuid := gen_random_uuid();
  v_current_abs numeric;
  v_other_abs numeric;
  v_current_sign integer;
  v_current_amount numeric;
  v_other_signed numeric;
  v_event_at timestamptz;
  v_description text;
  v_bill_link boolean;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  select * into v_tx
  from public.transactions
  where id=p_transaction_id and household_id=p_household_id
  for update;

  if not found then raise exception 'Transaktion nicht gefunden.'; end if;
  if v_tx.transfer_group_id is not null then raise exception 'Transaktion ist bereits eine Umbuchung.'; end if;
  if v_tx.cashflow_type <> 'standard' then raise exception 'Diese Buchung wird in einem Fachmodul verwaltet und kann nicht als Umbuchung umgewandelt werden.'; end if;

  select exists(
    select 1 from public.bills b
    where b.household_id=p_household_id
      and b.status='paid'
      and b.paid_transaction_id=v_tx.id
  ) into v_bill_link;
  if v_bill_link then raise exception 'Diese Buchung gehört zu einer bezahlten Rechnung.'; end if;

  select * into v_current_account
  from public.accounts
  where id=v_tx.account_id and household_id=p_household_id and is_archived=false;
  if not found then raise exception 'Konto der Buchung nicht gefunden.'; end if;

  select * into v_other_account
  from public.accounts
  where id=p_other_account_id and household_id=p_household_id and is_archived=false;
  if not found then raise exception 'Gegenkonto nicht gefunden.'; end if;
  if v_other_account.id=v_current_account.id then raise exception 'Die Umbuchung braucht zwei verschiedene Konten.'; end if;

  v_current_sign := case when v_tx.amount < 0 then -1 else 1 end;
  v_current_abs := coalesce(abs(p_amount),abs(v_tx.amount));
  if v_current_abs is null or v_current_abs <= 0 then raise exception 'Der Betrag muss grösser als 0 sein.'; end if;
  v_current_amount := v_current_sign * v_current_abs;

  if v_other_account.currency=v_current_account.currency then
    v_other_abs := v_current_abs;
  else
    v_other_abs := abs(p_other_amount);
    if v_other_abs is null or v_other_abs <= 0 then
      raise exception 'Bei unterschiedlichen Währungen muss der Betrag auf dem Gegenkonto angegeben werden.';
    end if;
  end if;
  v_other_signed := -v_current_sign * v_other_abs;
  v_event_at := coalesce(p_occurred_at,v_tx.occurred_at);
  v_description := coalesce(nullif(trim(p_description),''),v_tx.description,'Umbuchung');

  if p_other_transaction_id is not null then
    select * into v_other_tx
    from public.transactions
    where id=p_other_transaction_id
      and household_id=p_household_id
      and account_id=v_other_account.id
    for update;

    if not found then raise exception 'Ausgewählter Gegenposten wurde nicht gefunden.'; end if;
    if v_other_tx.id=v_tx.id then raise exception 'Eine Buchung kann nicht ihr eigener Gegenposten sein.'; end if;
    if v_other_tx.transfer_group_id is not null then raise exception 'Der Gegenposten ist bereits eine Umbuchung.'; end if;
    if v_other_tx.status <> 'booked' then raise exception 'Nur gebuchte Gegenposten können verknüpft werden.'; end if;
    if v_other_tx.cashflow_type <> 'standard' then raise exception 'Der Gegenposten wird in einem Fachmodul verwaltet.'; end if;
    if sign(v_other_tx.amount)=sign(v_current_amount) then raise exception 'Der Gegenposten muss die entgegengesetzte Buchungsrichtung haben.'; end if;
    if v_other_tx.currency<>v_other_account.currency then raise exception 'Währung des Gegenpostens stimmt nicht mit dem Gegenkonto überein.'; end if;
    if abs(extract(epoch from (v_other_tx.occurred_at-v_event_at))) > 7*24*60*60 then
      raise exception 'Der Gegenposten liegt mehr als 7 Tage von der Buchung entfernt.';
    end if;
    if abs(abs(v_other_tx.amount)-v_other_abs) >= 0.005 then
      raise exception 'Betrag des Gegenpostens stimmt nicht mit der Umbuchung überein.';
    end if;

    select exists(
      select 1 from public.bills b
      where b.household_id=p_household_id
        and b.status='paid'
        and b.paid_transaction_id=v_other_tx.id
    ) into v_bill_link;
    if v_bill_link then raise exception 'Der Gegenposten gehört zu einer bezahlten Rechnung.'; end if;
  end if;

  update public.transactions
  set occurred_at=v_event_at,
      amount=v_current_amount,
      description=v_description,
      note=coalesce(p_note,note),
      category_id=null,
      merchant_id=null,
      tax_relevant=false,
      tax_category=null,
      tax_year=null,
      tax_section_key=null,
      tax_treatment=null,
      income_kind=case when v_current_amount>0 then 'not_income' else null end,
      semantic_type='internal_transfer',
      exclude_from_reports=false,
      transfer_group_id=v_group,
      updated_at=now()
  where id=v_tx.id;

  if p_other_transaction_id is not null then
    update public.transactions
    set category_id=null,
        merchant_id=null,
        tax_relevant=false,
        tax_category=null,
        tax_year=null,
        tax_section_key=null,
        tax_treatment=null,
        income_kind=case when amount>0 then 'not_income' else null end,
        semantic_type='internal_transfer',
        exclude_from_reports=false,
        transfer_group_id=v_group,
        updated_at=now()
    where id=v_other_tx.id;
  else
    insert into public.transactions(
      household_id,account_id,category_id,occurred_at,amount,currency,
      description,counterparty,note,status,source,transfer_group_id,
      cashflow_type,tax_relevant,income_kind,semantic_type,exclude_from_reports
    ) values (
      p_household_id,v_other_account.id,null,v_event_at,v_other_signed,v_other_account.currency,
      v_description,null,'Von Finance als Gegenbuchung der internen Umbuchung erstellt.',
      'booked','manual',v_group,'standard',false,
      case when v_other_signed>0 then 'not_income' else null end,
      'internal_transfer',false
    );
  end if;

  return v_group;
end;
$$;

revoke all on function public.convert_transaction_to_transfer_v2(uuid,uuid,uuid,numeric,numeric,uuid,timestamptz,text,text) from public, anon;
grant execute on function public.convert_transaction_to_transfer_v2(uuid,uuid,uuid,numeric,numeric,uuid,timestamptz,text,text) to authenticated;
