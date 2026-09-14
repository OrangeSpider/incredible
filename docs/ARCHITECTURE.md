# Architektur der Unglaublichen Maschine

## Leitidee

Ein Level beschreibt **welche Objekte, Fähigkeiten und Ziele** es gibt. Die Engine entscheidet anhand von Gadget-Definitionen und Interaktionsregeln, wie diese Objekte reagieren. Das Spielfeld zeichnet den aktuellen Zustand und nimmt Eingaben entgegen; es entscheidet nicht anhand der Szenennummer über Physik oder Erfolg.

```text
Level-JSON ──► Validierung ──► MachinePhysicsEngine ──► Matter.js
     │                              │      │
     │                              │      └── Kollisionen, Zustände, Ereignisse
     │                              ├── Effekt- und Schrittverhalten-Registries
     ├── systems ──► MachineRuntime ──► registrierte Spezialmechaniken
     └── goal ─────► Goal-Evaluator ──► Erfolg

GameCanvas ◄──── Simulationszustand und Ereignisse
    ├── Gadget-Animationen aus dem Katalog
    └── rein visuelle Szenenpräsentation
```

## Zuständigkeiten

| Modul | Zuständigkeit |
| --- | --- |
| `engine/gadget-catalog.ts` | Eintrag pro Gadget: Form, Masse, Tags, Reaktionen, Standardzustand und Animationen je Zustand. |
| `engine/body-factory.ts` | Erzeugt Matter-Körper aus Katalog und Instanz-Overrides. |
| `engine/interaction-rules.ts` | Deklarative Kombinationen über Typ, Kategorie, Tag, Auslöser, Bewegungsdaten und beteiligte Zustände. |
| `engine/effect-handlers.ts` | Registrierte Ausführung einer Regelwirkung, etwa `pop`, `ignite`, `bounce` oder `push`. Eine neue Wirkung erfordert keinen weiteren Zweig in der Engine. |
| `engine/step-behaviors.ts` | Registrierte kontinuierliche Verhaltensweisen für selektierte Gadgets, derzeit unter anderem der Laufbandkontakt. |
| `engine/physics-engine.ts` | Besitzt Matter-Welt, Gadget-Instanzen, Zustandswechsel, Zustandszeiten, Signale und Ereignisverlauf; liefert die Daten für Ziele und Animationen. |
| `game/machine-runtime.ts` und `game/runtime-systems.ts` | Aktivieren die in `level.systems` genannten Mechaniken und führen ihre Kollisions- und Zeitschritt-Hooks aus. Darunter fallen Geometrie mit zusätzlichen Verbindungen sowie die bestehenden Spezialmodelle. |
| `game/runtime-pulley.ts` | Zug-only-Seilmodell des Flaschenzugs; lose Seile übertragen keine Druckkraft. |
| `engine/goal-evaluator.ts` | Wertet Ziele gegen einen lesenden Snapshot aus Zuständen, Positionen, Ereignissen und Signalen aus. |
| `components/game/GameCanvas.tsx` | Baut die Spielfeldinstanz, zeichnet sie und übergibt pro Frame Zeit an die Runtime. Es hat keinen eigenen Matter-Kollisionshandler. |
| `components/game/scene-presentation.ts` | Registriert szenenspezifische Dekorationen und Hinweise, ohne Spielregeln zu definieren. |

Die Engine meldet jede Matter-Kollision einmal über ihr Event-API. Die Runtime hört auf dieses API. Eine neue Spezialmechanik kann `onCollision`, `beforeStep`, `afterStep` oder `onState` implementieren und über ein Capability-Label in `level.systems` aktiviert werden. `game/runtime-system-ids.ts` definiert die erlaubten Labels; der Level-Validator weist unbekannte und doppelte Labels zurück. Grundlegende Regeln und Effekte sind levelübergreifend aktiv.

## Zustände und Animationen

Jedes Gadget besitzt einen `defaultState` und eine Animationstabelle nach Zustandsnamen. Ein Zustandswechsel über `machine.setState(id, state)` ist idempotent und startet die Animationsuhr dieser Instanz neu. `machine.animation(id)` liefert den gewählten Frame, Sprite-Zeile und -Spalte. Endliche Animationen halten ihren letzten Frame; Schleifen beginnen erneut. Ein nicht eigens gezeichneter Zustand fällt auf die Standardanimation zurück.

`components/game/catalog-sprite-renderer.ts` zeichnet Sprite-Sheets anhand dieser Angaben. Neue Sprite-Gadgets können damit ohne neue Frame-Berechnung im Canvas erscheinen. Einige vorhandene Figuren und Mechaniken behalten eigene Zeichnungen, weil ihre Anker, Partikeleffekte oder zusammengesetzten Formen speziell sind. Canvas-Animationen bleiben über den `renderer`-Namen im Katalog beschreibbar; ihre konkrete Zeichnung liegt in der Präsentationsschicht.

## Ziele als Daten

