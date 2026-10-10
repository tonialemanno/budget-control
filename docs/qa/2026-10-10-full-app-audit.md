# AIONE Finance: Systemaudit vom 10. Oktober 2026

## Umfang und Beweisbasis

**Code:** Branch `beta`; **Release:** 2.4.21 R77 (abschliessend getesteter Beta-Code). Stable-Branch unverändert.

**Automatische CI:** 64 Tests vollständig bestanden. JavaScript-Syntaxprüfung bestanden. Vollständiges ZIP erfolgreich gebaut. GitHub Actions Lauf `38040014535` (10.10.2026).

**Bedieninventar (statisch):** 35 View-Module, 194 authored Button-Markupstellen, 123 eindeutige `data-action`-Aktionstypen, 27 Formulartypen, 17 Drilldown-Verweise. Im automatisierten Mapping fehlten keine zugehörigen Handlernamen. Dies ist **keine** erfolgreiche Ausführung sämtlicher Buttons gegen einen eingeloggten Benutzer.

**DOM / mobile:** 35 Seiten mit generierten Render-Fixtures im Headless Chromium bei 375×812 und 1440×900 inspiziert (70 Durchgänge). 252 gerenderte Buttons und 58 gerenderte Formulare über beide Grössen. Fehlende `data-target`-Formularziele: 0. JavaScript-Fehler bei statischem Rendern: 0. Der gefundene horizontale Überlauf bei Rechnungen/Offerten wurde beseitigt; erneute 70 Bildschirmtests ohne Überlauf. Die Tests verwenden synthetische Fixtures, nicht echte Nutzer-Logins.

## Nachweislich behobene Fehler

1. **Release-Kette:** R74 scheiterte in CI wegen veralteter fest codierter Versionsprüfungen und fehlender IT/EN-Übersetzungen. Die Tests prüfen Versionsgleichheit jetzt anhand `version.json`; fehlende Übersetzungen ergänzt.
2. **Fehlende Demo-Funktionen:** Sparverlauf aus datierten Kontoüberträgen, Fahrzeug-Kaufpreis, dokumentierter Anzahlung, finanziertem Betrag und Leasing-Zahlungsverlauf und die Familienanzeige (Maximilian, Petra, Peter und Lukas Müller mit Haustieren) waren nicht im Beta-Zweig. In Beta eingebaut und durch `tests/demo-story-visibility-tests.mjs` abgesichert.
3. **Mobile Rechnungen/Offerten:** Aktionsleiste überschritt auf 375px Bildschirmen den Rand. Responsives Layout korrigiert und im Browser mit CSS überprüft.
4. **Falsche Stable-Anzeige im Beta-Build:** Branch `beta` kann unabhängig vom Hostnamen als Beta erkannt werden; die anfängliche HTML-Kanalbeschriftung wurde angepasst. Stable-Code nicht überschrieben.
5. **Quittungskamera:** Vollständiger Seiten-Reload nach dem Speichern entfällt; stattdessen wird der Finanzdaten-Kontext neu geladen und die aktuelle Ansicht aktualisiert. Regressionstest hinzugefügt.
6. **Aktionen-Kontrolle:** `tests/button-action-audit-tests.mjs` inventarisiert Buttons, Formulare, Drilldowns und Handler bei jedem CI-Lauf.

## Datenbank: Lesende Integritätsprüfung

- Buchungen ohne passendes Konto: **0**
- Händler mit identischem normiertem Schlüssel je Haushalt: **0**
- Belegdokumente mit Verweis auf nicht existente Buchung: **1** (nicht automatisch löschen)
- Gleiche aktive Kategoriebezeichnung und Kategorieart in einem Haushalt: **1 Dublettenpaar** (Restaurant & Café; einer der Datensätze ohne direkte Transaktionsverwendung). Nicht automatisch zusammenführen, da Parent-Kategorie verschieden.
- Überträge mit numerisch nicht ausgeglichener Summe: **16**. Alle geprüften Fälle waren **CHF/EUR-Paare mit je zwei Buchungen**; Beträge verschiedener Währungen dürfen nicht direkt addiert werden und sind deshalb kein Beleg für fehlende Gegenbuchungen.
- Keine produktiven Finanzbuchungen umgeschrieben.

## Sicherheits- und Performance-Hinweise

Supabase Advisors: Leaked-password-Prüfung in Supabase Auth deaktiviert; vier für `authenticated` ausführbare Security-Definer-Funktionen zur Berechtigungsprüfung vorgemerkt; drei RLS-Tabellen ohne direkte Policys (dürfen bei service-role-only Tabellen absichtlich so sein). 25 Hinweise zu fehlenden Foreign-Key-Indizes. Nicht ohne Architekturprüfung pauschal ändern.

## Nicht nachgewiesen / Freigabegrenze

- Kein authentifizierter Ende-zu-Ende-Test mit echten Klicks in der auf Cloudflare ausgelieferten Webapp, einschliesslich Kamera-Hardware und iPhone Safari.
- Cloudflare-Bereitstellung und Produktions-Domain-Version nicht unabhängig bestätigt. Ein erfolgreicher GitHub-Build ist keine Bereitstellungsbestätigung.
- Nicht alle Änderungen eines realen Nutzers gegen eine Live-Datenbank vollzogen; risikoreiche Finanzoperationen bewusst nicht simuliert.
- Das Vorhandensein von Code und Handlern belegt nicht, dass jede fachliche Geschäftsregel für alle Datenstände fehlerfrei arbeitet.

**Freigabeentscheidung:** Code- und statische UI-Regressionsprüfung bestanden. Eine vollständige Produktiv-Freigabe muss ausbleiben, bis ein authentifizierter Browserdurchlauf auf der tatsächlich veröffentlichten Beta-URL sowie die Beleg- und Dublettenausnahmen abgearbeitet wurden.
