create or replace function public.merge_merchants_bulk_v1(
  p_household_id uuid,
  p_canonical_merchant_id uuid,
  p_duplicate_merchant_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path to pg_catalog, public, private
as $function$
declare
  v_duplicate_id uuid;
  v_count integer := 0;
begin
  if not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diesen Haushalt.';
  end if;

  if p_canonical_merchant_id is null then
    raise exception 'Bitte einen Zielhändler auswählen.';
  end if;

  if not exists (
    select 1 from public.merchants
    where id=p_canonical_merchant_id and household_id=p_household_id
  ) then
    raise exception 'Zielhändler wurde nicht gefunden.';
  end if;

  if p_duplicate_merchant_ids is null or cardinality(p_duplicate_merchant_ids)=0 then
    raise exception 'Bitte mindestens einen weiteren Händler auswählen.';
  end if;

  for v_duplicate_id in
    select distinct x
    from unnest(p_duplicate_merchant_ids) as x
    where x is not null and x<>p_canonical_merchant_id
  loop
    if not exists (
      select 1 from public.merchants
      where id=v_duplicate_id and household_id=p_household_id
    ) then
      raise exception 'Mindestens ein ausgewählter Händler wurde nicht gefunden.';
    end if;

    perform public.merge_merchants_v2(
      p_household_id,
      p_canonical_merchant_id,
      v_duplicate_id
    );
    v_count := v_count + 1;
  end loop;

  if v_count=0 then
    raise exception 'Bitte mindestens zwei unterschiedliche Händler auswählen.';
  end if;

  return v_count;
end;
$function$;

revoke all on function public.merge_merchants_bulk_v1(uuid,uuid,uuid[]) from public, anon;
grant execute on function public.merge_merchants_bulk_v1(uuid,uuid,uuid[]) to authenticated, service_role;
