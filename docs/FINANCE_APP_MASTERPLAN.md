# Finance App – Projekt-Masterplan

**Stand:** 28.09.2026  
**Status:** Verbindliche Projektgrundlage für den vollständigen Neuaufbau

---

## 1. Projektziel

Wir bauen eine neue modulare Finanz-App für Privatpersonen und Haushalte vollständig von Grund auf neu.

Die bestehende App dient ausschliesslich als Erfahrungsquelle dafür, welche Funktionen sinnvoll sind und welche Fehler wir vermeiden müssen. Bestehender Code, alte Workarounds, Patch-Strukturen oder gewachsene technische Abhängigkeiten werden nicht übernommen.

GitHub, Cloudflare und die bestehende technische Infrastruktur können weiterverwendet werden. Die Anwendungsarchitektur, Datenstruktur, Module, Frontend-Struktur und Geschäftslogik werden jedoch neu entwickelt.

Die App soll sowohl für einen einfachen Benutzer funktionieren, der nur wissen möchte, wie viel Geld vorhanden ist und was bis Monatsende übrig bleibt, als auch für einen sehr finanzaffinen Benutzer mit Vermögen, Investments, Krediten, Forecasts und detaillierten Analysen.

Es gibt nicht mehrere verschiedene Apps. Alle Benutzer arbeiten auf derselben technischen Plattform und derselben Datenbasis. Die sichtbare Funktionalität wird über Module, Features und Berechtigungen gesteuert.

---

## 2. Produktprinzip

Die App ist **keine klassische Buchhaltungssoftware für Privatpersonen**.

Sie ist ein persönliches Finanzsystem, das folgende Fragen beantwortet:

- Was habe ich?
- Was kommt herein?
- Was geht hinaus?
- Was bleibt übrig?
- Was muss ich noch bezahlen?
- Was schulde ich?
- Welche Verträge und Verpflichtungen bestehen?
- Welche Rechnungen kommen demnächst?
- Welche Rücklagen brauche ich?
- Wie entwickelt sich mein Vermögen?
- Wo entstehen finanzielle Risiken?
- Was passiert, wenn ich so weitermache?

Buchhaltungslogik darf intern verwendet werden. Der Benutzer soll sie jedoch nicht verstehen müssen.

Beispiel:

Nicht: `Buchung auf Konto 6360`

Sondern: `Krankenkasse CHF 420`

---

## 3. Zielgruppen

Die Anwendung muss den Spagat zwischen sehr einfachen und sehr anspruchsvollen Benutzern schaffen.

### 3.1 Einfacher Benutzer

Beispiel: Fabrikarbeiter oder Benutzer ohne besonderes Finanzwissen.

Er braucht hauptsächlich:

- aktueller Kontostand
- Einnahmen
- Ausgaben
- Rechnungen
- Budget
- verfügbare Mittel bis Monatsende
- Sparziele
- Schulden
- nächste Zahlungen

### 3.2 Standard-Benutzer

Zusätzlich:

- mehrere Konten
- detaillierte Kategorien
- Rückstellungen
- Verträge und Abos
- Kredite
- Haushalt/Familie
- Vermögensübersicht
- einfache Prognosen

### 3.3 Finanzaffiner Benutzer / Finanzguru

Zusätzlich:

- Nettovermögensentwicklung
- Investments
- Renditen
- Asset Allocation
- Cashflow
- Sparquote
- Fixkostenquote
- Forecasts
- Szenarien
- Vorsorge
- detaillierte Kredit- und Zinsanalysen
- langfristige Finanzplanung

Wichtig: Alle drei Benutzergruppen verwenden dieselbe Datenbasis.

---

## 4. Finance Core

Jeder Benutzer erhält einen verpflichtenden Finance Core.

Der Core ist die technische und funktionale Grundlage der Anwendung und kann nicht deaktiviert werden.

Zum Core gehören mindestens:

