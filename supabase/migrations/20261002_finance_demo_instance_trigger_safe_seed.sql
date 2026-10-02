create table if not exists public.demo_instances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null unique references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  reset_at timestamptz not null default now()
);

alter table public.demo_instances enable row level security;
revoke all on public.demo_instances from anon, authenticated;

create or replace function public.provision_demo_instance(
  p_user_id uuid,
  p_locale text default 'de-CH'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  v_old_household uuid;
  v_household uuid;
  v_month date := date_trunc('month', current_date)::date;
  v_hist_month date;
  v_next_salary date;
  v_next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_acc_checking uuid; v_acc_savings uuid; v_acc_eur uuid; v_acc_cash uuid; v_acc_card uuid;
  v_cat_salary uuid; v_cat_home uuid; v_cat_food uuid; v_cat_health uuid; v_cat_mobility uuid;
  v_cat_leisure uuid; v_cat_restaurant uuid; v_cat_contracts uuid; v_cat_shopping uuid;
  v_cat_tax uuid; v_cat_saving uuid; v_cat_other uuid;
  v_merchant_migros uuid; v_merchant_coop uuid; v_merchant_sbb uuid; v_merchant_sanitas uuid;
  v_merchant_netflix uuid; v_merchant_sunrise uuid; v_merchant_mcd uuid; v_merchant_landlord uuid; v_merchant_power uuid;
  v_import uuid; v_transfer uuid; v_goal uuid; v_debt uuid; v_receivable uuid; v_case uuid; v_investment uuid; v_salary_rule uuid; v_paid_bill_tx uuid;
  i integer;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Demo-Benutzer wurde nicht gefunden.';
  end if;
  if p_locale not in ('de-CH','de-DE','it-CH','it-IT','en-CH','en-GB') then p_locale := 'de-CH'; end if;

  select household_id into v_old_household from public.demo_instances where user_id = p_user_id;
  if v_old_household is not null then delete from public.households where id = v_old_household; end if;

  update public.profiles
  set display_name='Finance Demo',country_code='CH',base_currency='CHF',locale=p_locale,
      onboarding_completed_at=now(),preferences='{}'::jsonb,updated_at=now()
  where user_id=p_user_id;
  if not found then
    insert into public.profiles(user_id,display_name,country_code,base_currency,locale,onboarding_completed_at,preferences)
    values(p_user_id,'Finance Demo','CH','CHF',p_locale,now(),'{}'::jsonb);
  end if;

  insert into public.households(name,owner_user_id,country_code,base_currency,tax_region_code)
  values('Demo Haushalt',p_user_id,'CH','CHF','SG') returning id into v_household;
  insert into public.demo_instances(user_id,household_id,reset_at)
  values(p_user_id,v_household,now())
  on conflict (user_id) do update set household_id=excluded.household_id,reset_at=excluded.reset_at;
  insert into public.household_members(household_id,user_id,role)
  values(v_household,p_user_id,'owner')
  on conflict (household_id,user_id) do update set role='owner';

  insert into public.user_module_access(user_id,module_key,enabled)
  select p_user_id,key,true from public.product_modules where is_available=true
  on conflict (user_id,module_key) do update set enabled=true,updated_at=now();

  insert into public.categories(household_id,name,kind,sort_order,created_by)
  select v_household,name,kind,sort_order,p_user_id
  from public.country_category_catalog where country_code='CH' and active=true order by kind,sort_order,name;

  insert into public.merchants(household_id,name,normalized_key,default_category_id,created_by)
  select v_household,m.name,m.normalized_key,c.id,p_user_id
  from public.country_merchant_catalog m
  left join public.country_category_catalog cc on cc.id=m.category_catalog_id
  left join public.categories c on c.household_id=v_household and c.kind=cc.kind and lower(trim(c.name))=lower(trim(cc.name))
  where m.country_code='CH' and m.active=true order by m.name;

  select id into v_cat_salary from public.categories where household_id=v_household and name='Lohn' limit 1;
  select id into v_cat_home from public.categories where household_id=v_household and name='Wohnen' limit 1;
  select id into v_cat_food from public.categories where household_id=v_household and name='Lebensmittel' limit 1;
  select id into v_cat_health from public.categories where household_id=v_household and name='Krankenkasse' limit 1;
  select id into v_cat_mobility from public.categories where household_id=v_household and name='Mobilität' limit 1;
  select id into v_cat_leisure from public.categories where household_id=v_household and name='Freizeit' limit 1;
  select id into v_cat_restaurant from public.categories where household_id=v_household and name='Restaurant' limit 1;
  select id into v_cat_contracts from public.categories where household_id=v_household and name='Abos & Verträge' limit 1;
  select id into v_cat_shopping from public.categories where household_id=v_household and name='Shopping' limit 1;
  select id into v_cat_tax from public.categories where household_id=v_household and name='Steuern' limit 1;
  select id into v_cat_saving from public.categories where household_id=v_household and name='Sparen' limit 1;
  select id into v_cat_other from public.categories where household_id=v_household and name='Sonstiges' limit 1;

  insert into public.merchants(household_id,name,normalized_key,default_category_id,created_by)
  values
    (v_household,'Demo Immobilien AG','demo immobilien ag',v_cat_home,p_user_id),
    (v_household,'Stadtwerke Demo','stadtwerke demo',v_cat_home,p_user_id)
  on conflict (household_id,normalized_key) do nothing;

  select id into v_merchant_migros from public.merchants where household_id=v_household and normalized_key='migros' limit 1;
  select id into v_merchant_coop from public.merchants where household_id=v_household and normalized_key='coop' limit 1;
  select id into v_merchant_sbb from public.merchants where household_id=v_household and normalized_key='sbb' limit 1;
  select id into v_merchant_sanitas from public.merchants where household_id=v_household and normalized_key='sanitas' limit 1;
  select id into v_merchant_netflix from public.merchants where household_id=v_household and normalized_key='netflix' limit 1;
  select id into v_merchant_sunrise from public.merchants where household_id=v_household and normalized_key='sunrise yallo' limit 1;
  select id into v_merchant_mcd from public.merchants where household_id=v_household and normalized_key='mcdonalds' limit 1;
  select id into v_merchant_landlord from public.merchants where household_id=v_household and normalized_key='demo immobilien ag' limit 1;
  select id into v_merchant_power from public.merchants where household_id=v_household and normalized_key='stadtwerke demo' limit 1;

  insert into public.accounts(household_id,name,account_type,institution_name,currency,balance_anchor_amount,balance_anchor_at,sort_order,created_by,visibility,owner_user_id)
  values(v_household,'Lohnkonto','checking','UBS','CHF',8450.35,now(),10,p_user_id,'household',p_user_id) returning id into v_acc_checking;
  insert into public.accounts(household_id,name,account_type,institution_name,currency,balance_anchor_amount,balance_anchor_at,sort_order,created_by,visibility,owner_user_id)
  values(v_household,'Notgroschen','savings','UBS','CHF',12500,now(),20,p_user_id,'household',p_user_id) returning id into v_acc_savings;
  insert into public.accounts(household_id,name,account_type,institution_name,currency,balance_anchor_amount,balance_anchor_at,sort_order,created_by,visibility,owner_user_id)
  values(v_household,'Revolut EUR','wallet','Revolut','EUR',950.40,now(),30,p_user_id,'household',p_user_id) returning id into v_acc_eur;
  insert into public.accounts(household_id,name,account_type,institution_name,currency,balance_anchor_amount,balance_anchor_at,sort_order,created_by,visibility,owner_user_id)
  values(v_household,'Bargeld','cash','Manuell','CHF',320,now(),40,p_user_id,'private',p_user_id) returning id into v_acc_cash;
  insert into public.accounts(household_id,name,account_type,institution_name,currency,balance_anchor_amount,balance_anchor_at,sort_order,created_by,visibility,owner_user_id)
  values(v_household,'Kreditkarte','credit_card','Demo Card','CHF',-642.80,now(),50,p_user_id,'household',p_user_id) returning id into v_acc_card;

  insert into public.import_batches(household_id,account_id,file_name,row_count,imported_count,skipped_count,status,created_by,created_at)
  values(v_household,v_acc_checking,'UBS_Demo_September.csv',24,22,2,'completed',p_user_id,now()-interval '15 days') returning id into v_import;

  for i in 1..3 loop
    v_hist_month := (v_month - make_interval(months=>i))::date;
    insert into public.transactions(household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,status,source,external_reference,created_by,merchant_id,import_batch_id)
    values
      (v_household,v_acc_checking,v_cat_salary,(v_hist_month+24)::timestamptz,6500,'CHF','Lohn Demo AG','Demo AG','booked','import',format('demo-%s-salary',i),p_user_id,null,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_home,(v_hist_month+0)::timestamptz,-1850,'CHF','Miete Demo Wohnung','Demo Immobilien AG','booked','import',format('demo-%s-rent',i),p_user_id,v_merchant_landlord,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_health,(v_hist_month+1)::timestamptz,-451.20,'CHF','Krankenkasse','Sanitas','booked','import',format('demo-%s-health',i),p_user_id,v_merchant_sanitas,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_food,(v_hist_month+4)::timestamptz,-126.40,'CHF','Wocheneinkauf','Migros','booked','import',format('demo-%s-food1',i),p_user_id,v_merchant_migros,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_food,(v_hist_month+11)::timestamptz,-94.85,'CHF','Wocheneinkauf','Coop','booked','import',format('demo-%s-food2',i),p_user_id,v_merchant_coop,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_food,(v_hist_month+18)::timestamptz,-138.70,'CHF','Wocheneinkauf','Migros','booked','import',format('demo-%s-food3',i),p_user_id,v_merchant_migros,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_mobility,(v_hist_month+7)::timestamptz,-74,'CHF','SBB Mobile','SBB','booked','import',format('demo-%s-sbb',i),p_user_id,v_merchant_sbb,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_restaurant,(v_hist_month+14)::timestamptz,-78.50,'CHF','Abendessen','McDonald''s','booked','import',format('demo-%s-foodout',i),p_user_id,v_merchant_mcd,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_contracts,(v_hist_month+10)::timestamptz,-19.90,'CHF','Netflix','Netflix','booked','import',format('demo-%s-netflix',i),p_user_id,v_merchant_netflix,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_contracts,(v_hist_month+5)::timestamptz,-59,'CHF','Mobilabo','Sunrise','booked','import',format('demo-%s-mobile',i),p_user_id,v_merchant_sunrise,case when i=1 then v_import else null end),
      (v_household,v_acc_checking,v_cat_leisure,(v_hist_month+20)::timestamptz,-145,'CHF','Freizeit Wochenende',null,'booked','manual',format('demo-%s-leisure',i),p_user_id,null,null);
  end loop;

  insert into public.transactions(household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,status,source,external_reference,created_by,merchant_id)
  values
    (v_household,v_acc_checking,v_cat_home,(v_month+0)::timestamptz,-1850,'CHF','Miete Demo Wohnung','Demo Immobilien AG','booked','manual','demo-current-rent',p_user_id,v_merchant_landlord),
    (v_household,v_acc_checking,v_cat_food,current_date::timestamptz,-86.40,'CHF','Einkauf','Coop','booked','manual','demo-current-coop',p_user_id,v_merchant_coop),
    (v_household,v_acc_checking,v_cat_mobility,current_date::timestamptz,-32,'CHF','SBB Mobile','SBB','booked','manual','demo-current-sbb',p_user_id,v_merchant_sbb),
    (v_household,v_acc_card,v_cat_restaurant,current_date::timestamptz,-74.50,'CHF','Restaurant Demo',null,'booked','manual','demo-current-restaurant',p_user_id,null),
    (v_household,v_acc_eur,v_cat_leisure,(current_date-1)::timestamptz,-118.40,'EUR','Hotel Italien',null,'booked','manual','demo-current-eur',p_user_id,null);

  insert into public.transactions(household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,status,source,external_reference,created_by)
  values(v_household,v_acc_checking,v_cat_shopping,(current_date-20)::timestamptz,-95,'CHF','Online-Bestellung','Demo Shop','booked','manual','demo-paid-bill',p_user_id)
  returning id into v_paid_bill_tx;

  v_transfer := gen_random_uuid();
  insert into public.transactions(household_id,account_id,occurred_at,amount,currency,description,counterparty,status,source,transfer_group_id,external_reference,created_by)
  values
    (v_household,v_acc_checking,(v_month-5)::timestamptz,-500,'CHF','Umbuchung Notgroschen','Notgroschen','booked','system',v_transfer,'demo-transfer-out',p_user_id),
    (v_household,v_acc_savings,(v_month-5)::timestamptz,500,'CHF','Umbuchung Notgroschen','Lohnkonto','booked','system',v_transfer,'demo-transfer-in',p_user_id);

  insert into public.categorization_rules(household_id,category_id,field_name,match_type,match_value,priority,active,created_by)
  values(v_household,v_cat_mobility,'description','contains','SBB',10,true,p_user_id),(v_household,v_cat_food,'counterparty','contains','Migros',20,true,p_user_id);

  v_next_salary := case when current_date <= v_month+24 then v_month+24 else v_next_month+24 end;
  insert into public.recurring_rules(household_id,account_id,category_id,direction,description,counterparty,amount,currency,cadence,next_date,active,created_by,merchant_id)
  values(v_household,v_acc_checking,v_cat_salary,'income','Lohn Demo AG','Demo AG',6500,'CHF','monthly',v_next_salary,true,p_user_id,null) returning id into v_salary_rule;
  insert into public.recurring_rules(household_id,account_id,category_id,direction,description,counterparty,amount,currency,cadence,next_date,active,created_by,merchant_id)
  values
    (v_household,v_acc_checking,v_cat_home,'expense','Miete Demo Wohnung','Demo Immobilien AG',1850,'CHF','monthly',v_next_month,true,p_user_id,v_merchant_landlord),
    (v_household,v_acc_checking,v_cat_health,'expense','Krankenkasse','Sanitas',451.20,'CHF','monthly',v_next_month,true,p_user_id,v_merchant_sanitas),
    (v_household,v_acc_checking,v_cat_contracts,'expense','Mobilabo','Sunrise',59,'CHF','monthly',v_next_month+4,true,p_user_id,v_merchant_sunrise),
    (v_household,v_acc_checking,v_cat_contracts,'expense','Netflix','Netflix',19.90,'CHF','monthly',v_next_month+11,true,p_user_id,v_merchant_netflix);
  insert into public.recurring_rules(household_id,account_id,category_id,direction,description,counterparty,amount,currency,cadence,next_date,active,created_by,destination_account_id)
  values(v_household,v_acc_checking,v_cat_saving,'transfer','Notgroschen sparen','Notgroschen',500,'CHF','monthly',v_next_salary,true,p_user_id,v_acc_savings);

  insert into public.budgets(household_id,category_id,month_start,amount,notes,created_by)
  values(v_household,v_cat_food,v_month,900,'Demo Lebensmittelbudget',p_user_id),(v_household,v_cat_restaurant,v_month,250,'Demo Restaurantbudget',p_user_id),(v_household,v_cat_mobility,v_month,350,'Demo Mobilitätsbudget',p_user_id),(v_household,v_cat_leisure,v_month,450,'Demo Freizeitbudget',p_user_id);

  insert into public.bills(household_id,account_id,category_id,name,provider,amount,currency,due_date,status,reference,notes,created_by)
  values
    (v_household,v_acc_checking,v_cat_home,'Stromrechnung','Stadtwerke Demo',174.80,'CHF',current_date+7,'open','DEMO-STROM-01','Offene Demo-Rechnung',p_user_id),
    (v_household,v_acc_checking,v_cat_health,'Zahnarztrechnung','Praxis Demo',380,'CHF',current_date-3,'overdue','DEMO-ZAHN-01','Überfällige Demo-Rechnung',p_user_id);

  insert into public.bills(household_id,account_id,category_id,name,provider,amount,currency,due_date,status,reference,notes,created_by,paid_transaction_id,paid_at,payment_source)
  values(v_household,v_acc_checking,v_cat_shopping,'Online-Bestellung','Demo Shop',95,'CHF',current_date-20,'paid','DEMO-SHOP-01','Bereits bezahlt',p_user_id,v_paid_bill_tx,current_date-20,'linked_transaction');

  insert into public.contracts(household_id,category_id,name,provider,contract_type,amount,currency,billing_cadence,start_date,cancellation_notice_days,next_payment_date,status,notes,created_by,account_id)
  values
    (v_household,v_cat_contracts,'Mobilabo','Sunrise','subscription',59,'CHF','monthly',current_date-interval '18 months',30,v_next_month+4,'active','Demo Vertrag',p_user_id,v_acc_checking),
    (v_household,v_cat_contracts,'Streaming','Netflix','subscription',19.90,'CHF','monthly',current_date-interval '10 months',30,v_next_month+11,'active','Demo Abo',p_user_id,v_acc_checking),
    (v_household,v_cat_leisure,'Fitness','Demo Fitness','membership',720,'CHF','annual',current_date-interval '4 months',60,(current_date+interval '8 months')::date,'active','Jährliche Mitgliedschaft',p_user_id,v_acc_checking);

  insert into public.savings_goals(household_id,name,target_amount,current_amount,monthly_amount,currency,target_date,goal_type,status,notes,created_by,account_id)
  values(v_household,'Notgroschen',20000,12500,500,'CHF',(current_date+interval '12 months')::date,'emergency','active','Mit echtem Spar-Topf verknüpft',p_user_id,v_acc_savings) returning id into v_goal;
  insert into public.savings_goals(household_id,name,target_amount,current_amount,monthly_amount,currency,target_date,goal_type,status,notes,created_by)
  values(v_household,'Ferien Italien',4000,1200,250,'CHF',(current_date+interval '8 months')::date,'holiday','active','Demo Sparziel',p_user_id);

  insert into public.debts(household_id,debt_type,creditor,name,original_amount,outstanding_amount,currency,interest_rate,installment_amount,payment_cadence,next_payment_date,start_date,end_date,status,notes,created_by,payment_account_id)
  values(v_household,'leasing','Demo Leasing AG','Autoleasing',18000,12800,'CHF',3.9,420,'monthly',v_next_month+4,current_date-interval '12 months',current_date+interval '30 months','active','Demo Finanzierung',p_user_id,v_acc_checking) returning id into v_debt;
  insert into public.receivables(household_id,debtor,reason,original_amount,outstanding_amount,currency,lent_at,due_date,status,notes,created_by)
  values(v_household,'Marco Bianchi','Ferien vorgestreckt',600,350,'CHF',(current_date-interval '45 days')::date,current_date+14,'partial','Demo Forderung',p_user_id) returning id into v_receivable;
  insert into public.legal_cases(household_id,country_code,case_type,creditor,reference,original_amount,outstanding_amount,currency,status,next_action_date,notes,created_by)
  values(v_household,'CH','reminder','Demo Forderung GmbH','DEMO-MAHN-01',420,180,'CHF','open',current_date+7,'Beispiel für Mahnprozess',p_user_id) returning id into v_case;
  insert into public.legal_case_events(case_id,household_id,event_date,event_type,title,notes,created_by)
  values(v_case,v_household,current_date-14,'created','Fall eröffnet','Demo Timeline',p_user_id),(v_case,v_household,current_date-5,'reminder_sent','Mahnung versendet','Nächste Aktion in einer Woche',p_user_id);

  insert into public.assets(household_id,asset_type,name,current_value,currency,acquired_date,notes,created_by)
  values(v_household,'valuable','Uhrensammlung',4500,'CHF',(current_date-interval '2 years')::date,'Demo Sachwert',p_user_id),(v_household,'cash_other','Mietdepot',4500,'CHF',(current_date-interval '3 years')::date,'Demo Geldvermögen',p_user_id);
  insert into public.properties(household_id,name,property_type,current_value,currency,purchase_date,purchase_price,monthly_running_cost,renovation_reserve,notes,created_by)
  values(v_household,'Eigentumswohnung Demo','apartment',650000,'CHF',(current_date-interval '5 years')::date,580000,780,20000,'Demo Immobilie',p_user_id);
  insert into public.vehicles(household_id,name,vehicle_type,current_value,currency,purchase_date,purchase_price,monthly_cost,notes,created_by,odometer_km,license_plate)
  values(v_household,'VW Golf Demo','car',22000,'CHF',(current_date-interval '2 years')::date,31000,430,'Demo Fahrzeug',p_user_id,38500,'SG 123456');

  insert into public.insurance_policies(household_id,name,provider,policy_type,premium_amount,currency,billing_cadence,start_date,cancellation_notice_days,next_payment_date,status,notes,created_by,policy_number,account_id,category_id)
  values
    (v_household,'Hausrat & Haftpflicht','AXA Demo','Hausrat / Haftpflicht',420,'CHF','annual',current_date-interval '2 years',90,(current_date+interval '5 months')::date,'active','Demo Police',p_user_id,'DEMO-AXA-001',v_acc_checking,v_cat_contracts),
    (v_household,'Reiseversicherung','Allianz Demo','Reise',168,'CHF','annual',current_date-interval '1 year',60,(current_date+interval '3 months')::date,'active','Demo Police',p_user_id,'DEMO-ALL-002',v_acc_checking,v_cat_contracts);

  insert into public.investments(household_id,name,investment_type,symbol,quantity,cost_basis,current_value,currency,provider,notes,created_by)
  values(v_household,'Vanguard FTSE All-World','etf','VWRL',35.2,8900,9800,'CHF','Swissquote Demo','Demo ETF Position',p_user_id) returning id into v_investment;
  insert into public.investment_transactions(investment_id,household_id,trade_date,side,quantity,unit_price,fees,currency,realized_gain,notes,created_by)
  values(v_investment,v_household,(current_date-interval '18 months')::date,'buy',35.2,252.40,15,'CHF',0,'Demo Kauf',p_user_id);

  insert into public.pension_accounts(household_id,country_code,pension_type,provider,name,current_value,currency,annual_contribution,notes,created_by)
  values(v_household,'CH','pillar_3a','VIAC Demo','Säule 3a',31500,'CHF',7056,'Demo Vorsorgeposition',p_user_id),(v_household,'CH','pension_fund','Pensionskasse Demo','Pensionskasse',86500,'CHF',9600,'Demo Pensionskasse',p_user_id);

  insert into public.documents(household_id,object_type,object_id,name,storage_path,mime_type,file_size,document_date,notes,created_by,tax_relevant,tax_year,tax_category)
  values
    (v_household,null,null,'Demo Steuerbeleg Krankenkasse.pdf',null,'application/pdf',0,current_date-30,'Beispieldokument ohne echte Datei',p_user_id,true,extract(year from current_date)::integer,'Krankheitskosten'),
    (v_household,'insurance',null,'Demo Versicherungspolice.pdf',null,'application/pdf',0,current_date-60,'Beispieldokument ohne echte Datei',p_user_id,false,null,null);

  return jsonb_build_object('ok',true,'user_id',p_user_id,'household_id',v_household,'household_name','Demo Haushalt','locale',p_locale);
end;
$$;

revoke all on function public.provision_demo_instance(uuid,text) from public, anon, authenticated;
grant execute on function public.provision_demo_instance(uuid,text) to service_role;

comment on table public.demo_instances is 'Tracks isolated synthetic demo tenants created by the admin demo provisioner.';
comment on function public.provision_demo_instance(uuid,text) is 'Rebuilds a fully synthetic CH demo household for a dedicated demo auth user. Service-role only.';
