create table if not exists public.tax_rule_versions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  canton_code text not null,
  tax_year integer not null check (tax_year between 2000 and 2100),
  version text not null unique,
  status text not null check (status in ('official','partial','pending','retired')),
  source_url text,
  notes text,
  published_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code,canton_code,tax_year)
);

create table if not exists public.tax_cases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2100),
  country_code text not null default 'CH',
  canton_code text not null default 'SG',
  municipality text,
  tax_period_from date,
  tax_period_to date,
  marital_status text,
  denomination text,
  registry_number text,
  tax_advisor text,
  status text not null default 'open'
    check (status in ('open','collecting','complete','exported','filed','assessed','final')),
  rule_version_id uuid references public.tax_rule_versions(id) on delete set null,
  expected_tax_amount numeric(16,2),
  assessed_tax_amount numeric(16,2),
  currency text not null default 'CHF',
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id,tax_year,country_code,canton_code)
);

create table if not exists public.tax_case_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  section_key text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','complete','review','not_applicable')),
  notes text,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tax_case_id,section_key)
);

create table if not exists public.tax_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  section_key text not null,
  item_type text not null default 'manual',
  title text not null,
  person_label text,
  country_code text not null default 'CH',
  canton_code text,
  occurred_on date,
  period_from date,
  period_to date,
  amount numeric(16,2),
  gross_amount numeric(16,2),
  reimbursement_amount numeric(16,2) not null default 0,
  deductible_amount numeric(16,2),
  deductible_percentage numeric(7,4),
  currency text not null default 'CHF',
  source_type text,
  source_id uuid,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','needs_document','review','verified','advisor_review')),
  advisor_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_obligations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  obligation_type text not null
    check (obligation_type in ('provisional','installment','final_assessment','final_invoice','interest','other')),
  label text not null,
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'CHF',
  due_date date,
  status text not null default 'open'
    check (status in ('open','partial','paid','cancelled')),
  reference text,
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  obligation_id uuid references public.tax_obligations(id) on delete set null,
  payment_type text not null default 'payment'
    check (payment_type in ('payment','refund','interest_payment','interest_credit')),
  amount numeric(16,2) not null check (amount >= 0),
  currency text not null default 'CHF',
  paid_at date not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  reference text,
  notes text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists tax_cases_household_year_idx on public.tax_cases(household_id,tax_year);
create index if not exists tax_case_sections_case_idx on public.tax_case_sections(tax_case_id,section_key);
create index if not exists tax_items_case_section_idx on public.tax_items(tax_case_id,section_key,occurred_on);
create index if not exists tax_items_source_idx on public.tax_items(household_id,source_type,source_id);
create index if not exists tax_obligations_case_due_idx on public.tax_obligations(tax_case_id,due_date);
create index if not exists tax_payments_case_paid_idx on public.tax_payments(tax_case_id,paid_at);

alter table public.tax_rule_versions enable row level security;
alter table public.tax_cases enable row level security;
alter table public.tax_case_sections enable row level security;
alter table public.tax_items enable row level security;
alter table public.tax_obligations enable row level security;
alter table public.tax_payments enable row level security;

drop policy if exists tax_rule_versions_read on public.tax_rule_versions;
create policy tax_rule_versions_read on public.tax_rule_versions for select to authenticated using (true);

drop policy if exists tax_cases_read on public.tax_cases;
create policy tax_cases_read on public.tax_cases for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_cases_write on public.tax_cases;
create policy tax_cases_write on public.tax_cases for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_case_sections_read on public.tax_case_sections;
create policy tax_case_sections_read on public.tax_case_sections for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_case_sections_write on public.tax_case_sections;
create policy tax_case_sections_write on public.tax_case_sections for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_items_read on public.tax_items;
create policy tax_items_read on public.tax_items for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_items_write on public.tax_items;
create policy tax_items_write on public.tax_items for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_obligations_read on public.tax_obligations;
create policy tax_obligations_read on public.tax_obligations for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_obligations_write on public.tax_obligations;
create policy tax_obligations_write on public.tax_obligations for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