- Benutzer und Profil
- Land
- Basiswährung
- Haushalt
- grundlegende Berechtigungen
- Konten
- Bankkonten
- Sparkonten
- Bargeld
- Kreditkarten als Kontoart
- Transaktionen
- Einnahmen
- Ausgaben
- Umbuchungen
- Kategorien
- grundlegende Regeln für Kategorisierung
- Datenimport
- CSV-/Dateiimport
- grundlegende Dokumentverwaltung
- Basis-Dashboard
- Modulverwaltung
- Feature-Verwaltung
- Berechtigungsverwaltung

Der Core muss stabil bleiben und darf keine unnötigen Funktionen enthalten, die nur einzelne Benutzergruppen benötigen.

---

## 5. Modulares Produktmodell

Das System wird nach dem Prinzip aufgebaut:

```text
Finance Core
    ↓
Modul
    ↓
Untermodul
    ↓
Feature
    ↓
Berechtigung
```

Beispiel:

```text
Investments
└── Wertschriften
    └── Dividendenanalyse
        └── Feature aktiv/deaktiviert
            └── Benutzer darf lesen/bearbeiten
```

Ein deaktiviertes Modul soll für den Benutzer grundsätzlich nicht sichtbar sein.

Navigation, Dashboard, Formulare und Funktionen passen sich an die aktivierten Module an.

---

## 6. Monetarisierungsprinzip

Aktuell wird die Anwendung zunächst für Familie und Kollegen genutzt.

Trotzdem wird das Lizenz-, Modul- und Berechtigungssystem von Anfang an so entwickelt, dass später Module vermietet beziehungsweise über Abonnements freigeschaltet werden können.

Grundprinzip:

- Core = immer vorhanden
- Module = zusätzlich aktivierbar
- Features innerhalb eines Moduls = je Tarif oder Berechtigung steuerbar
- CH/DE = länderspezifische Regeln innerhalb der passenden Module

Die spätere Monetarisierung darf keinen grundlegenden Umbau der Anwendung notwendig machen.

---

## 7. Vorgesehene Module

### 7.1 Mein Geld

Basisfunktionen für den täglichen Überblick:

- Konten
- Einnahmen
- Ausgaben
- Kategorien
- Monatsübersicht
- wiederkehrende Zahlungen
- Fixkosten
- verfügbares Geld

### 7.2 Budget & Planung

- Budget pro Kategorie
- Soll/Ist
- Monatsplanung
- Jahreskosten
- Rückstellungen
- kommende Ausgaben
- fixe und variable Kosten
- Prognose Monatsende

### 7.3 Rechnungen & Verträge

- Rechnungen
- Verträge
- Abonnements
- Laufzeiten
- Kündigungsfristen
- Preisänderungen
- nächste Zahlung
- zugehörige Dokumente
- Abgleich mit tatsächlichen Transaktionen

### 7.4 Sparen & Ziele

- Notgroschen
- Ferien
- Auto
- Möbel
- Hochzeit
- Steuern
- individuelle Ziele
- Zielbetrag
- vorhandener Betrag
- monatlicher Sparbetrag
- Fortschritt
- Zieltermin

Erweiterbar für fortgeschrittene Benutzer um:

- Inflation
- Renditeannahmen
- Szenarien
- Opportunitätskosten

### 7.5 Schulden & Kredite

Unterstützte Typen können sein:

- Privatkredit
- Hypothek
- Leasing
- Kreditkarte
- Ratenkauf
- Kontoüberziehung
- private Schulden
- Steuerschulden
- Krankenkassenschulden
- sonstige Forderungen

Ein Kredit kann enthalten:

- ursprünglicher Betrag
- aktuelle Restschuld
- Zinssatz
- Rate
- Zahlungsrhythmus
- Laufzeit
- nächste Zahlung
- bereits bezahlte Beträge
- Zinskosten
- Dokumente
- Zahlungsplan
- Sondertilgungen

