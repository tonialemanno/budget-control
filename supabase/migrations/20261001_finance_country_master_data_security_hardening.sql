-- Keep privileged master-data logic out of the exposed public API schema.
-- Public RPCs are SECURITY INVOKER wrappers; authorization remains enforced inside private functions.

alter function public.install_country_master_data(uuid) set schema private;
alter function private.install_country_master_data(uuid) rename to install_country_master_data_internal;

alter function public.list_master_data_households() set schema private;
alter function private.list_master_data_households() rename to list_master_data_households_internal;

alter function public.copy_household_master_data(uuid,uuid) set schema private;
alter function private.copy_household_master_data(uuid,uuid) rename to copy_household_master_data_internal;

alter function public.promote_merchant_to_country_catalog(uuid) set schema private;
alter function private.promote_merchant_to_country_catalog(uuid) rename to promote_merchant_to_country_catalog_internal;

alter function public.promote_category_to_country_catalog(uuid) set schema private;
alter function private.promote_category_to_country_catalog(uuid) rename to promote_category_to_country_catalog_internal;

revoke all on function private.install_country_master_data_internal(uuid) from public, anon;
revoke all on function private.list_master_data_households_internal() from public, anon;
revoke all on function private.copy_household_master_data_internal(uuid,uuid) from public, anon;
revoke all on function private.promote_merchant_to_country_catalog_internal(uuid) from public, anon;
revoke all on function private.promote_category_to_country_catalog_internal(uuid) from public, anon;

grant execute on function private.install_country_master_data_internal(uuid) to authenticated;
grant execute on function private.list_master_data_households_internal() to authenticated;
grant execute on function private.copy_household_master_data_internal(uuid,uuid) to authenticated;
grant execute on function private.promote_merchant_to_country_catalog_internal(uuid) to authenticated;
grant execute on function private.promote_category_to_country_catalog_internal(uuid) to authenticated;

create or replace function public.install_country_master_data(p_household_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.install_country_master_data_internal(p_household_id);
$$;

create or replace function public.list_master_data_households()
returns table(id uuid,name text,country_code text,base_currency text)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.list_master_data_households_internal();
$$;

create or replace function public.copy_household_master_data(
  p_source_household_id uuid,
  p_target_household_id uuid
)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.copy_household_master_data_internal(p_source_household_id,p_target_household_id);
$$;

create or replace function public.promote_merchant_to_country_catalog(p_merchant_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.promote_merchant_to_country_catalog_internal(p_merchant_id);
$$;

create or replace function public.promote_category_to_country_catalog(p_category_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.promote_category_to_country_catalog_internal(p_category_id);
$$;

revoke all on function public.install_country_master_data(uuid) from public, anon;
revoke all on function public.list_master_data_households() from public, anon;
revoke all on function public.copy_household_master_data(uuid,uuid) from public, anon;
revoke all on function public.promote_merchant_to_country_catalog(uuid) from public, anon;
revoke all on function public.promote_category_to_country_catalog(uuid) from public, anon;

grant execute on function public.install_country_master_data(uuid) to authenticated;
grant execute on function public.list_master_data_households() to authenticated;
grant execute on function public.copy_household_master_data(uuid,uuid) to authenticated;
grant execute on function public.promote_merchant_to_country_catalog(uuid) to authenticated;
grant execute on function public.promote_category_to_country_catalog(uuid) to authenticated;

create index if not exists country_category_catalog_created_by_idx
  on public.country_category_catalog(created_by);

create index if not exists country_merchant_catalog_category_idx
  on public.country_merchant_catalog(category_catalog_id);

create index if not exists country_merchant_catalog_created_by_idx
  on public.country_merchant_catalog(created_by);
