drop policy if exists households_select_member on public.households;
create policy households_select_member
on public.households for select
using (
  owner_user_id = (select auth.uid())
  or private.is_household_member(id)
);
