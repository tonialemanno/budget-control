-- Beta 5.5 hotfix: Forderungen belong to the existing debts module.
-- Removes the temporary standalone receivables entitlement introduced during reconciliation.

drop policy if exists receivables_module_access_gate on public.receivables;
create policy receivables_module_access_gate on public.receivables
as restrictive for all to authenticated
using ((select private.has_module_access('debts')))
with check ((select private.has_module_access('debts')));

drop policy if exists receivable_payments_module_access_gate on public.receivable_payments;
create policy receivable_payments_module_access_gate on public.receivable_payments
as restrictive for all to authenticated
using ((select private.has_module_access('debts')))
with check ((select private.has_module_access('debts')));

delete from public.user_module_access where module_key='receivables';
delete from public.product_modules where key='receivables';
