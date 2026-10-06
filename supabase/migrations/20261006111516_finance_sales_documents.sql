create table if not exists public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','quote','receipt')),
  document_number text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','paid','cancelled','expired')),
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  currency text not null check (currency in ('CHF','EUR','USD','GBP')),
  sender_name text,
  sender_address text,
  sender_tax_id text,
  recipient_name text not null,
  recipient_address text,
  intro_text text,
  closing_text text,
  payment_text text,
  notes text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(18,2) not null default 0 check (tax_total >= 0),
  total numeric(18,2) not null default 0 check (total >= 0),
  source_document_id uuid references public.sales_documents(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_documents_number_unique unique (household_id, document_type, document_number)
);

create index if not exists sales_documents_household_issue_idx on public.sales_documents(household_id, issue_date desc, created_at desc);
create index if not exists sales_documents_household_status_idx on public.sales_documents(household_id, document_type, status);

create or replace function private.sales_document_recalculate_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  item_count integer := 0;
  qty numeric;
  unit_price numeric;
  tax_rate numeric;
  line_net numeric;
  line_tax numeric;
  subtotal_sum numeric := 0;
  tax_sum numeric := 0;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then raise exception 'Sales document items must be an array'; end if;
  for item in select value from jsonb_array_elements(new.items)
  loop
    item_count := item_count + 1;
    if nullif(btrim(item->>'description'),'') is null then raise exception 'Each sales document item needs a description'; end if;
    qty := coalesce(nullif(item->>'quantity','')::numeric, 1);
    unit_price := coalesce(nullif(item->>'unit_price','')::numeric, 0);
    tax_rate := coalesce(nullif(item->>'tax_rate','')::numeric, 0);
    if qty <= 0 then raise exception 'Sales document quantity must be greater than zero'; end if;
    if unit_price < 0 then raise exception 'Sales document unit price cannot be negative'; end if;
    if tax_rate < 0 or tax_rate > 100 then raise exception 'Sales document tax rate must be between 0 and 100'; end if;
    line_net := qty * unit_price;
    line_tax := line_net * tax_rate / 100;
    subtotal_sum := subtotal_sum + line_net;
    tax_sum := tax_sum + line_tax;
  end loop;
  if item_count = 0 then raise exception 'Sales document needs at least one item'; end if;
  new.subtotal := round(subtotal_sum, 2);
  new.tax_total := round(tax_sum, 2);
  new.total := round(subtotal_sum + tax_sum, 2);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sales_documents_recalculate_totals on public.sales_documents;
create trigger sales_documents_recalculate_totals before insert or update of items on public.sales_documents for each row execute function private.sales_document_recalculate_totals();

alter table public.sales_documents enable row level security;
drop policy if exists sales_documents_member_read on public.sales_documents;
create policy sales_documents_member_read on public.sales_documents for select to authenticated using (private.is_household_member(household_id));
drop policy if exists sales_documents_writer_insert on public.sales_documents;
create policy sales_documents_writer_insert on public.sales_documents for insert to authenticated with check (private.can_write_household(household_id));
drop policy if exists sales_documents_writer_update on public.sales_documents;
create policy sales_documents_writer_update on public.sales_documents for update to authenticated using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
drop policy if exists sales_documents_writer_delete on public.sales_documents;
create policy sales_documents_writer_delete on public.sales_documents for delete to authenticated using (private.can_write_household(household_id));

revoke all on table public.sales_documents from anon;
grant select, insert, update, delete on table public.sales_documents to authenticated;
grant select, insert, update, delete on table public.sales_documents to service_role;
revoke execute on function private.sales_document_recalculate_totals() from public;
