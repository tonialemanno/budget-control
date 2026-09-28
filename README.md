# Finance App V1 – Style Foundation

Erste deploybare Frontend-Version auf Basis des Projekt-Masterplans.

## Ziel dieser Version

Diese V1 legt die visuelle und technische Frontend-Basis fest:

- Apple/iOS-inspirierte Gestaltung, ohne Apple-Assets zu kopieren
- Systemfont statt externer Font-Abhängigkeiten
- helle und dunkle Darstellung
- Glass-/Blur-Effekte nur für Navigation und Bedienelemente
- klare semantische Farben für positiv, Warnung und negativ
- responsive Desktop-, Tablet- und Mobile-Navigation
- Finance Core + modulabhängige Navigation
- Darstellungsstufen Einfach / Standard / Experte
- zentrale Konfiguration und zentraler UI-State
- wiederverwendbare Komponenten statt Seiten-Patches
- nur Demo-Daten; noch keine Supabase-/Bank-/API-Anbindung

## Struktur

```text
finance-app-v1/
├── index.html
├── _headers
├── README.md
├── docs/
│   └── FINANCE_APP_MASTERPLAN.md
└── assets/
    ├── css/
    │   ├── tokens.css
    │   ├── base.css
    │   ├── components.css
    │   ├── layout.css
    │   └── responsive.css
    └── js/
        ├── main.js
        ├── app/
        │   ├── config.js
        │   ├── demo-data.js
        │   ├── store.js
        │   ├── format.js
        │   ├── icons.js
        │   └── components.js
        └── views/
            ├── overview.js
            ├── accounts.js
            ├── transactions.js
            ├── budget.js
            ├── bills.js
            ├── goals.js
            ├── debts.js
            ├── wealth.js
            └── settings.js
```

## Lokal starten

Da native ES-Module verwendet werden, über einen kleinen lokalen Webserver öffnen:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

## GitHub / Cloudflare Pages

Das Verzeichnis kann direkt als Repository-Inhalt verwendet werden. Es gibt keinen Build-Schritt und keine npm-Abhängigkeiten.

Für Cloudflare Pages:

- Framework preset: None
- Build command: leer
- Build output directory: `.`

## Wichtig

Diese Version enthält bewusst keine produktive Finanzlogik und keine echten Zugangsdaten. Demo-Daten liegen ausschließlich in `assets/js/app/demo-data.js`.

Die weitere Entwicklung soll den Masterplan als verbindliche Grundlage verwenden. Bestehende Komponenten werden bei Änderungen sauber angepasst oder ersetzt; es werden keine Patch-Ketten über alte Implementierungen gelegt.
