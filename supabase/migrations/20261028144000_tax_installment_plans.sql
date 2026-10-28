-- Tax instalment plans are schedules against an existing tax claim, never additional
-- liabilities. A confirmed remaining-balance snapshot is kept separately from
-- the original assessment and historical bank transactions.
create table if not exists public.tax_installment_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_case_id uuid not null references public.tax_cases(id) on delete cascade,
  obligation_id uuid not null references public.tax_obligations(id) on delete cascade,
  balance_as_of date not null,
  starting_balance numeric(14,2) not null check (starting_balance > 0),
  first_due_date date not null,
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  currency text not null default 'CHF',
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_installment_plans_obligation_unique unique (obligation_id),
  constraint tax_installment_plans_first_due_check check (first_due_date >= balance_as_of),
  constraint tax_installment_plans_max_count check (ceil(starting_balance / installment_amount) <= 240)
);

create index if not exists tax_installment_plans_household_case_idx
  on public.tax_installment_plans (household_id, tax_case_id);

create or replace function private.validate_tax_installment_plan_scope_v1()
returns trigger language plpgsql
set search_path to 'public','private','pg_catalog'
as $$
begin
  if not exists (
    select 1 from public.tax_cases c
    join public.tax_obligations o
      on o.tax_case_id = c.id and o.household_id = c.household_id
    where c.id = new.tax_case_id
      and c.household_id = new.household_id
      and o.id = new.obligation_id
      and c.currency = new.currency
      and o.currency = new.currency
      and o.status <> 'cancelled'
  ) then
    raise exception 'Tax plan must belong to the same household, tax case, obligation and currency';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tax_installment_plans_scope_v1 on public.tax_installment_plans;
create trigger tax_installment_plans_scope_v1
  before insert or update on public.tax_installment_plans
  for each row execute function private.validate_tax_installment_plan_scope_v1();

alter table public.tax_installment_plans enable row level security;
create policy tax_installment_plans_read on public.tax_installment_plans
  for select to authenticated
  using (private.is_household_member(household_id) and private.has_module_access('tax'));
create policy tax_installment_plans_write on public.tax_installment_plans
  for all to authenticated
  using (private.can_write_household(household_id) and private.has_module_access('tax'))
  with check (private.can_write_household(household_id) and private.has_module_access('tax'));
grant select,insert,update,delete on public.tax_installment_plans to authenticated;
revoke all on public.tax_installment_plans from anon;

alter table public.tax_payments add column if not exists installment_due_date date;

-- Atomic wrapper around the existing bookkeeping routine. No extra transaction
-- is created when linking an already-imported bank entry.
create or replace function public.record_tax_installment_payment_v1(
  p_household_id uuid,
  p_tax_case_id uuid,
  p_obligation_id uuid default null,
  p_payment_type text default 'payment',
  p_amount numeric default null,
  p_paid_at date default current_date,
  p_reference text default null,
  p_notes text default null,
  p_source text default 'created_transaction',
  p_account_id uuid default null,
  p_transaction_id uuid default null,
  p_installment_due_date date default null
)
returns public.tax_payments
language plpgsql
security invoker
set search_path to 'public','pg_catalog'
as $$
declare
  v_payment public.tax_payments;
  v_plan public.tax_installment_plans;
  v_month_index integer;
  v_expected date;
begin
  if p_installment_due_date is not null then
    if p_obligation_id is null then
      raise exception 'A tax obligation is required for installment assignment';
    end if;
    select * into v_plan
    from public.tax_installment_plans
    where household_id=p_household_id and tax_case_id=p_tax_case_id
      and obligation_id=p_obligation_id and status='active';
    if not found then raise exception 'Active installment plan not found'; end if;
    if p_installment_due_date < v_plan.first_due_date then
      raise exception 'Installment is outside the plan';
    end if;
    if p_payment_type not in ('payment','interest_payment') then
      raise exception 'Refunds cannot be allocated to an installment';
    end if;
    -- A selected due date must be one of the generated monthly due dates.
    for v_month_index in 0..239 loop
      v_expected := (
        date_trunc('month', v_plan.first_due_date::timestamp)
        + make_interval(months=>v_month_index)
        + make_interval(days=>least(
          extract(day from v_plan.first_due_date)::integer,
          extract(day from (date_trunc('month',v_plan.first_due_date::timestamp)
            + make_interval(months=>v_month_index+1) - interval '1 day'))::integer
        ) - 1)
      )::date;
      exit when v_expected >= p_installment_due_date;
    end loop;
    if v_expected <> p_installment_due_date
       or v_month_index >= ceil(v_plan.starting_balance / v_plan.installment_amount)
    then raise exception 'Invalid installment due date'; end if;
  end if;

  select * into v_payment from public.record_tax_payment_v2(
    p_household_id=>p_household_id, p_tax_case_id=>p_tax_case_id,
    p_obligation_id=>p_obligation_id, p_payment_type=>p_payment_type,
    p_amount=>p_amount, p_paid_at=>p_paid_at, p_reference=>p_reference,
    p_notes=>p_notes, p_source=>p_source, p_account_id=>p_account_id,
    p_transaction_id=>p_transaction_id
  );
  if p_installment_due_date is not null then
    update public.tax_payments set installment_due_date=p_installment_due_date
      where id=v_payment.id returning * into v_payment;
  end if;
  return v_payment;
end;
$$;
revoke all on function public.record_tax_installment_payment_v1(
  uuid,uuid,uuid,text,numeric,date,text,text,text,uuid,uuid,date
) from public,anon;
grant execute on function public.record_tax_installment_payment_v1(
  uuid,uuid,uuid,text,numeric,date,text,text,text,uuid,uuid,date
) to authenticated;
