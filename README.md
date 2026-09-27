# aione

One repository, two release states:

- branch `stable` + Git tag `stable-68.1.0`: protected baseline before refactoring.
- branch `beta`: all refactoring and future development.

Current Beta package: `68.1.1-beta.1`.

Phase 1 externalizes CSS and JavaScript only. The extracted application JavaScript and CSS blocks are byte-identical to the Stable baseline. Business logic is not rewritten.

Run over HTTP(S), not `file://`:

```bash
python3 -m http.server 8765
```

Checks:

```bash
python3 tests/check_integrity.py
node --check src/js/bootstrap-errors.js
node --check src/js/app.js
```

Read `docs/REFACTORING_PLAN.md` before the next code movement.

See `docs/AUDIT.md` for the source audit and `docs/TEST_REPORT_PHASE1.md` for the exact verification status.
