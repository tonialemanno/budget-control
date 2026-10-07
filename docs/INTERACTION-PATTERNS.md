# ALEMANNO BUCHHALTUNG – Interaktionsregeln

## Speichern statt Auto-Save

Normale Benutzerentscheidungen in Formularen werden nicht beim Anklicken oder Auswählen sofort gespeichert.

Regel:

1. Benutzer ändert Select, Checkbox, Radio oder Eingabefeld.
2. Die Änderung bleibt lokal im Formular und wird als „noch nicht gespeichert“ markiert.
3. Weitere Änderungen können ohne Reload vorgenommen werden.
4. Erst „Speichern“ schreibt die Änderung.
5. Nach erfolgreichem Speichern wird die Ansicht höchstens einmal aktualisiert.

Diese Regel gilt insbesondere für:
- persönliche Einstellungen
- Sprache & Region
- Darstellung
- Informationstiefe
- Finanzmonat
- automatischen Logout
- Privatsphäre-Einstellung
- persönliche Modul-Sichtbarkeit
- Admin-Sprache und Modulfreigaben
- Haushaltspräferenzen

## Was weiterhin sofort reagieren darf

Nicht jede UI-Reaktion ist ein Speichervorgang. Folgende Dinge bleiben sofort reaktiv, ohne Datenbankänderung:
- Filter und Suche
- Ein-/Ausblenden abhängiger Felder
- Vorschauen und Berechnungen
- Sortierung und Seitennavigation innerhalb einer Ansicht
- Datei-Auswahl vor dem eigentlichen Upload/Import

Explizite Befehle bleiben direkte Aktionen:
- Importieren
- Löschen
- Archivieren
- Zahlung zuordnen
- Beleg hochladen
- Passwort ändern
- Stammdaten installieren

## Schutz ungespeicherter Änderungen

Solange ein Deferred-Formular offen geändert wurde:
- automatische Admin-Refreshes überschreiben den Entwurf nicht,
- Navigation warnt vor dem Verlassen,
- Browser-Reload/Tab-Schliessen warnt ebenfalls,
- der Speichern-Button wird sichtbar aktiv.

## Definition of Done

Eine neue Einstellungs- oder Berechtigungsfunktion gilt erst als fertig, wenn:
- Auswahl nicht automatisch persistiert,
- ein expliziter Speichern-Button vorhanden ist,
- Dirty-State sichtbar ist,
- Navigation/Auto-Refresh den Entwurf schützt,
- DE/EN/IT vorhanden sind,
- Regressionstests das Verhalten absichern.
