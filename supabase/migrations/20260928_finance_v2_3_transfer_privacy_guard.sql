-- Finance V2.3 – harden transfer conversion against private-account bypass.
create or replace function public.convert_transaction_to_transfer(
  p_household_id uuid,
  p_transaction_id uuid,
  p_to_account_id uuid,
  p_to_amount numeric default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_tx public.transactions%rowtype;
  v_from public.accounts%rowtype;
  v_to public.accounts%rowtype;
  v_group uuid := gen_random_uuid();
  v_amount numeric;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;
  v_is_admin := private.can_admin_household(p_household_id);

  select * into v_tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id
   for update;
  if not found then raise exception 'Transaktion nicht gefunden.'; end if;
  if v_tx.transfer_group_id is not null then raise exception 'Transaktion ist bereits eine Umbuchung.'; end if;
  if v_tx.amount >= 0 then raise exception 'Nur ein Abgang kann als Umbuchung umgewandelt werden.'; end if;

  select * into v_from from public.accounts
   where id=v_tx.account_id and household_id=p_household_id and is_archived=false;
  if not found then raise exception 'Quellkonto nicht gefunden.'; end if;
  if not (v_from.visibility='household' or v_from.owner_user_id=v_uid or v_is_admin) then
    raise exception 'Kein Zugriff auf das Quellkonto.';
  end if;

  select * into v_to from public.accounts
   where id=p_to_account_id and household_id=p_household_id and is_archived=false;
  if not found then raise exception 'Zielkonto nicht gefunden.'; end if;
  if not (v_to.visibility='household' or v_to.owner_user_id=v_uid or v_is_admin) then
    raise exception 'Kein Zugriff auf das Zielkonto.';
  end if;
  if v_to.id=v_tx.account_id then raise exception 'Quell- und Zielkonto müssen verschieden sein.'; end if;

  if v_to.currency=v_tx.currency then
    v_amount := abs(v_tx.amount);
  else
    v_amount := p_to_amount;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Bei Währungswechsel muss der Zielbetrag angegeben werden.';
    end if;
  end if;

  update public.transactions
     set transfer_group_id=v_group,
         category_id=null,
         tax_relevant=false,
         tax_category=null,
         updated_at=now()
   where id=v_tx.id;

  insert into public.transactions (
    household_id, account_id, category_id, occurred_at, amount, currency,
    description, counterparty, note, status, source, transfer_group_id
  ) values (
    p_household_id, v_to.id, null, v_tx.occurred_at, v_amount, v_to.currency,
    coalesce(nullif(p_description,''), 'Umbuchung'), null,
    'Aus bestehender Buchung als interne Umbuchung erkannt.', 'booked', 'manual', v_group
  );

  return v_group;
end;
$$;

revoke all on function public.convert_transaction_to_transfer(uuid,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.convert_transaction_to_transfer(uuid,uuid,uuid,numeric,text) to authenticated;
