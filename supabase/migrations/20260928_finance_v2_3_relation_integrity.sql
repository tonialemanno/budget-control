-- Finance V2.3 – relational integrity for newly connected module references.

create or replace function private.validate_budget_scope_refs()
returns trigger language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id=new.category_id and c.household_id=new.household_id
  ) then raise exception 'Budget category does not belong to household'; end if;
  if new.merchant_id is not null and not exists (
    select 1 from public.merchants m where m.id=new.merchant_id and m.household_id=new.household_id
  ) then raise exception 'Budget merchant does not belong to household'; end if;
  return new;
end; $$;
revoke all on function private.validate_budget_scope_refs() from public;
drop trigger if exists budgets_validate_scope_refs on public.budgets;
create trigger budgets_validate_scope_refs before insert or update of household_id,category_id,merchant_id
on public.budgets for each row execute function private.validate_budget_scope_refs();

create or replace function private.validate_contract_refs()
returns trigger language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a where a.id=new.account_id and a.household_id=new.household_id
  ) then raise exception 'Contract account does not belong to household'; end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id=new.category_id and c.household_id=new.household_id
  ) then raise exception 'Contract category does not belong to household'; end if;
  return new;
end; $$;
revoke all on function private.validate_contract_refs() from public;
drop trigger if exists contracts_validate_refs on public.contracts;
create trigger contracts_validate_refs before insert or update of household_id,account_id,category_id
on public.contracts for each row execute function private.validate_contract_refs();

create or replace function private.validate_insurance_refs()
returns trigger language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a where a.id=new.account_id and a.household_id=new.household_id
  ) then raise exception 'Insurance account does not belong to household'; end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id=new.category_id and c.household_id=new.household_id
  ) then raise exception 'Insurance category does not belong to household'; end if;
  return new;
end; $$;
revoke all on function private.validate_insurance_refs() from public;
drop trigger if exists insurance_validate_refs on public.insurance_policies;
create trigger insurance_validate_refs before insert or update of household_id,account_id,category_id
on public.insurance_policies for each row execute function private.validate_insurance_refs();

create or replace function private.validate_investment_trade_ref()
returns trigger language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
begin
  if not exists (
    select 1 from public.investments i where i.id=new.investment_id and i.household_id=new.household_id
  ) then raise exception 'Investment does not belong to trade household'; end if;
  return new;
end; $$;
revoke all on function private.validate_investment_trade_ref() from public;
drop trigger if exists investment_transactions_validate_ref on public.investment_transactions;
create trigger investment_transactions_validate_ref before insert or update of household_id,investment_id
on public.investment_transactions for each row execute function private.validate_investment_trade_ref();
