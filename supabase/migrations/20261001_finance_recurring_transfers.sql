-- Finance: recurring transfers / Untertöpfe
-- Extends recurring_rules without creating a parallel planning model.

alter table public.recurring_rules
  add column if not exists destination_account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recurring_rules_destination_account_id_fkey'
      and conrelid = 'public.recurring_rules'::regclass
  ) then
    alter table public.recurring_rules
      add constraint recurring_rules_destination_account_id_fkey
      foreign key (destination_account_id)
      references public.accounts(id)
      on delete set null;
  end if;
end $$;

alter table public.recurring_rules
  drop constraint if exists recurring_rules_direction_check;

alter table public.recurring_rules
  add constraint recurring_rules_direction_check
  check (direction in ('income','expense','transfer'));

alter table public.recurring_rules
  drop constraint if exists recurring_rules_transfer_target_check;

alter table public.recurring_rules
  add constraint recurring_rules_transfer_target_check
  check (
    (direction = 'transfer' and destination_account_id is not null and destination_account_id <> account_id)
    or
    (direction <> 'transfer' and destination_account_id is null)
  );

create index if not exists recurring_rules_destination_account_idx
  on public.recurring_rules(destination_account_id)
  where destination_account_id is not null;
