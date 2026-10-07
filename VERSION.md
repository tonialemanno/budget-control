# Finance 2.4.6

## R49 – Transaktionseditor für wiederkehrende Buchungen

- Fehler `locale is not defined` beim Bearbeiten bereits als wiederkehrend erkannter Buchungen behoben.
- Der Transaktionseditor übernimmt die persönliche Sprache nun explizit aus dem Benutzerprofil.
- Regressionstest schützt genau den Pfad `Wiederkehrend ✓ → Bearbeiten`.
- Keine Datenbankänderung.
- Release 2026.10.07-r49.

# Finance 2.4.6

## R48 – Zentraler Router mit echten URLs

- Hash-Routen wie `#/transactions` wurden durch echte Browser-Pfade ersetzt.
- Zentrale Route-Registry in `assets/js/app/router.js` definiert Pfad, Navigation, Modul, Bereich und Seitentitel pro Seite.
- Direkte Deep-Links funktionieren, z. B. `/finance/transactions`, `/planning/invoices`, `/selfservice/profile` und `/admin`.
- Browser Zurück/Vorwärts verwendet die History API ohne vollständigen Reload.
- Alte `#/...`-Links werden automatisch auf die neuen Pfade migriert.
- Cloudflare SPA-Fallback über `_redirects` ermöglicht Reloads auf tiefen URLs.
- Alle App-Shell Assets werden absolut vom Root geladen, damit Deep-Links keine CSS/JS-Dateien verlieren.
- Definition of Done für neue Seiten: Route + Rechte + Übersetzung + Desktop/Mobile + Regressionstest.
- Keine Datenbankänderung gegenüber R47.
- Release 2026.10.07-r48.

# Finance 2.4.6

## R47 – Sprache ist eine persönliche Benutzereinstellung

- Jeder eingeloggte Benutzer kann seine Sprache unabhängig von Haushaltsrolle oder Adminrechten ändern.
- Sprachwahl ist zusätzlich direkt unter `Mein Profil` sichtbar; die Auswahl in `Einstellungen` bleibt bestehen.
- Eigener Self-Service-Endpunkt `set_my_locale_v1` schreibt ausschließlich die Sprache des aktuell angemeldeten Benutzers.
- Profile-Seite wird nicht mehr fälschlich durch Haushalts-Nur-Lese-Rechte als schreibgeschützt behandelt.
- Deutsch, Italienisch und Englisch bleiben vollständig auswählbar.
- Regressionstest schützt die persönliche Sprachwahl dauerhaft.
- Schema 2026100702, Release 2026.10.07-r47.

# Finance 2.4.6

## R46 – Ruhige Release-Anzeige in der Sidebar

- Versions-/Release-Badge neben dem Logo entfernt.
- Marke steht oben für sich; Version und Release-Status sitzen als dezente Statuszeile ganz unten in der Sidebar.
- Release-Anzeige reduziert auf Kanal + Version + Release, z. B. `Stable · v2.4.6 · R46`.
- Stable/Beta werden nur noch über einen kleinen Statuspunkt unterschieden.
- Doppelte `Einstellungen`-Navigation im Sidebar-Footer entfernt.
- Keine Datenbankänderung.
- Release 2026.10.07-r46.

# Finance 2.4.6

## R45 – Dokumenteinstellungen sofort sichtbar

- Logo, Absender, Zahlungsdaten, Automatik und Textbausteine sind auf der Seite `Rechnungen / Offerten` nicht mehr hinter einem zugeklappten Bereich versteckt.
- Ein sichtbarer Automatik-Hinweis erklärt Offerte → Rechnung → Zahlungseingang → Bezahlt → Quittung.
- Offene Rechnungen zeigen ausdrücklich an, wenn noch kein passender Zahlungseingang erkannt wurde.
- Neue Texte sind für Deutsch, Englisch und Italienisch hinterlegt.
- Keine Datenbankänderung gegenüber R43/R44.
- Release 2026.10.07-r45.

# Finance 2.4.6

## R44 – ALEMANNO BUCHHALTUNG Branding

