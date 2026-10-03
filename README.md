# Die Unglaubliche Maschine

Ein Browser-Physikspiel im Stil klassischer Rube-Goldberg-Maschinen. Der Spieler platziert Gadgets, startet die Maschine und lässt Matter.js die Wechselwirkungen simulieren.

## Entwicklung

Voraussetzung ist Node.js `>=22.13.0`.

Zum lokalen Starten, auch unter Windows/PowerShell, im Projektordner ausführen:

```sh
npm ci
npm run dev:local
```

Das Spiel ist unter [http://localhost:3000](http://localhost:3000) erreichbar.
Mit `Strg+C` den Server beenden. Für einen lokalen Produktionsstart zuerst
`npm run build:local`, danach `npm run start:local` ausführen.

Der bestehende Vite-/Worker-Entwicklungsweg bleibt verfügbar:

```bash
npm install
npm run dev
```

Qualitätsprüfung:

```bash
npm run lint
npm run test
```

## Docker

Voraussetzung ist ein laufender Docker-Dienst. Das Produktions-Image baut die
Next.js-Anwendung und startet sie auf Port 3000:

```bash
docker compose up --build -d
```

Danach ist das Spiel unter [http://localhost:3000](http://localhost:3000)
erreichbar. Mit `docker compose down` wird der Container wieder gestoppt.

## Source-Aufteilung

- `app/page.tsx` – nur der Einstieg in die Spielanwendung
- `components/game/` – Header, Zielanzeige, Spielfeld, Bauteile, Toolbar, Dialoge und Level-Editor
- `engine/` – Gadget-Katalog, Körpererzeugung, Physiklaufzeit, Interaktionsregeln und Zielauswertung
- `levels/` – JSON-Schema und ein JSON-Dokument pro Level
- `game/` – abgegrenzte Spezialmodelle für Wasser, Lunte, Wippe, Flaschenzug und Tiere
- `public/assets/` – transparente Cartoon-Sprite-Sheets
- `tests/` – Physik-, Animations-, Architektur- und Renderingtests

Die ausführliche Beschreibung steht in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Die neuen Strom-, Licht-, Stoß- und Windgadgets mit elf Mini-Levels sind in [docs/GADGETS.md](docs/GADGETS.md) nach Umsetzungsabschnitten beschrieben.

## Level-Editor

Der Button **EDITOR** öffnet eine visuelle Werkstatt mit dem aktuellen Level. **Neues Level** legt ein leeres Spielfeld an. Rechts stehen alle Gadgets aus dem gemeinsamen Katalog; über die Suche lässt sich die Auswahl filtern.

1. Bauteil rechts auswählen und einmal auf das Spielfeld klicken. Das neue Objekt bleibt ausgewählt; der Editor wechselt zu **Bearbeiten**. **Shift** beim Platzieren erlaubt mehrere Exemplare, **Escape** beendet das Werkzeug. Kategorien lassen sich einklappen; die Suche zeigt Treffer unabhängig davon. Unter **Neue Bauteile** bestimmen, ob es als fest vorgegebenes Objekt (`fixedGadgets`) oder als verschiebbarer Startaufbau (`initialPlacements`) gespeichert wird. In **Bearbeiten** lassen sich beide Varianten verschieben, mit den ±15°-Buttons oder dem Gradfeld drehen, lokal horizontal/vertikal spiegeln (bei unterstützten Bauteilen), löschen und über ihre Koordinaten präzise einstellen. Holzplanke und Stahlträger lassen sich im Level-Editor an beiden Enden in der Länge ziehen, Holzwand und Steinmauer in der Höhe (40–900 Pixel, konstante Dicke). Das jeweils andere Ende bleibt fest; eine Ziehbewegung ist ein Undo-Schritt. Escape oder ein Pointer-Abbruch setzt sie zurück. Im Spielaufbau sind die Größen vorgegeben; Spielerbauteile lassen sich dort verschieben, drehen und bei unterstützten Typen spiegeln. Während der Simulation sind die Bearbeitungswerkzeuge gesperrt.
2. Die Zahlen neben den Bauteilen legen das **zusätzliche Spielerinventar** fest. `0` entfernt den Typ aus dem Inventar. Startobjekte und vorgegebene Verbindungen verbrauchen dieses Inventar nicht.
3. Levelname, Levelnummer und Zielbeschreibung eingeben. Über **Goal** ein gesetztes Einzelobjekt oder einen Typ aus dem Spielerinventar auswählen. Ein Ziel kann einen Zustand, Bewegung, das Verlassen einer der vier Spielfeldseiten oder einen aufgezogenen rechteckigen Zielbereich verlangen. Für einen Ausgang unten wird der Boden abgeschaltet. Mehrere Ziele können mit **alle gleichzeitig** oder **eines genügt** verknüpft werden.
4. **Im Spiel testen** öffnet den normalen Spielaufbau mit genau diesem Spielerinventar. Die Maschine starten, abbrechen und zurücksetzen. **Zurück zum Editor** kehrt zum unveränderten Entwurf zurück; Tests verändern keine Punktestände.
5. **Ordner öffnen** wählt eine lokale Levelsammlung, **Im Ordner speichern** schreibt jedes Level in eine eigene JSON-Datei. Gespeicherte Levels lassen sich oben wechseln. Neue Dateien heißen beispielsweise `02-level-abc.json`; bei geladenen Dateien bleibt der ursprüngliche Pfad erhalten. JSON-Import, Download und direkte JSON-Bearbeitung stehen unter **Dateien, Hinweise und JSON** zur Verfügung.

**Undo/Redo** funktioniert für Bauteile, Verschieben, Drehungen, Inventar, Metadaten, Ziele und Verbindungen. Eine Ziehbewegung entspricht einem Undo-Schritt. Tastatur: `Strg+Z`, `Strg+Umschalt+Z` / `Strg+Y`, `Entf`; `Esc` beendet das aktuelle Werkzeug. Beim Löschen eines Objekts werden seine Verbindungen und die darauf bezogenen Einzelziele mit entfernt und beim Rückgängigmachen gemeinsam wiederhergestellt. Der Entwurf wird automatisch im Browser gesichert und kann über **Entwurf laden** wiederhergestellt werden.

Lampen, Taschenlampen und Ventilatoren stehen mit Einschaltknopf und mit Steckdose zur Verfügung. Für Steckdosenvarianten **Stromleitung** auswählen und den Generatoranschluss mit der Steckdose verbinden. **Seil** verbindet einen Scherengriff oder Torriegel über optionale Umlenkrollen mit einem Zugpunkt. Auch diese Verbindungen werden gespeichert.

Ventilatoren zeigen ihre Blasrichtung auch ausgeschaltet als Pfeil; Drehen und Spiegeln verändern den Pfeil und den Luftstrom gemeinsam. **Antriebsriemen** können an beiden Laufbandrädern und am Generatorrad befestigt werden. Ein Generator erzeugt Strom, solange ein Riemen ihn antreibt, oder dauerhaft nach dem bisherigen Einschalten durch einen Stoß. Die gewählten Riemenräder werden in `connections` über die verbindlichen Felder `sourcePortId` und `targetPortId` gespeichert (`left`, `right` beziehungsweise `drive`). Nach einem Erfolg erscheint die Meldung neben beziehungsweise unter dem Spielfeld, damit die Maschine sichtbar bleibt.

Direktes Schreiben in Ordner verwendet die vom Browser angebotene `showDirectoryPicker`-API und benötigt einen sicheren Kontext (HTTPS oder localhost). Falls diese API fehlt, können Ordner über den Dateidialog eingelesen und einzelne Levels als JSON heruntergeladen werden. Die heruntergeladenen Dateien anschließend im gewünschten Levelordner ablegen.

Zum Spielen einer Sammlung im Dialog **LEVEL** auf **Ordner zum Spielen auswählen** klicken. Alle JSON-Level im Ordner einschließlich Unterordnern werden vorab geprüft und nach Levelnummer, danach nach Dateinamen sortiert. Nach jedem Erfolg lädt **Nächstes Level** die nächste Datei dieser Sammlung. **Mitgelieferte Levels** wechselt zurück zum ursprünglichen Katalog. Ungültige Dateien und doppelte Level-IDs werden mit Dateiname beziehungsweise ID gemeldet.

Das Format wird durch `levels/level.schema.json` beschrieben. Feste Startobjekte stehen in `fixedGadgets`, das Spielerinventar in `inventory`, das Ziel in `goal` und ausdrückliche Instanzbeziehungen in `animalChases`, `catapults`, `fishChases` bzw. `seesawLaunches`. `connections` speichert Stromleitungen und Riemen, `controlRopes` Steuerseile und `floor: false` ein unten offenes Spielfeld. Objekt-IDs bleiben beim Testen und Laden erhalten. Bewegungsziele verwenden `kind: "motion"` und `minimumSpeed` (Matter.js-Tempo), Rechteckziele `kind: "area"` mit `selector`, `x`, `y`, `width` und `height`; geprüft wird der Objektmittelpunkt. Ziele für Spielerbauteile verwenden zusätzlich `tag: "player-part"`.

## Physikmodell

Jeder Gadget-Typ besitzt genau eine Definition in `engine/gadget-catalog.ts`: Kategorien, Tags, Form, Abmessungen, Masse, Reibung, Rückprall, Schwerkraftfaktor, Feuer-/Wasser-/Aufprallreaktionen sowie Animationen je Zustand.

`engine/interaction-rules.ts` kombiniert Gadgets über Typen, Kategorien und Tags. Deshalb gilt beispielsweise dieselbe Aufprallregel für Bowlingkugel und Tennisball, während deren Masse und Rückprall verschieden bleiben.


Alle Level verwenden ausschließlich `schemaVersion: 2` mit `goal.kind`. Validatoren prüfen Daten ohne Normalisierung; alte Zielformate, Systemlisten und unvollständige Anschlussidentitäten werden zurückgewiesen. Der gemeinsame Aufbau in `game/simulation-setup.ts` aktiviert Hooks aus Gadget-Definitionen und wird von Spiel, Editor und Szenariotests verwendet. Lastseilrouten benötigen ein ausdrücklich referenziertes Gewicht und einen Anker. Neue Gadgets werden im bestehenden Katalog, den fachlichen Mechaniken und kleinen Renderern ergänzt; Details stehen in der Architekturdokumentation.

Lokale vollständige Prüfung mit der vorhandenen Node-Umgebung:

```sh
node --experimental-strip-types --test tests/*.test.mjs
node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false
node node_modules/next/dist/bin/next build
```

Der HTML-Test unter `tests/rendered-html.test.mjs` prüft das vorhandene Worker-Artefakt in `dist`; ein lokaler Next-Build aktualisiert dieses separate Artefakt nicht. Browserprüfungen des lokalen Produktionsservers ergänzen die Prüfung des aktuellen Anwendungscodes.
