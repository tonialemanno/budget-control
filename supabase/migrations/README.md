# Supabase migrations

Database changes belong here as ordered, reviewable migrations.

Beta and Stable currently use the same productive Supabase project. During this phase migrations must therefore be additive or otherwise backward-compatible with the Stable client. Destructive schema/data changes require explicit approval and a dedicated migration plan.

Every applied migration must remain in this directory so the repository reflects the actual production schema history relevant to aione development.
