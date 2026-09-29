# Version 2.3.0-beta-3

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