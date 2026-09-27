# aione Baseline

## Stable baseline

- Existing runtime version: `68.1.0-luxury-workflow`.
- The final existing release block aligns the release UI to `68.1.0`.
- The latest complete uploaded application is the source of truth.
- Git tag `stable-68.1.0` preserves that application before structural extraction.
- `aione-stable-68.1.0-original.zip` is an additional byte-for-byte backup of the exact uploaded filenames and bytes.

## Measured baseline

- `index.html`: 1,066,117 bytes and 4,967 lines.
- 3 top-level CSS blocks in `<head>`.
- 2 top-level JavaScript blocks at the end of `<body>`.
- 1,150 actual DOM elements with IDs; all 1,150 IDs are unique.
- approximately 638 named functions, including approximately 140 async functions.
- approximately 410 event-listener bindings.
- direct browser access to Supabase Auth, REST, Storage and Edge Functions.
- PWA manifest plus service worker.

The current JavaScript contains the Supabase project URL and browser publishable key directly in the client code. This is valid for a publishable browser key, but the environment selection is hard-coded. Beta/Stable environment separation must therefore be introduced deliberately rather than by editing URLs ad hoc.

## Baseline rule

During structural refactoring, existing business behavior and database semantics are frozen. If code purpose is unclear, characterize and test it before moving or rewriting it.
