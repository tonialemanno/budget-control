-- Link contracts and insurance policies to their recurring planning rule.
alter table public.contracts
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

alter table public.insurance_policies
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

create index if not exists contracts_recurring_rule_idx
  on public.contracts(recurring_rule_id)
  where recurring_rule_id is not null;

create index if not exists insurance_recurring_rule_idx
  on public.insurance_policies(recurring_rule_id)
  where recurring_rule_id is not null;

-- Safe backfill only when an exact household/account/name match resolves to one rule.
with matches as (
  select c.id as source_id, max(r.id::text)::uuid as recurring_rule_id
  from public.contracts c
  join public.recurring_rules r
    on r.household_id=c.household_id
   and r.account_id=c.account_id
   and r.direction='expense'
   and lower(trim(r.description))=lower(trim(c.name))
  where c.recurring_rule_id is null
  group by c.id
  having count(*)=1
)
update public.contracts c
set recurring_rule_id=m.recurring_rule_id
from matches m
where c.id=m.source_id;

with matches as (
  select p.id as source_id, max(r.id::text)::uuid as recurring_rule_id
  from public.insurance_policies p
  join public.recurring_rules r
    on r.household_id=p.household_id
   and r.account_id=p.account_id
   and r.direction='expense'
   and lower(trim(r.description))=lower(trim(p.name))
  where p.recurring_rule_id is null
  group by p.id
  having count(*)=1
)
update public.insurance_policies p
set recurring_rule_id=m.recurring_rule_id
from matches m
where p.id=m.source_id;
