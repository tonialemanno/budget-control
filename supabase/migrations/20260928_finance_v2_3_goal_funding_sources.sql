-- Finance V2.3 Beta 2: configurable savings-goal funding sources.
create table if not exists public.savings_goal_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  source_type text not null check (source_type in ('fixed','recurring_rule','surplus')),
  label text,
  amount numeric,
  recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goal_sources_shape check (
    (source_type='fixed' and amount is not null and amount >= 0 and recurring_rule_id is null)
    or (source_type='recurring_rule' and recurring_rule_id is not null and amount is null)
    or (source_type='surplus' and amount is null and recurring_rule_id is null)
  )
);
alter table public.savings_goal_sources enable row level security;
grant select, insert, update, delete on public.savings_goal_sources to authenticated;
create policy savings_goal_sources_member_read on public.savings_goal_sources for select using (private.is_household_member(household_id));
create policy savings_goal_sources_writer_insert on public.savings_goal_sources for insert with check (
  private.can_write_household(household_id)
  and exists (select 1 from public.savings_goals g where g.id=savings_goal_sources.goal_id and g.household_id=savings_goal_sources.household_id)
  and (recurring_rule_id is null or exists (select 1 from public.recurring_rules r where r.id=savings_goal_sources.recurring_rule_id and r.household_id=savings_goal_sources.household_id))
);
create policy savings_goal_sources_writer_update on public.savings_goal_sources for update using (private.can_write_household(household_id)) with check (
  private.can_write_household(household_id)
  and exists (select 1 from public.savings_goals g where g.id=savings_goal_sources.goal_id and g.household_id=savings_goal_sources.household_id)
  and (recurring_rule_id is null or exists (select 1 from public.recurring_rules r where r.id=savings_goal_sources.recurring_rule_id and r.household_id=savings_goal_sources.household_id))
);
create policy savings_goal_sources_writer_delete on public.savings_goal_sources for delete using (private.can_write_household(household_id));
create unique index if not exists savings_goal_sources_goal_recurring_uq on public.savings_goal_sources(goal_id, recurring_rule_id) where recurring_rule_id is not null;
create unique index if not exists savings_goal_sources_goal_surplus_uq on public.savings_goal_sources(goal_id) where source_type='surplus';
create index if not exists savings_goal_sources_household_goal_idx on public.savings_goal_sources(household_id, goal_id);
