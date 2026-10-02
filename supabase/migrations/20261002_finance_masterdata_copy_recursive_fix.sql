CREATE OR REPLACE FUNCTION private.copy_household_master_data_internal(p_source_household_id uuid, p_target_household_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_source_country text;
  v_target_country text;
  v_target_category_id uuid;
  v_target_parent_id uuid;
  v_categories_created integer := 0;
  v_merchants_created integer := 0;
  v_merchants_linked integer := 0;
  v_rules_created integer := 0;
  rec record;
begin
  if p_source_household_id=p_target_household_id then
    raise exception 'Quell- und Zielhaushalt müssen unterschiedlich sein.';
  end if;

  if not (
    private.is_app_admin()
    or (
      private.can_admin_household(p_source_household_id)
      and private.can_admin_household(p_target_household_id)
    )
  ) then
    raise exception 'Für beide Haushalte sind Admin-Rechte erforderlich.';
  end if;

  select country_code into v_source_country from public.households where id=p_source_household_id;
  select country_code into v_target_country from public.households where id=p_target_household_id;

  if v_source_country is null or v_target_country is null then
    raise exception 'Quell- oder Zielhaushalt wurde nicht gefunden.';
  end if;
  if v_source_country<>v_target_country then
    raise exception 'Stammdaten können nur zwischen Haushalten desselben Landes übernommen werden.';
  end if;

  create temporary table if not exists tmp_finance_category_map(
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  truncate tmp_finance_category_map;

  for rec in
    with recursive tree as (
      select c.*,0 as depth
      from public.categories c
      where c.household_id=p_source_household_id
        and c.parent_id is null
        and c.is_archived=false
      union all
      select c.*,t.depth+1
      from public.categories c
      join tree t on c.parent_id=t.id
      where c.household_id=p_source_household_id
        and c.is_archived=false
    )
    select * from tree order by depth,kind,sort_order,name
  loop
    v_target_parent_id := null;
    if rec.parent_id is not null then
      select target_id into v_target_parent_id
      from tmp_finance_category_map
      where source_id=rec.parent_id;
    end if;

    select c.id into v_target_category_id
    from public.categories c
    where c.household_id=p_target_household_id
      and c.kind=rec.kind
      and lower(trim(c.name))=lower(trim(rec.name))
      and (
        (v_target_parent_id is null and c.parent_id is null)
        or c.parent_id=v_target_parent_id
      )
    order by c.created_at
    limit 1;

    if v_target_category_id is null then
      insert into public.categories(
        household_id,parent_id,name,kind,icon,color,sort_order,is_archived,created_by
      )
      values(
        p_target_household_id,v_target_parent_id,rec.name,rec.kind,
        rec.icon,rec.color,rec.sort_order,false,auth.uid()
      )
      returning id into v_target_category_id;
      v_categories_created := v_categories_created + 1;
    end if;

    insert into tmp_finance_category_map(source_id,target_id)
    values(rec.id,v_target_category_id)
    on conflict (source_id) do update set target_id=excluded.target_id;
  end loop;

  for rec in
    select m.*, map.target_id as target_category_id
    from public.merchants m
    left join tmp_finance_category_map map on map.source_id=m.default_category_id
    where m.household_id=p_source_household_id
    order by m.name
  loop
    if exists (
      select 1 from public.merchants m
      where m.household_id=p_target_household_id
        and m.normalized_key=rec.normalized_key
    ) then
      update public.merchants m
      set default_category_id=coalesce(m.default_category_id,rec.target_category_id),
          updated_at=now()
      where m.household_id=p_target_household_id
        and m.normalized_key=rec.normalized_key
        and m.default_category_id is null
        and rec.target_category_id is not null;
      if found then v_merchants_linked := v_merchants_linked + 1; end if;
    else
      insert into public.merchants(
        household_id,name,normalized_key,default_category_id,created_by
      )
      values(
        p_target_household_id,rec.name,rec.normalized_key,rec.target_category_id,auth.uid()
      );
      v_merchants_created := v_merchants_created + 1;
    end if;
  end loop;

  for rec in
    select r.*, map.target_id as target_category_id
    from public.categorization_rules r
    join tmp_finance_category_map map on map.source_id=r.category_id
    where r.household_id=p_source_household_id
      and r.active=true
    order by r.priority,r.created_at
  loop
    if not exists (
      select 1
      from public.categorization_rules r
      where r.household_id=p_target_household_id
        and r.category_id=rec.target_category_id
        and r.field_name=rec.field_name
        and r.match_type=rec.match_type
        and lower(trim(r.match_value))=lower(trim(rec.match_value))
    ) then
      insert into public.categorization_rules(
        household_id,category_id,field_name,match_type,match_value,priority,active,created_by
      )
      values(
        p_target_household_id,rec.target_category_id,rec.field_name,rec.match_type,
        rec.match_value,rec.priority,true,auth.uid()
      );
      v_rules_created := v_rules_created + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'categories_created',v_categories_created,
    'merchants_created',v_merchants_created,
    'merchants_linked',v_merchants_linked,
    'rules_created',v_rules_created
  );
end;
$function$
