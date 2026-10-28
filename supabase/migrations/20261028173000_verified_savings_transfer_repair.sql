-- Repair a verified internal UBS transfer in one household only.
-- User-confirmed destination IBAN and the original UBS statement's recipient
-- IBAN match. The existing salary-account debit is NEVER duplicated or removed.
create table if not exists private.own_account_transfer_repair_audit (
  source_transaction_id uuid primary key,
  household_id uuid not null,
  debit_account_id uuid not null,
  credit_account_id uuid not null,
  credit_transaction_id uuid not null,
  bank_posting_id text not null,
  transfer_group_id uuid not null,
  previous_destination_ref text,
  original_source_record jsonb not null,
  action_note text not null,
  repaired_at timestamptz not null default now()
);
revoke all on private.own_account_transfer_repair_audit from public,anon,authenticated;

do $repair$
declare
  v_household constant uuid := '773b1425-f3d7-43a8-bbf4-7c4df2960ac8'::uuid;
  v_source_id constant uuid := 'e57f6dd6-bcbb-4286-a5f2-0d55b85707d9'::uuid;
  v_source_account constant uuid := 'eacceef5-5478-4ae7-9a2e-a02c9ae5c564'::uuid;
  v_target_account constant uuid := 'e16efe53-1605-42e7-ad01-f091821ece48'::uuid;
  v_iban constant text := 'CH1100203203860415M1M';
  v_bank_id constant text := '9903296LK7678439';
  v_source public.transactions%rowtype;
  v_target public.accounts%rowtype;
  v_source_account_row public.accounts%rowtype;
  v_group uuid;
  v_credit_id uuid;
begin
  select * into v_source_account_row from public.accounts
    where id=v_source_account and household_id=v_household and currency='CHF'
    and is_archived=false for update;
  if not found then raise exception 'Source account not found'; end if;
  select * into v_target from public.accounts
    where id=v_target_account and household_id=v_household and currency='CHF'
    and is_archived=false and account_type='savings' for update;
  if not found then raise exception 'Destination savings account not found'; end if;
  select * into v_source from public.transactions
    where id=v_source_id and account_id=v_source_account
    and household_id=v_household for update;
  if not found then raise exception 'Verified bank debit not found'; end if;

  if exists(select 1 from private.own_account_transfer_repair_audit
      where source_transaction_id=v_source_id) then
    if v_source.transfer_group_id is null
      then raise exception 'Repair audit exists but transaction transfer is missing'; end if;
    return;
  end if;

  if v_source.amount <> -525.00 or v_source.currency<>'CHF'
    or v_source.status <> 'booked' or v_source.source <> 'import'
    or v_source.cashflow_type <> 'standard' or v_source.transfer_group_id is not null
    or v_source.occurred_at::date <> date '2026-10-23'
    or v_source.import_raw_data->'row'->>'Transaktions-Nr.' <> v_bank_id
    or position(v_iban in upper(regexp_replace(
      coalesce(v_source.import_raw_data->'row'->>'Beschreibung3',''),
      '[^A-Za-z0-9]', '', 'g'))) = 0
  then raise exception 'Verified bank posting mismatches: refuse to modify'; end if;

  if nullif(v_target.external_account_ref,'') is not null
    and upper(regexp_replace(v_target.external_account_ref,'[^A-Za-z0-9]','','g')) <> v_iban
  then raise exception 'Destination has conflicting bank IBAN'; end if;
  if exists(select 1 from public.accounts a
    where a.household_id=v_household and a.id<>v_target_account
      and upper(regexp_replace(coalesce(a.external_account_ref,''),'[^A-Za-z0-9]','','g'))=v_iban)
  then raise exception 'Bank IBAN belongs to a different account'; end if;

  if exists(select 1 from public.transactions t where t.household_id=v_household
    and t.account_id=v_target_account and t.status='booked'
    and t.occurred_at::date between date '2026-10-23' and date '2026-10-25'
    and t.amount=525.00)
  then raise exception 'The savings credit is already present; refuse duplication'; end if;

  if exists(select 1 from public.bills x where x.paid_transaction_id=v_source_id)
    or exists(select 1 from public.debt_payments x where x.transaction_id=v_source_id)
    or exists(select 1 from public.receivable_payments x where x.transaction_id=v_source_id)
    or exists(select 1 from public.tax_payments x where x.transaction_id=v_source_id)
  then raise exception 'Source transaction is already linked to a finance obligation'; end if;

  v_group := gen_random_uuid();
  v_credit_id := gen_random_uuid();
  update public.accounts set external_account_ref='CH11 0020 3203 8604 15M1 M',
    updated_at=now()
    where id=v_target_account;
  update public.transactions set
    transfer_group_id=v_group,
    counterparty_account_ref=v_iban,
    semantic_type='internal_transfer',
    category_id=null,
    merchant_id=null,
    tax_relevant=false,
    tax_category=null,
    tax_year=null,
    tax_section_key=null,
    tax_treatment=null,
    income_kind=null,
    exclude_from_reports=false,
    updated_at=now()
    where id=v_source_id;
  insert into public.transactions (
    id,household_id,account_id,occurred_at,amount,currency,
    description,note,status,source,transfer_group_id,
    cashflow_type,tax_relevant,income_kind,semantic_type,exclude_from_reports
  ) values (
    v_credit_id,v_household,v_target_account,v_source.occurred_at,
    525.00,'CHF','Umbuchung LohnKonto → Sparkonto',
    'Gegenbuchung zum belegten UBS-Dauerauftrag vom 23.10.2026; erstellt ohne neue Belastung des LohnKontos.',
    'booked','manual',v_group,'standard',false,'not_income','internal_transfer',false
  );
  insert into private.own_account_transfer_repair_audit (
    source_transaction_id,household_id,debit_account_id,credit_account_id,
    credit_transaction_id,bank_posting_id,transfer_group_id,
    previous_destination_ref,original_source_record,action_note
  ) values (
    v_source_id,v_household,v_source_account,v_target_account,
    v_credit_id,v_bank_id,v_group,v_target.external_account_ref,to_jsonb(v_source),
    'User-confirmed savings IBAN matches original UBS debit; create matching credit only.'
  );
end;
$repair$;
