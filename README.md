# Finance App V1.3 – Admin Foundation

Finance Core mit produktiver Supabase-Basis und administrativ verwalteten Benutzerkonten.

## Enthalten

- Login ohne öffentliche Registrierung in der Finance-Oberfläche
- erster Finance-Benutzer als Owner/Admin
- Admin-Navigation nur für Administratoren
- Benutzerliste
- Benutzer direkt im Admin-Bereich anlegen
- neue Benutzer werden serverseitig automatisch bestätigt
- Service-Role-Key bleibt ausschließlich in der Supabase Edge Function
- Konten, Kategorien und Transaktionen aus Finance V1.2
- RLS und getrennte Haushaltsdaten

## Wichtig

Öffentliche Sign-ups sollen zusätzlich in Supabase Auth deaktiviert werden. Benutzer werden danach nur noch über den Finance-Admin-Bereich angelegt.

Das alte Projekt `budget` bleibt vom neuen Finance-V1-Projekt getrennt.
