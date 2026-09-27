# Architecture audit of the current aione baseline

## Facts measured from the current source

The current working application is a large single-document application. `index.html` is 1,066,117 bytes / 4,967 lines and contains the complete page markup plus three top-level CSS layers and two top-level JavaScript blocks.

The real DOM contains 1,150 IDs and no duplicate DOM IDs. The JavaScript contains roughly 638 named functions, around 140 async functions, around 410 event-listener registrations and a large shared mutable state object/variable set. This confirms that the immediate risk is not missing functionality but coupling: many screens and domains share the same runtime scope.

Supabase is used directly from browser JavaScript for Auth, REST, Storage and Edge Functions. The application includes role/feature gating before write API operations. Authentication/session, access control, finance data, planner, admin/support and UI behavior currently coexist in the same main IIFE.

The planner is already intentionally integrated with the same authentication and data model, and can link planner entries to budget items. It must therefore be extracted as a domain module, not rebuilt as a separate application.

PWA behavior is implemented through `manifest.webmanifest` and `sw.js`. The existing service worker registers from the application and maintains an explicit app-shell cache.

The current client runtime version is `68.1.0-luxury-workflow`; the final release block aligns the visible release to `68.1.0`. Several historical v65-v68 CSS and JavaScript layers remain in the same source, including later overrides that intentionally replace earlier functions/styles.

## Analysis

The highest regression risk is moving code by visual screen instead of dependency. For example, account, transaction, tax, forecast and planner screens all depend on common formatting, state, API, permission and currency behavior. Extracting a whole screen first would pull core behavior with it and create circular dependencies.

The safest sequence is therefore:

1. mechanical extraction with byte-identical payloads;
2. isolate environment/API/auth/permission/state boundaries;
3. characterize financial calculations with tests;
4. move business domains in small commits;
5. remove compatibility globals only after callers are migrated.

The CSS has a similar risk. The later style blocks are deliberate specificity/override layers. Immediately reorganizing all selectors into idealized files could alter cascade order even when every individual rule is unchanged. Phase 1 therefore preserves the three blocks one-to-one. Semantic CSS splitting comes only after visual baselines exist.

## Confirmed structural risks to address, not bugs to "fix" during refactoring

- hard-coded environment selection for Supabase;
- one very large global JavaScript scope;
- shared mutable state across domains;
- direct DOM event wiring spread through the main script;
- historical function/style overrides that can be semantically significant;
- app/release/cache version values maintained in more than one place;
- no repository-level migration history included in the supplied app package;
- no isolated Beta database configuration in the supplied package.

None of these items justifies changing business behavior during the structural migration.

## Not verifiable from the supplied files alone

The supplied client files do not contain a complete authoritative export of the current Supabase schema, RLS policies, database functions, triggers or Edge Function source. Therefore a complete database migration baseline cannot be generated safely from these files alone. That requires the actual Supabase project/schema source or an export from the project.

Likewise, authenticated end-to-end regression testing cannot be completed without a test Supabase environment and suitable test user credentials/data.
