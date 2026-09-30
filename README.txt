FINANCE V2.3 BETA 5.2 – BELEGKAMERA & OCR

Warum dieses Builder-Paket?
Der aktuelle Beta-5.1-Stand liegt korrekt auf GitHub. Der verbundene GitHub-Zugriff von ChatGPT kann das Repository lesen, aber Schreiboperationen werden von der GitHub-Integration mit HTTP 403 blockiert. Deshalb baut dieses Paket auf deinem Windows-Rechner automatisch die vollständige Beta 5.2 aus dem aktuellen beta-Branch.

So geht es:
1. ZIP entpacken.
2. build-beta5.2.bat doppelklicken.
3. Das Skript lädt den aktuellen beta-Branch (muss Beta 5.1 sein), integriert Beta 5.2 und erstellt im selben Ordner:
   finance-v2.3-beta5.2-receipt-camera.zip
4. Diese erzeugte ZIP entpacken und den Ordner wie bisher auf den beta-Branch hochladen.

Enthalten in Beta 5.2:
- Beleg fotografieren direkt aus Transaktionen (iPhone: Rückkamera via capture=environment)
- lokale OCR im Browser mit Tesseract.js
- Händler-, Datum-, Währungs- und Betragerkennung
- McDonald's -> Restaurant als sichere Händler-Vorbelegung
- Dublettenprüfung gegen vorhandene Bankbuchungen
- sichere Verknüpfung statt zweiter Ausgabe bei gutem Treffer
- neue Ausgabe nur wenn keine passende Buchung verwendet wird
- Originalfoto wird erst nach Bestätigung in finance-documents gespeichert
- Dokument wird direkt mit der Transaktion verknüpft
- OCR-Felder bleiben vor dem Speichern editierbar
- keine Datenbankmigration notwendig

Datenschutz:
Das Belegfoto wird für OCR lokal im Browser verarbeitet. Tesseract-Code/Sprachmodelle werden bei der ersten Verwendung aus den fest hinterlegten CDN-Quellen geladen. Das Foto selbst wird dabei nicht an den OCR-Anbieter übertragen. Erst beim Bestätigen wird das Originalfoto in den bestehenden privaten Supabase-Dokumentenspeicher hochgeladen.