- Der versehentlich in R43 eingeführte Name `Spendy` wurde vollständig aus der sichtbaren Anwendung entfernt.
- Produktname ist in Deutsch, Englisch und Italienisch einheitlich **ALEMANNO BUCHHALTUNG**.
- Neues reduziertes ALEMANNO-Monogramm in Graphit/Gold für Sidebar, Login und Browser-Favicon.
- Untertitel: DE `Ihre Finanzen im Griff`, EN `Your finances under control`, IT `Le tue finanze sotto controllo`.
- Technische interne Namen, Datenbanktabellen und API-Bezeichner bleiben unverändert.
- Keine Datenbankänderung gegenüber R43.
- Release 2026.10.07-r44.

# Finance 2.4.6

## R43 – Geschäftsdokumente mit Branding und Zahlungsautomatik

- Produktname und sichtbares Branding wurden appweit von `Finance` auf **Spendy** umgestellt; Deutsch, Englisch und Italienisch verwenden denselben Markennamen.
- Neues Spendy-Monogramm für Sidebar, Login und Browser-Favicon; technische interne Namen bleiben unverändert.
- Offerten, Rechnungen und Quittungen werden als echtes A4-Dokument (210 × 297 mm) dargestellt und drucken/PDF-unabhängig von der Monitorbreite.
- Dokumenteinstellungen speichern Firma, Adresse, Kontakt, MWST-/UID, IBAN, Bank, Logo, Standard-Steuer, Zahlungsfrist, Offertgültigkeit und Fusszeile pro Haushalt.
- Eigene Textbausteine für Einleitung, Zahlung und Schluss können pro Dokumenttyp gespeichert und beim Schreiben eingesetzt werden.
- Platzhalter wie `{Kunde}`, `{Dokumentnummer}`, `{Datum}`, `{Fälligkeitsdatum}`, `{Total}` und `{Zahlungsfrist}` werden beim Speichern aufgelöst.
- Angenommene Offerten werden mit den Rechnungs-Standardtexten in Rechnungen überführt.
- Offene Rechnungen schlagen passende echte Zahlungseingänge nach Betrag, Währung und Datum vor; zugeordnete Zahlungen markieren die Rechnung bei vollständiger Deckung als bezahlt.
- Bei vollständig bezahlter Rechnung kann automatisch eine Quittung erzeugt werden; die Automatik ist in den Dokumenteinstellungen abschaltbar.
- Logo-Dateien verwenden den bestehenden geschützten Finance-Dokumentenspeicher.
- Neue Datenbankstrukturen sind additiv und bleiben zu Stable R41 rückwärtskompatibel.
- Schema 2026100701, Release 2026.10.07-r43.

# Finance 2.4.6

## R42 – Lebensmittel statt Händlerart Supermarkt

- `Lebensmittel` ist wieder die eindeutige Ausgabenkategorie für Einkäufe bei Supermärkten.
- EDEKA bzw. Banktexte mit `EDK*` werden direkt als `Lebensmittel` vorgeschlagen.
- Die frühere R28-Logik `Supermarkt -> Lebensmittel` ist damit fachlich abgelöst; `Supermarkt` bleibt keine parallele Ausgabenkategorie.
- Bestehende `Supermarkt`-Buchungen und Händler werden kontrolliert auf `Lebensmittel` konsolidiert; die alte Kategorie wird anschließend archiviert.
- Regressionstest verhindert, dass die Händlerart `Supermarkt` künftig erneut als Ausgabenzweck eingeführt wird.
- Release 2026.10.07-r42.

## 2.4.6 – Ranking bleibt unsichtbar

- Kategorien bleiben nach persönlicher Nutzung priorisiert.
- Die sichtbare Auswahl zeigt wieder nur den Kategorienamen; Angaben wie `58× verwendet` werden nicht mehr angezeigt.
- Händler-/Beschreibungs-Erkennung und ML-Vorschläge bleiben unverändert aktiv.
- Release 2026.10.06-r30.


## 2.4.5 – Intelligente Kategorien statt alphabetischer Liste

