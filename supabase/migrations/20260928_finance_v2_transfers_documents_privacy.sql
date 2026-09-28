-- Account privacy, transfers and private document storage.

alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts add constraint accounts_account_type_check
check (account_type in ('checking','savings','cash','credit_card','investment','pension','other'));

drop policy if exists accounts_insert_writer on public.accounts;
create policy accounts_insert_writer on public.accounts for insert to authenticated
with check (private.can_write_household(household_id) and owner_user_id = (select auth.uid()));

drop policy if exists accounts_update_writer on public.accounts;
create policy accounts_update_writer on public.accounts for update to authenticated
using (
  private.can_write_household(household_id)
  and (visibility = 'household' or owner_user_id = (select auth.uid()) or private.can_admin_household(household_id))
)
with check (
  private.can_write_household(household_id)
  and (visibility = 'household' or owner_user_id = (select auth.uid()) or private.can_admin_household(household_id))
);

drop policy if exists accounts_delete_admin on public.accounts;
create policy accounts_delete_writer on public.accounts for delete to authenticated
using (
  private.can_write_household(household_id)
  and (visibility = 'household' or owner_user_id = (select auth.uid()) or private.can_admin_household(household_id))
);

drop policy if exists transactions_insert_writer on public.transactions;
create policy transactions_insert_writer on public.transactions for insert to authenticated
with check (
  private.can_write_household(household_id)
  and exists (
    select 1 from public.accounts a
    where a.id = account_id
      and a.household_id = transactions.household_id
      and (a.visibility = 'household' or a.owner_user_id = (select auth.uid()) or private.can_admin_household(transactions.household_id))
  )
  and (category_id is null or exists (
    select 1 from public.categories c
    where c.id = category_id and c.household_id = transactions.household_id
  ))
);

drop policy if exists transactions_update_writer on public.transactions;
create policy transactions_update_writer on public.transactions for update to authenticated
using (
  private.can_write_household(household_id)
  and exists (
    select 1 from public.accounts a
    where a.id = transactions.account_id
      and a.household_id = transactions.household_id
      and (a.visibility = 'household' or a.owner_user_id = (select auth.uid()) or private.can_admin_household(transactions.household_id))
  )
)
with check (
  private.can_write_household(household_id)
  and exists (
    select 1 from public.accounts a
    where a.id = account_id
      and a.household_id = transactions.household_id
      and (a.visibility = 'household' or a.owner_user_id = (select auth.uid()) or private.can_admin_household(transactions.household_id))
  )
  and (category_id is null or exists (
    select 1 from public.categories c
    where c.id = category_id and c.household_id = transactions.household_id
  ))
);

drop policy if exists transactions_delete_writer on public.transactions;
create policy transactions_delete_writer on public.transactions for delete to authenticated
using (
  private.can_write_household(household_id)
  and exists (
    select 1 from public.accounts a
    where a.id = transactions.account_id
      and a.household_id = transactions.household_id
      and (a.visibility = 'household' or a.owner_user_id = (select auth.uid()) or private.can_admin_household(transactions.household_id))
  )
);

create or replace function public.create_transfer(
  p_household_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_currency text,
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
begin
  if p_from_account_id = p_to_account_id then raise exception 'Quell- und Zielkonto müssen unterschiedlich sein.'; end if;
  if p_amount <= 0 then raise exception 'Der Betrag muss grösser als 0 sein.'; end if;

  insert into public.transactions (
    household_id, account_id, occurred_at, amount, currency, description, status, source, transfer_group_id, created_by
  ) values (
    p_household_id, p_from_account_id, p_occurred_at, -abs(p_amount), p_currency, p_description, 'booked', 'manual', v_group_id, auth.uid()
  );

  insert into public.transactions (
    household_id, account_id, occurred_at, amount, currency, description, status, source, transfer_group_id, created_by
  ) values (
    p_household_id, p_to_account_id, p_occurred_at, abs(p_amount), p_currency, p_description, 'booked', 'manual', v_group_id, auth.uid()
  );

  return v_group_id;
end;
$$;

grant execute on function public.create_transfer(uuid,uuid,uuid,numeric,text,timestamptz,text) to authenticated;
revoke execute on function public.create_transfer(uuid,uuid,uuid,numeric,text,timestamptz,text) from anon;

create or replace function private.storage_household_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  first_part text;
  result uuid;
begin
  first_part := split_part(object_name, '/', 1);
  begin result := first_part::uuid; exception when others then return null; end;
  return result;
end;
$$;

revoke execute on function private.storage_household_id(text) from public, anon;
grant execute on function private.storage_household_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('finance-documents', 'finance-documents', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists finance_documents_select on storage.objects;
create policy finance_documents_select on storage.objects for select to authenticated
using (bucket_id = 'finance-documents' and private.is_household_member(private.storage_household_id(name)));

drop policy if exists finance_documents_insert on storage.objects;
create policy finance_documents_insert on storage.objects for insert to authenticated
with check (bucket_id = 'finance-documents' and private.can_write_household(private.storage_household_id(name)));

drop policy if exists finance_documents_update on storage.objects;
create policy finance_documents_update on storage.objects for update to authenticated
using (bucket_id = 'finance-documents' and private.can_write_household(private.storage_household_id(name)))
with check (bucket_id = 'finance-documents' and private.can_write_household(private.storage_household_id(name)));

drop policy if exists finance_documents_delete on storage.objects;
create policy finance_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'finance-documents' and private.can_write_household(private.storage_household_id(name)));
