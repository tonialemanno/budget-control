-- R91 follow-up: never grant direct writes to archive/status/audit tables.
-- All mutations run only through reviewed SECURITY DEFINER RPCs that verify household admin.
revoke all privileges on table
  public.year_closures,
  public.year_closure_account_checks,
  public.year_closure_versions,
  public.year_closure_events
from public,anon,authenticated;
grant select on table
  public.year_closures,
  public.year_closure_account_checks,
  public.year_closure_versions,
  public.year_closure_events
to authenticated;
