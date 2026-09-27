# Changelog

## 69.0.0-beta.1 — Beta 69 foundation

- Started the Beta 69 desktop architecture without changing existing business behavior.
- Added dedicated i18n files for de-CH, fr-CH, it-CH and English.
- Added the country/region structure with Switzerland, St. Gallen, Thurgau and Germany placeholders.
- Defined central context requirements for country, canton/state, municipality, base currency and language.
- Defined the early Swiss debt-enforcement module boundary.
- Defined source/version/warning requirements for tax and official-data integrations.
- Updated Beta version and service-worker cache markers.
- Existing Stable financial/business logic remains the reference until migrated and regression-tested.

## 68.1.1-beta.1 — structural refactor step 1

- No new application feature.
- Preserved Stable baseline before refactoring.
- Externalized existing CSS while preserving the three-block cascade order.
- Externalized existing JavaScript without changing application code.
- Added a Beta-specific service-worker cache and precache entries for extracted assets.
- Added architecture/refactoring/test documentation and integrity checks.

## 68.1.0 — Stable baseline

Existing complete aione application before modular refactoring.
