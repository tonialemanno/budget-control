# Beta 69 Foundation B — runtime bridge and desktop shell

Version: `69.0.0-beta.2`

## Scope

This step makes the new architecture visible without moving or rewriting financial business logic.

Added:

- central read-only normalized application context
- JSON locale loader
- module/navigation registry
- desktop top navigation
- desktop-only hiding of the old left sidebar after the new shell initializes
- legacy runtime bridge with minimal navigation/context access

Not changed:

- Supabase project or schema
- authentication flow
- account/transaction/planning/tax calculations
- permissions calculation
- mobile navigation/layout
- existing view DOM IDs

## Safety design

The legacy `view()` function remains the source of truth for page switching. The Beta 69 shell delegates to it instead of duplicating routing.

Feature visibility uses the existing effective feature states exposed by the bridge. The shell does not grant access.

Country/region context is normalized from existing profile values. Missing canton/municipality data is left empty; nothing is invented.

## Test focus

1. Login still works.
2. Existing module home still works.
3. Opening Budget on desktop shows the new top navigation.
4. All visible top/sub navigation entries open the same legacy views as before.
5. Planner opens through the existing planner function.
6. Admin appears only when the existing feature state allows it.
7. Mobile remains on the legacy navigation.
8. No database writes are introduced by the new shell/context/i18n modules.