drop policy if exists tax_payments_read on public.tax_payments;
create policy tax_payments_read on public.tax_payments for select to authenticated
using (private.is_household_member(household_id) and private.has_module_access('tax'));
drop policy if exists tax_payments_write on public.tax_payments;
create policy tax_payments_write on public.tax_payments for all to authenticated
using (private.can_write_household(household_id) and private.has_module_access('tax'))
with check (private.can_write_household(household_id) and private.has_module_access('tax'));

grant select on public.tax_rule_versions to authenticated;
grant select,insert,update,delete on public.tax_cases,public.tax_case_sections,public.tax_items,public.tax_obligations,public.tax_payments to authenticated;

drop trigger if exists tax_rule_versions_set_updated_at on public.tax_rule_versions;
create trigger tax_rule_versions_set_updated_at before update on public.tax_rule_versions for each row execute function private.set_updated_at();
drop trigger if exists tax_cases_set_updated_at on public.tax_cases;
create trigger tax_cases_set_updated_at before update on public.tax_cases for each row execute function private.set_updated_at();
drop trigger if exists tax_case_sections_set_updated_at on public.tax_case_sections;
create trigger tax_case_sections_set_updated_at before update on public.tax_case_sections for each row execute function private.set_updated_at();
drop trigger if exists tax_items_set_updated_at on public.tax_items;
create trigger tax_items_set_updated_at before update on public.tax_items for each row execute function private.set_updated_at();
drop trigger if exists tax_obligations_set_updated_at on public.tax_obligations;
create trigger tax_obligations_set_updated_at before update on public.tax_obligations for each row execute function private.set_updated_at();

insert into public.tax_rule_versions(country_code,canton_code,tax_year,version,status,source_url,notes,active)
values
  ('CH','SG',2025,'SG-2025','official','https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/einkommens-vermoegenssteuer-privatpersonen.html','Ordentliche Formulare und Wegleitung 2025 veröffentlicht.',true),
  ('CH','SG',2026,'SG-2026','partial','https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/einkommens-vermoegenssteuer-privatpersonen.html','2026: unterjährige Formulare sowie Tarife/Steuerfüsse verfügbar; Regeln nicht als vollständig abgeschlossen behandeln.',true),
  ('CH','SG',2027,'SG-2027','pending','https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/einkommens-vermoegenssteuer-privatpersonen.html','Regelwerk für 2027 noch nicht als vollständige ordentliche Steuerperiode hinterlegt.',true)
on conflict (country_code,canton_code,tax_year)
do update set version=excluded.version,status=excluded.status,source_url=excluded.source_url,notes=excluded.notes,active=excluded.active,updated_at=now();

create or replace function public.ensure_tax_case(
  p_household_id uuid,
  p_tax_year integer,
  p_country_code text default 'CH',
  p_canton_code text default 'SG'
)
returns public.tax_cases
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_case public.tax_cases;
  v_rule uuid;
begin
  if not private.can_write_household(p_household_id) or not private.has_module_access('tax') then
    raise exception 'Keine Berechtigung für den Steuerfall.';
  end if;

  select id into v_rule
  from public.tax_rule_versions
  where country_code=p_country_code and canton_code=p_canton_code and tax_year=p_tax_year and active=true
  limit 1;

  insert into public.tax_cases(
    household_id,tax_year,country_code,canton_code,tax_period_from,tax_period_to,rule_version_id,status,currency
  )
  values(
    p_household_id,p_tax_year,p_country_code,p_canton_code,
    make_date(p_tax_year,1,1),make_date(p_tax_year,12,31),v_rule,'open','CHF'
  )
  on conflict (household_id,tax_year,country_code,canton_code)
  do update set rule_version_id=coalesce(public.tax_cases.rule_version_id,excluded.rule_version_id)
  returning * into v_case;
  return v_case;
end;
$$;

revoke all on function public.ensure_tax_case(uuid,integer,text,text) from public,anon;
grant execute on function public.ensure_tax_case(uuid,integer,text,text) to authenticated;
