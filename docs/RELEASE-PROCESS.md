# Finance Release-Prozess

## Ziel

Finance verwendet zwei klar getrennte Anwendungsversionen auf derselben Supabase-Datenbank:

- **Beta**: aktive Entwicklung und Tests.
- **Stable**: eingefrorener, nach aussen vorzeigbarer Release-Stand.

Der reguläre Release-Fluss ist ausschliesslich:

```
Entwicklung -> beta -> Prüfung -> stable
```

Es gibt keinen normalen Rückfluss von `stable` nach `beta`.

## URLs mit Cloudflare Pages

Ein einziges Cloudflare-Pages-Projekt genügt.

Empfohlene Konfiguration:

- Production branch: `stable`
- Preview deployments: Branch `beta` aktivieren
- Stable: `https://aione-test.pages.dev`
- Beta: `https://beta.aione-test.pages.dev`

Cloudflare erzeugt für Preview-Branches automatisch einen Branch-Alias. Dadurch braucht Finance keinen Umschalter innerhalb der Anwendung.

Ein Umschalter auf derselben URL wird bewusst **nicht** verwendet. Er würde Release-Stände, Browser-Cache, externe Demos und Support unnötig vermischen.

## Gemeinsame Supabase-Datenbank

Beta und Stable verwenden dasselbe Supabase-Projekt `finance-v1`.

Das ist erlaubt, solange Beta die Datenbank rückwärtskompatibel verändert.

### In Beta erlaubt, solange Stable älter ist

- neue Tabellen
- neue optionale Spalten
- neue Indizes
- neue Funktionen/RPCs mit neuem Namen oder kompatibler Signatur
- neue Policies, sofern bestehende Stable-Zugriffe weiterhin funktionieren
- additive Constraints, wenn vorhandene und Stable-erzeugte Daten sie weiterhin erfüllen

### Vor einer Stable-Promotion nicht erlaubt

- Tabellen oder Spalten löschen, die Stable verwendet
- Tabellen oder Spalten umbenennen
- Datentypen inkompatibel ändern
- RPCs löschen oder inkompatibel ändern, die Stable aufruft
- RLS so verschärfen, dass Stable bestehende Arbeitsabläufe verliert
- Daten destruktiv migrieren, wenn Stable danach nicht mehr mit ihnen arbeiten kann

Destruktive Schema-Bereinigungen erfolgen erst, wenn der Stable-Stand die alte Struktur nicht mehr benötigt.

## Beta-Daten

Beta-Tests erfolgen mit einem eigenen Demo-/Testbenutzer bzw. einer Demo-Instanz.

Regeln:

- keine Reset-/Massentest-Aktionen auf echten Benutzerhaushalten
- Testdaten klar von echten Haushalten trennen
- Stable und Beta dürfen dieselben realen Daten lesen, aber experimentelle Tests werden nur in der Demo-Instanz ausgeführt
- automatische Tests dürfen keine produktiven Finanzdaten voraussetzen oder verändern

## Promotion Beta -> Stable

1. Entwicklung nur auf `beta`.
2. Finance CI auf `beta` muss vollständig grün sein.
3. Beta über die Beta-URL auf Desktop und iPhone prüfen.
4. GitHub Action **Promote Beta to Stable** manuell starten.
5. Der Workflow prüft:
   - Stable enthält keine fachlichen Änderungen, die Beta nicht kennt.
   - JavaScript-Syntax ist sauber.
   - alle Tests auf Beta laufen erfolgreich.
6. Der Workflow öffnet einen Pull Request `beta -> stable`.
7. Pull-Request-CI muss grün sein.
8. PR bewusst nach `stable` mergen.
9. Stable-Deployment über die Stable-URL prüfen.
10. Stable danach bis zur nächsten Promotion nicht direkt verändern.

## Stable-Hotfix

Ein Hotfix direkt aus Stable ist die Ausnahme.

Ablauf:

1. Beta-Freeze ausrufen.
2. Hotfix von Stable aus erstellen und über PR nach Stable bringen.
3. Stable verifizieren.
4. Den Hotfix während des Freeze kontrolliert nach Beta vorwärts übernehmen.
5. Beta-CI vollständig ausführen.
6. Freeze aufheben.

Damit existiert niemals dauerhaft eine Stable-Korrektur, die Beta nicht kennt.

## Historischer Freeze vom 7. Oktober 2026

Der vorherige Stable-R19-Stand wurde vor der neuen Release-Struktur unter

`archive/stable-r19-2026-10-05`

archiviert.

R41 wurde als neuer gemeinsamer Release-Ausgangspunkt gewählt. Die alte Stable-Historie bleibt erhalten, wurde aber wegen Konflikten nicht in den aktuellen R41-Dateibaum zurückgemischt.

## Release-Grundsatz

**Stable ist kein Entwicklungsbranch.**

Stable wird nur aus einem bereits getesteten Beta-Stand erzeugt. Neue Arbeit beginnt nach einer Promotion wieder auf Beta.
