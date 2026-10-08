revoke all on function public.list_owned_storage_objects_v1(uuid) from public, anon, authenticated;
grant execute on function public.list_owned_storage_objects_v1(uuid) to service_role;

revoke all on function public.purge_user_finance_v1(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_finance_v1(uuid) to service_role;

revoke all on function public.enrich_demo_instance_v1(uuid) from public, anon, authenticated;
grant execute on function public.enrich_demo_instance_v1(uuid) to service_role;

revoke all on function public.set_my_locale_v1(text) from public, anon;
grant execute on function public.set_my_locale_v1(text) to authenticated, service_role;