### 7.6 Mahnung / Betreibung / Inkasso

Problematische Forderungen erhalten einen eigenen Prozessbereich.

Beispiel:

```text
Rechnung
→ überfällig
→ Mahnung
→ Betreibung oder Inkasso
→ weitere rechtliche Schritte
→ abgeschlossen
```

Die Verarbeitung erfolgt über Ereignisse beziehungsweise eine Timeline und nicht nur über einen einzelnen Statuswert.

### 7.7 Familie & Haushalt

- gemeinsame Haushalte
- private und gemeinsame Konten
- private und gemeinsame Transaktionen
- gemeinsames Haushaltsbudget
- gemeinsame Rechnungen
- gemeinsame Sparziele
- Rollen und Berechtigungen

### 7.8 Vermögen

- Kontoguthaben
- Immobilien
- Fahrzeuge
- Wertgegenstände
- Beteiligungen
- sonstige Vermögenswerte
- Verbindlichkeiten
- Nettovermögen
- Entwicklung über Zeit

### 7.9 Immobilien

- Immobilienwert
- Hypothek
- Nebenkosten
- Versicherungen
- Renovationsrücklagen
- Dokumente
- laufende Kosten

### 7.10 Fahrzeuge / Mobilität

- Fahrzeug
- Kaufwert
- Leasing
- Versicherung
- Fahrzeugsteuer
- Treibstoff
- Service
- Reparaturen
- Parkplatz
- Dokumente

### 7.11 Versicherungen

- Versicherungsart
- Anbieter
- Prämie
- Zahlungsrhythmus
- Laufzeit
- Kündigungsfrist
- Policen
- Dokumente
- zugehörige Zahlungen

### 7.12 Investments

Mögliche Unterbereiche:

- Depotverwaltung
- Aktien
- ETF
- Fonds
- Obligationen
- Kryptowährungen
- Dividenden
- Performance
- Asset Allocation
- Kursdaten
- Gebühren
- realisierte Gewinne/Verluste
- unrealisierte Gewinne/Verluste
- Advanced Analytics

### 7.13 Vorsorge

CH und DE werden getrennt behandelt.

Schweiz beispielsweise:

- AHV
- Pensionskasse
- Säule 3a
- Säule 3b

Deutschland erhält ein eigenes fachliches Modell.

Spätere Funktionen:

- Rentenprognose
- Vorsorgelücke
- Szenarien

### 7.14 Finance Intelligence

Fortgeschrittene Analyse vorhandener Daten:

- Cashflow
- Nettovermögensentwicklung
- Sparquote
- Fixkostenquote
- Liquiditätsreserve
- Schuldenquote
- Zinsbelastung
- Forecast
- Szenariosimulation
- langfristige Vermögensentwicklung
- Vergleich Vorjahr
- Trends
- Drilldowns

---

## 8. Unterschiedliche Darstellungstiefen

Modul und Komplexität dürfen nicht dasselbe sein.

Mögliche Darstellungsstufen:

### Einfach

Beispiel:

`Du hast diesen Monat noch CHF 842 zur Verfügung.`

### Standard

Beispiel:

- Einnahmen CHF 5'800
- Fixkosten CHF 3'140
- variable Ausgaben CHF 1'124
- Rückstellungen CHF 694
- verfügbar CHF 842

### Experte

Zusätzlich:

- Forecast
- Vorjahresvergleich
- Quoten
- Trends
- Drilldowns
- Szenarien

Ein Benutzer kann unterschiedliche Bereiche mit unterschiedlicher Tiefe verwenden.

Beispiel:

- Dashboard = einfach
- Budget = standard
- Investments = Experte

---

## 9. Finanzobjekte und Beziehungen

Die Anwendung besteht nicht nur aus Transaktionen.

Finanzielle Lebensbereiche werden als eigenständige Objekte modelliert.

Mögliche Objekte:

- Person
- Haushalt
- Konto
- Kredit
- Vertrag
- Rechnung
- Sparziel
- Fahrzeug
- Immobilie
- Versicherung
- Investment
- Forderung
- Betreibung / Inkassofall
- Dokument

Diese Objekte können miteinander verbunden werden.

Beispiel Fahrzeug:

```text
Fahrzeug
├── Leasing
├── Versicherung
├── Fahrzeugsteuer
├── Treibstoffkosten
├── Reparaturen
└── Dokumente
```

Dadurch kann die App Zusammenhänge verstehen und muss nicht alles nur über Kategorien abbilden.

---

## 10. Schweiz und Deutschland getrennt behandeln

Der gemeinsame Finance Core bleibt länderunabhängig, soweit dies sinnvoll ist.

Landesspezifische Prozesse werden separat implementiert.

Schweiz und Deutschland dürfen nicht durch unzählige verstreute `if country == ...`-Abfragen im gesamten Code unterschieden werden.

Stattdessen gibt es klar getrennte Länderlogik beziehungsweise Länderregeln.

### Schweiz

Beispiele:

- Betreibung
- Zahlungsbefehl
- Rechtsvorschlag
- Fortsetzung
- Pfändung
- Verlustschein
- QR-Rechnung
- Schweizer Vorsorge

### Deutschland

Beispiele:

- Mahnung
- Inkasso
- Mahnbescheid
- Widerspruch
- Vollstreckungsbescheid
- Zwangsvollstreckung
- deutsche Vorsorge-/Steuerlogik

Neue Länder sollen später ergänzt werden können, ohne den Finance Core neu schreiben zu müssen.

---

## 11. Bankintegration

In einer ersten Entwicklungsphase dient Banking primär dazu:

- Konten zu erkennen
- Salden abzurufen
- Transaktionen einzulesen
- Transaktionen abzugleichen
- Kategorien vorzuschlagen
- Analysen durchzuführen

Die App soll zunächst keine direkten Bankzahlungen auslösen.

Eine spätere Zahlungsfunktion wäre ein separates Projekt und muss regulatorisch, sicherheitstechnisch und haftungsrechtlich neu bewertet werden.

---

## 12. API- und Integrationsarchitektur

Externe Systeme dürfen niemals fest mit dem Finance Core verdrahtet werden.

Für jede externe Datenquelle wird eine klar definierte Provider-Schnittstelle verwendet.

Der Finance Core kennt beispielsweise:

- Banking Provider
- Market Data Provider
- Tax Provider
- Investment Provider
- Legal Process Provider

Der Finance Core kennt jedoch nicht die interne Implementierung eines konkreten externen Anbieters.

Beispiel:

```text
Finance Core
│
├── Banking Interface
│   ├── CH → SIX bLink
│   └── DE → PSD2 Provider / z. B. finAPI
│
├── Economic Data Interface
│   ├── CH → SNB
│   └── DE → Bundesbank / ECB
│
├── Investment Interface
│   ├── CH → bLink OpenWealth
│   └── DE → Investment Provider
│
├── Tax Interface
│   ├── CH → zukünftige CH-Lösung
│   └── DE → ELSTER / ERiC
│
└── Legal Process Interface
    ├── CH → eSchKG / zukünftige Integration
    └── DE → EDA / zukünftige Integration
```

---

## 13. Schweiz – vorgesehene APIs und Standards

### 13.1 SIX bLink

Primäre Zielarchitektur für Schweizer Bankdaten.

Perspektivisch verwendbar für:

- Konten
- Kontostände
- Transaktionen

Produktive Nutzung kann Verträge, Admission und technische Freigaben erfordern.

### 13.2 SIX bLink OpenWealth / Custody Services

Später für das Investment-Modul interessant:

- Depotkonten
- Wertschriftenpositionen
- Wertschriftentransaktionen

### 13.3 Schweizerische Nationalbank – Daten-API

Geeignet für:

