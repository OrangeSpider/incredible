# Die Unglaubliche Maschine

Ein Browser-Physikspiel im Stil klassischer Rube-Goldberg-Maschinen. Der Spieler platziert Gadgets, startet die Maschine und lässt Matter.js die Wechselwirkungen simulieren.

## Entwicklung

Voraussetzung ist Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Qualitätsprüfung:

```bash
npm run lint
npm run test
```

## Source-Aufteilung

- `app/page.tsx` – nur der Einstieg in die Spielanwendung
- `components/game/` – Header, Zielanzeige, Spielfeld, Bauteile, Toolbar, Dialoge und Level-Editor
- `engine/` – Gadget-Katalog, Körpererzeugung, Physiklaufzeit, Interaktionsregeln und Zielauswertung
- `levels/` – JSON-Schema und ein JSON-Dokument pro Level
- `game/` – abgegrenzte Spezialmodelle für Wasser, Lunte, Wippe, Flaschenzug und Tiere
- `public/assets/` – transparente Cartoon-Sprite-Sheets
- `tests/` – Physik-, Animations-, Architektur- und Renderingtests

Die ausführliche Beschreibung steht in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Level-Editor

Der Button **EDITOR** öffnet das JSON des aktuellen Levels. Der Editor kann:

- die aktuelle Anordnung als `initialPlacements` übernehmen,
- JSON lokal im Browser speichern,
- eine `.json`-Datei herunterladen oder einlesen,
- das validierte Level sofort im Spiel testen.

Das Format wird durch `levels/level.schema.json` beschrieben. Feste Startobjekte stehen in `fixedGadgets`, das Spielerinventar in `inventory`, aktive Verhaltensmodule in `systems` und das abstrakte Ziel in `goal`.

## Physikmodell

Jeder Gadget-Typ besitzt genau eine Definition in `engine/gadget-catalog.ts`: Kategorien, Tags, Form, Abmessungen, Masse, Reibung, Rückprall, Schwerkraftfaktor, Feuer-/Wasser-/Aufprallreaktionen sowie Animationen je Zustand.

`engine/interaction-rules.ts` kombiniert Gadgets über Typen, Kategorien und Tags. Deshalb gilt beispielsweise dieselbe Aufprallregel für Bowlingkugel und Tennisball, während deren Masse und Rückprall verschieden bleiben.
