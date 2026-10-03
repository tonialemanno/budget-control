
create or replace function private.seed_demo_tax_center_values(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_case_2025 uuid;
  v_case_2026 uuid;
  v_case_2027 uuid;
  v_rule_2025 uuid;
  v_rule_2026 uuid;
  v_rule_2027 uuid;
  v_obligation uuid;
begin
  select id into v_rule_2025 from public.tax_rule_versions where country_code='CH' and canton_code='SG' and tax_year=2025 and active=true limit 1;
  select id into v_rule_2026 from public.tax_rule_versions where country_code='CH' and canton_code='SG' and tax_year=2026 and active=true limit 1;
  select id into v_rule_2027 from public.tax_rule_versions where country_code='CH' and canton_code='SG' and tax_year=2027 and active=true limit 1;

  insert into public.tax_cases(
    household_id,tax_year,country_code,canton_code,municipality,tax_period_from,tax_period_to,
    marital_status,denomination,status,rule_version_id,expected_tax_amount,currency,notes,created_by
  )
  values(
    p_household_id,2025,'CH','SG','St. Gallen',date '2025-01-01',date '2025-12-31',
    'ledig','konfessionslos','collecting',v_rule_2025,18450,'CHF','Synthetischer Demo-Steuerfall',p_user_id
  )
  on conflict (household_id,tax_year,country_code,canton_code)
  do update set rule_version_id=excluded.rule_version_id
  returning id into v_case_2025;

  insert into public.tax_cases(
    household_id,tax_year,country_code,canton_code,municipality,tax_period_from,tax_period_to,
    marital_status,denomination,status,rule_version_id,expected_tax_amount,currency,notes,created_by
  )
  values(
    p_household_id,2026,'CH','SG','St. Gallen',date '2026-01-01',date '2026-12-31',
    'ledig','konfessionslos','collecting',v_rule_2026,19200,'CHF','Synthetischer Demo-Steuerfall',p_user_id
  )
  on conflict (household_id,tax_year,country_code,canton_code)
  do update set rule_version_id=excluded.rule_version_id
  returning id into v_case_2026;

  insert into public.tax_cases(
    household_id,tax_year,country_code,canton_code,municipality,tax_period_from,tax_period_to,
    marital_status,denomination,status,rule_version_id,expected_tax_amount,currency,notes,created_by
  )
  values(
    p_household_id,2027,'CH','SG','St. Gallen',date '2027-01-01',date '2027-12-31',
    'ledig','konfessionslos','open',v_rule_2027,20000,'CHF','Planwert im Demo-Datensatz; Regelwerk 2027 ausstehend.',p_user_id
  )
  on conflict (household_id,tax_year,country_code,canton_code)
  do update set rule_version_id=excluded.rule_version_id
  returning id into v_case_2027;

  insert into public.tax_case_sections(household_id,tax_case_id,section_key,status,notes,updated_by)
  values
    (p_household_id,v_case_2025,'persons_household','complete','Demo vollständig',p_user_id),
    (p_household_id,v_case_2025,'income','complete','Lohnausweis vorhanden',p_user_id),
    (p_household_id,v_case_2025,'pension_insurance','complete','3a Bescheinigung vorhanden',p_user_id),
    (p_household_id,v_case_2025,'banks_securities','in_progress','Bankbescheinigung teilweise vorhanden',p_user_id),
    (p_household_id,v_case_2025,'debts','review','Jahreszinsnachweis prüfen',p_user_id),
    (p_household_id,v_case_2025,'tax_account','in_progress','Noch offen',p_user_id),
    (p_household_id,v_case_2026,'persons_household','complete','Demo vollständig',p_user_id),
    (p_household_id,v_case_2026,'income','complete','Lohnausweis wird Ende Jahr erwartet',p_user_id),
    (p_household_id,v_case_2026,'pension_insurance','in_progress','Bescheinigung noch offen',p_user_id),
    (p_household_id,v_case_2026,'banks_securities','in_progress','31.12.-Stichtag noch offen',p_user_id),
    (p_household_id,v_case_2026,'tax_account','in_progress','Provisorische Zahlungen laufen',p_user_id)
  on conflict (tax_case_id,section_key)
  do update set status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now();

  if not exists (select 1 from public.tax_items where tax_case_id=v_case_2025 and title='Demo Lohnausweis 2025') then
    insert into public.tax_items(
      household_id,tax_case_id,section_key,item_type,title,person_label,country_code,canton_code,occurred_on,
      gross_amount,reimbursement_amount,deductible_amount,currency,verification_status,metadata,created_by
    ) values
      (p_household_id,v_case_2025,'income','salary_certificate','Demo Lohnausweis 2025','Finance Demo','CH','SG',date '2025-12-31',78000,0,null,'CHF','verified','{"employer":"Demo AG"}'::jsonb,p_user_id),
      (p_household_id,v_case_2025,'banks_securities','account_snapshot','UBS Lohnkonto · Saldo 31.12.2025','Finance Demo','CH','SG',date '2025-12-31',null,0,null,'CHF','verified','{"balance":6200.35,"institution":"UBS"}'::jsonb,p_user_id),
      (p_household_id,v_case_2025,'pension_insurance','pension_certificate','Säule 3a Bescheinigung 2025','Finance Demo','CH','SG',date '2025-12-31',7056,0,7056,'CHF','verified','{"provider":"VIAC Demo"}'::jsonb,p_user_id),
      (p_household_id,v_case_2025,'debts','debt_snapshot','Autoleasing · Saldo 31.12.2025','Finance Demo','CH','SG',date '2025-12-31',12800,0,null,'CHF','review','{"creditor":"Demo Leasing AG"}'::jsonb,p_user_id);
  end if;

  if not exists (select 1 from public.tax_items where tax_case_id=v_case_2026 and title='Lohn 2026 · laufend') then
    insert into public.tax_items(
      household_id,tax_case_id,section_key,item_type,title,person_label,country_code,canton_code,occurred_on,
      gross_amount,reimbursement_amount,deductible_amount,currency,verification_status,metadata,created_by
    ) values
      (p_household_id,v_case_2026,'income','manual','Lohn 2026 · laufend','Finance Demo','CH','SG',current_date,58500,0,null,'CHF','review','{"employer":"Demo AG","status":"laufend"}'::jsonb,p_user_id),
      (p_household_id,v_case_2026,'pension_insurance','manual','Säule 3a 2026 · laufend','Finance Demo','CH','SG',current_date,5292,0,5292,'CHF','needs_document','{"provider":"VIAC Demo"}'::jsonb,p_user_id);
  end if;

  if not exists (select 1 from public.tax_obligations where tax_case_id=v_case_2025 and label='Provisorische Steuer 2025') then
    insert into public.tax_obligations(household_id,tax_case_id,obligation_type,label,amount,currency,due_date,status,reference,created_by)
    values(p_household_id,v_case_2025,'provisional','Provisorische Steuer 2025',18450,'CHF',date '2026-03-31','partial','DEMO-2025',p_user_id)
    returning id into v_obligation;
    insert into public.tax_payments(household_id,tax_case_id,obligation_id,payment_type,amount,currency,paid_at,reference,created_by)
    values
      (p_household_id,v_case_2025,v_obligation,'payment',6000,'CHF',date '2025-06-30','Demo Rate 1',p_user_id),
      (p_household_id,v_case_2025,v_obligation,'payment',6000,'CHF',date '2025-10-31','Demo Rate 2',p_user_id);
  end if;

  if not exists (select 1 from public.tax_obligations where tax_case_id=v_case_2026 and label='Provisorische Steuer 2026') then
    insert into public.tax_obligations(household_id,tax_case_id,obligation_type,label,amount,currency,due_date,status,reference,created_by)
    values(p_household_id,v_case_2026,'provisional','Provisorische Steuer 2026',19200,'CHF',date '2026-12-31','partial','DEMO-2026',p_user_id)
    returning id into v_obligation;
    insert into public.tax_payments(household_id,tax_case_id,obligation_id,payment_type,amount,currency,paid_at,reference,created_by)
    values
      (p_household_id,v_case_2026,v_obligation,'payment',4000,'CHF',date '2026-03-31','Demo Rate 1',p_user_id),
      (p_household_id,v_case_2026,v_obligation,'payment',4000,'CHF',date '2026-06-30','Demo Rate 2',p_user_id);
  end if;

  if not exists (select 1 from public.tax_obligations where tax_case_id=v_case_2027 and label='Planwert Steuer 2027') then
    insert into public.tax_obligations(household_id,tax_case_id,obligation_type,label,amount,currency,due_date,status,reference,created_by)
    values(p_household_id,v_case_2027,'other','Planwert Steuer 2027',20000,'CHF',date '2027-12-31','open','DEMO-2027',p_user_id);
  end if;
end;
$$;

revoke all on function private.seed_demo_tax_center_values(uuid,uuid) from public,anon,authenticated;

create or replace function private.seed_demo_tax_center_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.seed_demo_tax_center_values(new.household_id,new.user_id);
  return new;
end;
$$;

revoke all on function private.seed_demo_tax_center_trigger() from public,anon,authenticated;

drop trigger if exists demo_instances_seed_tax_center on public.demo_instances;
create trigger demo_instances_seed_tax_center
after insert or update of household_id on public.demo_instances
for each row execute function private.seed_demo_tax_center_trigger();

do $$
declare r record;
begin
  for r in select user_id,household_id from public.demo_instances loop
    perform private.seed_demo_tax_center_values(r.household_id,r.user_id);
  end loop;
end $$;
