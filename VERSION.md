# Version 2.3.0-beta-1

## V2.3 Integrated Beta – Gesamttest

Dieser Stand bündelt die offenen V2.2-/V2.3-Arbeiten in einem einzigen testbaren Paket.

### Enthalten

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
