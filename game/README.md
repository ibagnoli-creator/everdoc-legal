# Brückensturm

Ein Crowd-Runner-Shooter fürs iPhone als HTML5-Spiel — eine blaue Mini-Armee
verteidigt eine Brücke gegen eine rote Horde, sammelt unterwegs **+1**- und
**+99**-Tore und muss den Gegner-Zähler auf 0 schießen, bevor die Flut (oder
der Boss) die Truppe überrennt.

## Auf dem iPhone spielen

1. `index.html` im Browser öffnen (z. B. über GitHub Pages oder einen beliebigen
   Webserver — die Datei ist komplett eigenständig, keine Abhängigkeiten außer
   der Google-Font „Lilita One", die bei Bedarf auf Systemschrift zurückfällt).
2. In Safari: **Teilen → Zum Home-Bildschirm**. Das Spiel startet dann im
   Vollbild wie eine native App (Standalone-Modus, Safe-Area-Unterstützung).

## Steuerung

- **Ziehen (links/rechts):** Truppe steuern
- Durch blaue **+1**-Tore laufen → 1 Soldat mehr, gelbe **+99**-Tore → 99 mehr
- Violette **×2**-Tore verdoppeln die Truppe (bis +120), rote **−10**-Tore meiden!
- **Bomben-Pickups** rufen einen Luftschlag: ein Flugzeug bombardiert die Horde
- Der **goldene Läufer** quert gelegentlich die Brücke — abschießen bringt +20
- Der **Boss wirft Felsbrocken** (rote Zielmarkierung) — ausweichen!
- Geschossen wird automatisch

## Level-Themen

Die Optik wechselt pro Level durch: Tag → Abendrot → Nacht (beleuchtete
Stadt, Sterne, Van-Scheinwerfer).

## Technik

- Ein einzelnes HTML-Dokument, Canvas 2D mit Pseudo-3D-Projektion
  (`t = z/(z+ZC)`), kein Framework
- WebAudio-Synthesizer für alle Sounds (kein Asset-Download), Unlock beim
  ersten Tippen (iOS-Anforderung)
- Fortschritt (Level, Bestwert, Stummschaltung) in `localStorage`
- Schwierigkeitsskalierung pro Level: Hordengröße ×1,38, stärkere Läufer-Trupps
  und Bosse; per Headless-Simulation ausbalanciert (Level 1–5 schaffbar,
  danach wird es hart)
- Debug-/Test-Hooks unter `window.__bs` (Zustand, `step(dt)`, `startLevel()`)
