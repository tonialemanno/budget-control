-- Exact, audited deduplication of five UBS transactions already imported twice
-- for ONE explicitly identified household/account. Never mutate other users.
-- The two exports have different text and running balances but IDENTICAL
-- bank-provided Transaktions-Nr., transaction date, currency and amount.
create table if not exists private.bank_duplicate_repair_audit (
  removed_id uuid primary key,
  kept_id uuid not null,
  household_id uuid not null,
  account_id uuid not null,
  bank_posting_id text not null,
  removal_reason text not null,
  original_record jsonb not null,
  removed_at timestamptz not null default now()
);
revoke all on private.bank_duplicate_repair_audit from public,anon,authenticated;

do $repair$
declare
  v_household constant uuid := '773b1425-f3d7-43a8-bbf4-7c4df2960ac8'::uuid;
  v_account constant uuid := 'eacceef5-5478-4ae7-9a2e-a02c9ae5c564'::uuid;
  v_count integer;
  v_total numeric;
begin
  lock table public.transactions in share row exclusive mode;

  create temp table _ubs_exact_duplicate_pairs on commit drop as
  select old.id removed_id, newer.id kept_id,
    old.household_id, old.account_id, old.amount,
    old.import_raw_data->'row'->>'Transaktions-Nr.' bank_id,
    to_jsonb(old) original_record
  from public.transactions old
  join public.import_batches old_batch on old.import_batch_id=old_batch.id
  join public.transactions newer
    on newer.household_id=old.household_id
    and newer.account_id=old.account_id
    and newer.currency=old.currency
    and newer.occurred_at::date=old.occurred_at::date
    and newer.amount=old.amount
    and newer.id<>old.id
    and nullif(newer.import_raw_data->'row'->>'Transaktions-Nr.','')=
        nullif(old.import_raw_data->'row'->>'Transaktions-Nr.','')
  join public.import_batches new_batch on newer.import_batch_id=new_batch.id
  where old.household_id=v_household and old.account_id=v_account
    and old_batch.file_name='transactions (3).csv'
    and new_batch.file_name='transactions (4).csv'
    and old.status='booked' and newer.status='booked'
    and old.source='import' and newer.source='import'
    and old.cashflow_type='standard' and newer.cashflow_type='standard'
    and old.transfer_group_id is null and newer.transfer_group_id is null
    and old.occurred_at::date='2026-10-23'
    and old.import_raw_data->'row'->>'Transaktions-Nr.' in (
      '9903296LK7678446','9903296LK7678439','9903296LK7678432',
      '9903296LK7678410','9903296LK7678403'
    );
  select count(*),coalesce(sum(amount),0) into v_count,v_total from _ubs_exact_duplicate_pairs;

  if v_count=0 and (
      select count(*) from private.bank_duplicate_repair_audit
       where household_id=v_household and account_id=v_account
        and removal_reason='UBS October 2026 exact duplicate bank posting'
    )=5 then
    -- Idempotent if an administrator reapplies after a successful repair.
    null;
  elsif v_count<>5 or v_total<>-2881.00 or (
      select count(distinct bank_id) from _ubs_exact_duplicate_pairs
    )<>5 then
    raise exception 'Refusing bank duplicate repair: expected exactly five matched IDs totaling CHF -2881; got % and %',v_count,v_total;
  else
    if exists(select 1 from public.documents d join _ubs_exact_duplicate_pairs p on d.object_type='transaction' and d.object_id=p.removed_id)
     or exists(select 1 from public.bills b join _ubs_exact_duplicate_pairs p on b.paid_transaction_id=p.removed_id)
     or exists(select 1 from public.debt_payments d join _ubs_exact_duplicate_pairs p on d.transaction_id=p.removed_id)
     or exists(select 1 from public.receivable_payments r join _ubs_exact_duplicate_pairs p on r.transaction_id=p.removed_id)
     or exists(select 1 from public.receivables r join _ubs_exact_duplicate_pairs p on r.source_transaction_id=p.removed_id)
     or exists(select 1 from public.tax_payments t join _ubs_exact_duplicate_pairs p on t.transaction_id=p.removed_id)
     or exists(select 1 from public.sales_document_payments s join _ubs_exact_duplicate_pairs p on s.transaction_id=p.removed_id)
     or exists(select 1 from public.transaction_duplicate_ignores i join _ubs_exact_duplicate_pairs p on i.transaction_a_id=p.removed_id or i.transaction_b_id=p.removed_id)
    then raise exception 'Refusing repair: a duplicate is referenced by another financial record'; end if;

    -- Keep the newer, better-described bank transactions and their business
    -- categories; restore links if only the historical entry had them.
    update public.transactions t set
      recurring_rule_id=coalesce(t.recurring_rule_id,old.recurring_rule_id),
      note=coalesce(t.note,old.note),
      tax_relevant=coalesce(t.tax_relevant,false) or coalesce(old.tax_relevant,false),
      tax_category=coalesce(t.tax_category,old.tax_category),
      tax_year=coalesce(t.tax_year,old.tax_year),
      tax_treatment=coalesce(t.tax_treatment,old.tax_treatment),
      updated_at=now()
    from _ubs_exact_duplicate_pairs p join public.transactions old on old.id=p.removed_id
    where t.id=p.kept_id;

    insert into private.bank_duplicate_repair_audit
       (removed_id,kept_id,household_id,account_id,bank_posting_id,removal_reason,original_record)
    select removed_id,kept_id,household_id,account_id,bank_id,
      'UBS October 2026 exact duplicate bank posting',original_record
    from _ubs_exact_duplicate_pairs;
    delete from public.transactions t using _ubs_exact_duplicate_pairs p
    where t.id=p.removed_id;
    update public.import_batches b set
      imported_count=imported_count-5,
      skipped_count=skipped_count+5
    where b.household_id=v_household
      and b.file_name='transactions (3).csv'
      and b.account_id=v_account
      and b.imported_count>=5;
  end if;
end;
$repair$;

-- Harden the database itself, not just the browser-side duplicate matcher.
-- Never rely on the name or amount when the bank publishes a posting ID.
create unique index if not exists transactions_unique_ubs_bank_posting
  on public.transactions (household_id,account_id,
    ((import_raw_data->'row'->>'Transaktions-Nr.')))
  where source='import'
    and nullif(import_raw_data->'row'->>'Transaktions-Nr.','') is not null;
