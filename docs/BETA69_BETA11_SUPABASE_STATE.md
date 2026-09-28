# Beta 69.0.0-beta.11 — Supabase live state

Verified against the connected `budget` project on 2026-09-28.

## Live migration history not yet mirrored as repository SQL files

- `20260927232137` — `aione_v690_subscription_catalog_trial`
- `20260927232220` — `aione_v690_subscription_lifecycle_access`
- `20260927232231` — `aione_v690_trial_automatic_purge`
- `20260927232723` — `aione_v690_family_member_addon_access`
- `20260927234240` — `aione_v690_subscription_security_hardening`
- `20260927234559` — `aione_v690_tariff_feature_gate_enforcement`

These migrations are already applied in the current Supabase database. Do not re-run guessed/reconstructed SQL against the live database. The exact historical statements remain in `supabase_migrations.schema_migrations` and should be exported into source control when repository write access is restored.

## Verified lifecycle

- Trial: first 30 days, full effective feature access according to the Trial plan.
- Grace: next 30 days, effective business features become read-only while export/support remain available.
- Deletion due: after the retention period.
- Automatic purge job is active.
- Active administrators are excluded from the Trial purge.
- Family is included for Trial and Founder; Plus/Pro can use the Family add-on.

## Security review status

Supabase Security Advisor currently reports warnings for authenticated execution of `SECURITY DEFINER` functions, including:

- `subscription_lifecycle_for_user(uuid)`
- `user_has_addon(uuid,text)`
- `user_addon_seats(uuid,text)`

The current definitions include caller/user checks, but the advisor warnings remain open. This Beta release does not silently alter these live functions. A dedicated security-hardening migration should move privileged helpers out of the exposed schema and/or reduce execution grants where practical.
