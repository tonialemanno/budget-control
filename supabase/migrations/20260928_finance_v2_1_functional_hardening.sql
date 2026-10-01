-- Finance V2.1 functional hardening
-- Fixes category nesting, CSV duplicate handling, module enforcement,
-- account integrity and cross-currency transfers.

-- 1) Account types: online banks / e-wallets are first-class liquid accounts.
alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts add constraint accounts_account_type_check
check (account_type in ('checking','savings','cash','credit_card','wallet','investment','pension','other'));

-- 2) CSV duplicate protection must be addressable by PostgREST ON CONFLICT.
-- A normal UNIQUE constraint still permits multiple NULL external references.
drop index if exists public.transactions_household_external_reference_uq;
alter table public.transactions drop constraint if exists transactions_household_external_reference_key;
alter table public.transactions
  add constraint transactions_household_external_reference_key
  unique (household_id, external_reference);

-- 3) Correct correlated parent-category checks.
drop policy if exists categories_insert_writer on public.categories;
create policy categories_insert_writer
on public.categories for insert to authenticated
with check (
  private.can_write_household(household_id)
  and (
    categories.parent_id is null
    or exists (
      select 1
      from public.categories p
      where p.id = categories.parent_id
        and p.household_id = categories.household_id
        and p.kind = categories.kind
    )
  )
);

drop policy if exists categories_update_writer on public.categories;
create policy categories_update_writer
on public.categories for update to authenticated
using (private.can_write_household(household_id))
with check (
  private.can_write_household(household_id)
  and (
    categories.parent_id is null
    or exists (
      select 1
      from public.categories p
      where p.id = categories.parent_id
        and p.household_id = categories.household_id
        and p.kind = categories.kind
        and p.id <> categories.id
    )
  )
);

-- 4) Module access is a backend permission, not just a navigation choice.
create or replace function private.has_module_access(p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.product_modules pm
    left join public.user_module_access uma
      on uma.module_key = pm.key
     and uma.user_id = auth.uid()
    where pm.key = p_module_key
      and pm.is_available = true
      and (pm.is_core = true or coalesce(uma.enabled, false) = true)
  );
$$;

revoke execute on function private.has_module_access(text) from public, anon;
grant execute on function private.has_module_access(text) to authenticated;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('budgets','budget'),
      ('bills','bills'),
      ('contracts','bills'),
      ('savings_goals','goals'),
      ('debts','debts'),
      ('legal_cases','legal'),
      ('legal_case_events','legal'),
      ('assets','wealth'),
      ('properties','property'),
      ('vehicles','vehicles'),
      ('insurance_policies','insurance'),
      ('investments','investments'),
      ('pension_accounts','pension')
    ) as x(table_name,module_key)
  loop
    execute format('drop policy if exists module_access_gate on public.%I', r.table_name);
    execute format(
      'create policy module_access_gate on public.%I as restrictive for all to authenticated using ((select private.has_module_access(%L))) with check ((select private.has_module_access(%L)))',
      r.table_name, r.module_key, r.module_key
    );
  end loop;
end $$;

-- 5) Once an account has bookings, changing its currency would corrupt history.
create or replace function private.protect_account_currency_history()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.currency is distinct from old.currency
     and exists (select 1 from public.transactions t where t.account_id = old.id) then
    raise exception 'Die Kontowährung kann nach der ersten Buchung nicht mehr geändert werden. Lege für eine andere Währung ein separates Konto an.';
  end if;
  return new;
end;
$$;

revoke execute on function private.protect_account_currency_history() from public, anon, authenticated;
drop trigger if exists accounts_protect_currency_history on public.accounts;
create trigger accounts_protect_currency_history
before update of currency on public.accounts
for each row execute function private.protect_account_currency_history();

-- Preserve transaction history when an account exists. Accounts with bookings must be archived, not deleted.
alter table public.transactions drop constraint if exists transactions_account_id_fkey;
alter table public.transactions
  add constraint transactions_account_id_fkey
  foreign key (account_id) references public.accounts(id) on delete restrict;

-- 6) Cross-currency transfers: source and target amounts are explicit.
create or replace function public.create_transfer_v2(
  p_household_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_from_amount numeric,
  p_to_amount numeric,
  p_occurred_at timestamptz,
  p_description text default 'Umbuchung'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_group_id uuid := gen_random_uuid();
  v_from_currency text;
  v_to_currency text;
begin
  if p_from_account_id = p_to_account_id then
    raise exception 'Quell- und Zielkonto müssen unterschiedlich sein.';
  end if;
  if p_from_amount <= 0 or p_to_amount <= 0 then
    raise exception 'Quell- und Zielbetrag müssen grösser als 0 sein.';
  end if;

  select currency into v_from_currency
  from public.accounts
  where id = p_from_account_id and household_id = p_household_id;

  select currency into v_to_currency
  from public.accounts
  where id = p_to_account_id and household_id = p_household_id;

  if v_from_currency is null or v_to_currency is null then
    raise exception 'Quell- oder Zielkonto wurde nicht gefunden.';
  end if;

  insert into public.transactions (
    household_id, account_id, occurred_at, amount, currency, description,
    status, source, transfer_group_id, created_by
  ) values (
    p_household_id, p_from_account_id, p_occurred_at, -abs(p_from_amount), v_from_currency, p_description,
    'booked', 'manual', v_group_id, auth.uid()
  );

  insert into public.transactions (
    household_id, account_id, occurred_at, amount, currency, description,
    status, source, transfer_group_id, created_by
  ) values (
    p_household_id, p_to_account_id, p_occurred_at, abs(p_to_amount), v_to_currency, p_description,
    'booked', 'manual', v_group_id, auth.uid()
  );

  return v_group_id;
end;
$$;

grant execute on function public.create_transfer_v2(uuid,uuid,uuid,numeric,numeric,timestamptz,text) to authenticated;
revoke execute on function public.create_transfer_v2(uuid,uuid,uuid,numeric,numeric,timestamptz,text) from public, anon;

create or replace function public.delete_transfer_v2(
  p_household_id uuid,
  p_transfer_group_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_deleted integer;
begin
  delete from public.transactions
  where household_id = p_household_id
    and transfer_group_id = p_transfer_group_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Umbuchung wurde nicht gefunden oder darf nicht gelöscht werden.';
  end if;
  return v_deleted;
end;
$$;

grant execute on function public.delete_transfer_v2(uuid,uuid) to authenticated;
revoke execute on function public.delete_transfer_v2(uuid,uuid) from public, anon;