- Kategorien werden nach tatsächlicher Nutzung im Haushalt sortiert: häufig verwendete zuerst, danach zuletzt verwendete und erst dann die übrigen.
- Transaktionsformulare filtern Vorschläge nach Einnahme/Ausgabe und zeigen Nutzungshäufigkeit direkt in der Auswahl.
- Beim Tippen einer Beschreibung bzw. eines Händlers versucht Finance sofort, die passende Kategorie aus gemerktem Händler, bekannten Händlerregeln und sicherem ML vorzuschlagen.
- Eine manuell gewählte Kategorie wird durch spätere Vorschläge nicht überschrieben.
- Beleg-OCR nutzt dieselbe Händler-/Kategorieerkennung.
- Release 2026.10.06-r29.


## 2.4.4 – EDEKA-Schreibweise EDK*

- Banktexte wie `EDK*HAFERKATER STORES` werden als **EDEKA** kanonisiert.
- EDEKA wird bevorzugt der Kategorie **Supermarkt** zugeordnet; **Lebensmittel** bleibt Fallback.
- Der bestehende Händler-Datensatz wurde auf EDEKA bereinigt und der Alias `edk haferkater stores` gespeichert.
- Release 2026.10.06-r28.


## 2.4.3 – Tilgung ist Buchungstyp, nicht Kategorie

- Offene Händler-/Personengruppen zeigen klarer, dass Kategorien nur für echte Einnahmen und Ausgaben gedacht sind.
- Der Einstieg für Sonderfälle heißt jetzt **„Umbuchung / Tilgung / Teilmenge“** statt des unspezifischen „Auswahl bearbeiten“.
- Historische Rückzahlungen geliehenen Geldes können als **Darlehensrückzahlung / Schuldentilgung** markiert werden, ohne eine künstliche Ausgabenkategorie anzulegen.
- Solche Tilgungen bleiben als Kontobewegung erhalten, zählen aber nicht als Konsumausgabe.
- Release 2026.10.06-r27.


## 2.4.2 – PDF-Saldo und Buchungsbetrag sicher getrennt

- PDF-Import behandelt die Saldo/Kontostand-Spalte nicht mehr als Buchungsbetrag, auch wenn der Saldo als einziger Wert ein Vorzeichen trägt.
- Regressionstest für den realen Fehlerfall: Gutschrift CHF 1'000.00 + Saldo CHF -175.12 muss als +CHF 1'000.00 importiert werden.
- Release 2026.10.06-r26.


## 2.4.1 – iPhone-Kategorisierung lesbar

- Teilmengenansicht auf iPhone neu aufgebaut: eine Buchung ist eine eigene Karte ohne überlappende Zeilen.
- Betrag steht im Kopf der Buchung, Kontext darunter in lesbaren Abständen.
- Konto, Banktext, Notiz/Zweck und erkannte Gegenbuchung werden mobil priorisiert.
- Händler/Gegenpartei werden nicht doppelt angezeigt, wenn sie nur denselben Text wie der Banktext wiederholen.
- Grössere Checkboxen und Touch-Ziele für iPhone 11/12 Pro.
- Release 2026.10.06-r25.


## 2.4.0 – Alltag zuerst: Prüfen, Suchen, Projekte und vollständiger Importkontext

