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
update public.contracts c
set recurring_rule_id = match.id
from lateral (
  select max(r.id::text)::uuid as id
  from public.recurring_rules r
  where r.household_id=c.household_id
    and r.account_id=c.account_id
    and r.direction='expense'
    and lower(trim(r.description))=lower(trim(c.name))
  having count(*)=1
) match
where c.recurring_rule_id is null
  and c.account_id is not null
  and match.id is not null;

update public.insurance_policies p
set recurring_rule_id = match.id
from lateral (
  select max(r.id::text)::uuid as id
  from public.recurring_rules r
  where r.household_id=p.household_id
    and r.account_id=p.account_id
    and r.direction='expense'
    and lower(trim(r.description))=lower(trim(p.name))
  having count(*)=1
) match
where p.recurring_rule_id is null
  and p.account_id is not null
  and match.id is not null;
