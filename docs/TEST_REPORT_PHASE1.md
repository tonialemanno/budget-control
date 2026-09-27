# Phase 1 test report

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

A full authenticated business regression has not been marked as passed. There is currently no separated Beta Supabase project/test login supplied for this refactor package.

A headless Chromium startup attempt in this execution environment was blocked by the environment itself with `ERR_BLOCKED_BY_ADMINISTRATOR`, including for localhost/file navigation. This is not evidence of an aione runtime failure, but it means visual browser execution cannot be certified from this environment. The first manual Beta run should therefore verify the login screen and then execute the functional checklist against the Beta backend.

## Phase-1 conclusion

The code movement itself is mechanically verified: CSS and application JavaScript payloads are unchanged. The next safe code step is not a feature change; it is preparing the core extraction boundary and the Beta Supabase environment.
