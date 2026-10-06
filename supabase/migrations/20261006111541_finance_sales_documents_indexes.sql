create index if not exists sales_documents_created_by_idx on public.sales_documents(created_by);
create index if not exists sales_documents_source_document_idx on public.sales_documents(source_document_id) where source_document_id is not null;
