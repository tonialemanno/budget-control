-- Country-wide master data catalogs for reusable categories and merchants.
-- Financial records remain household-local; only metadata is shared.

create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.role in ('admin','owner','superadmin')
  );
$$;

create table if not exists public.country_category_catalog (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('CH','DE')),
  name text not null,
  kind text not null check (kind in ('income','expense')),
  normalized_key text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, kind, normalized_key)
);

create table if not exists public.country_merchant_catalog (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('CH','DE')),
  name text not null,
  normalized_key text not null,
  category_catalog_id uuid references public.country_category_catalog(id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, normalized_key)
);

create index if not exists country_category_catalog_country_active_idx
  on public.country_category_catalog(country_code, active, sort_order);

create index if not exists country_merchant_catalog_country_active_idx
  on public.country_merchant_catalog(country_code, active, name);

alter table public.country_category_catalog enable row level security;
alter table public.country_merchant_catalog enable row level security;

drop policy if exists country_category_catalog_read on public.country_category_catalog;
create policy country_category_catalog_read
on public.country_category_catalog
for select
to authenticated
using (true);

drop policy if exists country_category_catalog_admin_insert on public.country_category_catalog;
create policy country_category_catalog_admin_insert
on public.country_category_catalog
for insert
to authenticated
with check (private.is_app_admin());

drop policy if exists country_category_catalog_admin_update on public.country_category_catalog;
create policy country_category_catalog_admin_update
on public.country_category_catalog
for update
to authenticated
using (private.is_app_admin())
with check (private.is_app_admin());

drop policy if exists country_category_catalog_admin_delete on public.country_category_catalog;
create policy country_category_catalog_admin_delete
on public.country_category_catalog
for delete
to authenticated
using (private.is_app_admin());

drop policy if exists country_merchant_catalog_read on public.country_merchant_catalog;
create policy country_merchant_catalog_read
on public.country_merchant_catalog
for select
to authenticated
using (true);

drop policy if exists country_merchant_catalog_admin_insert on public.country_merchant_catalog;
create policy country_merchant_catalog_admin_insert
on public.country_merchant_catalog
for insert
to authenticated
with check (private.is_app_admin());

drop policy if exists country_merchant_catalog_admin_update on public.country_merchant_catalog;
create policy country_merchant_catalog_admin_update
on public.country_merchant_catalog
for update
to authenticated
using (private.is_app_admin())
with check (private.is_app_admin());

drop policy if exists country_merchant_catalog_admin_delete on public.country_merchant_catalog;
create policy country_merchant_catalog_admin_delete
on public.country_merchant_catalog
for delete
to authenticated
using (private.is_app_admin());

-- Swiss baseline categories. Household-local customizations are never overwritten.
insert into public.country_category_catalog(country_code,name,kind,normalized_key,sort_order)
values
 ('CH','Lohn','income','lohn',10),
 ('CH','Sonstige Einnahmen','income','sonstige einnahmen',20),
 ('CH','Wohnen','expense','wohnen',100),
 ('CH','Lebensmittel','expense','lebensmittel',110),
 ('CH','Krankenkasse','expense','krankenkasse',120),
 ('CH','Versicherungen','expense','versicherungen',130),
 ('CH','Mobilität','expense','mobilitat',140),
 ('CH','Steuern','expense','steuern',150),
 ('CH','Freizeit','expense','freizeit',160),
 ('CH','Restaurant','expense','restaurant',170),
 ('CH','Abos & Verträge','expense','abos und vertrage',180),
 ('CH','Gesundheit','expense','gesundheit',190),
 ('CH','Shopping','expense','shopping',200),
 ('CH','Tabak','expense','tabak',210),
 ('CH','Sparen','expense','sparen',220),
 ('CH','Sonstiges','expense','sonstiges',230)
on conflict (country_code,kind,normalized_key) do update
set name=excluded.name, sort_order=excluded.sort_order, active=true, updated_at=now();

