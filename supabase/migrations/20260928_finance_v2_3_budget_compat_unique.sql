-- Finance V2.3 – temporary compatibility for the currently deployed V2.2 frontend.
-- Category budgets keep the legacy ON CONFLICT target while V2.3 also supports merchant-scoped budgets.
alter table public.budgets
  add constraint budgets_household_id_category_id_month_start_key
  unique (household_id, category_id, month_start);
