# Regions

Country/region modules contain jurisdiction-specific terminology, reference data adapters and rules that must not leak into generic finance code.

Initial structure:

- `ch/common` — Switzerland-wide concepts
- `ch/sg` — Canton St. Gallen
- `ch/tg` — Canton Thurgau
- `de/common` — Germany-wide concepts

A region module may provide reference data and presentation rules. It must not silently overwrite user-entered confirmed values.
