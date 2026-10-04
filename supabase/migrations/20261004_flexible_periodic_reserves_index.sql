create index if not exists recurring_rules_reserve_account_idx
  on public.recurring_rules(reserve_account_id)
  where reserve_account_id is not null;
