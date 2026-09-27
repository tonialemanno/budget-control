# Phase 1 test report

> Historical note: this report describes the original extraction phase. The later product decision intentionally keeps Beta and Stable on the same production Supabase project; a separate Beta project is no longer a prerequisite for cleanup work. Current rules are documented in `REFACTORING_PLAN.md` and `TEST_MATRIX.md`.

## Passed

- Exact original source backup created with SHA-256 manifest.
- Stable Git tag created before application-code refactoring.
- All three extracted CSS payloads match their original Stable blocks byte-for-byte.
- Both extracted JavaScript payloads match their original Stable blocks byte-for-byte.
- Actual DOM IDs preserved: 1,150 IDs, all unique.
- Manifest bytes unchanged.
- Icon bytes unchanged.
- `node --check` passes for both extracted JavaScript files.
- Manifest JSON parses successfully.
- Local HTTP asset smoke test passes for index, manifest, service worker, both icons, three stylesheets and both JavaScript files.
- Beta service-worker cache is distinct and includes all newly externalized startup assets.

## Not completed yet

At the time of this historical Phase-1 run, a full authenticated business regression was not completed. Current Beta testing instead uses the shared production Supabase project and therefore requires non-destructive manual smoke testing in addition to automated checks.

A headless Chromium startup attempt in this execution environment was blocked by the environment itself with `ERR_BLOCKED_BY_ADMINISTRATOR`, including for localhost/file navigation. This is not evidence of an aione runtime failure, but it means visual browser execution cannot be certified from this environment. The first manual Beta run should therefore verify the login screen and then execute the functional checklist against the Beta backend.

## Phase-1 conclusion

The code movement itself is mechanically verified: CSS and application JavaScript payloads are unchanged. The next safe code step from this historical phase was preparing the core extraction boundary. The later decision to keep a shared Supabase backend supersedes the former Beta-environment prerequisite.
