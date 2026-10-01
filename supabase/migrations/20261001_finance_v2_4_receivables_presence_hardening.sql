-- Finance V2.4 security/performance hardening for receivables and presence.

-- The temporary profile heartbeat is superseded by user_presence.
drop index if exists public.profiles_last_seen_idx;
alter table public.profiles drop column if exists last_seen_at;

-- Presence can be maintained by the signed-in user through RLS.
alter table public.user_presence enable row level security;

drop policy if exists user_presence_select_own on public.user_presence;
create policy user_presence_select_own on public.user_presence
for select to authenticated
using (user_id=(select auth.uid()));

drop policy if exists user_presence_insert_own on public.user_presence;
create policy user_presence_insert_own on public.user_presence
for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own on public.user_presence
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists user_presence_delete_own on public.user_presence;
create policy user_presence_delete_own on public.user_presence
for delete to authenticated
using (user_id=(select auth.uid()));

revoke all on table public.user_presence from anon;
grant select,insert,update,delete on table public.user_presence to authenticated;

-- All canonical receivable RPCs now run as the caller, so RLS and grants remain active.
alter function public.touch_user_presence(text,text,text) security invoker;
alter function public.clear_user_presence() security invoker;
alter function public.create_receivable_v2(uuid,text,text,numeric,text,date,date,text,uuid,boolean) security invoker;
alter function public.record_receivable_payment_v2(uuid,uuid,numeric,date,text,uuid,boolean) security invoker;
alter function public.reverse_receivable_payment_v2(uuid) security invoker;
alter function public.delete_receivable_v2(uuid,uuid) security invoker;

-- Keep the old history-only RPC temporarily compatible, but remove privilege escalation.
alter function public.record_receivable_payment(uuid,uuid,numeric,date,text) security invoker;

revoke execute on function public.record_receivable_payment(uuid,uuid,numeric,date,text) from public, anon;
grant execute on function public.record_receivable_payment(uuid,uuid,numeric,date,text) to authenticated;

-- Cover foreign keys used by the receivables ledger.
create index if not exists receivables_created_by_idx on public.receivables(created_by);
create index if not exists receivables_source_account_idx on public.receivables(source_account_id);
create index if not exists receivables_source_transaction_idx on public.receivables(source_transaction_id);
create index if not exists receivable_payments_household_idx on public.receivable_payments(household_id);
create index if not exists receivable_payments_created_by_idx on public.receivable_payments(created_by);
create index if not exists receivable_payments_payment_account_idx on public.receivable_payments(payment_account_id);
create index if not exists receivable_payments_transaction_idx on public.receivable_payments(transaction_id);
