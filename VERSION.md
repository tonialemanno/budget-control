# Version 2.3.0-beta-5

## V2.3 Beta 5 – iPhone UX

Dieser Stand ist ein reines Mobile-UX-Redesign. Die Desktop-Darstellung bleibt oberhalb des Smartphone-Breakpoints unverändert. Es ist keine zusätzliche Datenbankmigration erforderlich.

### Mobile-Zielgeräte

- iPhone 11 Pro: 375 pt Breite
- iPhone 12 Pro: 390 pt Breite
- Safe-Area-Unterstützung für Notch und Home Indicator

### Neu auf dem Handy

- iOS-inspirierte kompakte Topbar mit Large-Title-Verhalten beim Scrollen.
- Edge-to-edge Bottom-Tabbar mit fünf Kernbereichen und kurzen mobilen Labels.
- Vollständige Safe-Area-Abstände oben/unten.
- Mindestens 40–48 px grosse Touch-Ziele; Formfelder auf 16 px zur Vermeidung des Safari-Fokus-Zooms.
- Mobile Formulare einspaltig, grössere Inputs und klare primäre/sekundäre Aktionen.
- Tabellen werden auf Smartphones automatisch zu beschrifteten Karten statt horizontalem Desktop-Tabellenscrollen.
- Transaktionsaktionen, Import/Kategorisierung, Settings, Admin und Kartenraster für Daumenbedienung neu angeordnet.
- Profilmenü wird auf Smartphones als Bottom-Sheet dargestellt.
- Seitenmenü wird als iOS-artiges Off-Canvas-Sheet dargestellt.
- Zwei-Spalten-Metriken auf 375/390 pt reduzieren unnötiges Scrollen; sehr schmale Geräte fallen auf eine Spalte zurück.
- Login und Toasts berücksichtigen Safe Areas und mobile Tabbar.

### Desktop

- Keine Neugestaltung des Desktop-Layouts.
- Gleiche Komponenten, Datenlogik und Berechtigungen.
- Mobile Anpassungen liegen im Smartphone-Breakpoint bzw. in mobiler Beschriftung vorhandener Tabellen.


## V2.3 Beta 4.1 – Stabilisierung & PDF-Import

Deep-Test-Korrekturen auf Basis von Beta 4. Keine Patch-Wrapper; die betroffenen Funktionen und Views wurden direkt korrigiert.

### Korrigiert

- `Dokumente`: Zugriff auf die persönliche Modul-Sichtbarkeit wird sauber als View-Parameter übergeben; kein `hiddenModules is not defined` mehr.
- `Steuerberater`: Beleg-Zuordnung verwendet das korrekte Dokumentobjekt; vorhandene Transaktionsbelege lassen die Seite nicht mehr abstürzen.
- `Finance Intelligence`: Projektion basiert auf heutiger Liquidität minus offenen Rechnungen. Einnahmen/Ausgaben des laufenden Monats werden nicht mehr ein zweites Mal auf den bereits aktuellen Kontostand angewendet.
- Historische Import-Batch-Zuordnung repariert. Alle noch vorhandenen Import-Transaktionen besitzen wieder `import_batch_id`.
- CSV-Parser verarbeitet gequotete Felder mit eingebetteten Zeilenumbrüchen.
- Lokale Monats-/Datumswerte ersetzen UTC-basierte `toISOString()`-Ableitungen an den betroffenen UI-Stellen.

### PDF-Kontoauszüge

- Datenimport akzeptiert `.csv` und `.pdf`.
- Textbasierte PDFs werden im Browser mit PDF.js 4.10.38 analysiert.
- Importiert werden nur Zeilen mit eindeutig erkennbarem Datum und eindeutigem Vorzeichen bzw. Debit-/Credit-Kontext.
- Unklare PDF-Zeilen werden gezählt und übersprungen statt geraten.
- Gescannte PDFs benötigen OCR und werden in dieser Beta bewusst noch nicht automatisch interpretiert.

### Rechnungen

- `Bezahlen` erzeugt entweder eine echte Kontobuchung oder verknüpft eine bereits vorhandene passende Ausgangsbuchung.
- Betrag und Währung müssen exakt zur Rechnung passen.
- Verknüpfte Zahlungen werden serverseitig geschützt.
- `Zahlung zurücknehmen` entfernt eine von Finance erzeugte Kontobuchung; eine bereits vorhandene Bankbuchung bleibt erhalten.

### Backend-Härtung