-- Curated Swiss merchants. No personal/private counterparties are seeded.
with seed(name,normalized_key,category_key) as (
  values
   ('Migros Restaurant','migros restaurant','restaurant'),
   ('Coop Restaurant','coop restaurant','restaurant'),
   ('McDonald''s','mcdonalds','restaurant'),
   ('Migros','migros','lebensmittel'),
   ('Coop','coop','lebensmittel'),
   ('Denner','denner','lebensmittel'),
   ('Aldi Suisse','aldi suisse','lebensmittel'),
   ('Lidl','lidl','lebensmittel'),
   ('MediaMarkt','mediamarkt','shopping'),
   ('Digitec','digitec','shopping'),
   ('Galaxus','galaxus','shopping'),
   ('Sanitas','sanitas','krankenkasse'),
   ('Groupe Mutuel / Avenir','groupe mutuel avenir','krankenkasse'),
   ('Helsana','helsana','krankenkasse'),
   ('Swica','swica','krankenkasse'),
   ('SBB','sbb','mobilitat'),
   ('VBSG / Verkehrsbetriebe','vbsg','mobilitat'),
   ('ParkingPay','parkingpay','mobilitat'),
   ('Netflix','netflix','abos und vertrage'),
   ('Sunrise / Yallo','sunrise yallo','abos und vertrage'),
   ('Wellauer AG','wellauer ag','tabak')
)
insert into public.country_merchant_catalog(country_code,name,normalized_key,category_catalog_id)
select 'CH', s.name, s.normalized_key, c.id
from seed s
join public.country_category_catalog c
  on c.country_code='CH'
 and c.kind='expense'
 and c.normalized_key=s.category_key
on conflict (country_code,normalized_key) do update
set name=excluded.name,
    category_catalog_id=excluded.category_catalog_id,
    active=true,
    updated_at=now();

create or replace function public.install_country_master_data(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_country text;
  v_category_id uuid;
  v_categories_created integer := 0;
  v_merchants_created integer := 0;
  v_merchants_linked integer := 0;
  rec record;
begin
  if not (private.can_write_household(p_household_id) or private.is_app_admin()) then
    raise exception 'Keine Berechtigung für diesen Haushalt.';
  end if;

  select h.country_code into v_country
  from public.households h
  where h.id=p_household_id;

  if v_country is null then
    raise exception 'Haushalt wurde nicht gefunden.';
  end if;

  for rec in
    select *
    from public.country_category_catalog
    where country_code=v_country and active=true
    order by kind,sort_order,name
  loop
    select c.id into v_category_id
    from public.categories c
    where c.household_id=p_household_id
      and c.kind=rec.kind
      and lower(trim(c.name))=lower(trim(rec.name))
    order by c.created_at
    limit 1;

    if v_category_id is null then
      insert into public.categories(household_id,name,kind,sort_order,created_by)
      values(p_household_id,rec.name,rec.kind,rec.sort_order,auth.uid())
      returning id into v_category_id;
      v_categories_created := v_categories_created + 1;
    end if;
  end loop;

  for rec in
    select m.*, c.name as category_name, c.kind as category_kind
    from public.country_merchant_catalog m
    left join public.country_category_catalog c on c.id=m.category_catalog_id
    where m.country_code=v_country and m.active=true
    order by m.name
  loop
    v_category_id := null;
    if rec.category_name is not null then
      select c.id into v_category_id
      from public.categories c
      where c.household_id=p_household_id
        and c.kind=rec.category_kind
        and lower(trim(c.name))=lower(trim(rec.category_name))
      order by c.created_at
      limit 1;
    end if;

    if exists (
      select 1 from public.merchants m
      where m.household_id=p_household_id
        and m.normalized_key=rec.normalized_key
    ) then
      update public.merchants m
      set name=rec.name,
          default_category_id=coalesce(m.default_category_id,v_category_id),
          updated_at=now()
      where m.household_id=p_household_id
        and m.normalized_key=rec.normalized_key
        and (m.name is distinct from rec.name or (m.default_category_id is null and v_category_id is not null));
      if found then v_merchants_linked := v_merchants_linked + 1; end if;
    else
      insert into public.merchants(household_id,name,normalized_key,default_category_id,created_by)
      values(p_household_id,rec.name,rec.normalized_key,v_category_id,auth.uid());
      v_merchants_created := v_merchants_created + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'country_code',v_country,
    'categories_created',v_categories_created,
    'merchants_created',v_merchants_created,
    'merchants_linked',v_merchants_linked
  );
end;
$$;

