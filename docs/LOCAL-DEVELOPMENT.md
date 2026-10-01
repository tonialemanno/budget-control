# Finance lokal mit Docker + lokalen Daten

Finance kann vollständig lokal betrieben werden:

- Frontend: eigener Nginx-Dockercontainer
- PostgreSQL/Auth/Storage/Studio/Functions: lokale Supabase-Container
- Produktionsdaten sind **nicht** im Repository und werden nie in Git committed.

Die Supabase CLI verwendet `supabase/config.toml` aus diesem Repository.

## Voraussetzungen

- Docker Desktop / Docker Engine
- Supabase CLI

## 1. Lokales Supabase starten

Im Repository:

```bash
supabase start
supabase db reset
supabase status
```

`supabase db reset` baut die lokale PostgreSQL-Datenbank aus den versionierten Migrationen neu auf. Der mitgelieferte `supabase/seed.sql` enthält bewusst keine echten Finanz- oder Benutzerdaten.

Supabase Studio ist danach standardmässig unter:

```text
http://localhost:54323
```

erreichbar.

## 2. Lokalen Benutzer anlegen

Da öffentliche Signups auch lokal deaktiviert sind, den Testbenutzer über Supabase Studio unter Authentication > Users anlegen.

Falls der Benutzer App-Admin sein soll, die Rolle anschliessend nur in der lokalen Datenbank setzen. Keine produktiven IDs oder Zugangsdaten in Dateien eintragen oder committen.

## 3. Lokale Frontend-Konfiguration

```bash
cp runtime-config.local.example.js runtime-config.local.js
```

Unter Windows PowerShell:

```powershell
Copy-Item runtime-config.local.example.js runtime-config.local.js
```

Danach in `runtime-config.local.js` die lokale API-URL und den lokalen anon/publishable Key aus `supabase status` eintragen.

`runtime-config.local.js` ist in `.gitignore` und darf nicht committed werden.

## 4. Edge Functions lokal starten

In einem zweiten Terminal:

```bash
supabase functions serve
```

Damit funktionieren auch Admin-Benutzerverwaltung, Haushaltsverwaltung und FX-Funktion gegen die lokale Umgebung.

## 5. Frontend starten

```bash
docker compose up --build
```

Danach:

```text
http://localhost:8080
```

Die Cloudflare-Ländererkennung `/api/geo` existiert im lokalen Nginx-Container nicht. Lokal fällt Finance deshalb auf die Browser-Locale zurück. Kontowährungen bleiben immer manuell änderbar.

## Echte Daten lokal haben

Es gibt zwei unterschiedliche Fälle.

### A. Entwicklungsdaten

Für Entwicklung und Tests ist ein bereinigter Seed die sichere Variante. Ein Daten-Dump kann mit der Supabase CLI erstellt werden:

```bash
supabase link --project-ref bktzavcnaqwdwlwldbjo
supabase db dump --data-only --linked > local-data.sql
```

`local-data.sql` enthält echte personenbezogene Finanzdaten und darf **niemals** ins Repository committed werden. Ausserdem enthält ein normaler Data-Dump nicht automatisch alle verwalteten Auth-/Storage-Inhalte. Für eine echte 1:1-Kopie ist deshalb Variante B geeigneter.

### B. Vollständige lokale Kopie / Backup

Für eine möglichst vollständige lokale Kopie inklusive der verwalteten Supabase-Bestandteile einen Supabase-Plattform-Backup verwenden und lokal mit der dafür vorgesehenen Restore-Funktion starten. Den Backup-Pfad ausserhalb des Git-Repositories speichern.

Wichtig: Eine lokale Kopie deiner Finanzdaten ist ein sensibles Backup. Datenträger-Verschlüsselung, lokales Benutzerkonto und regelmäßige Backups müssen entsprechend geschützt werden.

## Stoppen

Frontend:

```bash
docker compose down
```

Lokale Supabase-Container:

```bash
supabase stop
```

Ohne `db reset` bleiben lokale Daten zwischen normalen Stop/Start-Vorgängen erhalten.