Die ursprünglichen *The Incredible Machine*-Aufgaben verlangen unter anderem, Gegenstände in Behälter oder Zielbereiche zu bringen, Tiere zum Ausgang zu führen, Ballons platzen zu lassen, Feuer zu entzünden oder zu löschen und mehrere Teilziele gleichzeitig zu erreichen. Beispiele stehen in den [Aufgaben 1–21](https://sierrachest.com/index.php?a=games&fld=walkthrough&id=228&pid=100), [Aufgaben 22–43](https://sierrachest.com/index.php?a=games&fld=walkthrough&id=228&pid=101) und im [Sierra-Hinweisbuch](https://www.sierragamers.com/wp-content/uploads/2019/12/Even_More_Incredible_Machine_Hint_Book.pdf). Daraus ergeben sich diese Bausteine:

| `kind` | Bedeutung | Beispiel |
| --- | --- | --- |
| `zone`, `contact` | Ein ausgewähltes Objekt erreicht einen Zielbereich oder berührt ein anderes. | Joanne betritt den Ausgang. |
| `state`, `position` | Ein Objekt hat einen Zustand oder überschreitet eine Koordinate. | Eine Kerze ist erloschen; ein Gewicht erreicht die Markierung. |
| `event`, `signal` | Ein einmaliges Ereignis oder ein gemessener Mechanikwert tritt ein. | Die vollständig verbundene Zahnradkette lief lange genug. |
| `count` | Eine Anzahl passender Objekte erfüllt ein Zustands- oder Positionsprädikat. | Drei Ballons verlassen oben das Spielfeld. |
| `all`, `any` | Teilziele müssen gemeinsam oder alternativ gelten. | Laufband angetrieben **und** vier Raketen gestartet. |
| `never` | Ein verbotener Zustand oder ein Ereignis darf bis zu einem Abschluss beziehungsweise einer Zeitgrenze nicht eingetreten sein. | Ein geschütztes Objekt bleibt bis zur Lieferung heil. |

Selektoren verwenden `id`, `type`, `tag` oder `role`. Dadurch kann ein Ziel für eine Objektklasse formuliert werden, ohne die IDs einzelner Instanzen aufzuzählen. `contact`- und `zone`-Ziele nutzen den von der Engine erfassten Kontaktverlauf; Zustands- und Positionsziele nutzen den aktuellen Snapshot. Historische Verbote sollten als `event` oder als beständiges Signal formuliert werden.

Beispiel für Lieferung mit Schutzbedingung:

```json
{
  "kind": "all",
  "goals": [
    { "kind": "zone", "entity": { "role": "payload" }, "zone": { "tag": "goal-zone" } },
    { "kind": "never", "goal": { "kind": "event", "name": "payload.broken" },
      "until": { "kind": "zone", "entity": { "role": "payload" }, "zone": { "tag": "goal-zone" } } }
  ]
}
```

Die ausgelieferten Level verwenden `schemaVersion: 2`. Der Validator prüft die rekursive Zielstruktur, Operatoren, bekannte Typen und referenzierte feste IDs. Version-1-Level mit `mode`-Zielen bleiben importierbar. Der Editor exportiert dasselbe Level-JSON mit `inventory`, `fixedGadgets`, optionalen `initialPlacements`, `systems` und `goal`.

## Ein Gadget oder eine Mechanik ergänzen

1. Neuen Gadget-Typ in `engine/types.ts` und eine vollständige Definition in `engine/gadget-catalog.ts` anlegen. Für ein platzierbares Teil den Typ zusätzlich in `PlaceableGadgetType` aufnehmen. Die Standarddrehung liegt ebenfalls im Katalog.
2. Zustände und zugehörige Sprite- oder Canvas-Animationen in der Katalogdefinition hinterlegen. Sprite-Animationen benötigen Asset, Zeile, Spaltenzahl, Frames, Dauer und Maße.
3. Bestehende Tags und Regeln wiederverwenden. Falls das Verhalten neu ist, eine Regel in `interaction-rules.ts` und gegebenenfalls einen Effekt-Handler oder ein kontinuierliches Schrittverhalten registrieren.
4. Für eine Mechanik mit Verbindungen, Partikeln oder mehreren Körpern ein Runtime-System registrieren, die Capability-ID ergänzen und sie im Level aktivieren. Darstellungsbesonderheiten gehören in die Präsentationsschicht.
5. Gadget im Level platzieren, Ziel mit der DSL beschreiben und die neue Reaktion beziehungsweise Zielerfüllung mit einem Engine-Test prüfen.

Einige ältere Spezialmodelle erzeugen zusätzliche Matter-Körper, etwa Wasserteilchen und Kanonenkugeln, noch direkt in ihren Runtime-Systemen. Sie sind keine katalogisierten Gadget-Instanzen und können daher nicht per Gadget-Selektor in einem Ziel adressiert werden. Für neue Mechaniken sollten relevante Zielobjekte in der Engine registriert oder als typisierte Runtime-Ereignisse gemeldet werden.
