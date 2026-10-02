
create table if not exists public.tax_people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  person_no integer not null check (person_no between 1 and 2),
  role text not null default 'taxpayer' check (role in ('taxpayer','partner')),
  first_name text not null,
  last_name text not null,
  birth_date date,
  address_line text,
  postal_code text,
  city text,
  country_code text not null default 'CH',
  move_in_date date,
  move_out_date date,
  marital_status text,
  denomination text,
  occupation text,
  employment_type text check (employment_type in ('employee','self_employed','not_employed','retired','other')),
  employer_name text,
  joint_taxation boolean not null default false,
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tax_case_id,person_no)
);

create table if not exists public.tax_children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  residence_country text not null default 'CH',
  residence_city text,
  custody text,
  parental_authority text,
  education_status text not null default 'none'
    check (education_status in ('none','preschool','school','vocational','higher','other')),
  school_or_training text,
  training_end date,
  maintenance_paid numeric(16,2) not null default 0,
  maintenance_received numeric(16,2) not null default 0,
  childcare_costs numeric(16,2) not null default 0,
  assets_value numeric(16,2) not null default 0,
  currency text not null default 'CHF',
  assignment_status text not null default 'review'
    check (assignment_status in ('confirmed','review','unresolved')),
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_employments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  tax_person_id uuid references public.tax_people(id) on delete set null,
  employer_name text not null,
  work_location text,
  period_from date,
  period_to date,
  gross_income numeric(16,2),
  net_income numeric(16,2),
  withholding_tax numeric(16,2) not null default 0,
  bonus numeric(16,2) not null default 0,
  commission numeric(16,2) not null default 0,
  board_fees numeric(16,2) not null default 0,
  currency text not null default 'CHF',
  work_days integer not null default 0 check (work_days>=0),
  homeoffice_days integer not null default 0 check (homeoffice_days>=0),
  vacation_days integer not null default 0 check (vacation_days>=0),
  sick_days integer not null default 0 check (sick_days>=0),
  field_service_days integer not null default 0 check (field_service_days>=0),
  commuting_distance_km numeric(10,2) not null default 0 check (commuting_distance_km>=0),
  transport_mode text,
  subsidized_meals boolean,
  weekly_resident boolean not null default false,
  lodging_cost numeric(16,2) not null default 0,
  home_trip_cost numeric(16,2) not null default 0,
  continuing_education_cost numeric(16,2) not null default 0,
  employer_contribution numeric(16,2) not null default 0,
  work_equipment_cost numeric(16,2) not null default 0,
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_people_case_idx on public.tax_people(tax_case_id,person_no);
create index if not exists tax_children_case_idx on public.tax_children(tax_case_id,birth_date);
create index if not exists tax_employments_case_idx on public.tax_employments(tax_case_id,period_from);

alter table public.tax_people enable row level security;
alter table public.tax_children enable row level security;
alter table public.tax_employments enable row level security;

drop policy if exists tax_people_read on public.tax_people;
create policy tax_people_read on public.tax_people for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_people_write on public.tax_people;
create policy tax_people_write on public.tax_people for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_children_read on public.tax_children;
create policy tax_children_read on public.tax_children for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_children_write on public.tax_children;
create policy tax_children_write on public.tax_children for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_employments_read on public.tax_employments;
create policy tax_employments_read on public.tax_employments for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_employments_write on public.tax_employments;
create policy tax_employments_write on public.tax_employments for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

grant select,insert,update,delete on public.tax_people,public.tax_children,public.tax_employments to authenticated;

drop trigger if exists tax_people_set_updated_at on public.tax_people;
create trigger tax_people_set_updated_at before update on public.tax_people for each row execute function private.set_updated_at();
drop trigger if exists tax_children_set_updated_at on public.tax_children;
create trigger tax_children_set_updated_at before update on public.tax_children for each row execute function private.set_updated_at();
drop trigger if exists tax_employments_set_updated_at on public.tax_employments;
create trigger tax_employments_set_updated_at before update on public.tax_employments for each row execute function private.set_updated_at();

drop trigger if exists tax_people_validate_case on public.tax_people;
create trigger tax_people_validate_case before insert or update on public.tax_people
for each row execute function private.validate_tax_child_link();
drop trigger if exists tax_children_validate_case on public.tax_children;
create trigger tax_children_validate_case before insert or update on public.tax_children
for each row execute function private.validate_tax_child_link();
drop trigger if exists tax_employments_validate_case on public.tax_employments;
create trigger tax_employments_validate_case before insert or update on public.tax_employments
for each row execute function private.validate_tax_child_link();

create or replace function private.validate_tax_employment_person()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_person public.tax_people%rowtype;
  v_doc public.documents%rowtype;
begin
  if new.tax_person_id is not null then
    select * into v_person from public.tax_people where id=new.tax_person_id;
    if not found or v_person.household_id<>new.household_id or v_person.tax_case_id<>new.tax_case_id then
      raise exception 'Arbeitsstelle und Person gehören nicht zum selben Steuerfall.';
    end if;
  end if;
  if new.document_id is not null then
    select * into v_doc from public.documents where id=new.document_id;
    if not found or v_doc.household_id<>new.household_id then
      raise exception 'Lohnausweis gehört nicht zum Steuerhaushalt.';
    end if;
  end if;
  if new.homeoffice_days+new.vacation_days+new.sick_days+new.field_service_days>new.work_days then
    raise exception 'Homeoffice, Ferien, Krankheit und Aussendienst dürfen zusammen die Arbeitstage nicht überschreiten.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_tax_employment_person() from public,anon,authenticated;

drop trigger if exists tax_employments_validate_person on public.tax_employments;
create trigger tax_employments_validate_person before insert or update on public.tax_employments
for each row execute function private.validate_tax_employment_person();
