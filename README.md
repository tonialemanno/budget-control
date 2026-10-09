# FinanceApp / ALEMANNO BUCHHALTUNG · 2.4.16

## Neu in 2.4.0: Alltag zuerst

Finance hat jetzt einen zentralen Bereich **„Prüfen“** für alle Buchungen, die wirklich eine Entscheidung brauchen, eine globale Suche, Anlässe & Projekte, vollständigeren Bank-Importkontext, eigene-Konto-/Umbuchungserkennung über IBAN/Kontokennung sowie einen persistenten Änderungsverlauf für Sammel-Kategorisierungen. Die Informationstiefe „Einfach / Standard / Experte“ beeinflusst nun tatsächlich die sichtbaren Felder. Sparen auf eigene Konten wird als Umbuchung statt als Konsumausgabe behandelt.

## Neu in 2.3.14: Machine Learning für Kategorien

Finance ergänzt die bestehende Händler-, Regel- und Kategorienlogik um ein lokales, überwachtes ML-Modell. Das Modell lernt aus bereits kategorisierten Buchungen des aktiven Haushalts, zeigt ML-Vorschläge mit Confidence und darf nur bei strenger Evidenz automatisch als sicher gelten. Regeln und explizit gemerkte Händler bleiben vorrangig. Die Buchungstexte verlassen Finance dafür nicht.


## Aktueller Stand

R72 / 2.4.16 ist der aktuelle Beta-Audit-Stand. Die Kernbereiche Übersicht, Prüfen, Geld, Planung, Konten, Transaktionen, Import, Händler, Kategorien, Fixkosten, Budget, Rechnungen/Verträge, Sparziele, Schulden, Forderungen, Steuern, Dokumente, Vermögen und Administration sind im zentralen Router registriert und werden im CI als Renderer, Route, Aktionen, Formulare, API-Aufrufe und Übersetzungen geprüft.

Der Bankimport bleibt bewusst dateibasiert; eine direkte Bank-API ist noch kein produktiver Bestandteil. Händler werden vor einer Neuanlage auf Ähnlichkeit geprüft, Kategorien werden beim Import nicht automatisch neu erzeugt, und Händler-Standardkategorien werden nur noch verwendet, wenn ihre Einnahme-/Ausgabeart zur Buchungsrichtung passt.

Wichtige Grundsätze:

- Kontostände werden über einen verbindlichen Balance-Anker geführt.
- Zukünftige Buchungen sind Planung und verändern den heutigen Kontostand nicht.
- Fixkosten, variable Budgets und interne Umbuchungen werden getrennt ausgewiesen.
- Händler sind zentrale Stammdaten und können direkt mit Fixkosten verbunden werden.
- Regelmässige Zahlungen rollen ihren Plantermin aus dem gespeicherten Terminanker weiter.
- Verknüpfte Verträge, Versicherungen, Schulden und Planungsregeln werden gegen inkonsistentes Löschen geschützt.
- Region & Format steuert Zahlen-/Datumsdarstellung; die Oberfläche von Stable 2.3 ist deutsch.
- Lokale Entwicklung und lokale Daten: siehe `docs/LOCAL-DEVELOPMENT.md`.
## iPhone UX

Beta 5.1 basiert auf Beta 5 und korrigiert zusätzlich die iPhone-Abmeldung. Beta 5 optimiert die bestehende Finance-App gezielt für iPhone 11 Pro und iPhone 12 Pro, ohne die Desktop-Oberfläche neu zu gestalten. Datenmodell, Supabase-Backend und Modulstruktur bleiben identisch zu Beta 4.1.

**Mobile Referenzbreiten:** 375–390 pt.

**Wichtig:** Für Beta 5.1 ist keine neue Supabase-Migration notwendig; die Beta-4.1-Stabilisierung bleibt die aktuelle Datenbankbasis.

### Beta 5.1 – iPhone-Abmeldung

- Profil-Bottom-Sheet wird auf Smartphones ausserhalb der gefilterten Topbar gemountet, damit iOS/Safari den unteren Aktionsbereich nicht abschneidet.
- `Abmelden` ist zusätzlich direkt im mobilen Seitenmenü verfügbar.
- Eine fehlgeschlagene Netzwerk-Abmeldung blockiert nicht mehr die lokale Abmeldung; die lokale Session wird zuverlässig entfernt.


Manuell nutzbare Beta auf Basis des verbindlichen Projekt-Masterplans. Diese Version ersetzt die reine Style-/Core-Vorstufe durch echte, persistente Arbeitsabläufe auf dem neuen Supabase-Projekt `finance-v1`.





## V2.3 Beta 4.1 – Stabilisierung

Dieser Stand korrigiert die im Deep-Test von Beta 4 gefundenen Fehler, ohne neue Modulschichten einzuführen.

