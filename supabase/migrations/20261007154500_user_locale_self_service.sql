-- Finance R47: personal language preference independent of household role.

create or replace function public.set_my_locale_v1(p_locale text)
returns public.profiles
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_locale not in ('de-CH','de-DE','it-CH','it-IT','en-CH','en-GB') then
    raise exception 'Unsupported locale';
  end if;

  insert into public.profiles(user_id, locale)
  values(auth.uid(), p_locale)
  on conflict (user_id) do update
  set locale=excluded.locale,
      updated_at=now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.set_my_locale_v1(text) from public;
grant execute on function public.set_my_locale_v1(text) to authenticated, service_role;

insert into public.app_runtime_state(app_key,schema_version,min_client_schema,release_id,updated_at)
values('finance',2026100702,2026100403,'2026.10.07-r47',now())
on conflict(app_key) do update
set schema_version=excluded.schema_version,
    min_client_schema=least(public.app_runtime_state.min_client_schema,excluded.min_client_schema),
    release_id=excluded.release_id,
    updated_at=excluded.updated_at;
