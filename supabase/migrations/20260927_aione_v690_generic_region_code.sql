alter table public.profiles
  add column if not exists region_code text;

update public.profiles
set region_code = canton_code
where region_code is null and canton_code is not null;

alter table public.profiles drop constraint if exists profiles_region_code_check;
alter table public.profiles add constraint profiles_region_code_check
  check (region_code is null or region_code ~ '^[A-Z]{2}$');
