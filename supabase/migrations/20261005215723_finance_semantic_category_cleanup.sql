-- Savings between own accounts are transfers, not spending. Add durable legal/refund categories.

update public.country_category_catalog
set active=false, updated_at=now()
where kind='expense'
  and normalized_key='sparen'
  and country_code in ('CH','DE');

insert into public.country_category_catalog(country_code,name,kind,normalized_key,sort_order,active)
values
 ('CH','Rückerstattung','income','ruckerstattung',15,true),
 ('CH','Rückzahlung','income','ruckzahlung',16,true),
 ('CH','Rechts- & Gerichtskosten','expense','rechts gerichtskosten',215,true),
 ('DE','Rückerstattung','income','ruckerstattung',15,true),
 ('DE','Rückzahlung','income','ruckzahlung',16,true),
 ('DE','Rechts- & Gerichtskosten','expense','rechts gerichtskosten',215,true)
on conflict (country_code,kind,normalized_key) do update
set name=excluded.name,
    sort_order=excluded.sort_order,
    active=true,
    updated_at=now();
