# Finance lokal mit Docker und lokalen Daten

Finance kann vollständig lokal betrieben werden:

- Frontend: Nginx-Dockercontainer
- PostgreSQL/Auth/Storage/Studio/Functions: lokale Supabase-Container
- Produktivdaten bleiben ausserhalb von Git.

## Voraussetzungen

- Docker Desktop / Docker Engine
- Supabase CLI

## Start

```bash
supabase start
supabase db reset
supabase status
```

`supabase db reset` baut die lokale Datenbank aus `supabase/migrations` neu auf. `supabase/seed.sql` enthält bewusst keine echten Benutzer- oder Finanzdaten.

Supabase Studio ist standardmässig unter `http://localhost:54323` erreichbar.

Da öffentliche Signups deaktiviert sind, lokale Testbenutzer in Studio unter Authentication > Users anlegen.

## Frontend mit lokaler Supabase verbinden

```bash
cp runtime-config.local.example.js runtime-config.local.js
```

PowerShell:

```powershell
Copy-Item runtime-config.local.example.js runtime-config.local.js
```

In `runtime-config.local.js` die lokale API-URL und den lokalen anon/publishable Key aus `supabase status` eintragen.

Edge Functions in einem zweiten Terminal:

```bash
supabase functions serve
```

Frontend:

```bash
docker compose up --build
```

Danach: `http://localhost:8080`.

Die Cloudflare-Ländererkennung `/api/geo` steht im lokalen Nginx-Container nicht zur Verfügung. Finance fällt lokal auf die Browser-Locale zurück. Die Währung bleibt immer manuell änderbar.

## Echte Daten lokal

Für einen Entwicklungs-Dump:

```bash
supabase link --project-ref bktzavcnaqwdwlwldbjo
supabase db dump --data-only --linked > local-data.sql
```

`local-data.sql` enthält echte personenbezogene Finanzdaten und darf niemals committed werden. Ein normaler Data-Dump umfasst nicht automatisch alle verwalteten Auth-/Storage-Inhalte.

Für eine möglichst vollständige lokale Kopie inklusive verwalteter Supabase-Bestandteile einen Plattform-Backup verwenden und lokal über die vorgesehene Backup-Restore-Funktion starten. Backup-Dateien ausserhalb des Repositories speichern.

## Stoppen

```bash
docker compose down
supabase stop
```

Ohne `supabase db reset` bleiben lokale Daten bei normalen Stop/Start-Vorgängen erhalten.
