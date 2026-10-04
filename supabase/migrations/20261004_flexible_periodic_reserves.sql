alter table public.recurring_rules
  add column if not exists interval_months integer not null default 1,
  add column if not exists amount_mode text not null default 'fixed',
  add column if not exists reserve_enabled boolean not null default false,
  add column if not exists reserve_account_id uuid null,
  add column if not exists reserve_strategy text not null default 'monthly';

alter table public.recurring_rules
  drop constraint if exists recurring_rules_interval_months_check,
  add constraint recurring_rules_interval_months_check check (interval_months between 1 and 120),
  drop constraint if exists recurring_rules_amount_mode_check,
  add constraint recurring_rules_amount_mode_check check (amount_mode in ('fixed','variable')),
  drop constraint if exists recurring_rules_reserve_strategy_check,
  add constraint recurring_rules_reserve_strategy_check check (reserve_strategy in ('monthly')),
  drop constraint if exists recurring_rules_reserve_account_id_fkey,
  add constraint recurring_rules_reserve_account_id_fkey foreign key (reserve_account_id) references public.accounts(id) on delete set null,
  drop constraint if exists recurring_rules_reserve_shape_check,
  add constraint recurring_rules_reserve_shape_check check (
    reserve_enabled = false
    or (direction = 'expense' and reserve_account_id is not null and reserve_account_id <> account_id)
  );

comment on column public.recurring_rules.interval_months is 'For cadence=monthly, number of months between occurrences. 1=monthly, 2=every second month.';
comment on column public.recurring_rules.amount_mode is 'fixed = expected amount should match; variable = amount is a planning estimate and actual payments may differ.';
comment on column public.recurring_rules.reserve_enabled is 'Periodic expense is funded through a monthly reserve and not double-counted as monthly fixed expense.';
comment on column public.recurring_rules.reserve_account_id is 'Dedicated account/pot receiving the monthly reserve.';
comment on column public.recurring_rules.reserve_strategy is 'Reserve funding strategy.';