- Neuer Kernbereich **„Prüfen“** als zentrale Arbeitsliste: unkategorisierte Ausgaben, ungeklärte Eingänge, mögliche eigene Umbuchungen und bald fällige Rechnungen werden an einem Ort abgearbeitet.
- **Gespeichert = erledigt:** bereits kategorisierte Buchungen erscheinen nicht erneut als offene Aufgabe. Eindeutige Gegenbuchungen werden nur nach Bestätigung als Umbuchung verbunden.
- **Seit dem letzten Besuch:** Finance merkt sich den vorherigen sinnvollen Besuchszeitpunkt und zeigt neue Buchungen seitdem, ohne dass ein normaler Seiten-Refresh die Vergleichsbasis sofort löscht.
- **Globale Suche** über Betrag, Datum, Beschreibung, Person/Gegenpartei, Händler, Konto, Kategorie, Projekt, Bankreferenz, Gegenkonto, Rechnungen, Verträge, Forderungen, Schulden und Dokumente.
- **Anlässe & Projekte** verwenden die bestehende Transaktionskontext-Struktur. Kategorien sagen dauerhaft wofür Geld war; Projekte erklären den zeitlich begrenzten Anlass, z. B. „Scheidung“ oder „Italien 2026“.
- **Importkontext bleibt erhalten:** CSV/PDF können Gegenkonto/IBAN, Bankreferenz/Zweck, Originalzeile bzw. PDF-Folgezeilen und Quellseite speichern. Originalinformationen werden nicht mehr auf Beschreibung + Betrag reduziert.
- **Eigene Konten erkennen:** Konten können optional eine IBAN/Kontokennung erhalten. Stimmen Import-Gegenkonto und eigenes Konto überein, erkennt Finance die Bewegung als interne Umbuchung; vorhandene eindeutige Gegenbuchungen werden verknüpft.
- PDF-Import wertet Folgezeilen bis zur nächsten Buchung aus und bewahrt den Rohkontext für spätere Nachvollziehbarkeit.
- **Informationstiefe funktioniert jetzt:** Einfach blendet technische Händler-/Semantik-/Expertenfelder aus, Standard zeigt normale Zuordnungen, Experte den vollständigen technischen Umfang.
- Planung ist menschlicher gebündelt: **„Feste Zahlungen“** ist der normale Einstieg für Lohn, Miete, Krankenkasse, Abos, Rücklagen und feste Umbuchungen. „Automatik im Detail“ bleibt als technische Gesamtansicht.
- **Sparen ist keine neue Ausgabenkategorie mehr.** Historische Daten bleiben erhalten; neue Sparbewegungen laufen als Umbuchung/Rücklage.
- Einnahmen werden klarer getrennt: „Rückerstattung“ und „Rückzahlung“ werden nicht als normaler Verdienst behandelt; Forderungsrückzahlungen bleiben an das Forderungsmodul gekoppelt.
- Neue dauerhafte Kategorie **„Rechts- & Gerichtskosten“**; im Startermodell zusätzlich „Gerichtskosten“ und „Anwaltskosten“. Ein Anlass wie „Scheidung“ gehört in ein Projekt, nicht in die dauerhafte Kategorie.
- **Änderungsverlauf + Rückgängig** für Sammel-Kategorisierungen wird persistent pro Haushalt gespeichert.
- Schema 2026100504, Release 2026.10.05-r24.


## 2.3.18 – gezielte Einnahme-Basiskategorien

- Bestehende Haushalte erhalten bei der Kategorienanalyse nur die fehlenden gewünschten Einnahmekategorien „Lohn/Gehalt“, „Rückzahlung“ und „Sonstige Einnahmen“.
- Finance installiert dabei nicht pauschal andere entfernte Standardkategorien erneut.
- Enthält alle Korrekturen aus 2.3.17 zur erledigten Arbeitsliste, Einzelspeicherung ohne feste Regel und erweiterten Transaktionskontext.


## 2.3.17 – Kategorisierung als echte Arbeitsliste

- „Kategorien analysieren“ zeigt im Standardfilter nur noch Buchungen, die tatsächlich noch eine Entscheidung benötigen.
- Eine gespeicherte Buchung verschwindet sofort aus der offenen Arbeitsliste. Unterschiedliche, bereits korrekt gesetzte Kategorien innerhalb derselben Person-/Händlergruppe gelten nicht mehr als Fehler.
- „Auswahl speichern“ speichert nur die markierten Buchungen und legt ausdrücklich keine dauerhafte Händler- oder Personenregel an.
- Die Auswahl zeigt mehr Kontext: Quellkonto, Gegenpartei, Händler, Banktext und Notiz/Zweck.
- Passende Gegenbuchungen auf anderen eigenen Konten werden als mögliche Umbuchung angezeigt. Mehrdeutige Treffer werden nur als Hinweis gezeigt und nie automatisch entschieden.
- Für Einnahmen gehören „Lohn“, „Rückzahlung“ und „Sonstige Einnahmen“ zur empfohlenen Basisauswahl. Fehlende Basis-Kategorien werden auch in bestehenden Haushalten beim Öffnen der Analyse ergänzt.
- Benutzerentscheidungen bleiben Trainingsbeispiele für Machine Learning; sie werden nicht automatisch zu festen Regeln.
- Keine Datenbankmigration erforderlich.


