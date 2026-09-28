# Beta 12 — Supabase live state

## Live change

`public.handle_new_user()` was changed in the shared live Supabase project during Beta 12 foundation work.

It now:

- inserts the user's profile
- assigns the Trial subscription lifecycle
- **does not insert default categories**

Country-specific categories are created only by Beta 12 onboarding after the user confirms a country and chooses the recommended starter set.

## Existing users

No existing category row, transaction, account, document or debt-enforcement record was deleted or modified by this trigger change.

## Migration-history status

The change was applied and verified live using Supabase SQL tooling. It is deliberately **not** represented by an invented hand-named migration file in this packer. Supabase's documented migration workflow requires generating/pulling migration files with the CLI; that step remains necessary for a fully reproducible clean database build.

## Advisor status after change

The security advisor still reports the same pre-existing warnings for several public authenticated-callable `SECURITY DEFINER` functions plus leaked-password protection being disabled. No additional warning was introduced by the new-user trigger change.
