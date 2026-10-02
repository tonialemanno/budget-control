
create or replace function private.validate_tax_case_links()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_rule public.tax_rule_versions%rowtype;
begin
  if new.rule_version_id is not null then
    select * into v_rule from public.tax_rule_versions where id=new.rule_version_id;
    if not found then raise exception 'Steuer-Regelversion wurde nicht gefunden.'; end if;
    if v_rule.country_code<>new.country_code or v_rule.canton_code<>new.canton_code or v_rule.tax_year<>new.tax_year then
      raise exception 'Steuerfall und Regelversion passen nicht zusammen.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_tax_child_link()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.tax_cases where id=new.tax_case_id;
  if v_household is null or v_household<>new.household_id then
    raise exception 'Steuerobjekt gehört nicht zum Steuerfall bzw. Haushalt.';
  end if;
  return new;
end;
$$;

create or replace function private.validate_tax_item_source()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_ok boolean := false;
begin
  if new.source_type is null and new.source_id is null then return new; end if;
  if new.source_type is null or new.source_id is null then
    raise exception 'Steuerquelle benötigt Typ und ID gemeinsam.';
  end if;

  case new.source_type
    when 'transaction' then select exists(select 1 from public.transactions x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'account' then select exists(select 1 from public.accounts x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'debt' then select exists(select 1 from public.debts x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'receivable' then select exists(select 1 from public.receivables x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'pension' then select exists(select 1 from public.pension_accounts x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'insurance' then select exists(select 1 from public.insurance_policies x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'investment' then select exists(select 1 from public.investments x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'property' then select exists(select 1 from public.properties x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'vehicle' then select exists(select 1 from public.vehicles x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    when 'document' then select exists(select 1 from public.documents x where x.id=new.source_id and x.household_id=new.household_id) into v_ok;
    else raise exception 'Unbekannter Steuerquellentyp: %',new.source_type;
  end case;

  if not v_ok then raise exception 'Verknüpfte Steuerquelle wurde im Haushalt nicht gefunden.'; end if;
  return new;
end;
$$;

create or replace function private.validate_tax_payment_links()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_obligation public.tax_obligations%rowtype;
  v_tx public.transactions%rowtype;
begin
  perform private.validate_tax_child_link();

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

revoke all on function private.validate_tax_case_links() from public,anon,authenticated;
revoke all on function private.validate_tax_child_link() from public,anon,authenticated;
revoke all on function private.validate_tax_item_source() from public,anon,authenticated;
revoke all on function private.validate_tax_payment_links() from public,anon,authenticated;

drop trigger if exists tax_cases_validate_links on public.tax_cases;
create trigger tax_cases_validate_links before insert or update on public.tax_cases
for each row execute function private.validate_tax_case_links();

drop trigger if exists tax_case_sections_validate_case on public.tax_case_sections;
create trigger tax_case_sections_validate_case before insert or update on public.tax_case_sections
for each row execute function private.validate_tax_child_link();

drop trigger if exists tax_items_validate_case on public.tax_items;
create trigger tax_items_validate_case before insert or update on public.tax_items
for each row execute function private.validate_tax_child_link();

drop trigger if exists tax_items_validate_source on public.tax_items;
create trigger tax_items_validate_source before insert or update on public.tax_items
for each row execute function private.validate_tax_item_source();

drop trigger if exists tax_obligations_validate_case on public.tax_obligations;
create trigger tax_obligations_validate_case before insert or update on public.tax_obligations
for each row execute function private.validate_tax_child_link();

drop trigger if exists tax_payments_validate_links on public.tax_payments;
create trigger tax_payments_validate_links before insert or update on public.tax_payments
for each row execute function private.validate_tax_payment_links();
