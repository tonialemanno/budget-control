create or replace function private.capture_user_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_household uuid;
  v_route text;
  v_module text;
  v_action text;
begin
  if v_uid is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;

  begin
    v_household := nullif(v_row->>'household_id','')::uuid;
  exception when others then
    v_household := null;
  end;

  -- During cascading deletes the parent household can already be invisible to
  -- foreign-key checks. Activity metadata must never recreate a reference to it.
  if v_household is not null
     and not exists (select 1 from public.households h where h.id=v_household) then
    v_household := null;
  end if;

  select p.route
    into v_route
  from public.user_presence p
  where p.user_id=v_uid
    and p.last_seen_at > now() - interval '10 minutes';

  v_module := coalesce(nullif(v_route,''), private.activity_fallback_module(tg_table_name));
  if v_module in ('admin','settings','family') then
    v_module := private.activity_fallback_module(tg_table_name);
  end if;

  v_action := case tg_op
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
    else 'update'
  end;

  if not exists (
    select 1
    from public.user_activity_events e
    where e.user_id=v_uid
      and e.module_key=v_module
      and e.action_kind=v_action
      and e.occurred_at > now() - interval '2 seconds'
      and (e.household_id is not distinct from v_household)
  ) then
    insert into public.user_activity_events(user_id,household_id,module_key,action_kind)
    values(v_uid,v_household,v_module,v_action);
  end if;

  insert into public.user_activity_summary(user_id,last_activity_at,last_module,last_action,last_household_id)
  values(v_uid,now(),v_module,v_action,v_household)
  on conflict(user_id) do update
  set last_activity_at=excluded.last_activity_at,
      last_module=excluded.last_module,
      last_action=excluded.last_action,
      last_household_id=excluded.last_household_id;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function public.admin_reset_user_finance(
  p_user_id uuid,
  p_confirmation_email text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_email text;
  v_owned integer := 0;
  v_memberships integer := 0;
begin
  if auth.uid() is null
     or not exists (select 1 from public.app_admins a where a.user_id=auth.uid()) then
    raise exception 'Forbidden';
  end if;

  select lower(coalesce(u.email,'')) into v_email
  from auth.users u
  where u.id=p_user_id;

  if coalesce(v_email,'')='' then
    raise exception 'Benutzer wurde nicht gefunden.';
  end if;

  if lower(trim(coalesce(p_confirmation_email,'')))<>v_email then
    raise exception 'Die eingegebene E-Mail-Adresse stimmt nicht überein.';
  end if;

  select count(*) into v_owned
  from public.households h
  where h.owner_user_id=p_user_id;

  -- Managed transactions have protective triggers. Remove/unlink their owning
  -- ledger rows first so the household cascade can proceed without exceptions.
  update public.bills
  set status='open',
      paid_transaction_id=null,
      paid_at=null,
      payment_source=null,
      updated_at=now()
  where household_id in (select id from public.households where owner_user_id=p_user_id)
    and paid_transaction_id is not null;

  delete from public.debt_payments
  where household_id in (select id from public.households where owner_user_id=p_user_id);
  delete from public.debts
  where household_id in (select id from public.households where owner_user_id=p_user_id);

  delete from public.receivable_payments
  where household_id in (select id from public.households where owner_user_id=p_user_id);
  delete from public.receivables
  where household_id in (select id from public.households where owner_user_id=p_user_id);

  delete from public.households
  where owner_user_id=p_user_id;

  delete from public.household_members
  where user_id=p_user_id;
  get diagnostics v_memberships = row_count;

  delete from public.user_presence where user_id=p_user_id;
  delete from public.user_activity_events where user_id=p_user_id;
  delete from public.user_activity_summary where user_id=p_user_id;

  update public.profiles
  set country_code=null,
      base_currency=null,
      onboarding_completed_at=null,
      preferences='{}'::jsonb,
      updated_at=now()
  where user_id=p_user_id;

  return jsonb_build_object(
    'ok',true,
    'owned_households_deleted',v_owned,
    'memberships_removed',v_memberships,
    'login_preserved',true
  );
end;
$$;

revoke all on function public.admin_reset_user_finance(uuid,text) from public, anon;
grant execute on function public.admin_reset_user_finance(uuid,text) to authenticated;
grant execute on function public.admin_reset_user_finance(uuid,text) to service_role;

comment on function public.admin_reset_user_finance(uuid,text)
is 'Admin-only irreversible reset of Finance data while preserving the auth login and module grants.';
