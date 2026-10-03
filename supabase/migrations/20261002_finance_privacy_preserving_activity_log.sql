
-- Privacy-preserving admin activity metadata.
-- Stores only who changed data, the app area, generic action type and timestamp.
-- No amounts, descriptions, counterparties, document names or object IDs are stored.

create table if not exists public.user_activity_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_activity_at timestamptz not null default now(),
  last_module text not null,
  last_action text not null check (last_action in ('create','update','delete')),
  last_household_id uuid references public.households(id) on delete set null
);

create table if not exists public.user_activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  module_key text not null,
  action_kind text not null check (action_kind in ('create','update','delete')),
  occurred_at timestamptz not null default now()
);

create index if not exists user_activity_events_user_time_idx
  on public.user_activity_events(user_id, occurred_at desc);
create index if not exists user_activity_events_time_idx
  on public.user_activity_events(occurred_at desc);
create index if not exists user_activity_events_module_time_idx
  on public.user_activity_events(module_key, occurred_at desc);

alter table public.user_activity_summary enable row level security;
alter table public.user_activity_events enable row level security;

revoke all on public.user_activity_summary from public, anon, authenticated;
revoke all on public.user_activity_events from public, anon, authenticated;

create or replace function private.activity_fallback_module(p_table text)
returns text
language sql
immutable
as $$
  select case p_table
    when 'accounts' then 'accounts'
    when 'transactions' then 'transactions'
    when 'categories' then 'categories'
    when 'categorization_rules' then 'categories'
    when 'merchants' then 'merchants'
    when 'import_batches' then 'imports'
    when 'recurring_rules' then 'recurring'
    when 'budgets' then 'budget'
    when 'bills' then 'bills'
    when 'contracts' then 'fixed-costs'
    when 'savings_goals' then 'goals'
    when 'savings_goal_sources' then 'goals'
    when 'debts' then 'debts'
    when 'debt_payments' then 'debts'
    when 'receivables' then 'receivables'
    when 'receivable_payments' then 'receivables'
    when 'legal_cases' then 'legal'
    when 'legal_case_events' then 'legal'
    when 'assets' then 'wealth'
    when 'properties' then 'property'
    when 'vehicles' then 'vehicles'
    when 'insurance_policies' then 'insurance'
    when 'investments' then 'investments'
    when 'investment_transactions' then 'investments'
    when 'pension_accounts' then 'pension'
    when 'documents' then 'documents'
    when 'tax_cases' then 'tax-advisor'
    when 'tax_people' then 'tax-advisor'
    when 'tax_children' then 'tax-advisor'
    when 'tax_employments' then 'tax-advisor'
    when 'tax_case_sections' then 'tax-advisor'
    when 'tax_items' then 'tax-advisor'
    when 'tax_obligations' then 'tax-advisor'
    when 'tax_payments' then 'tax-advisor'
    else 'other'
  end
$$;

create or replace function private.capture_user_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_household uuid;
  v_route text;
  v_module text;
  v_action text;
begin
  if v_uid is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;

  begin
    v_household := nullif(v_row->>'household_id','')::uuid;
  exception when others then
    v_household := null;
  end;

  select p.route
    into v_route
  from public.user_presence p
  where p.user_id=v_uid
    and p.last_seen_at > now() - interval '10 minutes';

  v_module := coalesce(nullif(v_route,''), private.activity_fallback_module(tg_table_name));
  if v_module in ('admin','settings','family') then
    v_module := private.activity_fallback_module(tg_table_name);
  end if;

  v_action := case tg_op
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
    else 'update'
  end;

  -- Several database rows can be touched by one user action. Collapse identical
  -- user/module/action events occurring within two seconds into one activity.
  if not exists (
    select 1
    from public.user_activity_events e
    where e.user_id=v_uid
      and e.module_key=v_module
      and e.action_kind=v_action
      and e.occurred_at > now() - interval '2 seconds'
      and (e.household_id is not distinct from v_household)
  ) then
    insert into public.user_activity_events(user_id,household_id,module_key,action_kind)
    values(v_uid,v_household,v_module,v_action);
  end if;

  insert into public.user_activity_summary(user_id,last_activity_at,last_module,last_action,last_household_id)
  values(v_uid,now(),v_module,v_action,v_household)
  on conflict(user_id) do update
  set last_activity_at=excluded.last_activity_at,
      last_module=excluded.last_module,
      last_action=excluded.last_action,
      last_household_id=excluded.last_household_id;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.activity_fallback_module(text) from public, anon, authenticated;
revoke all on function private.capture_user_activity() from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'accounts','transactions','categories','categorization_rules','merchants','import_batches',
    'recurring_rules','budgets','bills','contracts','savings_goals','savings_goal_sources',
    'debts','debt_payments','receivables','receivable_payments','legal_cases','legal_case_events',
    'assets','properties','vehicles','insurance_policies','investments','investment_transactions',
    'pension_accounts','documents','tax_cases','tax_people','tax_children','tax_employments',
    'tax_case_sections','tax_items','tax_obligations','tax_payments'
  ];
begin
  foreach v_table in array v_tables loop
    execute format('drop trigger if exists %I on public.%I', 'activity_'||v_table, v_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.capture_user_activity()',
      'activity_'||v_table,
      v_table
    );
  end loop;
end $$;
