# i18n

Beta 69 keeps translatable UI text outside business logic.

Maintained initial locales:

- `de-CH.json`
- `fr-CH.json`
- `it-CH.json`
- `en.json`

Rules:

- keys describe meaning, not the original German sentence;
- country-specific terminology belongs in locale/region overrides;
- no new large translation dictionaries inside feature JavaScript;
- untranslated keys must fall back predictably instead of silently rendering a wrong language.

These files are foundation-only until the Beta 69 i18n loader is connected.
