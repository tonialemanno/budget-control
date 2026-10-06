drop trigger if exists sales_documents_recalculate_totals on public.sales_documents;
create trigger sales_documents_recalculate_totals
before insert or update on public.sales_documents
for each row execute function private.sales_document_recalculate_totals();
