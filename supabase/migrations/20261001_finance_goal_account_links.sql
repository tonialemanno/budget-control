alter table public.savings_goals
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

create index if not exists savings_goals_account_idx
  on public.savings_goals(account_id)
  where account_id is not null;
