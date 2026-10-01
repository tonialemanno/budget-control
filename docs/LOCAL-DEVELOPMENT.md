# Finance lokal mit Docker + lokalen Daten

Finance kann lokal mit einem statischen Docker-Webcontainer und der lokalen Supabase-Entwicklungsumgebung betrieben werden. Die Daten bleiben dabei auf dem eigenen Rechner.

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

`supabase db reset` spielt die versionierten Migrationen aus `supabase/migrations` in die lokale PostgreSQL-Datenbank ein.

## 2. Lokale Frontend-Konfiguration

```bash
cp runtime-config.local.example.js runtime-config.local.js
```

Danach in `runtime-config.local.js` die lokale API-URL und den lokalen anon/publishable Key aus `supabase status` eintragen.

`runtime-config.local.js` ist absichtlich nicht für Git vorgesehen.

## 3. Frontend starten

```bash
docker compose up --build
```

Danach: `http://localhost:8080`.

## Daten

PostgreSQL, Auth, Storage und die Supabase-Dienste laufen lokal in Docker-Containern, die von der Supabase CLI verwaltet werden. Für einen vollständigen lokalen Test müssen auch die Edge Functions lokal gestartet werden:

```bash
supabase functions serve
```

Die Anwendung verwendet auf localhost die Werte aus `runtime-config.local.js`; ohne diese Datei bleibt die produktive Supabase-Konfiguration aktiv, deshalb sollte für lokale Tests immer die lokale Runtime-Konfiguration gemountet werden.
