create table if not exists public.app_release_state (
  id smallint primary key default 1 check (id=1),
  schema_version integer not null,
  updated_at timestamptz not null default now()
);

insert into public.app_release_state(id,schema_version,updated_at)
values(1,1,now())
on conflict(id) do update
set schema_version=excluded.schema_version,
    updated_at=excluded.updated_at;

alter table public.app_release_state enable row level security;

drop policy if exists app_release_state_read on public.app_release_state;
create policy app_release_state_read
on public.app_release_state
for select
to authenticated
using (true);

revoke all on public.app_release_state from anon;
grant select on public.app_release_state to authenticated;

comment on table public.app_release_state is
  'Compatibility epoch used by the Finance release guard. App and DB must expose the same schema_version.';