- Wechselkurse
- offizielle Zinssätze
- weitere Referenzdaten

Diese API kann unabhängig von Bankintegrationen verwendet werden.

### 13.4 Swiss QR Bill

Schweizer QR-Rechnungen werden gemäss Swiss Payment Standards verarbeitet.

Die QR-Rechnungslogik wird als eigener Parser beziehungsweise Service entwickelt und nicht direkt in Rechnungs- oder UI-Code eingebaut.

### 13.5 eSchKG

Für spätere strukturierte Integration von Betreibungsprozessen denkbar.

Das Betreibungsmodul darf jedoch nicht davon abhängig sein.

Betreibungen müssen vollständig manuell beziehungsweise dokumentbasiert verwaltbar bleiben.

### 13.6 ZEK

Das Kredit- und Schuldenmodul darf nicht von ZEK abhängig sein.

Kredite, Leasing, Kreditkarten und andere Verpflichtungen werden im eigenen Finanzmodell vollständig abgebildet.

---

## 14. Deutschland – vorgesehene APIs und Standards

### 14.1 PSD2 / XS2A

Für deutsche Bankdaten wird eine PSD2-/XS2A-kompatible Provider-Schicht vorgesehen.

Eine direkte Anbindung jeder einzelnen Bank soll vermieden werden.

### 14.2 Banking Aggregator, z. B. finAPI

Mögliche Daten:

- Konten
- Salden
- Transaktionen
- Sparkonten
- Kreditkarten
- Kreditkonten
- teilweise Depots

Die genaue produktive Nutzung hängt vom Provider, Vertrag und regulatorischen Modell ab.

### 14.3 Deutsche Bundesbank API

Geeignet für:

- Zinsen
- Finanzstatistiken
- Referenzdaten

### 14.4 Europäische Zentralbank API

Geeignet für:

- Wechselkurse
- europäische Referenzdaten
- weitere statistische Daten

### 14.5 ELSTER / ERiC

Möglicher Integrationsweg für ein späteres deutsches Steuermodul.

Nicht Bestandteil des Finance Core.

### 14.6 Elektronischer Datenaustausch im Mahnverfahren

Für spätere strukturierte Integration in gerichtliche Mahnverfahren denkbar.

Nicht Bestandteil der ersten Version.

Das Datenmodell für Forderungen und Mahnverfahren muss jedoch so entwickelt werden, dass eine spätere Anbindung möglich bleibt.

---

## 15. Fallback-Prinzip

Jedes wesentliche Finanzmodul benötigt einen Weg ohne externe API.

Beispiele:

### Bankkonto

- API
- CSV/Dateiimport
- manuelle Erfassung

### Kredit

- API
- Dokumentimport
- manuelle Erfassung

### Investment

- Depot-API
- Dateiimport
- manuelle Erfassung

### Betreibung / Inkasso

- spätere Behördenschnittstelle
- Dokumentimport
- manuelle Erfassung

Eine externe API darf niemals Single Point of Failure für die Finanzdaten des Benutzers sein.

---

## 16. Normalisiertes internes Datenmodell

Externe Provider bestimmen niemals unser Datenmodell.

Beispiel:

```text
External Provider Data
        ↓
Provider Adapter
        ↓
Validation
        ↓
Normalization
        ↓
Finance Core Transaction
        ↓
Database
```

Alle weiteren Module arbeiten ausschliesslich mit dem normalisierten Finance-Core-Modell.

Das Dashboard darf niemals direkt Daten von bLink, finAPI oder einem anderen Provider lesen.

---

## 17. API-Versionierung

Externe APIs können sich ändern.

Jeder Provider-Adapter erhält deshalb eine eigene Versionsverwaltung.

Ändert ein externer Anbieter seine API, wird der betreffende Adapter sauber aktualisiert oder ersetzt.

Es dürfen keine zusätzlichen Patch-Layer über eine alte Integration gelegt werden.

