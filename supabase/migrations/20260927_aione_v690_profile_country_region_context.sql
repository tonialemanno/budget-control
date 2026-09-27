alter table public.profiles
  add column if not exists country_code text,
  add column if not exists canton_code text,
  add column if not exists municipality text,
  add column if not exists municipality_bfs integer;

update public.profiles
set country_code = case
  when lower(coalesce(country,'')) in ('de','deutschland','germany') then 'DE'
  else 'CH'
end
where country_code is null;

alter table public.profiles drop constraint if exists profiles_language_code_check;
alter table public.profiles add constraint profiles_language_code_check
  check (language_code = any (array['de'::text,'fr'::text,'it'::text,'en'::text,'ro'::text]));

alter table public.profiles drop constraint if exists profiles_country_code_check;
alter table public.profiles add constraint profiles_country_code_check
  check (country_code is null or country_code = any (array['CH'::text,'DE'::text]));

alter table public.profiles drop constraint if exists profiles_canton_code_check;
alter table public.profiles add constraint profiles_canton_code_check
  check (canton_code is null or canton_code ~ '^[A-Z]{2}$');

create or replace function public.aione_sync_profile_country_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.country is distinct from old.country then
    new.country_code := case
      when lower(coalesce(new.country,'')) in ('de','deutschland','germany') then 'DE'
      else coalesce(new.country_code,'CH')
    end;
  elsif new.country_code is distinct from old.country_code then
    if new.country_code = 'DE' then new.country := 'Deutschland'; end if;
    if new.country_code = 'CH' then new.country := 'Schweiz'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aione_sync_profile_country_code on public.profiles;
create trigger trg_aione_sync_profile_country_code
before insert or update of country, country_code on public.profiles
for each row execute function public.aione_sync_profile_country_code();

revoke all on function public.aione_sync_profile_country_code() from public;
