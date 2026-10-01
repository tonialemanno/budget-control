-- Finance V2.2 Beta 2 – import intelligence and merchant identity.
-- Merchants are Finance-Core objects. Import batches can be traced to their transactions.

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  normalized_key text not null,
  default_category_id uuid references public.categories(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_key)
);

alter table public.merchants enable row level security;

grant select, insert, update, delete on table public.merchants to authenticated;

create policy merchants_member_read on public.merchants
for select using (private.is_household_member(household_id));

create policy merchants_writer_insert on public.merchants
for insert with check (
  private.can_write_household(household_id)
  and (default_category_id is null or exists (
    select 1 from public.categories c
    where c.id = merchants.default_category_id and c.household_id = merchants.household_id
  ))
);

create policy merchants_writer_update on public.merchants
for update using (private.can_write_household(household_id))
with check (
  private.can_write_household(household_id)
  and (default_category_id is null or exists (
    select 1 from public.categories c
    where c.id = merchants.default_category_id and c.household_id = merchants.household_id
  ))
);

create policy merchants_writer_delete on public.merchants
for delete using (private.can_write_household(household_id));

create index if not exists merchants_household_name_idx
  on public.merchants(household_id, name);

alter table public.transactions
  add column if not exists merchant_id uuid references public.merchants(id) on delete set null,
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

create index if not exists transactions_merchant_idx on public.transactions(merchant_id);
create index if not exists transactions_import_batch_idx on public.transactions(import_batch_id);

create or replace function private.validate_transaction_import_refs()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.merchant_id is not null and not exists (
    select 1 from public.merchants m where m.id = new.merchant_id and m.household_id = new.household_id
  ) then
    raise exception 'Merchant does not belong to transaction household';
  end if;

  if new.import_batch_id is not null and not exists (
    select 1 from public.import_batches b where b.id = new.import_batch_id and b.household_id = new.household_id
  ) then
    raise exception 'Import batch does not belong to transaction household';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_transaction_import_refs() from public;

drop trigger if exists transactions_validate_import_refs on public.transactions;
create trigger transactions_validate_import_refs
before insert or update of household_id, merchant_id, import_batch_id
on public.transactions
for each row execute function private.validate_transaction_import_refs();