- `convert_transaction_to_transfer` und `record_investment_trade` laufen als `SECURITY INVOKER`; ihre bestehenden expliziten Berechtigungsprüfungen bleiben erhalten und RLS greift zusätzlich.
- Die vom Supabase-Performance-Audit gemeldeten fehlenden FK-Indizes wurden ergänzt.
- Die bekannte Auth-Einstellung „Leaked Password Protection“ bleibt als separates Supabase-Projektsetting offen.

### Migration

`20260929_finance_v2_3_beta4_1_stabilization.sql`

## V2.3 Beta 4 – Debt Ledger

Dieser Stabilisierungsschritt ersetzt die bisherige reine Restschuld-Korrektur durch einen konsistenten Schulden-Zahlungsverlauf.

### Neu

- Bestehende Schulden vollständig bearbeiten: Name, Gläubiger, Typ, Währung, Ursprungsbetrag, Restschuld, Zins, Rate, Rhythmus, Zahlungskonto, Termine, Status und Notiz.
- `Zahlung erfassen` mit Aufteilung in Tilgung, Zins und Gebühren.
- Drei saubere Zahlungswege: neue Kontobuchung erzeugen, vorhandene Bankbuchung verknüpfen oder historische Zahlung ohne neue Kontobewegung erfassen.
- Restschuld und Zahlungshistorie werden in einer Datenbanktransaktion zusammengeführt; Teilzustände werden vermieden.
- Automatische Fortschreibung des nächsten Zahlungstermins, optional abschaltbar.
- Zahlungshistorie pro Schuld mit Restschuld nach jeder Zahlung.
- Nur die zuletzt erfasste aktive Zahlung kann storniert werden; dabei werden Restschuld, Termin und verknüpfte Kontobuchung konsistent zurückgesetzt.
- Schuldenrate kann mit `Wiederkehrend` verbunden und bei Änderungen synchronisiert werden.
- Neue Tabelle `debt_payments`, neue Debt-Verknüpfungen zu Zahlungskonto/Wiederkehrend und `transactions.cashflow_type`.
- Schuldentilgung wird nicht als Konsumausgabe gezählt; Zins und Gebühren bleiben Aufwand. Cashflow berücksichtigt weiterhin den vollständigen Geldabfluss.
- Kategorisierungsassistent ignoriert Schuldentilgungen bewusst.
- RLS für `debt_payments` inklusive restriktivem Schulden-Modul-Gate. Keine neue SECURITY-DEFINER-Funktion.

### Migration

`20260929_finance_v2_3_debt_ledger.sql`

Zusätzliche Integritätshärtung: `20260929_finance_v2_3_debt_ledger_hardening.sql` und `20260929_finance_v2_3_debt_transaction_integrity.sql`. Sie verhindern u. a. Währungswechsel nach vorhandenem Zahlungsverlauf sowie direkte Änderungen an aktiven Schuldentilgungs-Buchungen.

## V2.3 Beta 3 – Categorization Assistant

Dieser Stabilisierungsschritt vervollständigt die bereits geplante Händler- und Kategorienlogik, ohne einen neuen Hauptbereich einzuführen.

### Neu

- Button `Kategorien analysieren` direkt unter Transaktionen; jederzeit erneut ausführbar.
- Analyse des gesamten vorhandenen Buchungsbestands, nicht nur des letzten CSV-Imports.
- Gruppierung nach normalisiertem Händler statt einer endlosen Einzelbuchungsliste.
- Vorschläge aus gemerkter Händlerkategorie, bestehenden Regeln und konservativer Händlerbibliothek.
- Sammelaktion `Sichere Vorschläge übernehmen` verändert ausschließlich bisher unkategorisierte Buchungen.
- Bestehende Benutzerkategorien werden bei der Sammelaktion bewusst nicht überschrieben.
- Händlergruppen können einzeln geprüft, auf eine andere Kategorie gesetzt und für zukünftige Imports gemerkt werden.
- Direkter Sprung von einer Händlergruppe zu den zugehörigen Einzelbuchungen.
- Review-Liste ist paginiert und kann auf offene Gruppen reduziert werden.
- Neue Haushalte erhalten die CH-/DE-Starter-Kategorien automatisch.
- Bestehende Haushalte ohne Kategorien erhalten sie beim ersten Start der Analyse.
- Keine neue Datenbankmigration erforderlich; bestehende RLS- und Merchant-Struktur wird weiterverwendet.

