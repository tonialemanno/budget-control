alter table public.savings_goals
  add column if not exists start_date date,
  add column if not exists duration_months integer;

alter table public.savings_goals
  drop constraint if exists savings_goals_duration_months_check;

alter table public.savings_goals
  add constraint savings_goals_duration_months_check
  check (duration_months is null or (duration_months between 1 and 600));

comment on column public.savings_goals.start_date is 'Optional planned start date for the savings phase.';
comment on column public.savings_goals.duration_months is 'Optional planned savings duration in whole months. target_date may be derived from start_date plus duration_months.';