- Datenimport akzeptiert jetzt CSV **und textbasierte PDF-Kontoauszüge**. PDF-Zeilen werden nur übernommen, wenn Datum und Vorzeichen/Betragsrichtung eindeutig erkannt werden; unklare Zeilen werden nicht geraten. Gescannte PDFs bleiben bis zur OCR-Stufe bewusst ausgeschlossen.
- CSV-Felder mit korrekt gequoteten Zeilenumbrüchen werden vollständig gelesen.
- Historische Imports sind wieder mit ihren Import-Batches verknüpft; der grosse 916er-Import ist 916/916 zugeordnet. Beim ersten alten Import bleiben nach den zwei bewusst gelöschten Dubletten 64 der ursprünglich 66 importierten Zeilen vorhanden.
- Dokumente und Steuerberater stürzen mit aktivem Steuer-Modul bzw. vorhandenen Belegen nicht mehr ab.
- Finance Intelligence berechnet die Projektion aus der heutigen Liquidität, ohne laufende Monatsbewegungen doppelt zu zählen.
- Rechnungen werden beim Bezahlen mit einer echten Kontobuchung verknüpft oder erzeugen diese kontrolliert. Eine von Finance erzeugte Zahlung kann zusammen mit dem Rechnungsstatus zurückgenommen werden; eine bereits vorhandene Bankbuchung bleibt dabei erhalten.
- Monats- und Datumsgrenzen verwenden lokale Datumswerte statt UTC-basierter Formular-/Monatswerte.
- Die zwei zuvor gemeldeten öffentlich aufrufbaren `SECURITY DEFINER`-RPCs laufen jetzt als `SECURITY INVOKER`; die fehlenden FK-Indizes aus dem Performance-Audit wurden ergänzt.

### PDF-Import

Für die Extraktion textbasierter PDFs wird PDF.js 4.10.38 versionsfest im Browser geladen. Finance sendet die PDF-Datei dabei nicht an einen OCR-/KI-Dienst; die Datei wird im Browser gelesen. Für gescannte Kontoauszüge ist später eine eigene OCR-Stufe vorgesehen.

### Migration

`20260929_finance_v2_3_beta4_1_stabilization.sql`

## V2.3 Beta 4

Debt Ledger: Schulden und Kredite sind vollständig bearbeitbar. Rate, Rhythmus, Standard-Zahlungskonto, Termine, Status und Notizen lassen sich nachträglich korrigieren. Tatsächliche Zahlungen werden als unveränderbarer Zahlungsverlauf mit Tilgung, Zins und Gebühren gespeichert. Eine Zahlung kann eine neue Kontobuchung erzeugen, eine bestehende Bankbuchung verknüpfen oder als historische Zahlung erfasst werden, wenn sie bereits im Kontostand enthalten ist. Die Restschuld wird dabei atomar aktualisiert; die zuletzt erfasste Zahlung kann sauber storniert werden. Schuldenraten können mit `Wiederkehrend` gekoppelt und bei Änderungen synchron gehalten werden.

Tilgungen werden zusätzlich als eigener Cashflow-Typ geführt: Sie reduzieren die Verbindlichkeit und werden nicht als Konsumausgabe behandelt; Zinsen und Gebühren bleiben Kosten.

## V2.3 Beta 3

Vollständiger Kategorisierungs-Assistent für bestehende und neue Buchungen. In Transaktionen kann die Analyse jederzeit manuell gestartet werden. Händler werden gruppiert; gemerkte Händlerkategorien, Regeln und die konservative Händlerbibliothek erzeugen nachvollziehbare Vorschläge. Der Sammel-Button übernimmt nur sichere Vorschläge auf bisher unkategorisierte Buchungen. Bestehende Kategorien werden dabei nicht überschrieben. Jede Händlergruppe kann separat geprüft, geändert und als künftige Händler-Zuordnung gespeichert werden. Neue Haushalte erhalten die länderspezifischen Starter-Kategorien automatisch.

## V2.3 Beta 2

Historischer Transaktions-Explorer mit Vollbestand, Suche/Filtern/Pagination, Monatsverlauf und klickbaren Kategoriekacheln. Sparziele lassen sich vollständig bearbeiten und aus eigenem Monatsbetrag, zusätzlichen Fixbeträgen, verknüpften wiederkehrenden Zahlungen und optionalem durchschnittlichem Monatsüberschuss zusammensetzen. Die Import-Vorschau nutzt zusätzlich eine konservative Bibliothek eindeutig erkennbarer Händler.

## V2.3 Integrated Beta

Ein gebündelter Gesamttest-Stand statt mehrerer Zwischen-Commits. Enthalten sind automatische SNB-Referenzwechselkurse, kompakte Transaktionsauswertung, TWINT-/Bargeld-/Spar-Hinweise, Budget-Intelligence, Sparziel-Machbarkeit, Steuerberater-Export mit Belegablage, maximal fünf Haushaltsmitglieder, editierbare Fahrzeuge und Versicherungen sowie ein Investment-Trade-Ledger für Teilkäufe und Teilverkäufe.

Steuerliche Einzelfallentscheidungen und externe Börsen-/Kryptokurse werden bewusst nicht erfunden: dafür bleiben offizielle Referenz- bzw. Provider-Schnittstellen vorgesehen.

## V2.2 Beta 2

