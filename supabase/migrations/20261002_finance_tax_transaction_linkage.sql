
alter table public.transactions
  add column if not exists tax_year integer,
  add column if not exists tax_section_key text,
  add column if not exists tax_treatment text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.transactions'::regclass
      and conname='transactions_tax_year_check'
  ) then
    alter table public.transactions
      add constraint transactions_tax_year_check
      check (tax_year is null or tax_year between 2000 and 2100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.transactions'::regclass
      and conname='transactions_tax_section_key_check'
  ) then
    alter table public.transactions
      add constraint transactions_tax_section_key_check
      check (
        tax_section_key is null or tax_section_key in (
          'persons_household','income','work_expenses','pension_insurance',
          'banks_securities','crypto','debts','medical','children','support',
          'donations','property','assets','inheritance_gifts','foreign','tax_account'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.transactions'::regclass
      and conname='transactions_tax_treatment_check'
  ) then
    alter table public.transactions
      add constraint transactions_tax_treatment_check
      check (
        tax_treatment is null or tax_treatment in (
          'income','deduction','tax_payment','tax_refund','information'
        )
      );
  end if;
end $$;

create or replace function private.normalize_transaction_tax_link()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_text text;
begin
  if not new.tax_relevant then
    new.tax_year := null;
    new.tax_section_key := null;
    new.tax_treatment := null;
    new.tax_category := null;
    return new;
  end if;

  new.tax_year := coalesce(new.tax_year, extract(year from new.occurred_at)::integer);
  v_text := lower(
    coalesce(new.tax_category,'') || ' ' ||
    coalesce(new.description,'') || ' ' ||
    coalesce(new.counterparty,'')
  );

  if new.tax_treatment is null then
    if v_text ~ '(steuerrück|steuererstatt|tax refund)' then
      new.tax_treatment := 'tax_refund';
    elsif v_text ~ '(steuerzahlung|steueramt|steuerverwaltung|kanton.*steuer|gemeinde.*steuer|tax payment)' then
      if new.amount >= 0 then new.tax_treatment := 'tax_refund';
      else new.tax_treatment := 'tax_payment';
      end if;
    elsif new.amount >= 0 then
      new.tax_treatment := 'income';
    else
      new.tax_treatment := 'deduction';
    end if;
  end if;

  if new.tax_section_key is null then
    new.tax_section_key := case new.tax_treatment
      when 'income' then 'income'
      when 'deduction' then 'work_expenses'
      when 'tax_payment' then 'tax_account'
      when 'tax_refund' then 'tax_account'
      else null
    end;
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_transaction_tax_link() from public,anon,authenticated;

drop trigger if exists transactions_normalize_tax_link on public.transactions;
create trigger transactions_normalize_tax_link
before insert or update of tax_relevant,tax_year,tax_section_key,tax_treatment,tax_category,amount,occurred_at,description,counterparty
on public.transactions
for each row execute function private.normalize_transaction_tax_link();

update public.transactions
set tax_year = coalesce(tax_year,extract(year from occurred_at)::integer),
    tax_treatment = coalesce(
      tax_treatment,
      case
        when lower(coalesce(tax_category,'')||' '||coalesce(description,'')||' '||coalesce(counterparty,'')) ~ '(steuerrück|steuererstatt|tax refund)' then 'tax_refund'
        when lower(coalesce(tax_category,'')||' '||coalesce(description,'')||' '||coalesce(counterparty,'')) ~ '(steuerzahlung|steueramt|steuerverwaltung|kanton.*steuer|gemeinde.*steuer|tax payment)' and amount>=0 then 'tax_refund'
        when lower(coalesce(tax_category,'')||' '||coalesce(description,'')||' '||coalesce(counterparty,'')) ~ '(steuerzahlung|steueramt|steuerverwaltung|kanton.*steuer|gemeinde.*steuer|tax payment)' then 'tax_payment'
        when amount>=0 then 'income'
        else 'deduction'
      end
    ),
    tax_section_key = coalesce(
      tax_section_key,
      case
        when coalesce(tax_treatment,
          case when amount>=0 then 'income' else 'deduction' end
        ) in ('tax_payment','tax_refund') then 'tax_account'
        when coalesce(tax_treatment,
          case when amount>=0 then 'income' else 'deduction' end
        )='income' then 'income'
        when coalesce(tax_treatment,
          case when amount>=0 then 'income' else 'deduction' end
        )='deduction' then 'work_expenses'
        else null
      end
    )
where tax_relevant=true;

create index if not exists transactions_tax_household_year_idx
  on public.transactions(household_id,tax_year)
  where tax_relevant=true;
