-- Finance V2.3 – backend guard for tax module metadata.
-- Core transactions/documents remain readable without the tax module,
-- but tax-specific metadata can only be created or changed when the user has tax access.

create or replace function private.guard_transaction_tax_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if (coalesce(new.tax_relevant,false) or new.tax_category is not null)
       and not private.has_module_access('tax') then
      raise exception 'Das Modul Steuern & Steuerberater ist nicht freigeschaltet.';
    end if;
  elsif (new.tax_relevant is distinct from old.tax_relevant
      or new.tax_category is distinct from old.tax_category)
      and not private.has_module_access('tax') then
    raise exception 'Das Modul Steuern & Steuerberater ist nicht freigeschaltet.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_transaction_tax_fields() from public;

drop trigger if exists transactions_guard_tax_fields on public.transactions;
create trigger transactions_guard_tax_fields
before insert or update of tax_relevant, tax_category
on public.transactions
for each row execute function private.guard_transaction_tax_fields();

create or replace function private.guard_document_tax_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if (coalesce(new.tax_relevant,false) or new.tax_year is not null or new.tax_category is not null)
       and not private.has_module_access('tax') then
      raise exception 'Das Modul Steuern & Steuerberater ist nicht freigeschaltet.';
    end if;
  elsif (new.tax_relevant is distinct from old.tax_relevant
      or new.tax_year is distinct from old.tax_year
      or new.tax_category is distinct from old.tax_category)
      and not private.has_module_access('tax') then
    raise exception 'Das Modul Steuern & Steuerberater ist nicht freigeschaltet.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_document_tax_fields() from public;

drop trigger if exists documents_guard_tax_fields on public.documents;
create trigger documents_guard_tax_fields
before insert or update of tax_relevant, tax_year, tax_category
on public.documents
for each row execute function private.guard_document_tax_fields();
