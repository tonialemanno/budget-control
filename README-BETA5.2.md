# Finance V2.3 Beta 5.2 – Belegkamera

Dieses Paket aktualisiert einen bestehenden Beta-5.1-Stand direkt auf Beta 5.2. Es enthält vollständige Ersatzdateien für die geänderten Komponenten sowie die neue Beleg-OCR-Komponente. Es gibt keine Datenbankmigration.

## Ablauf

`Beleg fotografieren` öffnet auf unterstützten Mobilgeräten die rückwärtige Kamera. Das Bild wird lokal im Browser mit Tesseract.js analysiert. Händler, Betrag, Währung und Datum werden als Vorschläge in ein Prüfformular übernommen. Erst nach Bestätigung wird das Originalfoto in `finance-documents` gespeichert.

Finance sucht vor dem Buchen nach einer passenden bestehenden Ausgangsbuchung. Bei einem eindeutigen Treffer kann der Beleg mit dieser Buchung verknüpft werden. Wird eine neue Ausgabe aus einem Beleg angelegt, berücksichtigt der spätere Bankimport diese beleggestützte Transaktion ebenfalls und übernimmt bei einem eindeutigen Abgleich den Bank-Fingerprint statt eine zweite Buchung anzulegen.

McDonald's ist in der bestehenden Händlerbibliothek ergänzt und schlägt die Ausgabenkategorie `Restaurant` vor, sofern diese Kategorie im Haushalt vorhanden ist.

## Datenschutz

Das Foto wird nicht an einen OCR- oder KI-Dienst übertragen. Für die Browser-OCR werden Tesseract.js, dessen Core-Dateien und Sprachdaten aus den in `_headers` freigegebenen CDNs geladen. Die eigentliche Bildanalyse findet im Browser statt. Das Originalfoto wird erst nach der Benutzerbestätigung in den bestehenden privaten Supabase-Dokumentenspeicher hochgeladen.
