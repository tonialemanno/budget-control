alter table public.user_presence
  add column if not exists activity_state text not null default 'active',
  add column if not exists last_interaction_at timestamptz,
  add column if not exists session_started_at timestamptz;

alter table public.user_presence
  drop constraint if exists user_presence_activity_state_check;

alter table public.user_presence
  add constraint user_presence_activity_state_check
  check (activity_state in ('active','idle'));

create or replace function public.touch_user_presence_v2(
  p_route text default null,
  p_app_version text default null,
  p_device_label text default null,
  p_activity_state text default 'active',
  p_last_interaction_at timestamptz default null,
  p_session_started_at timestamptz default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_state text := case when p_activity_state='idle' then 'idle' else 'active' end;
  v_last_interaction timestamptz := case
    when p_last_interaction_at is null then null
    when p_last_interaction_at > now() + interval '5 minutes' then now()
    else p_last_interaction_at
  end;
  v_session_started timestamptz := case
    when p_session_started_at is null then null
    when p_session_started_at > now() + interval '5 minutes' then now()
    else p_session_started_at
  end;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  insert into public.user_presence(
    user_id,last_seen_at,route,app_version,device_label,
    activity_state,last_interaction_at,session_started_at
  )
  values(
    v_uid,now(),nullif(left(trim(p_route),120),''),
    nullif(left(trim(p_app_version),120),''),
    nullif(left(trim(p_device_label),80),''),
    v_state,v_last_interaction,v_session_started
  )
  on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at,
      route=excluded.route,
      app_version=excluded.app_version,
      device_label=excluded.device_label,
      activity_state=excluded.activity_state,
      last_interaction_at=coalesce(excluded.last_interaction_at,public.user_presence.last_interaction_at),
      session_started_at=coalesce(excluded.session_started_at,public.user_presence.session_started_at);
end;
$$;

revoke all on function public.touch_user_presence_v2(text,text,text,text,timestamptz,timestamptz) from public;
grant execute on function public.touch_user_presence_v2(text,text,text,text,timestamptz,timestamptz) to authenticated;

create or replace function public.clear_user_presence()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  delete from public.user_presence where user_id=v_uid;
end;
$$;

revoke all on function public.clear_user_presence() from public;
grant execute on function public.clear_user_presence() to authenticated;

create table if not exists public.app_runtime_state (
  app_key text primary key,
  schema_version bigint not null,
  min_client_schema bigint not null,
  release_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_state enable row level security;
revoke all on public.app_runtime_state from public, anon, authenticated;

insert into public.app_runtime_state(app_key,schema_version,min_client_schema,release_id,updated_at)
values('finance',2026100402,2026100402,'2026.10.04-r2',now())
on conflict(app_key) do update
set schema_version=excluded.schema_version,
    min_client_schema=excluded.min_client_schema,
    release_id=excluded.release_id,
    updated_at=excluded.updated_at;

create or replace function public.get_finance_runtime_state()
returns table(
  schema_version bigint,
  min_client_schema bigint,
  release_id text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select s.schema_version,s.min_client_schema,s.release_id,s.updated_at
  from public.app_runtime_state s
  where s.app_key='finance'
  limit 1
$$;

revoke all on function public.get_finance_runtime_state() from public;
grant execute on function public.get_finance_runtime_state() to authenticated;
