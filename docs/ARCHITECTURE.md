# Target architecture

The migration is incremental. The current application remains the behavioral source of truth until each extracted area passes regression tests.

```text
aione/
  index.html
  manifest.webmanifest
  sw.js
  icon-192.png
  icon-512.png

  src/
    styles/
      legacy-core.css
      luxury-layer.css
      legacy-overrides.css
      # Phase 1 preserves the original three CSS blocks exactly.
      # Phase 2 moves them, in controlled order, toward:
      # tokens.css, base.css, layout.css, components.css,
      # desktop.css, mobile.css, temporary legacy-overrides.css

    js/
      bootstrap-errors.js
      app.js                  # temporary monolith after safe extraction

    core/                     # auth, API, permissions, state, currency, navigation, PWA
    components/               # reusable UI behavior
    features/                 # business domains

  supabase/
    migrations/               # all future DB changes are versioned here

  tests/
  docs/
```

## Ownership rules

`core` owns cross-cutting runtime behavior: environment configuration, Supabase transport, authentication/session, permissions/feature gates, user/profile state, currency/FX, navigation and PWA lifecycle.

`components` owns reusable UI behavior: dialogs, toast/messages, common cards/list/table helpers, privacy masking, collapsible sections, formatting and shared form behavior.

`features` owns business domains, not individual tiles. Planned domains include accounts/wealth, transactions/transfers, planning/recurring payments, imports/reconciliation, taxes, documents/invoices, planner, family/support/admin, categories/classification, finance tools/forecasting and intelligence/chat/feedback.

A module is created only where there is a coherent responsibility. aione will not be fragmented into one file per card or button.
