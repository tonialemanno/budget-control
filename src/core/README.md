# Core

Core owns application-wide infrastructure and state, not finance-domain business rules.

Beta 69 runtime foundation now includes:

- `app-context.js` — normalized country/region/municipality/base-currency/language context
- `i18n.js` — locale-file loader and key-based translation API
- `module-registry.js` — one registry for desktop navigation/module visibility

Still to migrate from the legacy runtime:

- environment/config and Supabase transport
- auth/session
- permissions/entitlements implementation
- currency/FX implementation
- PWA lifecycle

`src/js/app.js` remains the legacy runtime reference until each boundary is migrated and regression-tested. The Beta 69 bridge exposes only the minimum state/actions needed by the new shell.
