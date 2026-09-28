# Supabase · Finance V2.2 Beta

Projekt: `finance-v1`
Region: `eu-central-1`

Dieses Verzeichnis gehört ausschließlich zum neuen Finance-Projekt und hat keine technische Abhängigkeit zum alten Aione-/`budget`-Projekt.

## Regeln

- Schemaänderungen nur über versionierte Migrationen.
- Benutzer- und Haushaltsdaten sind über Row Level Security getrennt.
- Service-Role-Zugriff ist ausschließlich serverseitig in Edge Functions erlaubt.
- Der Browser verwendet nur den Supabase-Publishable-Key.
- Admin-Benutzeranlage und Haushaltsmitgliederverwaltung laufen über JWT-geschützte Edge Functions.
- Dokumente liegen in einem privaten Storage-Bucket mit Haushalts-RLS.
- `balance_anchor_amount` + `balance_anchor_at` sind die verbindliche Quelle für den vom Benutzer angegebenen aktuellen Kontostand.
- Externe Provider bestimmen nicht das interne Datenmodell.
