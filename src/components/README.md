# Components

Reusable UI building blocks only.

Beta 69 now includes `desktop-shell.js`, the first visible shell component. It creates a desktop-only top navigation while leaving the legacy sidebar in the DOM as a fallback and leaving mobile unchanged.

Target owners:

- top navigation and breadcrumbs
- buttons/action states
- dialogs/drawers
- cards/tables
- messages/toasts
- warnings and source badges
- privacy presentation
- shared form behavior

Components do not decide finance, tax or legal outcomes.
## Temporary compatibility adapter

`beta69-ux.js` is a temporary UI adapter for legacy DOM that has not yet moved into owned components/features. It may enhance presentation and navigation only; it must not duplicate persistence or business rules from `app.js`. The former Admin persistence interception was removed in Beta 9. As each affected screen is migrated, its corresponding enhancer must be moved to the owning component/feature and deleted from this adapter.

