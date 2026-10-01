alter table public.recurring_rules
  add column if not exists merchant_id uuid references public.merchants(id) on delete set null;

create index if not exists recurring_rules_merchant_idx
  on public.recurring_rules(merchant_id)
  where merchant_id is not null;

-- Safe backfill: only exact canonical counterparty/name matches inside the same household.
with matches as (
  select r.id as rule_id, max(m.id::text)::uuid as merchant_id
  from public.recurring_rules r
  join public.merchants m
    on m.household_id=r.household_id
   and (
     m.normalized_key = lower(regexp_replace(trim(coalesce(r.counterparty,'')),'[^a-zA-Z0-9äöüÄÖÜ]+',' ','g'))
     or m.normalized_key = lower(regexp_replace(trim(coalesce(r.description,'')),'[^a-zA-Z0-9äöüÄÖÜ]+',' ','g'))
   )
  where r.merchant_id is null
  group by r.id
  having count(*)=1
)
update public.recurring_rules r
set merchant_id=m.merchant_id
from matches m
where r.id=m.rule_id;
