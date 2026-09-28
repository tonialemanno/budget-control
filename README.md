# Finance App V1.2 – Finance Core

Deploybare Finance-Core-Version auf Basis des Projekt-Masterplans.

## In dieser Version aktiv

- neuer, eigenständiger Supabase-Backend-Stack (`finance-v1`)
- neue Benutzer über Supabase Auth
- Benutzerprofil und einmalige Grundeinrichtung
- Land Schweiz / Deutschland und Basiswährung
- Haushaltsmodell mit Rollenbasis
- Konten mit verbindlichem aktuellem Kontostand (`balance anchor`)
- Kategorien direkt bei den Transaktionen erfassen
- manuelle Einnahmen und Ausgaben
- echte Übersicht aus Live-Daten
- Row Level Security für Benutzer- und Haushaltsdaten
- Apple/iOS-inspirierte, responsive Oberfläche
- Light / Dark / System
- Finance Core + modular vorbereitete Navigation

## Noch nicht aktiv

Die folgenden Module bleiben absichtlich ausgeblendet, bis ihre eigene saubere Implementierung steht:

- Budget & Planung
- Rechnungen & Verträge
- Sparziele
- Schulden & Kredite
- Vermögen
- Investments
- Finance Intelligence
- CSV-/PDF-Import
- Banking Provider
- Dokumente
- Admin-/Lizenzsystem

## Architektur

```text
index.html
_headers
README.md
VERSION.md
assets/
  css/
    tokens.css
    base.css
    components.css
    layout.css
    forms.css
    responsive.css
  js/
    main.js
    app/
      backend.js
      finance-api.js
      config.js
      store.js
      format.js
      icons.js
      components.js
      demo-data.js
    views/
      overview.js
      accounts.js
      transactions.js
      ...
supabase/
  README.md
  migrations/
docs/
  FINANCE_APP_MASTERPLAN.md
```

Die deaktivierten Modul-Views dürfen weiterhin als visuelle Vorarbeit im Repository liegen, sind aber nicht Teil der aktiven Navigation.

## Sicherheit

- Finanzdaten werden nicht im Frontend als Quelle der Wahrheit gespeichert.
- Die Datenbank erzwingt Row Level Security.
- Der Browser enthält nur den öffentlichen Supabase Publishable Key.
- Service-Role-/Secret-Keys gehören niemals ins Frontend oder Repository.
- Der aktuelle Kontostand eines Kontos wird als zeitlicher Anker gespeichert. Historische Transaktionen vor diesem Anker verändern den eingegebenen aktuellen Stand nicht.

## Deployment

Kein Build-Schritt und keine npm-Abhängigkeiten.

Cloudflare Pages:
- Framework preset: None
- Build command: leer
- Build output directory: `.`

Die Content-Security-Policy in `_headers` erlaubt ausschließlich die eigene App und die neue Supabase-Instanz.