## 2.3.16 – sichtbare zentrale Versionsanzeige

- Login-Seite, Seitenleiste und Release-Hinweis verwenden dieselbe zentrale Version aus `APP_CONFIG`.
- Auf der Login-Seite ist der tatsächlich geladene Stand sofort sichtbar, inklusive Kanal und kurzer Release-ID, z. B. `V2.3.16 · STABLE · R21`.
- Die veraltete hart codierte Anzeige `V2.3 · Beta 5.4` wurde entfernt.
- Auch innerhalb der App zeigt die Versions-Pille zusätzlich die Release-ID, damit Cache-/Deployment-Probleme sofort erkennbar sind.
- Keine Datenbankmigration erforderlich.


## 2.3.15 – Teilmengen in Händlergruppen

- „Kategorien analysieren“ kann Händler-/Gegenparteigruppen jetzt aufklappen und einzelne Teilmengen per Checkbox bearbeiten.
- Mehrere markierte Buchungen lassen sich gemeinsam kategorisieren, ohne die komplette Gruppe oder den Händlerstandard zu überschreiben.
- Mehrere markierte Buchungen lassen sich gesammelt als echte interne Umbuchungen verbuchen; ein Sparkonto kann dabei direkt als Gegenkonto gewählt werden.
- Bei gleicher Währung wird eine eindeutig vorhandene Gegenbuchung verknüpft. Fehlt sie, erzeugt Finance die Gegenbuchung kontrolliert. Mehrdeutige Gegenbuchungen werden nicht geraten.
- Teilmengen-Kategorisierungen fliessen anschließend als Trainingsdaten in das lokale Machine Learning ein.
- Keine Datenbankmigration erforderlich.


## 2.3.14 – lokales Machine Learning für Kategorien

- Finance trainiert einen überwachten Multinomial-Naive-Bayes-Klassifikator direkt aus bereits kategorisierten Haushaltsbuchungen.
- Merkmale sind unter anderem kanonischer Händler, Beschreibung/Gegenpartei, Text-Bigramme, Zahlungsprozessor, Betragsspanne und Währung.
- Die Priorität bleibt deterministisch: gemerkte Händlerkategorie → Regel → eindeutige Händlerbibliothek → Machine Learning → bisherige Gruppenhistorie.
- ML-Vorschläge erscheinen mit Confidence. Nur bei ausreichender Datenbasis, Klassenstützung, Merkmalsabdeckung und deutlichem Abstand zur zweitbesten Kategorie gelten sie als sicher.
- Importvorschauen dürfen auch prüfbare ML-Vorschläge vorselektieren; stille Fallback-Kategorisierung und manuelle Neuanlage verwenden ML nur bei hoher Sicherheit.
- Benutzerkorrekturen wirken beim nächsten Modellaufbau als neue Trainingslabels. Es gibt keinen externen ML-Dienst und keine Übertragung von Buchungstexten.
- Keine Datenbankmigration: das Modell wird aus den bereits vorhandenen, haushaltsisolierten Transaktionsdaten aufgebaut.


## Stable 2.3.0 – konsolidierter Finanzkern

Dieser Release friert den geprüften Beta-Stand als erste stabile 2.3-Version ein.

### Zentrale Stable-Regeln

- Der aktuelle Kontostand bleibt ein Balance-Anker; historische Imports verändern den heutigen Stand nicht.
- Zukünftig datierte Transaktionen verändern den heutigen Kontostand nicht und werden als Planung behandelt.
- Fixkosten, variable Budgets und interne Umbuchungen werden getrennt gerechnet.
- Interne Umbuchungen verändern weder Konsumausgaben noch Nettovermögen.
- Regelmässige Zahlungen verwenden einen Terminanker und rollen vergangene Termine anhand ihres Rhythmus auf den nächsten Plantermin weiter.
- Händler sind zentrale Stammdaten für Import, Kategorien, Fixkosten und Budgetanalyse.
- Fixkosten können mit einem Händler verknüpft werden; Händler- und Kategorienzuordnung wird für künftige Imports wiederverwendet.
- Verträge, Versicherungen und Schulden können mit ihrer Planungsregel verknüpft werden; verknüpfte Datensätze werden vor inkonsistentem Löschen geschützt.
- Rechnungen und Verträge sind korrigierbar. Bezahlte Rechnungen müssen vor einer Änderung zuerst sauber zurückgesetzt werden.
- Sparziele können an echte Konten/Töpfe gebunden werden; Kontostand und geplante Umbuchungen fliessen in die Prognose ein.
- Hauptübersicht und Finance Intelligence verwenden dieselbe zentrale Finanzberechnung.
- Region & Format steuert Datums-, Zahlen- und Regionsformat; die Stable-2.3-Oberfläche ist deutsch.