Import Intelligence: Händlerobjekte, Gruppierung, Kategorien direkt beim CSV-Import, gemerkte Händlerkategorien, kompakte Import-Historie, Filter sowie direkte Übernahme von Transaktionen in Wiederkehrend.

## V2.2 Beta 1

Dieser Stand fokussiert die UI-Grundlage: Login-/Scroll-Fix, sichtbare Identität und Rollen, persönliche Modul-Sichtbarkeit, Privacy-Modus, Kategorien unter Einstellungen sowie eine skalierbare Admin-Benutzerübersicht mit Suche und Pagination.


## Korrekturen in V2.1

- sichtbare Login-E-Mail, Haushaltsrolle, Systemrolle, aktive und weitere Module
- Konten editierbar; aktueller Saldo kann als neuer Balance-Anker korrigiert werden, auch negativ
- Kontowährung ist unabhängig vom Wohnland; CHF/EUR/USD/GBP und Onlinekonto/Wallet sind möglich
- Fremdwährungen werden ohne Kursquelle nicht zu falschen Gesamtsummen vermischt
- Fremdwährungs-Umbuchungen speichern Abgang und Eingang in ihren jeweiligen Originalwährungen
- CSV-Dublettenprüfung auf belastbarem Unique-Constraint
- Unterkategorien-RLS korrigiert
- deaktivierte Module zusätzlich durch restriktive RLS geschützt
- Viewer/Editor/Admin/Owner werden in UI und Aktionen klarer getrennt
- kompakterer Seitenkopf und scrollbare Navigation, damit Inhalte früher sichtbar sind

## Was im Stable-Umfang funktioniert

- Login mit administrativ angelegten Benutzern
- Ersteinrichtung für Schweiz oder Deutschland
- Haushalt, Rollen und Benutzerzuordnung
- private und gemeinsame Konten
- aktueller Kontostand als verbindlicher Balance-Anker
- manuelle Einnahmen, Ausgaben und Umbuchungen
- Kategorien und Kategorisierungsregeln
- CSV-/PDF-Import mit Mapping, Händlerprüfung und Dubletten-Fingerprint
- wiederkehrende Zahlungen
- Budgets pro Kategorie und Monat
- Rechnungen
- Verträge und Abonnements
- Sparziele
- Schulden und Kredite
- CH/DE-getrennte Mahn-/Betreibungs-/Inkasso-Fälle mit Ereignis-Timeline
- Vermögenswerte
- Immobilien
- Fahrzeuge
- Versicherungen
- Investments (manuelle Bestände/Werte)
- Vorsorge CH/DE (manuelle Werte)
- private Dokumentablage in Supabase Storage
- Finance Intelligence auf Basis vorhandener Daten
- Admin-Bereich für Benutzer, Passwörter und Module
- Light/Dark/System sowie UI-Tiefe Einfach/Standard/Experte

## Wichtige Finanzregel

Ein beim Anlegen eines Kontos eingetragener `Kontostand jetzt` wird als `balance_anchor_amount` und `balance_anchor_at` gespeichert. Historische Transaktionen vor diesem Zeitpunkt verändern diesen aktuellen Stand nicht. Transaktionen nach dem Anker verändern den berechneten aktuellen Kontostand.

## Architektur

- Frontend: statische ES-Module, kein Build-Schritt
- Backend: Supabase Auth, REST/RPC, Edge Functions
- Datenbank: PostgreSQL mit RLS, Constraints, Indizes und versionierten Migrationen
- Dateien: privater Supabase-Storage-Bucket `finance-documents`
- Länderlogik: getrennte Module unter `assets/js/country/`
- Modulmodell: zentral über `product_modules` und `user_module_access`

## Bewusst nicht im Stable-Kern

Stable 2.3 ist manual-first. Folgende externe Integrationen werden erst auf das getestete interne Finanzmodell gesetzt:

- SIX bLink / PSD2-Banking
- automatische Live-/Intraday-Börsen- und Kryptokurse ohne konfigurierten Market-Data-Provider
- weitere Bundesbank/ECB-Referenzdaten ausserhalb der bereits integrierten SNB-FX-Kurse
- Swiss-QR-Rechnungsparser
- eSchKG / deutsche Mahnverfahrensschnittstellen
- ELSTER / ERiC
- direkte Bankzahlungen
- OCR für gescannte Dokumente/PDFs und weitergehende automatische Dokumenterkennung

Die Anwendung bleibt für die wesentlichen Finanzbereiche auch ohne externe API nutzbar.

## Entwicklung

Bestehende Implementierungen werden bei Änderungen refaktoriert oder ersetzt. Keine Wrapper-/Patch-Ketten und keine versteckten Legacy-Versionen.

## Deployment

Cloudflare Pages:

- Framework preset: None
- Build command: leer
- Build output directory: `.`
- Getesteter Release-Branch: `stable`
- Cloudflare-Produktionszweig kann nach Freigabe auf `stable` umgestellt werden.

Das alte Supabase-Projekt `budget` gehört nicht zu Finance V2 und bleibt davon getrennt.
