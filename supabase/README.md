# Supabase · Finance V1

Dieses Verzeichnis gehört ausschließlich zum neuen Finance-V1-Projekt.

Projekt: `finance-v1`
Region: `eu-central-1`

Die Migrationen bilden den neuen Finance Core ab. Es gibt keine technische Abhängigkeit zum alten Aione-/`budget`-Projekt.

Wichtig:
- Benutzer werden über Supabase Auth verwaltet.
- Finanzdaten sind über Row Level Security auf Haushaltsmitgliedschaften begrenzt.
- Ein erfasster Kontostand wird als `balance_anchor_amount` + `balance_anchor_at` gespeichert.
- Historische Transaktionen vor diesem Anker verändern den aktuellen Ankerwert nicht.
