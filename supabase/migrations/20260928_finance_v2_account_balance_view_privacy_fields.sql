drop view if exists public.account_balances;

create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.household_id,
  a.name,
  a.account_type,
  a.institution_name,
  a.currency,
  a.balance_anchor_amount,
  a.balance_anchor_at,
  a.is_archived,
  a.sort_order,
  a.visibility,
  a.owner_user_id,
  (
    a.balance_anchor_amount
    + coalesce(sum(t.amount) filter (
        where t.status = 'booked' and t.occurred_at > a.balance_anchor_at
      ), 0)
  )::numeric(18,2) as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

grant select on public.account_balances to authenticated;