create or replace function public.list_master_data_households()
returns table(id uuid,name text,country_code text,base_currency text)
language sql
stable
security definer
set search_path = public, private
as $$
  select h.id,h.name,h.country_code,h.base_currency
  from public.households h
  where private.is_app_admin()
     or exists (
       select 1
       from public.household_members hm
       where hm.household_id=h.id
         and hm.user_id=auth.uid()
         and hm.role in ('owner','admin')
     )
  order by h.name,h.created_at;
$$;

create or replace function public.copy_household_master_data(
  p_source_household_id uuid,
  p_target_household_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
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
      select c,t.depth+1
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
$$;

create or replace function public.promote_merchant_to_country_catalog(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_country text;
  v_merchant public.merchants%rowtype;
  v_category public.categories%rowtype;
  v_category_key text;
  v_catalog_category_id uuid;
begin
  if not private.is_app_admin() then
    raise exception 'Nur App-Admins dürfen globale Stammdaten freigeben.';
  end if;

  select m.* into v_merchant
  from public.merchants m
  where m.id=p_merchant_id;

  if v_merchant.id is null then
    raise exception 'Händler wurde nicht gefunden.';
  end if;

  select h.country_code into v_country
  from public.households h
  where h.id=v_merchant.household_id;

  if v_merchant.default_category_id is null then
    raise exception 'Bitte dem Händler zuerst eine Standardkategorie zuweisen.';
  end if;

  select c.* into v_category
  from public.categories c
  where c.id=v_merchant.default_category_id;

  v_category_key := lower(trim(regexp_replace(v_category.name,'\s+',' ','g')));

  insert into public.country_category_catalog(
    country_code,name,kind,normalized_key,sort_order,created_by
  )
  values(
    v_country,v_category.name,v_category.kind,v_category_key,v_category.sort_order,auth.uid()
  )
  on conflict (country_code,kind,normalized_key) do update
  set name=excluded.name,
      active=true,
      updated_at=now()
  returning id into v_catalog_category_id;

  insert into public.country_merchant_catalog(
    country_code,name,normalized_key,category_catalog_id,created_by
  )
  values(
    v_country,v_merchant.name,v_merchant.normalized_key,v_catalog_category_id,auth.uid()
  )
  on conflict (country_code,normalized_key) do update
  set name=excluded.name,
      category_catalog_id=excluded.category_catalog_id,
      active=true,
      updated_at=now();

  return jsonb_build_object(
    'country_code',v_country,
    'merchant',v_merchant.name,
    'category',v_category.name
  );
end;
$$;

create or replace function public.promote_category_to_country_catalog(p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_country text;
  v_category public.categories%rowtype;
  v_key text;
begin
  if not private.is_app_admin() then
    raise exception 'Nur App-Admins dürfen globale Stammdaten freigeben.';
  end if;

  select c.* into v_category
  from public.categories c
  where c.id=p_category_id and c.is_archived=false;

  if v_category.id is null then
    raise exception 'Kategorie wurde nicht gefunden.';
  end if;

  select h.country_code into v_country
  from public.households h
  where h.id=v_category.household_id;

  v_key := lower(trim(regexp_replace(v_category.name,'\s+',' ','g')));

  insert into public.country_category_catalog(
    country_code,name,kind,normalized_key,sort_order,created_by
  )
  values(
    v_country,v_category.name,v_category.kind,v_key,v_category.sort_order,auth.uid()
  )
  on conflict (country_code,kind,normalized_key) do update
  set name=excluded.name,
      active=true,
      updated_at=now();

  return jsonb_build_object('country_code',v_country,'category',v_category.name);
end;
$$;

revoke all on function public.install_country_master_data(uuid) from public;
revoke all on function public.list_master_data_households() from public;
revoke all on function public.copy_household_master_data(uuid,uuid) from public;
revoke all on function public.promote_merchant_to_country_catalog(uuid) from public;
revoke all on function public.promote_category_to_country_catalog(uuid) from public;

grant execute on function public.install_country_master_data(uuid) to authenticated;
grant execute on function public.list_master_data_households() to authenticated;
grant execute on function public.copy_household_master_data(uuid,uuid) to authenticated;
grant execute on function public.promote_merchant_to_country_catalog(uuid) to authenticated;
grant execute on function public.promote_category_to_country_catalog(uuid) to authenticated;
