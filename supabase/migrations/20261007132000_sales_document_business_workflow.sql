-- Finance R43: branded sales documents, reusable text blocks and payment linkage.

alter table public.sales_documents
  add column if not exists paid_at date;

create unique index if not exists sales_documents_source_type_unique
  on public.sales_documents(source_document_id, document_type)
  where source_document_id is not null;

create table if not exists public.sales_document_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  company_name text,
  company_address text,
  company_email text,
  company_phone text,
  company_website text,
  tax_id text,
  iban text,
  bank_name text,
  logo_storage_path text,
  default_payment_days integer not null default 30 check (default_payment_days between 0 and 365),
  default_quote_valid_days integer not null default 30 check (default_quote_valid_days between 0 and 365),
  default_tax_rate numeric(6,3) not null default 0 check (default_tax_rate between 0 and 100),
  footer_text text,
  auto_receipt_on_payment boolean not null default true,
  default_quote_intro text,
  default_invoice_intro text,
  default_receipt_intro text,
  default_payment_text text,
  default_closing_text text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_document_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  document_type text not null default 'all' check (document_type in ('all','invoice','quote','receipt')),
  section text not null check (section in ('intro','payment','closing')),
  name text not null,
  content text not null,
  is_default boolean not null default false,
  sort_order integer not null default 100,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_document_templates_name_unique unique (household_id, document_type, section, name)
);

create table if not exists public.sales_document_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  sales_document_id uuid not null references public.sales_documents(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint sales_document_payment_unique unique (sales_document_id, transaction_id)
);

create index if not exists sales_document_templates_household_idx
  on public.sales_document_templates(household_id, document_type, section, sort_order, created_at);
create index if not exists sales_document_payments_document_idx
  on public.sales_document_payments(sales_document_id, created_at);
create index if not exists sales_document_payments_transaction_idx
  on public.sales_document_payments(transaction_id);

drop trigger if exists sales_document_settings_updated_at on public.sales_document_settings;
create trigger sales_document_settings_updated_at
before update on public.sales_document_settings
for each row execute function private.set_updated_at();

drop trigger if exists sales_document_templates_updated_at on public.sales_document_templates;
create trigger sales_document_templates_updated_at
before update on public.sales_document_templates
for each row execute function private.set_updated_at();

alter table public.sales_document_settings enable row level security;
alter table public.sales_document_templates enable row level security;
alter table public.sales_document_payments enable row level security;

drop policy if exists sales_document_settings_member_read on public.sales_document_settings;
create policy sales_document_settings_member_read on public.sales_document_settings
for select to authenticated using (private.is_household_member(household_id));
drop policy if exists sales_document_settings_writer_insert on public.sales_document_settings;
create policy sales_document_settings_writer_insert on public.sales_document_settings
for insert to authenticated with check (private.can_write_household(household_id));
drop policy if exists sales_document_settings_writer_update on public.sales_document_settings;
create policy sales_document_settings_writer_update on public.sales_document_settings
for update to authenticated using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));
drop policy if exists sales_document_settings_writer_delete on public.sales_document_settings;
create policy sales_document_settings_writer_delete on public.sales_document_settings
for delete to authenticated using (private.can_write_household(household_id));

drop policy if exists sales_document_templates_member_read on public.sales_document_templates;
create policy sales_document_templates_member_read on public.sales_document_templates
for select to authenticated using (private.is_household_member(household_id));
drop policy if exists sales_document_templates_writer_insert on public.sales_document_templates;
create policy sales_document_templates_writer_insert on public.sales_document_templates
for insert to authenticated with check (private.can_write_household(household_id));
drop policy if exists sales_document_templates_writer_update on public.sales_document_templates;
create policy sales_document_templates_writer_update on public.sales_document_templates
for update to authenticated using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));
drop policy if exists sales_document_templates_writer_delete on public.sales_document_templates;
create policy sales_document_templates_writer_delete on public.sales_document_templates
for delete to authenticated using (private.can_write_household(household_id));

drop policy if exists sales_document_payments_member_read on public.sales_document_payments;
create policy sales_document_payments_member_read on public.sales_document_payments
for select to authenticated using (private.is_household_member(household_id));
drop policy if exists sales_document_payments_writer_insert on public.sales_document_payments;
create policy sales_document_payments_writer_insert on public.sales_document_payments
for insert to authenticated with check (private.can_write_household(household_id));
drop policy if exists sales_document_payments_writer_delete on public.sales_document_payments;
create policy sales_document_payments_writer_delete on public.sales_document_payments
for delete to authenticated using (private.can_write_household(household_id));

