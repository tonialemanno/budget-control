-- Golden demo baseline v2. Code backup only; saved data stay in private database.
-- Do not recapture the baseline from mutable tenant content during deployment.
begin;
create schema if not exists private;
create table if not exists private.demo_golden_v1 (
 baseline_key text primary key,user_id uuid not null,household_id uuid not null,
 household_record jsonb not null,profile_record jsonb not null,
 captured_at timestamptz not null default now(),sealed boolean not null default true
);
create table if not exists private.demo_golden_rows_v1 (
 baseline_key text not null references private.demo_golden_v1(baseline_key),
 table_name text not null,row_count integer not null,contents jsonb not null,
 primary key(baseline_key,table_name)
);
revoke all on private.demo_golden_v1,private.demo_golden_rows_v1 from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.restore_demo_golden_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$
declare
 g private.demo_golden_v1%rowtype;
 current_household uuid;
 t record;
 parent_name text;
 next_table text;
 ordinal integer:=0;
 expected_tables integer;
 actual_count integer;
 expected_count integer;
 total integer:=0;
 cols text;
 begin
  select * into strict g from private.demo_golden_v1
  where baseline_key='familie-mueller-golden-2026-10-09-v2' and user_id=p_user_id and sealed;
  perform pg_advisory_xact_lock(hashtextextended('demo-golden:'||p_user_id::text,0));
  select household_id into current_household from public.demo_instances
  where user_id=p_user_id for update;
  if current_household is distinct from g.household_id then
   raise exception 'Demo-Haushalt hat sich verändert. Wiederherstellung abgebrochen.';
  end if;
  if not exists(select 1 from public.households where id=g.household_id and owner_user_id=p_user_id) then
   raise exception 'Demo owner/household mismatch. Nothing modified.';
  end if;

  create temporary table if not exists demo_snapshot_restore_order(name text primary key, seq integer)
   on commit drop;
  truncate table pg_temp.demo_snapshot_restore_order;
  insert into pg_temp.demo_snapshot_restore_order(name)
  select table_name from private.demo_golden_rows_v1 where baseline_key=g.baseline_key;

  select count(*) into expected_tables from pg_temp.demo_snapshot_restore_order;
  if expected_tables<>42 then raise exception 'Golden snapshot table count changed: %',expected_tables;end if;

  -- Resolve all foreign-key dependencies before deleting any data.
  while exists(select 1 from pg_temp.demo_snapshot_restore_order where seq is null) loop
    select o.name into next_table from pg_temp.demo_snapshot_restore_order o
    where o.seq is null
      and not exists (
       select 1 from pg_constraint fk
       join pg_class child on child.oid=fk.conrelid
       join pg_namespace ns on ns.oid=child.relnamespace
       join pg_class parent on parent.oid=fk.confrelid
       join pg_temp.demo_snapshot_restore_order dep on dep.name=parent.relname and dep.seq is null
       where fk.contype='f' and ns.nspname='public'
         and child.relname=o.name and parent.relname<>o.name
      )
    order by o.name limit 1;
    if next_table is null then raise exception 'Snapshot tables have circular FK dependencies';end if;
    ordinal:=ordinal+1;
    update pg_temp.demo_snapshot_restore_order set seq=ordinal where name=next_table;
    next_table:=null;
  end loop;
  -- Delete only demo-household business data. Login, memberships and golden baseline remain untouched.
  for t in select name from pg_temp.demo_snapshot_restore_order order by seq desc loop
    execute format('delete from public.%I where household_id=$1',t.name) using g.household_id;
  end loop;

  update public.households set
   name=g.household_record->>'name',
   country_code=g.household_record->>'country_code',
   base_currency=g.household_record->>'base_currency',
   tax_region_code=g.household_record->>'tax_region_code'
  where id=g.household_id;
  update public.profiles set
   display_name=g.profile_record->>'display_name',
   country_code=g.profile_record->>'country_code',
   base_currency=g.profile_record->>'base_currency',
   locale=g.profile_record->>'locale',
   onboarding_completed_at=(g.profile_record->>'onboarding_completed_at')::timestamptz,
   preferences=g.profile_record->'preferences'
  where user_id=p_user_id;

  perform set_config('request.jwt.claim.sub',p_user_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  -- Restore original UUIDs so every relationship continues pointing to the original record.
  for t in select o.name,o.seq,s.contents,s.row_count from pg_temp.demo_snapshot_restore_order o
   join private.demo_golden_rows_v1 s on s.table_name=o.name and s.baseline_key=g.baseline_key
   order by o.seq loop
    select string_agg(format('%I',column_name),',' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema='public' and table_name=t.name
      and is_generated='NEVER' and is_identity='NO';
    if cols is null then raise exception 'Cannot determine columns for table %',t.name;end if;
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',
      t.name,cols,cols,t.name)
      using t.contents;
    execute format('select count(*) from public.%I where household_id=$1',t.name)
      into actual_count using g.household_id;
    if actual_count<>t.row_count then
       raise exception 'Golden restore count mismatch for %: % vs %',t.name,actual_count,t.row_count;
    end if;
    total:=total+actual_count;
  end loop;
  update public.demo_instances set reset_at=now()
    where household_id=g.household_id and user_id=p_user_id;
  return jsonb_build_object('ok',true,'source','sealed_golden_snapshot',
    'baseline',g.baseline_key,'baseline_captured_at',g.captured_at,
    'household_id',g.household_id,'restored_tables',expected_tables,
    'restored_rows',total,'restored_transactions',
     (select count(*) from public.transactions where household_id=g.household_id));
end $function$

CREATE OR REPLACE FUNCTION public.restore_demo_golden_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'pg_temp'
AS $function$select private.restore_demo_golden_v1(p_user_id)$function$

revoke all on function private.restore_demo_golden_v1(uuid) from public,anon,authenticated;
revoke all on function public.restore_demo_golden_v1(uuid) from public,anon,authenticated;
grant execute on function public.restore_demo_golden_v1(uuid) to service_role;
CREATE OR REPLACE FUNCTION private.prevent_golden_change_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'private', 'pg_temp'
AS $function$
begin
 raise exception 'Der eingefrorene Demo-Referenzstand darf nicht verändert oder gelöscht werden.';
end $function$

revoke all on function private.prevent_golden_change_v1() from public,anon,authenticated;
drop trigger if exists demo_golden_protect_header on private.demo_golden_v1;
create trigger demo_golden_protect_header before update or delete on private.demo_golden_v1 for each row execute function private.prevent_golden_change_v1();
drop trigger if exists demo_golden_protect_rows on private.demo_golden_rows_v1;
create trigger demo_golden_protect_rows before update or delete on private.demo_golden_rows_v1 for each row execute function private.prevent_golden_change_v1();
commit;
-- Current protected snapshot is familie-mueller-golden-2026-10-09-v2.
-- Restore through owner-authorized admin-users Edge Function only.
