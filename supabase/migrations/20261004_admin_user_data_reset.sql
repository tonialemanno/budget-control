create or replace function public.admin_reset_finance_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_household_id uuid;
  v_owned_count integer := 0;
  v_membership_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  for v_household_id in
    select h.id
    from public.households h
    where h.owner_user_id = p_user_id
  loop
    v_owned_count := v_owned_count + 1;

    delete from public.receivable_payments where household_id = v_household_id;
    delete from public.receivables where household_id = v_household_id;
    delete from public.debt_payments where household_id = v_household_id;
    delete from public.debts where household_id = v_household_id;
    delete from public.tax_payments where household_id = v_household_id;
    delete from public.tax_items where household_id = v_household_id;
    delete from public.tax_obligations where household_id = v_household_id;
    delete from public.tax_employments where household_id = v_household_id;
    delete from public.tax_children where household_id = v_household_id;
    delete from public.tax_people where household_id = v_household_id;
    delete from public.tax_case_sections where household_id = v_household_id;
    delete from public.tax_cases where household_id = v_household_id;
    delete from public.bills where household_id = v_household_id;
    delete from public.transactions where household_id = v_household_id;
    delete from public.households where id = v_household_id;
  end loop;

  delete from public.household_members where user_id = p_user_id;
  get diagnostics v_membership_count = row_count;

  delete from public.user_presence where user_id = p_user_id;
  delete from public.user_activity_events where user_id = p_user_id;
  delete from public.user_activity_summary where user_id = p_user_id;

  update public.profiles
  set country_code = null,
      base_currency = null,
      onboarding_completed_at = null,
      preferences = '{}'::jsonb,
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'owned_households_deleted', v_owned_count,
    'other_memberships_removed', v_membership_count
  );
end;
$$;

revoke all on function public.admin_reset_finance_user_data(uuid) from public;
revoke all on function public.admin_reset_finance_user_data(uuid) from anon;
revoke all on function public.admin_reset_finance_user_data(uuid) from authenticated;
grant execute on function public.admin_reset_finance_user_data(uuid) to service_role;
