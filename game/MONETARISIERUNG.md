# Monetarisierungs-Konzept „Brückensturm"

Orientiert am Genre-Playbook der erfolgreichsten Crowd-Runner:
**Mob Control** (Voodoo) fährt ein Hybrid-Modell aus ~85 % Werbung und
~15 % In-App-Käufen, wobei der IAP-Anteil mit wachsender Meta-Tiefe auf
~2 Mio. $/Monat stieg (Season Pass allein ~20 % des IAP-Umsatzes).
**Count Masters** (Freeplay) bindet Spieler über Münzen → permanente
Upgrades (Startgruppe, Tor-Boni) und kosmetische Skins.

## Bereits im Spiel eingebaut (Web-Version)

Diese Systeme sind funktionsfähig implementiert und bilden die Andockpunkte
für spätere Käufe:

| System | Status | Späterer Kauf-Andockpunkt |
|---|---|---|
| **Münzen** (Soft Currency) | ✅ Sieg: 10 + 2×Level + Bonus je 10 Überlebende; Boss-Kill: +5 | Münzpakete gegen Echtgeld |
| **Upgrade-Shop** | ✅ Start-Truppe +3/Stufe (ab 50 🪙, ×1,6), Feuerkraft +8 %/Stufe (ab 60 🪙, ×1,7) | Progressions-Beschleuniger |
| **Revive „WEITERSPIELEN"** | ✅ 1× pro Level: 20+ Soldaten, Horde zurückgeworfen | Rewarded Ad oder Premium-Kauf |

## Kauf-Stellen für den App-Store-Build (Priorität nach Genre-Benchmark)

1. **Rewarded Video an der Niederlage** („Weiterspielen?") — der stärkste
   Moment: Spieler hat 30+ Sekunden investiert und verliert sonst alles.
   Alternativ als Premium-Feature eines Abos.
2. **Münzpakete** (IAP): 4 Preisstufen, z. B. 500 / 1.500 / 5.000 / 15.000 🪙
   (1,99 / 4,99 / 9,99 / 24,99 €). Bei Mob Control ~20 % des IAP-Umsatzes.
3. **„Keine Werbung"-Kauf** (einmalig, 3,99–5,99 €) — Standard-Konversion
   der Ad-genervten Vielspieler; Rewarded Videos bleiben aktiv.
4. **Season Pass** (4,99 €/Saison): kosmetische Skins + Münz-Meilensteine
   entlang der Levelkette. Stärkstes Einzelprodukt bei Mob Control.
5. **Skins** (Truppen-Farben/Outfits, Van-Designs, Brücken-Themen):
   teils für Münzen, teils exklusiv im Pass/Shop. Rein kosmetisch.
6. **Starter Pack** (einmalig, nur in den ersten Sessions sichtbar):
   Münzen + 2 Upgrade-Stufen + exklusiver Skin zum Ankerpreis 2,99 €.
7. **Doppelte Sieg-Belohnung** per Rewarded Video auf dem Sieg-Screen
   (dauerhafte, wiederkehrende Ad-Impression ohne Frust).

## Umsetzungshinweis

Echte Käufe/Werbung erfordern einen nativen Wrapper (z. B. Capacitor):
StoreKit 2 für IAP, AdMob/AppLovin für Rewarded Video. Die Web-Version
markiert alle Andockpunkte bereits im Code (`btnRevive`, Shop,
Münz-Ökonomie), sodass der Wrapper nur die Bezahl-/Ad-Aufrufe einhängen
muss. Design-Prinzip aus dem Markt: Werbung nie erzwingen, sondern als
Tausch (Belohnung) anbieten — das treibt sowohl Ad-Umsatz als auch die
Konversion zu „Keine Werbung".

Quellen: MAF-Analyse zu Mob Control (Hybrid-Casual-Monetarisierung),
Udonis-Report zu Mob-Control-Umsätzen, App-Store-/Play-Store-Einträge zu
Count Masters.
