-- Finance V1 Core security hardening.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_household_member(uuid) set schema private;
alter function public.can_write_household(uuid) set schema private;
alter function public.can_admin_household(uuid) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.handle_new_household_owner() set schema private;
alter function public.set_updated_at() set schema private;
alter function public.prevent_household_owner_change() set schema private;

alter function private.set_updated_at() set search_path = pg_catalog, public;
alter function private.prevent_household_owner_change() set search_path = pg_catalog, public;

revoke execute on function private.is_household_member(uuid) from public, anon;
revoke execute on function private.can_write_household(uuid) from public, anon;
revoke execute on function private.can_admin_household(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.can_write_household(uuid) to authenticated;
grant execute on function private.can_admin_household(uuid) to authenticated;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.handle_new_household_owner() from public, anon, authenticated;
revoke execute on function private.set_updated_at() from public, anon, authenticated;
revoke execute on function private.prevent_household_owner_change() from public, anon, authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
using (user_id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists households_insert_owner on public.households;
create policy households_insert_owner on public.households for insert
with check (owner_user_id = (select auth.uid()));

drop policy if exists households_delete_owner on public.households;
create policy households_delete_owner on public.households for delete
using (
  owner_user_id = (select auth.uid())
  and exists (
    select 1 from public.household_members hm
    where hm.household_id = id
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
  )
);

drop policy if exists household_members_delete_admin on public.household_members;
create policy household_members_delete_admin on public.household_members for delete
using (
  private.can_admin_household(household_id)
  and not (user_id = (select auth.uid()) and role = 'owner')
);

create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists households_owner_user_idx on public.households(owner_user_id);
create index if not exists accounts_created_by_idx on public.accounts(created_by);
create index if not exists categories_created_by_idx on public.categories(created_by);
create index if not exists transactions_created_by_idx on public.transactions(created_by);
