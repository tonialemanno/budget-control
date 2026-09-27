alter table public.debt_enforcement_cases add column if not exists currency text not null default 'CHF';
alter table public.debt_enforcement_cases drop constraint if exists debt_enforcement_cases_currency_check;
alter table public.debt_enforcement_cases add constraint debt_enforcement_cases_currency_check check (currency in ('CHF','EUR'));
