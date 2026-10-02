
create or replace function private.seed_demo_tax_people_work(
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
  v_person_2025 uuid;
  v_person_2026 uuid;
begin
  select id into v_case_2025 from public.tax_cases where household_id=p_household_id and tax_year=2025 and country_code='CH' and canton_code='SG' limit 1;
  select id into v_case_2026 from public.tax_cases where household_id=p_household_id and tax_year=2026 and country_code='CH' and canton_code='SG' limit 1;

  if v_case_2025 is not null then
    insert into public.tax_people(
      household_id,tax_case_id,person_no,role,first_name,last_name,birth_date,address_line,postal_code,city,country_code,
      marital_status,denomination,occupation,employment_type,employer_name,joint_taxation,notes,created_by
    )
    values(
      p_household_id,v_case_2025,1,'taxpayer','Demo','Person',date '1988-05-12','Musterstrasse 10','9000','St. Gallen','CH',
      'ledig','konfessionslos','Solution Expert','employee','Demo AG',false,'Synthetische Demo-Person',p_user_id
    )
    on conflict(tax_case_id,person_no) do update set first_name=excluded.first_name,last_name=excluded.last_name
    returning id into v_person_2025;

    if not exists(select 1 from public.tax_employments where tax_case_id=v_case_2025 and employer_name='Demo AG') then
      insert into public.tax_employments(
        household_id,tax_case_id,tax_person_id,employer_name,work_location,period_from,period_to,
        gross_income,net_income,currency,work_days,homeoffice_days,vacation_days,sick_days,field_service_days,
        commuting_distance_km,transport_mode,subsidized_meals,weekly_resident,continuing_education_cost,employer_contribution,work_equipment_cost,notes,created_by
      ) values(
        p_household_id,v_case_2025,v_person_2025,'Demo AG','St. Gallen',date '2025-01-01',date '2025-12-31',
        78000,63500,'CHF',220,40,25,3,12,8.4,'ÖV',false,false,1200,600,450,'Synthetische Arbeitsstelle',p_user_id
      );
    end if;

    if not exists(select 1 from public.tax_children where tax_case_id=v_case_2025 and first_name='Demo-Kind') then
      insert into public.tax_children(
        household_id,tax_case_id,first_name,last_name,birth_date,residence_country,residence_city,custody,parental_authority,
        education_status,school_or_training,training_end,maintenance_paid,maintenance_received,childcare_costs,assets_value,
        currency,assignment_status,notes,created_by
      ) values(
        p_household_id,v_case_2025,'Demo-Kind','Muster',date '2015-04-22','CH','St. Gallen','gemeinsam','gemeinsam',
        'school','Primarschule Demo',date '2027-07-31',0,0,1800,500,'CHF','review','Synthetischer Kinderfall',p_user_id
      );
    end if;
  end if;

  if v_case_2026 is not null then
    insert into public.tax_people(
      household_id,tax_case_id,person_no,role,first_name,last_name,birth_date,address_line,postal_code,city,country_code,
      marital_status,denomination,occupation,employment_type,employer_name,joint_taxation,notes,created_by
    )
    values(
      p_household_id,v_case_2026,1,'taxpayer','Demo','Person',date '1988-05-12','Musterstrasse 10','9000','St. Gallen','CH',
      'ledig','konfessionslos','Solution Expert','employee','Demo AG',false,'Synthetische Demo-Person',p_user_id
    )
    on conflict(tax_case_id,person_no) do update set first_name=excluded.first_name,last_name=excluded.last_name
    returning id into v_person_2026;

    if not exists(select 1 from public.tax_employments where tax_case_id=v_case_2026 and employer_name='Demo AG') then
      insert into public.tax_employments(
        household_id,tax_case_id,tax_person_id,employer_name,work_location,period_from,period_to,
        gross_income,net_income,currency,work_days,homeoffice_days,vacation_days,sick_days,field_service_days,
        commuting_distance_km,transport_mode,subsidized_meals,weekly_resident,continuing_education_cost,employer_contribution,work_equipment_cost,notes,created_by
      ) values(
        p_household_id,v_case_2026,v_person_2026,'Demo AG','St. Gallen',date '2026-01-01',date '2026-12-31',
        78000,63500,'CHF',220,55,25,2,10,8.4,'ÖV',false,false,900,450,320,'Synthetische Arbeitsstelle',p_user_id
      );
    end if;

    if not exists(select 1 from public.tax_children where tax_case_id=v_case_2026 and first_name='Demo-Kind') then
      insert into public.tax_children(
        household_id,tax_case_id,first_name,last_name,birth_date,residence_country,residence_city,custody,parental_authority,
        education_status,school_or_training,training_end,maintenance_paid,maintenance_received,childcare_costs,assets_value,
        currency,assignment_status,notes,created_by
      ) values(
        p_household_id,v_case_2026,'Demo-Kind','Muster',date '2015-04-22','CH','St. Gallen','gemeinsam','gemeinsam',
        'school','Primarschule Demo',date '2027-07-31',0,0,1600,650,'CHF','review','Synthetischer Kinderfall',p_user_id
      );
    end if;
  end if;
end;
$$;

revoke all on function private.seed_demo_tax_people_work(uuid,uuid) from public,anon,authenticated;

create or replace function private.seed_demo_tax_people_work_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.seed_demo_tax_people_work(new.household_id,new.user_id);
  return new;
end;
$$;

revoke all on function private.seed_demo_tax_people_work_trigger() from public,anon,authenticated;

drop trigger if exists demo_instances_seed_tax_people_z on public.demo_instances;
create trigger demo_instances_seed_tax_people_z
after insert or update of household_id on public.demo_instances
for each row execute function private.seed_demo_tax_people_work_trigger();

do $$
declare r record;
begin
  for r in select user_id,household_id from public.demo_instances loop
    perform private.seed_demo_tax_people_work(r.household_id,r.user_id);
  end loop;
end $$;
