create or replace function private.cleanup_source_recurring_rule()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if old.recurring_rule_id is not null then
    delete from public.recurring_rules
    where id=old.recurring_rule_id
      and household_id=old.household_id;
  end if;
  return old;
end;
$$;

revoke all on function private.cleanup_source_recurring_rule() from public, anon, authenticated;

drop trigger if exists contracts_cleanup_recurring_rule on public.contracts;
create trigger contracts_cleanup_recurring_rule
after delete on public.contracts
for each row execute function private.cleanup_source_recurring_rule();

drop trigger if exists insurance_cleanup_recurring_rule on public.insurance_policies;
create trigger insurance_cleanup_recurring_rule
after delete on public.insurance_policies
for each row execute function private.cleanup_source_recurring_rule();

drop trigger if exists debts_cleanup_recurring_rule on public.debts;
create trigger debts_cleanup_recurring_rule
after delete on public.debts
for each row execute function private.cleanup_source_recurring_rule();