revoke all on public.sales_document_settings, public.sales_document_templates, public.sales_document_payments from anon;
grant select,insert,update,delete on public.sales_document_settings, public.sales_document_templates to authenticated, service_role;
grant select,insert,delete on public.sales_document_payments to authenticated, service_role;

create or replace function public.link_sales_document_payment_v1(
  p_sales_document_id uuid,
  p_transaction_id uuid,
  p_amount numeric default null
)
returns jsonb
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_doc public.sales_documents%rowtype;
  v_tx public.transactions%rowtype;
  v_amount numeric(18,2);
  v_paid numeric(18,2);
  v_status text;
begin
  select * into v_doc from public.sales_documents where id=p_sales_document_id;
  if not found then raise exception 'Sales document not found'; end if;
  if v_doc.document_type <> 'invoice' then raise exception 'Only invoices can receive linked payments'; end if;
  if not private.can_write_household(v_doc.household_id) then raise exception 'No write access'; end if;

  select * into v_tx from public.transactions where id=p_transaction_id and household_id=v_doc.household_id;
  if not found then raise exception 'Transaction not found in household'; end if;
  if v_tx.status <> 'booked' or v_tx.amount <= 0 then raise exception 'Only a booked incoming transaction can pay an invoice'; end if;
  if v_tx.currency <> v_doc.currency then raise exception 'Transaction currency must match invoice currency'; end if;

  v_amount := round(coalesce(p_amount, v_tx.amount),2);
  if v_amount <= 0 or v_amount > v_tx.amount then raise exception 'Invalid payment amount'; end if;

  insert into public.sales_document_payments(household_id,sales_document_id,transaction_id,amount)
  values(v_doc.household_id,v_doc.id,v_tx.id,v_amount)
  on conflict (sales_document_id,transaction_id)
  do update set amount=excluded.amount;

  select coalesce(sum(amount),0) into v_paid
  from public.sales_document_payments
  where sales_document_id=v_doc.id;

  v_status := case when v_paid + 0.005 >= v_doc.total then 'paid' else v_doc.status end;
  update public.sales_documents
  set status=v_status,
      paid_at=case when v_status='paid' then coalesce(paid_at,v_tx.occurred_at::date) else paid_at end,
      updated_at=now()
  where id=v_doc.id;

  return jsonb_build_object(
    'document_id',v_doc.id,
    'paid_total',v_paid,
    'remaining',greatest(v_doc.total-v_paid,0),
    'status',v_status,
    'paid_at',case when v_status='paid' then coalesce(v_doc.paid_at,v_tx.occurred_at::date) else v_doc.paid_at end
  );
end;
$$;

create or replace function public.unlink_sales_document_payment_v1(
  p_sales_document_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_doc public.sales_documents%rowtype;
  v_paid numeric(18,2);
  v_status text;
begin
  select * into v_doc from public.sales_documents where id=p_sales_document_id;
  if not found then raise exception 'Sales document not found'; end if;
  if not private.can_write_household(v_doc.household_id) then raise exception 'No write access'; end if;

  delete from public.sales_document_payments
  where sales_document_id=v_doc.id and transaction_id=p_transaction_id;

  select coalesce(sum(amount),0) into v_paid
  from public.sales_document_payments
  where sales_document_id=v_doc.id;

  v_status := case when v_paid + 0.005 >= v_doc.total then 'paid' else 'sent' end;
  update public.sales_documents
  set status=v_status,
      paid_at=case when v_status='paid' then paid_at else null end,
      updated_at=now()
  where id=v_doc.id;

  return jsonb_build_object(
    'document_id',v_doc.id,
    'paid_total',v_paid,
    'remaining',greatest(v_doc.total-v_paid,0),
    'status',v_status
  );
end;
$$;

revoke all on function public.link_sales_document_payment_v1(uuid,uuid,numeric) from public;
revoke all on function public.unlink_sales_document_payment_v1(uuid,uuid) from public;
grant execute on function public.link_sales_document_payment_v1(uuid,uuid,numeric) to authenticated, service_role;
grant execute on function public.unlink_sales_document_payment_v1(uuid,uuid) to authenticated, service_role;