## V2.3 Beta 2 – Historical Explorer & Goal Funding

Dieser Stand behebt die Begrenzung der Transaktionshistorie und erweitert Sparziele um frei editierbare sowie kombinierbare Finanzierungsquellen.

### Neu

- Sämtliche Transaktionen werden paginiert aus Supabase geladen; die bisherige 500er-Grenze entfällt.
- Buchungsjournal ohne Endlosliste: 50 Buchungen pro Seite.
- Filter nach Freitext/Händler, Kategorie, Konto, Zeitraum und Von/Bis.
- Zeitraum zusätzlich `Alle Buchungen`; historische Suche reicht über den gesamten vorhandenen Datenbestand.
- Kategoriekacheln bleiben Auswertung; Klick führt direkt zu den zugehörigen Einzelbuchungen.
- Monatsverlauf zeigt rückwirkende Ausgaben für den aktuell gesetzten Filter.
- Eingebaute Händlerbibliothek normalisiert besonders eindeutige Marken wie Migros, Coop, Denner, Aldi, Lidl, MediaMarkt, SBB, Sanitas/Groupe Mutuel usw. bereits vor dem Import.
- Sparziele können vollständig bearbeitet werden: Ziel, aktueller Stand, eigener Monatsbetrag und Termin.
- Vorschlag bleibt optional und überschreibt nicht mehr die Möglichkeit, einen eigenen Betrag zu wählen.
- Sparziele unterstützen zusätzliche fixe Beträge, Verknüpfungen zu `Wiederkehrend` und einen dynamischen Monatsüberschuss (Durchschnitt der letzten drei vollständigen Monate).
- Mehrere Quellen werden zu einem Gesamt-Sparplan pro Monat kombiniert.

### Weiterhin enthalten


- V2.2 UI-Grundlage: Scroll/Login-Fix, Profil/Rollen, persönliche Modul-Sichtbarkeit, Privacy-Modus, skalierbarer Admin.
- Import Intelligence: Händlererkennung, Händler-Gruppierung, Kategorien direkt beim Import, Import-Historie und kompakte Auswertung.
- Transaktionen standardmässig als kompakte Monats-/Quartals-/Jahres-Kacheln; Detailansicht bleibt verfügbar.
- TWINT-Zweck kann direkt ergänzt werden.
- Bargeld-/Sparkonto-Hinweise: passende Abhebungen/Überträge können nach Bestätigung in echte Umbuchungen umgewandelt werden.
- Automatische Referenz-FX-Kurse für CHF/EUR/USD/GBP über die offizielle SNB-Datenquelle; Originalwährungen bleiben erhalten.
- Budget: interne Umbuchungen zählen nicht als Konsum; Sparen auf Sparkonten wird separat ausgewiesen; Händler-Budgetvorschläge und geplante Fixkosten.
- Sparziele: Machbarkeit, erforderlicher Monatsbetrag, Prognose und Grün/Gelb/Rot-Status.
- Familie & Haushalt: maximal 5 Personen inklusive Owner.
- Rechnungen/Verträge: verständlichere Trennung und Übernahme von Verträgen in Wiederkehrend.
- Versicherungen: bearbeiten, Policennummer, letzter Zahlungstermin, Konto/Kategorie, Dokumentfoto/PDF und Übernahme in Wiederkehrend.
- Fahrzeuge: bearbeiten, Kennzeichen und optionaler Kilometerstand.
- Investments: Positionen bearbeiten, Teilkäufe/-verkäufe und Trade-Historie mit Menge, Preis, Gebühren und realisiertem Ergebnis.
- Steuerberater-Modul: Steuerjahr/Region, steuerrelevante Buchungen, Belegfoto/PDF, Dokumentablage und CSV-Export.
- Vorsorge: länderspezifische Orientierung ohne hart codierte, möglicherweise veraltete Steuerlimiten.
- Backend-Härtung für Steuerberechtigungen und private Konten bei intelligenten Umbuchungen.

### Bewusst noch nicht automatisiert

- Direkte Bankanbindung (SIX bLink / PSD2)
- Live-/Intraday-Börsen- und Kryptokurse ohne konfigurierten verlässlichen Market-Data-Provider
- verbindliche automatische Steuerabzugsentscheidung je Einzelfall/Kanton
- automatische OCR-Dokumenterkennung
- direkte Bankzahlungen

Manuelle Nutzung bleibt für alle wesentlichen Finanzobjekte möglich.