Nicht mehr benötigter Provider-Code wird entfernt, sobald eine Migration vollständig abgeschlossen ist.

---

## 18. Credentials und Secrets

API-Schlüssel, Zertifikate, Access Tokens, Refresh Tokens und andere Zugangsdaten dürfen niemals im Frontend oder öffentlich im GitHub-Repository liegen.

Secrets werden ausschliesslich serverseitig beziehungsweise über dafür vorgesehene Secret-Stores verwaltet.

Benutzerbezogene Bank- und Provider-Tokens müssen verschlüsselt gespeichert und streng dem jeweiligen Benutzer beziehungsweise Haushalt zugeordnet werden.

---

## 19. Entwicklungsreihenfolge für Integrationen

Bereits früh sinnvoll:

### Schweiz

- SNB-Daten-API
- Swiss-QR-Rechnung
- SIX-bLink-Provider-Struktur / Sandbox

### Deutschland

- Bundesbank-API
- ECB-API
- PSD2-/Provider-Struktur / Sandbox

Später:

### Schweiz

- bLink OpenWealth
- eSchKG
- weitere institutionelle Schnittstellen

### Deutschland

- ELSTER / ERiC
- strukturierte Mahnverfahren
- weitere institutionelle Schnittstellen

Grundregel:

Wir bauen zuerst das korrekte interne Finanzmodell.

Danach verbinden wir externe APIs damit.

Wir verändern niemals das interne Finanzmodell nur deshalb, weil ein einzelner externer Anbieter seine Daten auf eine bestimmte Weise strukturiert.

---

# 20. Verbindliche Entwicklungsregel: kein Patch-Code

Diese Regel ist verbindlich.

Die Anwendung wird nicht durch fortlaufende Patches, Wrapper oder Überschreibungen bestehender Funktionen aufgebaut.

Verboten sind insbesondere Strukturen nach dem Prinzip:

```text
alte Funktion speichern
→ neue Funktion darüberlegen
→ Verhalten ergänzen
→ alte Version trotzdem im Code behalten
→ nächster Patch darüberlegen
```

Nicht gewünschtes Beispiel:

```javascript
const oldRender = render;

render = function() {
    oldRender();
    // zusätzliche Logik
};
```

Solche Strukturen dürfen nicht als normale Entwicklungsstrategie verwendet werden.

Wenn sich eine Funktion oder ein Modul verändert, wird die bestehende Implementierung sauber angepasst, refaktoriert oder vollständig neu geschrieben.

Nicht mehr benötigter Code wird entfernt.

Es darf keine versteckte alte Version im Projekt verbleiben, nur weil eine neue Version darübergelegt wurde.

---

## 21. Refactoring statt Layering

Wenn eine Änderung nicht mehr sauber in die bestehende Struktur passt, gilt:

Nicht weiter ergänzen.

Stattdessen wird geprüft:

1. Ist die bestehende Architektur noch korrekt?
2. Muss die betreffende Funktion refaktoriert werden?
3. Muss ein Modul neu strukturiert werden?
4. Muss die Implementierung vollständig ersetzt werden?

Falls notwendig, wird neu geschrieben.

Die Qualität und Wartbarkeit des Codes haben Vorrang gegenüber dem schnellen Einbau eines weiteren Features.

---

## 22. Single Source of Truth

Jede fachliche Information soll möglichst genau eine verantwortliche Quelle im System besitzen.

Beispiele:

- Modulstatus an einer zentralen Stelle
- Benutzerberechtigungen an einer zentralen Stelle
- Kontostand aus einer definierten Datenquelle
- Kreditrestschuld aus dem Kreditmodell
- Transaktionskategorien aus dem zentralen Kategoriensystem

Die gleiche Geschäftslogik darf nicht mehrfach an verschiedenen Stellen unterschiedlich implementiert werden.

---

## 23. Saubere Verantwortlichkeiten

### Frontend

