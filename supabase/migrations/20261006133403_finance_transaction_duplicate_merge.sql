create or replace function public.merge_duplicate_transactions_v1(
  p_household_id uuid,
  p_keep_transaction_id uuid,
  p_duplicate_transaction_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path to pg_catalog, public, private
as $function$
declare
  v_keep public.transactions%rowtype;
  v_duplicate public.transactions%rowtype;
  v_tolerance numeric;
  v_note text;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  if p_keep_transaction_id = p_duplicate_transaction_id then
    return p_keep_transaction_id;
  end if;

  select * into v_keep
  from public.transactions
  where id = p_keep_transaction_id
    and household_id = p_household_id
  for update;
  if not found then raise exception 'Zu behaltende Buchung wurde nicht gefunden.'; end if;

  select * into v_duplicate
  from public.transactions
  where id = p_duplicate_transaction_id
    and household_id = p_household_id
  for update;
  if not found then raise exception 'Doppelte Buchung wurde nicht gefunden.'; end if;

  if v_keep.status <> 'booked' or v_duplicate.status <> 'booked' then
    raise exception 'Nur gebuchte Transaktionen können zusammengeführt werden.';
  end if;
  if v_keep.transfer_group_id is not null or v_duplicate.transfer_group_id is not null then
    raise exception 'Umbuchungen können nicht als Dublette zusammengeführt werden.';
  end if;
  if v_keep.cashflow_type <> 'standard' or v_duplicate.cashflow_type <> 'standard' then
    raise exception 'Verwaltete Schuld-/Forderungsbuchungen können nicht zusammengeführt werden.';
  end if;
  if v_keep.account_id <> v_duplicate.account_id then
    raise exception 'Dubletten müssen auf demselben Konto liegen.';
  end if;
  if v_keep.currency <> v_duplicate.currency or sign(v_keep.amount) <> sign(v_duplicate.amount) then
    raise exception 'Währung oder Buchungsrichtung stimmen nicht überein.';
  end if;

  v_tolerance := greatest(0.02::numeric, abs(v_keep.amount) * 0.002::numeric);
  if abs(abs(v_keep.amount) - abs(v_duplicate.amount)) > v_tolerance then
    raise exception 'Die Beträge sind zu unterschiedlich für eine sichere Zusammenführung.';
  end if;
  if abs(extract(epoch from (v_keep.occurred_at - v_duplicate.occurred_at))) > 7 * 86400 then
    raise exception 'Die Buchungen liegen zeitlich zu weit auseinander.';
  end if;
  if v_keep.external_reference is not null
     and v_duplicate.external_reference is not null
     and v_keep.external_reference <> v_duplicate.external_reference then
    raise exception 'Beide Buchungen besitzen unterschiedliche Bankreferenzen.';
  end if;

  if exists(select 1 from public.bills where paid_transaction_id in (v_keep.id, v_duplicate.id))
     or exists(select 1 from public.debt_payments where transaction_id in (v_keep.id, v_duplicate.id))
     or exists(select 1 from public.receivable_payments where transaction_id in (v_keep.id, v_duplicate.id))
     or exists(select 1 from public.receivables where source_transaction_id in (v_keep.id, v_duplicate.id))
     or exists(select 1 from public.tax_payments where transaction_id in (v_keep.id, v_duplicate.id)) then
    raise exception 'Mindestens eine Buchung ist mit einer Fachfunktion verknüpft und muss dort korrigiert werden.';
  end if;

  update public.documents
  set object_id = v_keep.id
  where household_id = p_household_id
    and object_type = 'transaction'
    and object_id = v_duplicate.id;

  delete from public.transactions
  where id = v_duplicate.id
    and household_id = p_household_id;

  v_note := case
    when nullif(trim(v_keep.note), '') is null then v_duplicate.note
    when nullif(trim(v_duplicate.note), '') is null then v_keep.note
    when trim(v_keep.note) = trim(v_duplicate.note) then v_keep.note
    else trim(v_keep.note) || ' · ' || trim(v_duplicate.note)
  end;

  update public.transactions
  set
    category_id = coalesce(v_keep.category_id, v_duplicate.category_id),
    merchant_id = coalesce(v_keep.merchant_id, v_duplicate.merchant_id),
    counterparty_id = coalesce(v_keep.counterparty_id, v_duplicate.counterparty_id),
    context_id = coalesce(v_keep.context_id, v_duplicate.context_id),
    vehicle_id = coalesce(v_keep.vehicle_id, v_duplicate.vehicle_id),
    recurring_rule_id = coalesce(v_keep.recurring_rule_id, v_duplicate.recurring_rule_id),
    note = v_note,
    tax_relevant = coalesce(v_keep.tax_relevant, false) or coalesce(v_duplicate.tax_relevant, false),
    tax_category = coalesce(v_keep.tax_category, v_duplicate.tax_category),
    tax_year = coalesce(v_keep.tax_year, v_duplicate.tax_year),
    tax_section_key = coalesce(v_keep.tax_section_key, v_duplicate.tax_section_key),
    tax_treatment = coalesce(v_keep.tax_treatment, v_duplicate.tax_treatment),
    income_kind = coalesce(v_keep.income_kind, v_duplicate.income_kind),
    analytics_excluded = coalesce(v_keep.analytics_excluded, false) and coalesce(v_duplicate.analytics_excluded, false),
    exclude_from_reports = coalesce(v_keep.exclude_from_reports, false) and coalesce(v_duplicate.exclude_from_reports, false),
    semantic_type = coalesce(v_keep.semantic_type, v_duplicate.semantic_type),
    external_reference = coalesce(v_keep.external_reference, v_duplicate.external_reference),
    import_batch_id = coalesce(v_keep.import_batch_id, v_duplicate.import_batch_id),
    bank_reference = coalesce(v_keep.bank_reference, v_duplicate.bank_reference),
    counterparty_account_ref = coalesce(v_keep.counterparty_account_ref, v_duplicate.counterparty_account_ref),
    import_raw_data = coalesce(v_keep.import_raw_data, v_duplicate.import_raw_data),
    import_source_page = coalesce(v_keep.import_source_page, v_duplicate.import_source_page),
    source = case
      when v_keep.source = 'import' or v_duplicate.source = 'import' then 'import'
      when v_keep.source = 'manual' or v_duplicate.source = 'manual' then 'manual'
      else v_keep.source
    end,
    occurred_at = case
      when v_keep.source = 'import' then v_keep.occurred_at
      when v_duplicate.source = 'import' then v_duplicate.occurred_at
      else v_keep.occurred_at
    end,
    description = case
      when v_keep.source = 'import' then v_keep.description
      when v_duplicate.source = 'import' then v_duplicate.description
      else v_keep.description
    end,
    counterparty = coalesce(nullif(trim(v_keep.counterparty), ''), nullif(trim(v_duplicate.counterparty), '')),
    updated_at = now()
  where id = v_keep.id
    and household_id = p_household_id;

  return v_keep.id;
end;
$function$;

revoke all on function public.merge_duplicate_transactions_v1(uuid,uuid,uuid) from public, anon;
grant execute on function public.merge_duplicate_transactions_v1(uuid,uuid,uuid) to authenticated, service_role;
