alter table public.invoices
  add column if not exists document_kind text not null default 'invoice';

alter table public.invoices
  drop constraint if exists invoices_document_kind_check;

alter table public.invoices
  add constraint invoices_document_kind_check
  check (document_kind in ('invoice','quote'));

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft','sent','paid','cancelled','accepted','rejected'));

update public.invoices
set document_kind='invoice'
where document_kind is null;
