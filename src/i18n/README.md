# i18n

Beta 69 keeps translatable UI text outside business logic.

Maintained initial locales:

- `de-CH.json`
- `fr-CH.json`
- `it-CH.json`
- `en.json`
- `de-DE.json` (country-specific German foundation)

Rules:

- keys describe meaning, not the original German sentence;
- country-specific terminology belongs in locale/region overrides;
- no new large translation dictionaries inside feature JavaScript;
- untranslated keys must fall back predictably instead of silently rendering a wrong language.

`src/core/i18n.js` now loads these files for Beta 69 shell/components. Legacy feature screens are migrated gradually and keep their existing translation path until replaced.
