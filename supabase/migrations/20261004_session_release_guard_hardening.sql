revoke execute on function public.touch_user_presence_v2(text,text,text,text,timestamptz,timestamptz) from anon, public;
grant execute on function public.touch_user_presence_v2(text,text,text,text,timestamptz,timestamptz) to authenticated;

revoke execute on function public.clear_user_presence() from anon, public;
grant execute on function public.clear_user_presence() to authenticated;

drop function if exists public.get_finance_runtime_state();

create or replace function public.get_finance_runtime_state()
returns table(
  schema_version bigint,
  min_client_schema bigint,
  release_id text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select s.schema_version,s.min_client_schema,s.release_id,s.updated_at
  from public.app_runtime_state s
  where s.app_key='finance'
  limit 1
$$;

drop policy if exists app_runtime_state_authenticated_read on public.app_runtime_state;
create policy app_runtime_state_authenticated_read
  on public.app_runtime_state
  for select
  to authenticated
  using (app_key='finance');

revoke all on public.app_runtime_state from anon, public;
grant select on public.app_runtime_state to authenticated;

revoke execute on function public.get_finance_runtime_state() from anon, public;
grant execute on function public.get_finance_runtime_state() to authenticated;
