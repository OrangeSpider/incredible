# Architektur der Unglaublichen Maschine

## Laufweg

1. `app/page.tsx` bindet ausschließlich die Spielanwendung ein.
2. `components/game/GameApp.tsx` verwaltet Levelwahl, Benutzerzustand und Editor.
3. Ein Level wird aus einer Datei unter `levels/level-XX.json` geladen und validiert.
4. `engine/gadget-catalog.ts` liefert Form, Masse, Materialreaktionen, Kategorien und Animationen aller Gadget-Typen.
5. `engine/body-factory.ts` baut daraus Matter.js-Körper.
6. `engine/physics-engine.ts` simuliert Körper, Gelenke, Schwerkraft, Auftrieb und Zustandswechsel.
7. `engine/interaction-rules.ts` löst Kombinationen über Typen, Tags und Kategorien auf. Dadurch gilt eine Regel wie `falling-body -> scissor` zugleich für Bowling- und Tennisball.
8. `engine/goal-evaluator.ts` wertet die abstrakte `goal`-Beschreibung des Levels aus.

## Wichtige Verzeichnisse

| Bereich | Aufgabe |
| --- | --- |
| `app/` | Route, globale Darstellung und Metadaten |
| `components/game/` | Sichtbare UI-Bereiche, Spielfeld und Level-Editor |
| `engine/` | Gadget-Modell, Körpererzeugung, Interaktionen und Zielprüfung |
| `levels/` | JSON-Schema, Validator und ein JSON-Dokument pro Level |
| `game/` | Abgegrenzte Spezialmodelle wie Flaschenzug, Lunte, Wasser und Wippe |
| `public/assets/` | Sprite-Sheets und weitere Grafikdateien |
| `tests/` | Physik-, Animations-, Architektur- und Renderingtests |

## Ein Gadget ergänzen

1. Den neuen Typ in `engine/types.ts` aufnehmen.
2. Genau eine vollständige Definition in `engine/gadget-catalog.ts` anlegen.
3. Falls nötig eine kategorisierte Regel in `engine/interaction-rules.ts` ergänzen.
4. Einen Canvas-Renderer oder zustandsabhängige Sprite-Animationen hinterlegen.
5. Das Gadget im Inventar oder als `fixedGadget` eines Level-JSON verwenden.
6. Mindestens einen Regel- oder Physiktest ergänzen.

## Level-JSON

Ein Level beschreibt:

- Metadaten: `id`, `number`, `scene`, `title`, `objective`, `hint`, `buildTip`, `successText`
- `inventory`: vom Spieler platzierbare Teile und Anzahl
- `fixedGadgets`: gesperrte Startobjekte mit Position, Rolle und optionalen Overrides
- `initialPlacements`: optionale, bereits platzierte und weiter bearbeitbare Teile
- `systems`: aktivierte Physiksysteme
- `goal`: Ereignis, Zustand oder kombinierte Signal-/Positionsbedingungen

Der Editor im Spiel exportiert genau dieses Format, prüft importierte Dateien und kann einen Entwurf unmittelbar als aktuelles Level laden.