- Darstellung
- Benutzerinteraktion
- lokale UI-Zustände

### Backend

- Geschäftslogik
- Validierung
- Berechtigungen
- Verarbeitung

### Datenbank

- persistente Daten
- Beziehungen
- Integrität

Keine wichtige Geschäftslogik darf nur deshalb im Frontend existieren, weil dies kurzfristig einfacher erscheint.

---

## 24. Wiederverwendbare Komponenten

Wiederkehrende UI-Elemente und Funktionen werden als gemeinsame Komponenten entwickelt.

Beispiele:

- Karten
- Modalfenster
- Tabellen
- Formulare
- Navigation
- Betragsanzeige
- Datum
- Dokumentanzeige
- Statusanzeige

Eine Änderung an einer gemeinsamen Komponente soll überall dort wirken, wo diese Komponente verwendet wird.

Identische Komponenten sollen nicht mehrfach kopiert und separat gepflegt werden.

---

## 25. Datenbankänderungen

Datenbankänderungen erfolgen kontrolliert und nachvollziehbar.

Schemaänderungen dürfen nicht spontan und unkoordiniert erfolgen.

Notwendig sind:

- klare Tabellenstruktur
- Beziehungen
- Constraints
- Indizes
- Migrationen
- Versionsnachvollziehbarkeit

Bestehende Daten dürfen durch eine neue Version nicht unbeabsichtigt verändert oder gelöscht werden.

---

## 26. Deployment-Fähigkeit

Jeder Entwicklungsstand, der als Version abgeschlossen wird, muss grundsätzlich deploybar sein.

Das bedeutet:

- keine bekannten Syntaxfehler
- keine offensichtlichen Runtime-Fehler
- keine halbfertigen alten und neuen Implementierungen parallel
- keine temporären Test-Hacks im Produktionscode
- keine nicht verwendeten Altversionen
- keine unnötigen Debug-Ausgaben
- keine geheimen Schlüssel im Repository
- nachvollziehbare Konfiguration
- kontrollierte Datenbankmigrationen

Eine neue Funktion gilt nicht als fertig, nur weil sie lokal irgendwie funktioniert.

Sie gilt als fertig, wenn sie sauber in die bestehende Architektur integriert ist.

---

## 27. Änderungen an bestehenden Modulen

Wenn ein bestehendes Modul geändert wird, ist folgender Ablauf einzuhalten:

1. Bestehende Implementierung verstehen.
2. Abhängigkeiten prüfen.
3. Datenmodell prüfen.
4. Zielverhalten definieren.
5. Bestehenden Code gezielt ändern oder refaktorieren.
6. Nicht mehr benötigten Code entfernen.
7. Alle betroffenen Funktionen prüfen.
8. Modul testen.
9. Gesamtanwendung auf Seiteneffekte prüfen.
10. Erst danach deployen.

Eine Änderung darf nicht einfach am Ende einer Datei angehängt werden, um bestehendes Verhalten zu überschreiben.

---

## 28. Codequalität

Der Code soll:

- verständlich
- modular
- wartbar
- testbar
- konsistent
- dokumentierbar

sein.

Dateien und Funktionen sollen klar benannt werden.

Sehr grosse Dateien sollen vermieden werden.

Funktionen sollen eine klar definierte Aufgabe haben.

Komplexe Geschäftslogik soll nicht in einzelnen riesigen Event-Handlern oder Render-Funktionen versteckt werden.

---

## 29. Keine unnötige Rückwärtskompatibilität

Da die Anwendung neu aufgebaut wird, müssen schlechte Architekturentscheidungen nicht künstlich erhalten werden.

Wenn eine interne Schnittstelle, Struktur oder Komponente falsch aufgebaut wurde und noch keine zwingende externe Abhängigkeit besteht, darf sie sauber ersetzt werden.

Wir behalten schlechten Code nicht nur deshalb, weil er bereits existiert.

---

## 30. Sicherheit und Datenschutz

