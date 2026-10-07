# ALEMANNO BUCHHALTUNG – Routing

Seit R48 verwendet die Anwendung echte Browser-Pfade statt Hash-Routen.

## Grundregel

Jede Seite ist genau einmal in `assets/js/app/router.js` registriert. Die Route-Registry ist die einzige Stelle für:

- internen Routenschlüssel
- öffentliche URL
- Alias-Pfade
- Seitentitel / Eyebrow
- Navigationstitel und Icon
- Modulzuordnung
- Bereich / Section
- Admin-Guard

Beispiel:

```js
{
  route: 'transactions',
  path: '/finance/transactions',
  title: 'Transaktionen',
  module: 'money',
  section: 'money'
}
```

Wenn ein Pfad später geändert werden soll, wird er in der Registry geändert. Der fachliche Schlüssel `transactions` bleibt stabil.

## Bereiche

- `/` – Übersicht
- `/review` – Prüfen
- `/finance/*` – Konten, Buchungen, Importe, Dokumente und weitere Geldbereiche
- `/planning/*` – Budget, Automatik, Rechnungen, Ziele und weitere Planungsbereiche
- `/selfservice/*` – Profil, persönliche Einstellungen und Stammdaten
- `/admin` – Administration
- `/setup` – Einrichtung

## Kompatibilität

Alte Links wie `#/transactions?create=expense` werden beim Laden automatisch auf den neuen Pfad `/finance/transactions?create=expense` umgestellt.

Cloudflare Pages verwendet `_redirects`, damit direkte Browser-Aufrufe und Reloads auf tiefen Pfaden wieder `index.html` laden.

## Definition of Done für neue Seiten

Eine neue Seite gilt erst als integriert, wenn sie:

1. einen Registry-Eintrag mit eindeutigem Pfad besitzt,
2. einen Renderer hat,
3. Modul-/Adminrechte korrekt berücksichtigt,
4. Navigation und Deep-Linking unterstützt,
5. DE/EN/IT berücksichtigt,
6. Desktop und Mobile geprüft ist,
7. durch Route-/Regressionstests abgedeckt ist.
