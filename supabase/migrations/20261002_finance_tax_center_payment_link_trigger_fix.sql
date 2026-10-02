
create or replace function private.validate_tax_payment_links()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_case_household uuid;
  v_obligation public.tax_obligations%rowtype;
  v_tx public.transactions%rowtype;
begin
  select household_id into v_case_household from public.tax_cases where id=new.tax_case_id;
  if v_case_household is null or v_case_household<>new.household_id then
    raise exception 'Steuerzahlung gehört nicht zum Steuerfall bzw. Haushalt.';
  end if;

  if new.obligation_id is not null then
    select * into v_obligation from public.tax_obligations where id=new.obligation_id;
    if not found or v_obligation.household_id<>new.household_id or v_obligation.tax_case_id<>new.tax_case_id then
      raise exception 'Steuerzahlung und Steuerforderung gehören nicht zum selben Steuerfall.';
    end if;
    if v_obligation.currency<>new.currency then
      raise exception 'Währung von Steuerzahlung und Steuerforderung stimmt nicht überein.';
    end if;
  end if;

  if new.transaction_id is not null then
    select * into v_tx from public.transactions where id=new.transaction_id;
    if not found or v_tx.household_id<>new.household_id then
      raise exception 'Verknüpfte Kontobuchung gehört nicht zum Steuerhaushalt.';
    end if;
    if v_tx.currency<>new.currency then
      raise exception 'Währung von Steuerzahlung und Kontobuchung stimmt nicht überein.';
    end if;
    if abs(abs(v_tx.amount)-new.amount)>0.01 then
      raise exception 'Betrag von Steuerzahlung und Kontobuchung stimmt nicht überein.';
    end if;
    if new.payment_type in ('payment','interest_payment') and v_tx.amount>=0 then
      raise exception 'Eine Steuerzahlung muss mit einer Ausgabebuchung verknüpft sein.';
    end if;
    if new.payment_type in ('refund','interest_credit') and v_tx.amount<=0 then
      raise exception 'Eine Steuerrückerstattung muss mit einer Einnahmebuchung verknüpft sein.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_tax_payment_links() from public,anon,authenticated;
