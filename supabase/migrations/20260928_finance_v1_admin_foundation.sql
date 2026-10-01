-- Finance V1 admin-only user management.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists app_admins_select_own on public.app_admins;
create policy app_admins_select_own
on public.app_admins for select
using (user_id = (select auth.uid()));

insert into public.app_admins (user_id, role)
select id, 'owner'
from auth.users
order by created_at asc
limit 1
on conflict (user_id) do nothing;

create or replace function private.is_app_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.user_id = target_user_id
      and a.role in ('owner','admin')
  );
$$;

revoke execute on function private.is_app_admin(uuid) from public, anon, authenticated;

create table if not exists private.app_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into private.app_meta (key, value)
values ('admin_bootstrap', '{"complete": false}'::jsonb)
on conflict (key) do nothing;

update private.app_meta
set value = '{"complete": true}'::jsonb,
    updated_at = now()
where key = 'admin_bootstrap'
  and exists (select 1 from public.app_admins);

create or replace function private.bootstrap_first_app_admin()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  is_complete boolean;
begin
  select coalesce((value->>'complete')::boolean, false)
    into is_complete
  from private.app_meta
  where key = 'admin_bootstrap'
  for update;

  if not coalesce(is_complete, false) then
    insert into public.app_admins (user_id, role)
    values (new.id, 'owner')
    on conflict (user_id) do nothing;

    update private.app_meta
    set value = '{"complete": true}'::jsonb,
        updated_at = now()
    where key = 'admin_bootstrap';
  end if;

  return new;
end;
$$;

drop trigger if exists on_first_auth_user_make_app_admin on auth.users;
create trigger on_first_auth_user_make_app_admin
after insert on auth.users
for each row execute function private.bootstrap_first_app_admin();

revoke execute on function private.bootstrap_first_app_admin() from public, anon, authenticated;
