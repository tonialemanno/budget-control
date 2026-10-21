# App erstellungen / ALEMANNO BUCHHALTUNG — Project scan

**Audit date:** 2026-10-21. **Repository:** `tonialemanno/budget-control`, `beta` release R96. **AxiomSeal project_id:** `budget-control` derived from the repository name. The ChatGPT parent project is named **App erstellungen**; it is not the same namespace as AxiomSeal.

## Full source inventory

- [109 frontend, Cloudflare function and config files](./source-inventory-A-frontend.md)
- [182 Supabase SQL/Edge and test files](./source-inventory-B-tests-supabase.md)

Exactly **291** tracked files matching source/test/config extensions are listed. This index is not a claim that all 291 files were line-by-line audited. Excluded: build artifacts, binaries, gitignored files, and lock files. Critical ancillary nonextension files reviewed: `Dockerfile`, `_headers`, `.gitignore`, `docker-compose.yml`, and `.github/workflows/ci.yml`.

## Confirmed security findings

1. **S-01 Critical: privileged account actions.** The active deployed Supabase Edge function `admin-users` version 13 is byte-for-byte identical to `supabase/functions/admin-users/index.ts` in `beta`. JWT authorization and a general `app_admins` membership check exist. However `set_password` can reset a nominated account without an owner-only role gate or protected-target check; `create_demo` can reset an existing account's password solely by matching a supplied email, even if that account was not previously flagged as demo. Current `app_admins` holds one owner and no non-owner admins (latent exposure; no confirmed misuse).
2. **S-02 High: household membership role escalation.** The live `public.household_members` INSERT/UPDATE RLS rules allow household `admin` and `owner` through `private.can_admin_household`, but do not constrain the *new role*. Authenticated clients hold INSERT/UPDATE permission, including update of the `role` column. No protective noninternal table trigger was found. A household admin could give an owner-level membership to itself or another account directly using REST. Existing sampled membership roles were seven owners and no admins. Never rely solely on Edge/UI role restrictions.
3. **S-03 High if Docker image is served: broad webroot copy.** `Dockerfile` runs `COPY . /usr/share/nginx/html`; it excludes only a few directories afterward, and no `.dockerignore` appears in the repository. Nontracked `.env`/backup files in the Docker build context could become publicly served. `supabase/`, `tests/` and `docs/` are also copied. A default Nginx deployment does not interpret Cloudflare `_headers` automatically. Whether this Docker build is used in production was not verified.
4. **S-04 Medium: browser token persistence.** `assets/js/app/backend.js` stores the access and refresh session as JSON in `localStorage`; successful XSS can read these credentials. `_headers` CSP allows some third-party code CDNs and `wasm-unsafe-eval`. Prefer stricter bundled/pinned libraries and test DOM injection sinks.
5. **S-05 Medium: leaked-password protection.** Live Supabase Security Advisor reports `auth_leaked_password_protection` WARN. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
6. **S-06 Needs per-RPC review:** Supabase Advisor lists eight authenticated-callable `SECURITY DEFINER` public functions. An advisory does not prove exploitability. The destructive `admin_reset_user_finance` RPC checks only for membership in `app_admins`, so role-specific authorization deserves review.
7. **S-07 CI hardening:** GitHub Actions runs JavaScript syntax/tests and creates ZIP builds, but the reviewed workflow does not run a secrets scanner, dependency scanner, SQL/RLS negative-auth tests or image audit.

## Positive controls and verified limits

- Storage bucket `finance-documents` object policies restrict read to household members and writes to writers. Core transactions RLS limits access by household and account visibility.
- The beta JavaScript contains a publishable Supabase client key, **not** a service-role key; this is expected with enforced RLS.
- Reviewed SQL metadata did not show any ordinary public table with RLS disabled; three internal log/demo tables have RLS enabled with no direct client policy.
- Several Edge functions validate Supabase JWTs; their presence does not imply that each administrative action has correct authorization.
- We did not modify passwords, data, roles, production policies or deployed Edge functions. This review does not replace an authenticated penetration test of the UI.

## EON memory status and project activation

**Important current blocker:** AxiomSeal returns `REQUIRE_CONFIRM` and stores detailed source memories as `pending_confirm`. It excludes these records from searches and active project counts. The project `budget-control` therefore does not appear in `eon_projects` until memories are approved. As of this audit, **10 nonduplicate records** are awaiting review (IDs 4–7, 9–14). The accidental newer duplicate for `runtime-config.js` was deleted with an AxiomSeal audit certificate; the original remains.

Review at https://app.axiomseal.com/quarantine . After approval, verify via `eon_projects`, `eon_list(project_id='budget-control')` and `eon_search(project_id='budget-control',query=<filename>)`. This repository scan does **not** create a new ChatGPT UI project; the user is already working within **App erstellungen**.

## Priorities

P0: fix server-side `admin-users` action authorization and the household-members RLS owner transition rules. P1: restrict Docker build context or whitelist frontend files, review direct `SECURITY DEFINER` RPC privileges and enable breached-password checks. P2: add CI scanners, pin dependencies, and evaluate localStorage token hardening.
