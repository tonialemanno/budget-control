# aione Beta 69 — Foundation C

## Scope

Foundation C establishes the central country/region/municipality and money context without rewriting existing financial calculations.

### Implemented

- Central region registry for CH and DE.
- All Swiss cantons and German Bundesländer are selectable through one generic region layer; `canton_code` is kept Swiss-specific.
- SG and TG are marked as the first cantons for the regional tax-data layer.
- Profile settings now store `country_code`, generic `region_code`, Swiss `canton_code` and `municipality` in addition to the legacy country/address fields.
- Additive Supabase migration keeps Stable compatible with the shared database.
- The database language constraint is prepared for French while Romanian remains accepted for legacy compatibility.
- Romanian is removed from the active Beta 69 language selector.
- Dedicated money core reads the user's base currency and current EUR/CHF context for new Beta components.
- Desktop context line now shows country, region, municipality, base currency and locale.

## Important boundary

Existing legacy screens are not yet fully migrated to the new money and i18n cores. Hard-coded legacy currency labels and the old inline translation dictionary are still audited feature by feature. This avoids a risky global search/replace that could confuse account currency with base currency.

## Safety

The Supabase migration is additive. No existing financial table, transaction, account or calculation is deleted or reinterpreted.

The regional settings include a permanent warning that tax/legal calculations are planning aids and must be checked against official authority documents.
