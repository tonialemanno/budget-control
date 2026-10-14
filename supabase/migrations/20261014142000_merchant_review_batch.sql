-- One atomic API call for all pending merchant comparisons; bank transactions are never deleted.
-- SECURITY INVOKER preserves household/editor permissions and profile ownership RLS.
create or replace function public.review_merchants_batch_v1(
  p_household_id uuid,
  p_decisions jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = 'pg_catalog','public','private'
as $$
declare
  v_decision jsonb;
  v_canonical uuid;
  v_duplicate uuid;
  v_choice text;
  v_pair text;
  v_pairs text[] := array[]::text[];
  v_merge_sources uuid[] := array[]::uuid[];
  v_merge_targets uuid[] := array[]::uuid[];
  v_ignored text[] := array[]::text[];
  v_existing text[] := array[]::text[];
  v_preferences jsonb;
  v_index integer;
  v_merges integer := 0;
  v_ignored_count integer := 0;
  v_seen_count integer := 0;
begin
  if (select auth.uid()) is null or not private.can_write_household(p_household_id) then
    raise exception 'Keine Schreibberechtigung für diese Händlerprüfung' using errcode='42501';
  end if;
  if jsonb_typeof(p_decisions) <> 'array' or jsonb_array_length(p_decisions) < 1
      or jsonb_array_length(p_decisions) > 200 then
    raise exception 'Bitte 1 bis 200 Händlerentscheidungen auswählen';
  end if;

  -- Validate the complete draft before any write. A pair may be decided only once.
  for v_decision in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(v_decision)<>'object' then
      raise exception 'Ungültige Händlerentscheidung';
    end if;
    v_canonical := nullif(v_decision->>'canonicalId','')::uuid;
    v_duplicate := nullif(v_decision->>'duplicateId','')::uuid;
    v_choice := v_decision->>'choice';
    if v_canonical is null or v_duplicate is null or v_canonical=v_duplicate
        or v_choice not in ('merge','ignore') or v_choice is null then
      raise exception 'Ungültige Händlerentscheidung';
    end if;
    if not exists(select 1 from public.merchants where id=v_canonical and household_id=p_household_id)
      or not exists(select 1 from public.merchants where id=v_duplicate and household_id=p_household_id) then
      raise exception 'Ein Händler wurde inzwischen geändert. Bitte die Händlerprüfung neu laden.';
    end if;
    v_pair := least(v_canonical::text,v_duplicate::text)||':'||greatest(v_canonical::text,v_duplicate::text);
    if v_pair=any(v_pairs) then raise exception 'Händlervergleich doppelt ausgewählt'; end if;
    v_pairs:=array_append(v_pairs,v_pair);
    if v_choice='merge' then
      if v_duplicate=any(v_merge_sources) then
        raise exception 'Ein Händler soll in mehrere Zielhändler zusammengeführt werden';
      end if;
      v_merge_sources:=array_append(v_merge_sources,v_duplicate);
      v_merge_targets:=array_append(v_merge_targets,v_canonical);
    else
      v_ignored:=array_append(v_ignored,v_pair);
    end if;
  end loop;

  for v_index in 1..coalesce(array_length(v_merge_sources,1),0) loop
    if v_merge_sources[v_index]=any(v_merge_targets) then
      raise exception 'Zielhändler kann nicht zugleich als Dublette zusammengeführt werden';
    end if;
  end loop;
  for v_index in 1..coalesce(array_length(v_ignored,1),0) loop
    if exists (
      select 1 from unnest(v_merge_sources) as dup
      where v_ignored[v_index] like dup::text||':%'
        or v_ignored[v_index] like '%:'||dup::text
    ) then
      raise exception 'Widersprüchliche Händlerentscheidungen: Zusammenführen und Nicht identisch';
    end if;
  end loop;

  -- Existing RPC preserves aliases, linked bookings, budgets and recurring rules.
  -- A closed financial year prevents the merge and rolls back this entire batch.
  for v_index in 1..coalesce(array_length(v_merge_sources,1),0) loop
    perform public.merge_merchants_v2(p_household_id,v_merge_targets[v_index],v_merge_sources[v_index]);
    v_merges:=v_merges+1;
  end loop;

  if coalesce(array_length(v_ignored,1),0)>0 then
    select coalesce(preferences,'{}'::jsonb) into v_preferences
    from public.profiles where user_id=(select auth.uid()) for update;
    if not found then raise exception 'Benutzerprofil nicht gefunden'; end if;
    if jsonb_typeof(v_preferences->'merchant_duplicate_ignores')='array' then
      select coalesce(array_agg(value order by ord),'{}'::text[]) into v_existing
      from jsonb_array_elements_text(v_preferences->'merchant_duplicate_ignores') with ordinality as t(value,ord);
    end if;
    for v_index in 1..array_length(v_ignored,1) loop
      if not v_ignored[v_index]=any(v_existing) then
        v_existing:=array_append(v_existing,v_ignored[v_index]);
        v_ignored_count:=v_ignored_count+1;
      end if;
    end loop;
    v_seen_count:=coalesce(array_length(v_existing,1),0);
    if v_seen_count>500 then v_existing:=v_existing[(v_seen_count-499):v_seen_count]; end if;
    update public.profiles
       set preferences=jsonb_set(v_preferences,'{merchant_duplicate_ignores}',to_jsonb(v_existing),true),
           updated_at=now()
     where user_id=(select auth.uid());
    if not found then raise exception 'Händlerentscheidungen konnten nicht gespeichert werden'; end if;
  end if;

  return jsonb_build_object('merged',v_merges,'ignored',v_ignored_count,'processed',jsonb_array_length(p_decisions));
end;
$$;
revoke all on function public.review_merchants_batch_v1(uuid,jsonb) from public,anon;
grant execute on function public.review_merchants_batch_v1(uuid,jsonb) to authenticated;
