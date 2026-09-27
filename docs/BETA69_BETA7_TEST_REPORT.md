# Beta 69.0.0-beta.7 — Test report

Date: 2026-09-27

## Scope

Beta 7 consolidates the UX findings from live testing instead of shipping many small UI patches.

The release changes navigation/interaction, login loading order, dialogs, account actions, transaction filtering, bank-file handling, categories, documents/quotes, tax reference logic, family chat access, Admin feature editing, Swiss debt-enforcement labels and AI review behavior.

## Automated checks

Passed:

- JavaScript syntax for all local app/core/component/feature scripts.
- Local startup assets return HTTP 200.
- All Beta 69 foundation, onboarding, debt-enforcement, quote, regional-tax and UX regression tests.
- Legacy DOM preservation: Beta 6 had 1,158 unique IDs; Beta 7 has 1,161. No Beta 6 ID was removed. Added only `invoiceDocumentKind`, `newQuoteBtn`, `quoteOpenCount`.
- Protected financial calculation hashes remain unchanged except `taxCalc`, whose Beta 7 override is intentional and documented for the SG/TG regional correction.
- Service-worker cache and app/context versions resolve to `69.0.0-beta.7`.

## User bank samples

- The provided UBS CSV was detected as a semicolon-delimited export with 68 data rows and the expected booking/date/debit/credit/description fields.
- The provided UBS PDF is text-based and can be extracted as text; it is not an image-only scan.
- The Beta 7 bank reconciliation control accepts multiple PDF and CSV files. CSV is handed to the structured importer so preview and duplicate checks remain in force.

## Supabase

Applied live migration:

- `aione_v690_invoice_offer_kind`
- adds invoice `document_kind` = `invoice` / `quote`
- adds quote workflow statuses `accepted` / `rejected`
- existing invoice rows remain invoices

No destructive migration was applied.

## Tax reference correction

Beta 7 makes the existing tax planning function region-aware for SG and TG instead of applying one implicit rule set. Unsupported cantons are explicitly marked unsupported rather than receiving SG/TG reference values.

All displayed results remain planning estimates. Official tax assessments and authority data remain authoritative.

## Not covered by automated checks

No full browser E2E automation was executed. Live Cloudflare testing is still required for visual dialog sizing, browser/PWA cache behavior, perceived login speed, Admin interaction, file chooser behavior and full end-user workflows.
