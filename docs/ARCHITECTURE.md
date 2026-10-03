# Architektur der Unglaublichen Maschine

## Leitidee

Ein Level beschreibt **welche Objekte, Instanzbeziehungen und Ziele** es gibt. Die Engine entscheidet anhand von Gadget-Definitionen und Interaktionsregeln, wie diese Objekte reagieren. Das Spielfeld zeichnet den aktuellen Zustand und nimmt Eingaben entgegen; es entscheidet nicht anhand der Szenennummer über Physik oder Erfolg.

```text
Level-JSON ──► Validierung ──► MachinePhysicsEngine ──► Matter.js
     │                              │      │
     │                              │      └── Kollisionen, Zustände, Ereignisse
     │                              ├── Effekt- und Schrittverhalten-Registries
     ├── Instanzen / Beziehungen ──► MachineRuntime ──► intrinsische Hooks / Abläufe
     └── goal ─────► Goal-Evaluator ──► Erfolg

GameCanvas ◄──── Simulationszustand und Ereignisse
    ├── Gadget-Animationen aus dem Katalog
    └── Renderer je Körper und lokale Effekte
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
| `engine/gadget-mechanics.ts` | Gemeinsame Modelle für Strom, Licht, Brennpunkte, Wind, TNT, Sprengzünder und Boxhandschuh. Verwendet Gadget-Zustände und Verbindungen ohne Szenensonderfälle. |
| `game/gadget-connections.ts`, `game/airflow.ts` | Gemeinsame Anschlussgeometrie für Aufbau und Zeichnung sowie das begrenzte Luftstrommodell. |
| `game/machine-runtime.ts` und `game/runtime-systems.ts` | Leiten Hooks aus `GadgetDefinition.mechanics` aller aufgebauten Instanzen ab und führen ihre Kollisions- und Zeitschritt-Hooks aus. Darunter fallen Geometrie mit zusätzlichen Verbindungen sowie die bestehenden Spezialmodelle. |
| `game/runtime-pulley.ts` | Zug-only-Seilmodell des Flaschenzugs; lose Seile übertragen keine Druckkraft. |
| `engine/goal-evaluator.ts` | Wertet Ziele gegen einen lesenden Snapshot aus Zuständen, Positionen, Ereignissen und Signalen aus. |
| `game/simulation-setup.ts` | Baut Welt, registrierte Instanzen, Portverbindungen und Runtime gemeinsam für Canvas und Tests. |
| `components/game/GameCanvas.tsx` | Ruft den gemeinsamen Aufbau auf, koordiniert Renderer und übergibt pro Frame Zeit an die Runtime. Es hat keinen eigenen Matter-Kollisionshandler. |
| `components/game/gadget-body-renderer.ts`, `fire-gadget-renderer.ts`, `load-rope-renderer.ts` | Zeichnen Körper, lokale Feuer-/Raketenwirkungen und ausdrücklich konfigurierte Lastseilrouten anhand aktueller Instanzdaten. |

Die Engine meldet jede Matter-Kollision einmal über ihr Event-API. Die Runtime hört auf dieses API. Intrinsische Hooks implementieren `onCollision`, `beforeStep`, `afterStep` oder `onState` in der bestehenden Factory-Registry und werden über `GadgetDefinition.mechanics` aktiviert. `createSimulation` wird im Canvas und in Szenariotests gemeinsam verwendet. Tierpaarungen, Katapult- und Auslösefolgen werden als konkrete Relationen in Leveldaten gespeichert. `systems` gehört nicht mehr zum Levelvertrag.

## Zustände und Animationen

Jedes Gadget besitzt einen `defaultState` und eine Animationstabelle nach Zustandsnamen. Ein Zustandswechsel über `machine.setState(id, state)` ist idempotent und startet die Animationsuhr dieser Instanz neu. `machine.animation(id)` liefert den gewählten Frame, Sprite-Zeile und -Spalte. Endliche Animationen halten ihren letzten Frame; Schleifen beginnen erneut. Ein nicht eigens gezeichneter Zustand fällt auf die Standardanimation zurück.

`components/game/catalog-sprite-renderer.ts` zeichnet Sprite-Sheets anhand dieser Angaben. Neue Sprite-Gadgets können damit ohne neue Frame-Berechnung im Canvas erscheinen. Einige vorhandene Figuren und Mechaniken behalten eigene Zeichnungen, weil ihre Anker, Partikeleffekte oder zusammengesetzten Formen speziell sind. Canvas-Animationen bleiben über den `renderer`-Namen im Katalog beschreibbar; ihre konkrete Zeichnung liegt in der Präsentationsschicht.

## Ziele als Daten

Die ursprünglichen *The Incredible Machine*-Aufgaben verlangen unter anderem, Gegenstände in Behälter oder Zielbereiche zu bringen, Tiere zum Ausgang zu führen, Ballons platzen zu lassen, Feuer zu entzünden oder zu löschen und mehrere Teilziele gleichzeitig zu erreichen. Beispiele stehen in den [Aufgaben 1–21](https://sierrachest.com/index.php?a=games&fld=walkthrough&id=228&pid=100), [Aufgaben 22–43](https://sierrachest.com/index.php?a=games&fld=walkthrough&id=228&pid=101) und im [Sierra-Hinweisbuch](https://www.sierragamers.com/wp-content/uploads/2019/12/Even_More_Incredible_Machine_Hint_Book.pdf). Daraus ergeben sich diese Bausteine:

| `kind` | Bedeutung | Beispiel |
| --- | --- | --- |
| `zone`, `contact` | Ein ausgewähltes Objekt erreicht einen Zielbereich oder berührt ein anderes. | Joanne betritt den Ausgang. |
| `state`, `position` | Ein Objekt hat einen Zustand oder überschreitet eine Koordinate. | Eine Kerze ist erloschen; ein Gewicht erreicht die Markierung. |
| `motion`, `area` | Ein einzelnes ausgewähltes Objekt überschreitet das Mindesttempo oder sein Mittelpunkt liegt in einem Rechteck. | Eine Bowlingkugel bewegt sich oder erreicht den aufgezogenen Zielbereich. |
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

Die ausgelieferten Level verwenden `schemaVersion: 2`. Der Validator prüft die rekursive Zielstruktur, Operatoren, bekannte Typen und referenzierte feste IDs. Alte `mode`-Ziele und Version 1 werden abgewiesen. Die Validierung verändert keine Eingabedaten und ergänzt keine Felder. Der Editor exportiert dasselbe Level-JSON mit `inventory`, `fixedGadgets`, optionalen `initialPlacements`, Verbindungen, Relationen und `goal`.

Wasserteilchen, erzeugte Fische und Kanonenkugeln werden als Gadget-Instanzen in der Engine registriert. Ihre IDs, Typen und Tags sind für Zielselektoren verfügbar. Neue relevante Laufzeitkörper werden ebenfalls über die Engine registriert.

## Steuerseile mit Wippenanschlüssen

`game/control-ropes.ts` beschreibt Steuerseile als Zielgriff, geordnete Umlenkrollen und lokalen Befestigungspunkt an einem Quellkörper. `ropePorts` liefert dieselben Anschlusskoordinaten für Eingabe und Zeichnung. Bei der Wippe werden beide Enden mit dem Körperwinkel transformiert. Beim Bearbeiten entsteht aus der neuen Geometrie eine neue Ruhelänge; vorhandene Verbindungen bleiben bestehen.

`MachineRuntime` misst nach dem Physikschritt die Länge des Verlaufs. Erst nach dem Aufnehmen von 3 Pixeln Spiel und 12 Pixeln Griffweg wird die Schere geschlossen oder der Riegel geöffnet. Verkürzung überträgt keinen Druck. Das ist ein Steuerkabel für kleine Auslöser; es ist kein Last tragender Flaschenzug. Mauerüberschneidungen blockieren den Zug. Nach dem Auslösen löst sich das Griffende sichtbar.

`components/game/control-rope-renderer.ts` zeichnet Seile, Rollenbewegung, Griffweg und Scheren ausschließlich aus dem Runtime-Zustand. Die Level 14 und 21–24 verwenden diese Mechanik. Das alte Level 5 wurde aus dem Katalog entfernt; die übrigen Level behalten ihre Nummern. Das Lastseilmodell verwendet einen ausdrücklichen `loadRope`-Eintrag im endgültigen Format.

`tests/control-ropes.test.mjs` prüft vollständige Lösungen, getrennte Seile, Zugrichtung, rotierende Anschlüsse, Mauerblockaden, Bearbeitung und die Reihenfolge der Seilstaffel bei mehreren Simulationsraten.

Neue Gadgets, Umsetzungsabschnitte, Mini-Levels 25–35 und das Verbindungsformat sind in [GADGETS.md](GADGETS.md) beschrieben. `connections` speichert Leitungen und Antriebsriemen zwischen Gadget-IDs. Stromverbraucher unterscheiden `electrical.supply: battery` und `socket`; der Generator verwendet `generator`. Katalog und Engine sind damit die gemeinsame Quelle für elektrische Varianten und ihre Anschlüsse.


## Neue Gadgets und Abläufe

1. Im Gadget-Katalog Körperdaten, Tags, Zustände und Animationen ergänzen. `placementState` kann einen abweichenden Anfangszustand frei platzierter Instanzen angeben (Fisch: `flopping`).
2. Lokale benannte Anschlüsse unter `ports` angeben; vollständige Identitäten bestehen aus Gadget-ID und Port-ID. Strom, Riemen und Steuerseile behalten getrennte Regeln. `light` und `electrical.activeState` beschreiben Licht und Betrieb unabhängig vom Artwork.
3. Fachliche Wirkungen über Interaktionsregeln/EffectRegistry oder räumliche GadgetMechanics implementieren. `execution` weist Regeln einem einzigen Ausführungspfad zu. Intrinsische Runtime-Hooks bei Bedarf in der bestehenden Registry ergänzen, mit `mechanics` zuordnen und Mehrinstanzfälle prüfen.
4. Zusätzliche Beziehungen ausdrücklich in Level-JSON speichern und in `level-relations.ts` prüfen. IDs aus dem stabilen Startaufbau verwenden. Keine Wahl der ersten Instanz, Szenen-IDs oder automatischen Systemlabels.
5. Sprite-Animationen verwenden den Katalogrenderer; zusammengesetzte Formen und Effekte kleine Renderer. Darstellung liest Zustand und Geometrie derselben Instanz. `GameCanvas` koordiniert Uhr, Simulation und Zeichnung. `scene` ist Metadatum; der Bauhinweis kommt aus `buildTip`. Zielbereiche werden durch die vorhandene Zielüberlagerung dargestellt.

`reactions` sind beschreibende Handbuchdaten. Physik-Overrides verändern reale Körperparameter; explizite Masse hat Vorrang vor Dichte. Das Lastseilmodell ist eine konfigurierte Route mit `weightId`, `anchor`, einer Lastgruppe und einer Zugkugel. Es stellt kein allgemeines Seilnetz dar. Der Editor baut die komplette Simulation bei Bauänderungen neu auf; Relationen werden über JSON bearbeitet.
