
create or replace function private.normalize_transaction_tax_link()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_text text;
  v_mentioned_year integer;
begin
  if not new.tax_relevant then
    new.tax_year := null;
    new.tax_section_key := null;
    new.tax_treatment := null;
    new.tax_category := null;
    return new;
  end if;

  v_text := lower(
    coalesce(new.tax_category,'') || ' ' ||
    coalesce(new.description,'') || ' ' ||
    coalesce(new.counterparty,'') || ' ' ||
    coalesce(new.note,'')
  );

  select nullif((regexp_match(v_text, '\m(20[0-9]{2})\M'))[1],'')::integer
    into v_mentioned_year;

  new.tax_year := coalesce(new.tax_year,v_mentioned_year,extract(year from new.occurred_at)::integer);

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

with candidates as (
  select id,
         ((regexp_match(
           lower(coalesce(tax_category,'')||' '||coalesce(description,'')||' '||coalesce(counterparty,'')||' '||coalesce(note,'')),
           '\m(20[0-9]{2})\M'
         ))[1])::integer as mentioned_year
  from public.transactions
  where tax_relevant=true
    and lower(coalesce(tax_category,'')||' '||coalesce(description,'')||' '||coalesce(counterparty,'')||' '||coalesce(note,''))
      ~ '(steuer|tax)'
)
update public.transactions t
set tax_year=c.mentioned_year
from candidates c
where t.id=c.id
  and c.mentioned_year between 2000 and 2100
  and c.mentioned_year<>t.tax_year;
