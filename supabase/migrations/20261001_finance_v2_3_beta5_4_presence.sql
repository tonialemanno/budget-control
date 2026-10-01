-- Finance V2.3 Beta 5.4 – privacy-preserving live presence.
-- Normal users cannot read the presence table. Admin reads are served by the secured admin-users Edge Function.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  route text,
  app_version text,
  device_label text
);

create index if not exists user_presence_last_seen_idx on public.user_presence(last_seen_at desc);
alter table public.user_presence enable row level security;

create or replace function public.touch_user_presence(
  p_route text default null,
  p_app_version text default null,
  p_device_label text default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into public.user_presence(user_id,last_seen_at,route,app_version,device_label)
  values(v_uid,now(),nullif(left(trim(p_route),120),''),nullif(left(trim(p_app_version),80),''),nullif(left(trim(p_device_label),80),''))
  on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at,
      route=excluded.route,
      app_version=excluded.app_version,
      device_label=excluded.device_label;
end;
$$;

revoke all on function public.touch_user_presence(text,text,text) from public;
grant execute on function public.touch_user_presence(text,text,text) to authenticated;
