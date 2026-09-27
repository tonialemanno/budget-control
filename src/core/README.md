# Core

Core owns application-wide infrastructure and state, not finance-domain business rules.

Beta 69 target owners:

- environment/config
- Supabase/API transport
- auth/session
- permissions and entitlements
- central app context (country, region, municipality, base currency, language)
- currency/FX infrastructure
- navigation/view registry
- PWA lifecycle
- i18n loading/fallback

Legacy runtime code remains in `src/js/app.js` until each boundary is migrated and regression-tested.
