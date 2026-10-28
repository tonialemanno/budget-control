-- Bank statement evidence and a reproducible reconciliation record, separate
-- from account balance anchors (which must NOT be rewritten automatically).
alter table public.import_batches
  add column if not exists statement_date date,
  add column if not exists bank_statement_balance numeric(14,2),
  add column if not exists ledger_balance_at_statement numeric(14,2),
  add column if not exists balance_difference numeric(14,2),
  add column if not exists reconciliation_status text,
  add column if not exists reconciliation_note text;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='import_batches_reconciliation_status_check') then
   alter table public.import_batches
     add constraint import_batches_reconciliation_status_check
       check (reconciliation_status is null or reconciliation_status in ('matched','difference','unverifiable'));
 end if;
end $$;
