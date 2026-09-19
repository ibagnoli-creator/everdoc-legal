# Daily Duel

Ein Quiz-Duell pro Tag: fünf Fragen, 60 Sekunden, ein Gegner, dann ist Schluss.
Die künstliche Knappheit erzeugt den täglichen Rückkehrreflex; das PvP-Format
gibt ihm den Ehrgeiz, den ein Solo-Rätsel nicht hat.

Dies ist der Prototyp-Stand: Spiellogik und Datenmodell stehen und sind
getestet, die Oberfläche existiert als SwiftUI-Code, das Backend als
Supabase-Migrationen und Edge Functions.

## Die tragende Entscheidung: asynchrone Duelle

Ein Duell läuft **nicht** in Echtzeit. Spieler A spielt, der Server speichert
seine Antwortspur (welche Option, nach wie vielen Millisekunden). Spieler B
bekommt später exakt dieselben fünf Fragen in derselben Reihenfolge und tritt
gegen diese Spur an – mit Live-Balken, der sich anfühlt wie ein Gegner, der
gerade mitspielt.

Das erspart drei Dinge auf einmal:

- kein Matchmaking-Wartezimmer und keine gleichzeitig online spielenden Leute,
- kein Realtime-Backend, keine WebSockets, kein State-Server,
- kein Cold-Start-Problem: am Tag 1 genügen synthetische Spuren.

## Aufbau

```
supabase/
  migrations/
    0001_init.sql                 Schema, RLS, Statistik-Trigger
    0002_rpc.sql                  Tages-Slots und Abschluss, atomar
    0003_seed_questions_de.sql    generiert, siehe seed/
  functions/
    _shared/                      reine Spiellogik, ohne Netz und Datenbank
    start-match/                  Slot verbrauchen, Gegner suchen, Frage 1
    submit-answer/                auswerten, nächste Frage liefern
    finish-match/                 Elo, Serie, Ergebnis festschreiben
    build-sets/                   nächtlicher Job: neue Fragensets
seed/
  questions.de.json               40 geprüfte Startfragen
  to-sql.mjs                      erzeugt daraus die Migration
tests/                            45 Tests auf der Spiellogik
ios/DailyDuel/                    SwiftUI-Client
```

`_shared/` enthält bewusst keinen Datenbankzugriff: Punkteformel, Elo,
Set-Auswahl und der synthetische Gegner sind reine Funktionen und dadurch
ohne laufende Infrastruktur testbar.

## Spielregeln im Code

- **Punkte:** 100 für richtig, dazu bis zu 100 Tempo-Bonus, linear über das
  Zeitfenster von 12 Sekunden. Maximal 1000 pro Duell. Der Tempo-Bonus ist der
  Grund, warum ein 5:5 an richtigen Antworten trotzdem spannend ausgeht.
- **Elo:** Standardformel, K=40 für die ersten 20 Partien, danach K=20.
- **Schwierigkeit:** kalibriert sich selbst. Jede beantwortete Frage schreibt
  `times_served`, `times_correct` und `sum_answer_ms` fort; ab 30 Antworten
  gilt der empirische p-Wert als belastbar und steuert die Set-Auswahl.
- **Übungsgegner:** werden aus den Fragenstatistiken erzeugt (Rasch-Modell:
  400 Elo Unterschied ≈ dreifache Chance, richtig zu liegen) und sind im
  Client **sichtbar gekennzeichnet**. Verdeckte Bots sind in Quiz-Apps ein
  verlässlicher Weg zu einer 1-Stern-Welle.

## Was der Server nie herausgibt

`questions.correct_index` verlässt den Server erst, nachdem geantwortet wurde.
`questions` und `question_sets` haben deshalb absichtlich **keine**
Select-Policy für Clients – alle Lesepfade laufen über die Edge Functions.

Die Antwortzeit wird serverseitig gemessen: `served_questions.served_at` wird
beim Ausliefern gestempelt, `submit-answer` rechnet gegen diesen Stempel. Eine
vom Client gemeldete Zeit wäre der erste Wert, den jemand manipuliert.
Antworten unter 400 ms oder mehr als 13 Sekunden nach dem Ausliefern zählen
als Fehlversuch.

## Entwickeln

```bash
npm test                                   # Spiellogik, 45 Tests
node seed/to-sql.mjs > supabase/migrations/0003_seed_questions_de.sql
supabase db push                           # Schema und Fragen einspielen
supabase functions deploy start-match submit-answer finish-match build-sets
```

`build-sets` braucht `CRON_SECRET` als Function-Secret und wird als Scheduled
Function nachts aufgerufen. **Vor dem ersten Duell muss der Job einmal
gelaufen sein** – ohne Fragensets gibt `start-match` `no_questions` zurück.

Die Tests laufen mit Node 22.18+ direkt auf den `.ts`-Dateien
(`--experimental-strip-types`), ohne Build-Schritt. Die Edge Functions laufen
unter Deno; sie teilen sich `_shared/` mit den Tests.

### iOS

Der Client läuft ohne Backend: solange `SupabaseFunctionsURL` und
`SupabaseAnonKey` nicht in der Info.plist stehen, greift `MockAPI` und die
Oberfläche ist vollständig bedienbar. So lässt sich am Match-Gefühl arbeiten,
bevor der Server steht.

Noch nicht angeschlossen: Sign in with Apple, StoreKit-Abo, Rewarded Ads,
Push. Die Haken dafür sind da (`daily_slots.slots_granted`,
`grant_bonus_slot`, `users.subscription_until`).

## Nächste Schritte

1. Xcode-Projekt anlegen und die Dateien aus `ios/DailyDuel/` einhängen
   (`MatchView` ist die Einstiegsansicht, `#Preview` läuft gegen den Mock).
2. Sign in with Apple über Supabase Auth, damit `users`-Zeilen entstehen.
3. Fragenbestand von 40 auf ~800 bringen – der einzige Schritt, der sich
   nicht abkürzen lässt, weil jede Frage einzeln geprüft gehört.
4. Täglicher Push um 18:00 Ortszeit. Das ist nicht Beiwerk, das *ist* der
   Loop.
5. Soft Launch in einem kleinen Markt, dann gegen die Schwellen messen:
   D1 > 40 %, D7 > 20 %, Abo-Conversion > 2 %, Duelle pro DAU > 1,3.