### Release-Prüfung

- JavaScript-Syntaxcheck für alle Frontend- und Function-Dateien.
- Automatisierte Finanz-, Import-, OCR-, Mobile-, Render-, Recurrence- und Integrationsprüfungen.
- Supabase-Referenzprüfung auf verwaiste Konten, Händler, Budgets, Sparziele und Planungsbeziehungen.
- Cloudflare Pages Deployment-Check.

### Externe / optionale Integrationen

Stable 2.3 bleibt bewusst manual-first. Direkte Bankanbindungen, direkte Bankzahlungen, verbindliche automatische Steuerentscheidungen und nicht konfigurierte Live-Market-Data-Provider gehören nicht zum Stable-Kern.

---
# Version 2.3.0-beta-5.5

## Beta 5.5 – integrierter Standortkontext, Local Dev und Härtung

- Die bereits vorhandene Cloudflare-Ländererkennung wird nun tatsächlich im Frontend verwendet.
- CH/LI schlagen CHF vor; Euro-Länder wie DE/AT/IT schlagen EUR vor. Es ist nur eine Eingabe-Vorauswahl: Haushalts-Basiswährung und bestehende Konten werden nicht automatisch geändert.
- Logout entfernt das Presence-Signal sofort; der Admin zeigt dadurch nicht unnötig lange „Online“.
- Presence läuft über eigene RLS-Policies und SECURITY INVOKER statt unnötiger Rechteeskalation.
- Zusätzliche Indizes für Forderungs-Fremdschlüssel.
- Lokaler Betrieb mit Docker + Supabase CLI, Runtime-Konfiguration und dokumentiertem Daten-/Backup-Workflow.
- GitHub Actions prüft JavaScript-Syntax und Tests und erzeugt ein vollständiges finance-v2.3-beta5.5-full.zip als Artifact.

## Beta 5.4 – Forderungen, Receipt Intelligence, Währung und Live-Status

- Forderungen wieder als eigener Bereich unter dem bestehenden Modul Schulden & Kredite.
- Teilrückzahlungen, Verlauf, Fälligkeit sowie optionale Konto-Auszahlung/-Rückzahlung.
- Forderungen zählen zum Vermögen, aber nicht zur freien Liquidität.
- OCR mit zwei Erkennungsläufen, Händlerprofilen und plausibler Total-/Datumswahl.
- Migros MR / Restaurant wird von Migros Supermarkt unterschieden.
- Standortland dient nur als Währungs-Vorauswahl; erkannte Belegwährung hat Vorrang.
- Admin zeigt Online-Status, Gerät und App-Version.
- Dokumente können in Finance als Bild/PDF vorab angesehen und separat heruntergeladen werden.
- Mobile Belegerfassung hält das Foto beim Korrigieren sichtbar.

## V2.3 Beta 5.1 – iPhone Logout Fix

Kleine Mobile-Stabilisierung auf Basis von Beta 5. Keine Datenbankmigration.

- Profil-Bottom-Sheet wird auf Smartphones ausserhalb der Topbar gemountet, damit iOS/Safari Fixed-Positioning nicht an der Backdrop-Filter-Topbar festhält oder abschneidet.
- `Abmelden` ist zusätzlich direkt im mobilen Seitenmenü erreichbar.
- Lokale Session wird beim Abmelden immer gelöscht, auch wenn der Remote-Logout wegen eines Netzwerkfehlers nicht bestätigt werden kann.
- Desktop-Verhalten bleibt unverändert.

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