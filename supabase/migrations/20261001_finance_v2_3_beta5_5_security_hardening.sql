-- Finance V2.3 Beta 5.5 – Presence/receivables hardening.
alter table public.user_presence enable row level security;

drop policy if exists user_presence_select_own on public.user_presence;
create policy user_presence_select_own on public.user_presence for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists user_presence_insert_own on public.user_presence;
create policy user_presence_insert_own on public.user_presence for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own on public.user_presence for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists user_presence_delete_own on public.user_presence;
create policy user_presence_delete_own on public.user_presence for delete to authenticated
using (user_id=(select auth.uid()));

revoke all on table public.user_presence from anon;
grant select,insert,update,delete on table public.user_presence to authenticated;

create or replace function public.touch_user_presence(
  p_route text default null,
  p_app_version text default null,
  p_device_label text default null
) returns void
language plpgsql
security invoker
set search_path=public,pg_temp
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

create or replace function public.clear_user_presence()
returns void
language sql
security invoker
set search_path=public,pg_temp
as $$
  delete from public.user_presence where user_id=(select auth.uid());
$$;

revoke execute on function public.touch_user_presence(text,text,text) from public,anon;
revoke execute on function public.clear_user_presence() from public,anon;
grant execute on function public.touch_user_presence(text,text,text) to authenticated;
grant execute on function public.clear_user_presence() to authenticated;

do $$
begin
  if to_regprocedure('public.record_receivable_payment(uuid,uuid,numeric,date,text)') is not null then
    execute 'alter function public.record_receivable_payment(uuid,uuid,numeric,date,text) security invoker';
    execute 'revoke execute on function public.record_receivable_payment(uuid,uuid,numeric,date,text) from public,anon';
    execute 'grant execute on function public.record_receivable_payment(uuid,uuid,numeric,date,text) to authenticated';
  end if;
end $$;

create index if not exists receivables_created_by_idx on public.receivables(created_by);
create index if not exists receivables_source_transaction_idx on public.receivables(source_transaction_id);
create index if not exists receivable_payments_household_idx on public.receivable_payments(household_id);
create index if not exists receivable_payments_created_by_idx on public.receivable_payments(created_by);
create index if not exists receivable_payments_transaction_idx on public.receivable_payments(transaction_id);
