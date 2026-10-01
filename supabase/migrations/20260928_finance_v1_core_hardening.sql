-- Finance V1 Core hardening before first user data.

alter table public.accounts
  drop constraint if exists accounts_account_type_check;

alter table public.accounts
  add constraint accounts_account_type_check
  check (account_type in ('checking','savings','cash','investment','pension','other'));

create or replace function public.prevent_household_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Household owner transfer requires a dedicated operation.';
  end if;
  return new;
end;
$$;

create trigger households_prevent_owner_change
before update of owner_user_id on public.households
for each row execute function public.prevent_household_owner_change();

drop policy if exists categories_insert_writer on public.categories;
create policy categories_insert_writer
on public.categories for insert
with check (
  public.can_write_household(household_id)
  and (
    parent_id is null
    or exists (
      select 1 from public.categories p
      where p.id = parent_id
        and p.household_id = categories.household_id
    )
  )
);

drop policy if exists categories_update_writer on public.categories;
create policy categories_update_writer
on public.categories for update
using (public.can_write_household(household_id))
with check (
  public.can_write_household(household_id)
  and (
    parent_id is null
    or exists (
      select 1 from public.categories p
      where p.id = parent_id
        and p.household_id = categories.household_id
    )
  )
);

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
  (
    a.balance_anchor_amount
    + coalesce(sum(t.amount) filter (
        where t.status = 'booked'
          and t.occurred_at > a.balance_anchor_at
      ), 0)
  )::numeric(18,2) as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

grant select on public.account_balances to authenticated;
