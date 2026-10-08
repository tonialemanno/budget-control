CREATE OR REPLACE FUNCTION public.enrich_demo_instance_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_household uuid;
  v_account uuid;
  v_savings uuid;
  v_salary_cat uuid;
  v_food_cat uuid;
  v_rest_cat uuid;
  v_mobility_cat uuid;
  v_housing_cat uuid;
  v_health_cat uuid;
  v_sub_cat uuid;
  v_salary_rule uuid;
  v_rent_rule uuid;
  v_health_rule uuid;
  v_mobile_rule uuid;
  v_netflix_rule uuid;
  v_migros uuid;
  v_sbb uuid;
  v_mcd uuid;
  v_rent_merchant uuid;
  v_health_merchant uuid;
  v_sunrise uuid;
  v_netflix uuid;
  v_month date;
  v_salary_date date;
begin
  select di.household_id into v_household
  from public.demo_instances di
  where di.user_id=p_user_id
  limit 1;
  if v_household is null then raise exception 'Demo-Instanz wurde nicht gefunden.'; end if;

  select id into v_account from public.accounts where household_id=v_household and name='Lohnkonto' limit 1;
  select id into v_savings from public.accounts where household_id=v_household and name='Notgroschen' limit 1;
  if v_account is null then raise exception 'Demo-Lohnkonto fehlt.'; end if;

  update public.accounts
  set balance_anchor_amount=case
    when name='Lohnkonto' then 12450.35
    when name='Notgroschen' then 15000
    when name='Bargeld' then 480
    when name='Kreditkarte' then 0
    when name='Revolut EUR' then 1250.40
    else balance_anchor_amount end,
    updated_at=now()
  where household_id=v_household;

  select id into v_salary_cat from public.categories where household_id=v_household and name='Lohn' limit 1;
  select id into v_food_cat from public.categories where household_id=v_household and name='Lebensmittel' limit 1;
  select id into v_rest_cat from public.categories where household_id=v_household and name='Restaurant' limit 1;
  select id into v_mobility_cat from public.categories where household_id=v_household and name='Mobilität' limit 1;
  select id into v_housing_cat from public.categories where household_id=v_household and name='Wohnen' limit 1;
  select id into v_health_cat from public.categories where household_id=v_household and name='Krankenkasse' limit 1;
  select id into v_sub_cat from public.categories where household_id=v_household and name='Abos & Verträge' limit 1;

  select id into v_salary_rule from public.recurring_rules where household_id=v_household and direction='income' and description='Lohn Demo AG' limit 1;
  select id into v_rent_rule from public.recurring_rules where household_id=v_household and direction='expense' and description='Miete Demo Wohnung' limit 1;
  select id into v_health_rule from public.recurring_rules where household_id=v_household and direction='expense' and description='Krankenkasse' limit 1;
  select id into v_mobile_rule from public.recurring_rules where household_id=v_household and direction='expense' and description='Mobilabo' limit 1;
  select id into v_netflix_rule from public.recurring_rules where household_id=v_household and direction='expense' and description='Netflix' limit 1;

  update public.transactions
  set recurring_rule_id=v_salary_rule,
      semantic_type='earned_income',
      updated_at=now()
  where household_id=v_household
    and status='booked'
    and amount>0
    and category_id=v_salary_cat
    and description ilike 'Lohn Demo AG%';

  select id into v_migros from public.merchants where household_id=v_household and name='Migros' limit 1;
  select id into v_sbb from public.merchants where household_id=v_household and name='SBB' limit 1;
  select id into v_mcd from public.merchants where household_id=v_household and name='McDonald''s' limit 1;
  select id into v_rent_merchant from public.merchants where household_id=v_household and name='Demo Immobilien AG' limit 1;
  select id into v_health_merchant from public.merchants where household_id=v_household and name='Sanitas' limit 1;
  select id into v_sunrise from public.merchants where household_id=v_household and name='Sunrise / Yallo' limit 1;
  select id into v_netflix from public.merchants where household_id=v_household and name='Netflix' limit 1;

  delete from public.transactions
  where household_id=v_household and source='system' and external_reference like 'demo-story:%';

  foreach v_salary_date in array array['2026-04-25'::date,'2026-05-25'::date,'2026-06-25'::date]
  loop
    insert into public.transactions(
      household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,status,source,
      external_reference,merchant_id,created_by,semantic_type,recurring_rule_id
    ) values (
      v_household,v_account,v_salary_cat,v_salary_date::timestamp+time '08:00',6500,'CHF','Lohn Demo AG','Demo AG','booked','system',
      'demo-story:salary:'||v_salary_date::text,null,p_user_id,'earned_income',v_salary_rule
    );

    v_month=(date_trunc('month',v_salary_date+interval '1 month'))::date;

    insert into public.transactions(
      household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,status,source,
      external_reference,merchant_id,created_by,recurring_rule_id
    )
    values
      (v_household,v_account,v_housing_cat,(v_month+0)::timestamp+time '08:00',-1850,'CHF','Miete Demo Wohnung','Demo Immobilien AG','booked','system','demo-story:rent:'||v_salary_date::text,v_rent_merchant,p_user_id,v_rent_rule),
      (v_household,v_account,v_health_cat,(v_month+2)::timestamp+time '08:00',-451.20,'CHF','Krankenkasse','Sanitas','booked','system','demo-story:health:'||v_salary_date::text,v_health_merchant,p_user_id,v_health_rule),
      (v_household,v_account,v_food_cat,(v_month+5)::timestamp+time '12:00',-168.40,'CHF','Migros Einkauf','Migros','booked','system','demo-story:migros-a:'||v_salary_date::text,v_migros,p_user_id,null),
      (v_household,v_account,v_mobility_cat,(v_month+8)::timestamp+time '18:00',-72.60,'CHF','SBB Mobile','SBB','booked','system','demo-story:sbb:'||v_salary_date::text,v_sbb,p_user_id,null),
      (v_household,v_account,v_rest_cat,(v_month+11)::timestamp+time '19:00',-58.90,'CHF','McDonald''s','McDonald''s','booked','system','demo-story:mcd:'||v_salary_date::text,v_mcd,p_user_id,null),
      (v_household,v_account,v_food_cat,(v_month+15)::timestamp+time '17:00',-132.75,'CHF','Migros Einkauf','Migros','booked','system','demo-story:migros-b:'||v_salary_date::text,v_migros,p_user_id,null),
      (v_household,v_account,v_sub_cat,(v_month+18)::timestamp+time '08:00',-59,'CHF','Mobilabo','Sunrise / Yallo','booked','system','demo-story:mobile:'||v_salary_date::text,v_sunrise,p_user_id,v_mobile_rule),
      (v_household,v_account,v_sub_cat,(v_month+20)::timestamp+time '08:00',-19.90,'CHF','Netflix','Netflix','booked','system','demo-story:netflix:'||v_salary_date::text,v_netflix,p_user_id,v_netflix_rule);
  end loop;

  update public.savings_goals
  set current_amount=case when name='Notgroschen' then 15000 when name='Ferien Italien' then 1800 else current_amount end,
      start_date=case when name='Notgroschen' then '2026-09-25'::date when name='Ferien Italien' then '2026-10-25'::date else start_date end,
      duration_months=case when name='Notgroschen' then 18 when name='Ferien Italien' then 8 else duration_months end,
      target_date=case when name='Notgroschen' then '2028-03-24'::date when name='Ferien Italien' then '2027-06-24'::date else target_date end,
      updated_at=now()
  where household_id=v_household and name in ('Notgroschen','Ferien Italien');

  if not exists(select 1 from public.savings_goals where household_id=v_household and name='Neues Auto') then
    insert into public.savings_goals(
      household_id,name,target_amount,current_amount,monthly_amount,currency,target_date,goal_type,status,notes,created_by,start_date,duration_months
    ) values (
      v_household,'Neues Auto',25000,3500,350,'CHF','2030-12-31','custom','active',
      'Langfristiges Ziel – zeigt die Planung über mehrere Jahre.',p_user_id,'2027-01-01',48
    );
  end if;

  update public.debts
  set original_amount=18000,outstanding_amount=9600,installment_amount=420,payment_cadence='monthly',
      start_date='2025-10-08',term_months=36,end_date='2028-10-07',next_payment_date='2026-11-05',updated_at=now()
  where household_id=v_household and name='Autoleasing';

  update public.budgets
  set amount=case
    when category_id=v_food_cat then greatest(amount,900)
    when category_id=v_rest_cat then greatest(amount,450)
    when category_id=v_mobility_cat then greatest(amount,350)
    else amount end,
    updated_at=now()
  where household_id=v_household and month_start='2026-09-01';

  return jsonb_build_object(
    'ok',true,'household_id',v_household,
    'story_transactions',(select count(*) from public.transactions where household_id=v_household and source='system' and external_reference like 'demo-story:%'),
    'positive_accounts',(select count(*) from public.accounts where household_id=v_household and balance_anchor_amount>=0 and not is_archived)
  );
end;
$function$


revoke all on function public.enrich_demo_instance_v1(uuid) from public, anon, authenticated;
grant execute on function public.enrich_demo_instance_v1(uuid) to service_role;
