create table if not exists public.transaction_duplicate_ignores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_a_id uuid not null references public.transactions(id) on delete cascade,
  transaction_b_id uuid not null references public.transactions(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint transaction_duplicate_ignores_distinct check (transaction_a_id <> transaction_b_id),
  constraint transaction_duplicate_ignores_ordered check (transaction_a_id::text < transaction_b_id::text),
  constraint transaction_duplicate_ignores_unique unique (household_id, transaction_a_id, transaction_b_id)
);

alter table public.transaction_duplicate_ignores enable row level security;

drop policy if exists "transaction_duplicate_ignores_read" on public.transaction_duplicate_ignores;
create policy "transaction_duplicate_ignores_read"
on public.transaction_duplicate_ignores
for select
to authenticated
using (private.is_household_member(household_id));

drop policy if exists "transaction_duplicate_ignores_write" on public.transaction_duplicate_ignores;
create policy "transaction_duplicate_ignores_write"
on public.transaction_duplicate_ignores
for insert
to authenticated
with check (private.can_write_household(household_id));

drop policy if exists "transaction_duplicate_ignores_delete" on public.transaction_duplicate_ignores;
create policy "transaction_duplicate_ignores_delete"
on public.transaction_duplicate_ignores
for delete
to authenticated
using (private.can_write_household(household_id));

revoke all on public.transaction_duplicate_ignores from anon;
grant select, insert, delete on public.transaction_duplicate_ignores to authenticated;
grant all on public.transaction_duplicate_ignores to service_role;

create index if not exists transaction_duplicate_ignores_household_idx
  on public.transaction_duplicate_ignores(household_id);