Da Finanzdaten verarbeitet werden, gelten hohe Anforderungen.

Von Anfang an berücksichtigen:

- Benutzertrennung
- Zugriffskontrolle
- Row Level Security beziehungsweise gleichwertige Schutzmechanismen
- sichere Authentifizierung
- keine Secrets im Frontend
- keine Secrets im Repository
- minimale Rechte
- Logging ohne unnötige sensible Daten
- Schutz persönlicher Dokumente
- sichere Dateiablage
- Verschlüsselung sensibler Tokens und Zugangsdaten

Ein Benutzer darf technisch niemals Daten eines anderen Benutzers sehen können, nur weil das Frontend diese nicht anzeigt.

---

## 31. Architektur vor Feature

Bei jeder neuen Anforderung wird zuerst geprüft:

- Zu welchem Modul gehört sie?
- Ist sie Core oder optional?
- Ist sie CH-/DE-spezifisch?
- Ist sie ein neues Feature oder eine Erweiterung eines bestehenden Features?
- Welche bestehenden Objekte sind betroffen?
- Welche Daten benötigt sie?
- Welche Berechtigungen gelten?
- Welche Auswirkungen hat sie auf andere Module?

Erst danach wird programmiert.

---

## 32. Keine Features nur weil sie technisch möglich sind

Die Anwendung soll kein Sammelsurium von Funktionen werden.

Jede Funktion muss einen konkreten Nutzen für Privatpersonen oder Haushalte besitzen.

Unternehmensfunktionen wie Lagerverwaltung, klassische Debitoren-/Kreditorenbuchhaltung, Lohnbuchhaltung oder Projektzeiterfassung gehören nicht automatisch in das Privatprodukt.

Solche Funktionen wären gegebenenfalls später separate Module für Selbständige.

---

## 33. Langfristiges Ziel

Die Anwendung soll so aufgebaut werden, dass sie klein beginnen und langfristig wachsen kann.

Heute:

- Familie
- Kollegen

Später:

- zahlende Benutzer
- unterschiedliche Tarife
- zusätzliche Module
- Länderpakete
- externe Integrationen

Die heutige Architektur muss professionell genug sein, dass Wachstum möglich ist, ohne die Anwendung erneut vollständig neu bauen zu müssen.

---

# 34. Verbindliche Entwicklungsmaxime

Bei jeder Änderung gilt:

Nicht fragen:

> Wie können wir das noch irgendwie ergänzen?

Sondern:

> Wie muss die bestehende Struktur aussehen, damit diese Funktion sauber Bestandteil des Systems ist?

Wenn die Antwort bedeutet, dass bestehender Code angepasst, refaktoriert oder ersetzt werden muss, wird genau das gemacht.

**Keine Patch-Ketten.**

**Keine versteckten Altimplementierungen.**

**Keine Funktionsüberschreibungen als Entwicklungsstrategie.**

**Kein unnötiger Legacy-Code.**

**Eine Funktion existiert im Projekt genau in der Version, die aktuell gelten soll.**

Das Ergebnis muss sauber, nachvollziehbar, wartbar und deploybar sein.

---

# 35. Arbeitsregel für die weitere Projektentwicklung

Diese Datei ist die verbindliche Ausgangslage des Projekts.

Neue Entscheidungen werden gegen diese Grundsätze geprüft.

Wenn eine spätere Entscheidung einen bestehenden Punkt verändert, wird dieser Masterplan aktualisiert. Alte widersprüchliche Regeln bleiben nicht parallel bestehen.

Vor grösseren Implementierungen wird zuerst festgelegt:

1. fachliches Ziel
2. betroffenes Modul
3. Datenmodell
4. Berechtigungen
5. Länderlogik
6. API-/Provider-Abhängigkeiten
7. UI-/UX-Ablauf
8. Tests
9. Migration
10. Deployment

Erst danach wird der produktive Code umgesetzt.
