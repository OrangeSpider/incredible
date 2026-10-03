# Gadgets: Umsetzungsabschnitte und Mini-Levels

Die Referenzbilder dienen als Vorbild für erkennbare Gegenstände, sichtbare Anschlüsse und nachvollziehbare Kettenreaktionen. Alle folgenden Abschnitte sind umgesetzt; die Mini-Levels führen die Mechaniken einzeln ein. Neue kombinierte Aufgaben können dieselben Gadget-Typen, Verbindungen und Ziele verwenden.

## 1. Strom und Leitungen — Level 25–28

- Taschenlampe (`flashlight`): Batterie, mechanischer Einschaltknopf, gerichteter Lichtkegel.
- Lampe mit Knopf (`lamp`): Batterie, mechanischer Einschaltknopf, Licht im Umkreis.
- Steckdosenlampe (`socketLamp`) und Steckdosenventilator (`socketFan`): laufen ausschließlich mit einer Leitung zu einem laufenden Generator.
- Generator (`generator`): startet bei einem Stoß durch einen beweglichen Körper, eine Explosion oder einen Boxhandschuh. Er läuft anschließend weiter.
- Stromleitung (`wire`): Werkzeug wählen, STROM und STECKDOSE anklicken. Eine Leitung versorgt einen Verbraucher; mehrere Leitungen können vom selben Generator ausgehen. Batteriegeräte benötigen keine Leitung.

Die bisherigen Ventilatoren besitzen ihren eigenen Antrieb. Ein gemeinsames Luftstrommodell ersetzt die bisher doppelt angewendete Kraft. Der sichtbare Kegel entspricht der Reichweite von 320 Pixeln. Schwere Kugeln werden nicht vom Luftstrom fortgeblasen; leichte Bälle und Ballons reagieren darauf. Wände blockieren Wind.

## 2. Licht und Hitze — Level 29–30

- Lampen beleuchten einen Umkreis von 260 Pixeln, Taschenlampen einen Kegel von 360 Pixeln. Eine Kerzenflamme liefert ebenfalls nahes Licht.
- Lupe (`magnifier`): bündelt tatsächlich eintreffendes Licht in einem Brennpunkt 90 Pixel vor der Linse. Drehen verändert die Richtung. Der markierte Punkt hilft beim Aufbau.
- Ein Docht oder Luntenabschnitt im Brennpunkt entzündet sich nach kurzer Erwärmung. Ohne Licht, bei falscher Ausrichtung oder mit einer Wand im Strahlweg bleibt er kalt.
- Neue Lunten nutzen das räumliche Abbrandmodell: Feuer bewegt sich vom Zündpunkt durch die Lunte. Die bestehenden Kanonenlevels behalten ihre Luntennetzwerke.
- Raketenfeuer folgt der sichtbaren Flugbahn und entzündet beim Vorbeifliegen Kerzendochte, Lunten und die Zündlunten von Kanonen oder TNT. Der Weg zwischen Simulationsschritten wird ebenfalls geprüft; nasse Lunten bleiben gelöscht.

## 3. Stoß und Antrieb — Level 31–35

- Basketball (`basketball`): 0,62 kg gegenüber 7,2 kg bei der Bowlingkugel; stärkerer Rückprall.
- TNT (`tnt`): direktes Feuer an der kurzen Lunte, 650 ms Abbrand, einmalige Explosion mit abnehmendem Impuls bis 180 Pixel. Goldfischgläser im ungeschützten Wirkungsbereich zerbrechen und geben nach ihrer Bruchanimation jeweils einen Fisch frei. Wände schirmen den Stoß ab; leichtere Körper reagieren stärker. Wasser löscht die Lunte vor der Explosion.
- Sprengzünder (`detonator`): ein Treffer von oben drückt den Griff. Rechts unten erscheint ein Funke für 160 ms. Er kann eine unmittelbar angrenzende Lunte entzünden.
- Windrad (`windmill`): dreht im Luftstrom. Ein Antriebsriemen zwischen seinen ANTRIEB-Anschlüssen und Zahnrad oder Laufband überträgt Drehung. Ohne Wind stoppt der Antrieb.
- Boxhandschuh (`boxingGlove`): ein Treffer an der Rückseite löst genau einen Schlag nach vorne aus. Die Schlagrichtung lässt sich durch Drehen ändern. Zurücksetzen der Maschine macht ihn erneut bereit.

## 4. Darstellung und Bedienung

- Mäuselöcher sind dunkle Rundbogenöffnungen am Boden.
- Trampoline zeigen Sprungfläche, Rahmen, Federn und Beine.
- Ventilatoren zeigen rotierende Flügel und wandernde Luftstromlinien; ausgeschaltete Varianten stehen still. Windräder drehen entsprechend der Windstärke und behalten beim Stoppen ihre Flügelstellung. Bei beleuchteten Lupen bewegen sich Lichtpunkte zum pulsierenden Brennpunkt, während die Linse schimmert.
- Größenänderungen an Holzplanken, Stahlträgern, Holzwänden und Steinmauern sind dem Level-Editor vorbehalten. Im Spielaufbau behalten diese Flächen ihre vorgegebene Länge beziehungsweise Höhe.
- Level 21 und 22 enthalten die überflüssige Steinwand nicht mehr. Ihre Seilaufgaben und bisherigen Lösungen bleiben erhalten.
- Seil anklicken oder verbundenen Griff auswählen, anschließend **ENTFERNEN** drücken. Es kommt ins Inventar zurück. Dasselbe gilt für Stromleitungen und die neuen Riemenverbindungen. Es gibt keinen zusätzlichen „Seil zurück“-Button. Escape bricht einen begonnenen Verbindungsaufbau ab.
- Verbundene Bauteile können weiterhin an ihrer Mitte verschoben werden.
- Der Level-Editor speichert die aktuell gebauten Leitungen und Riemen mit. Verbindungen folgen beim Verschieben oder Drehen den Anschlüssen.
- Die Magnetmechanik bleibt in den bestehenden Levels verfügbar.

## Mini-Levels

| Level | Aufgabe | Vorgesehener Schwerpunkt |
| --- | --- | --- |
| 25 | Ein Klick macht Licht | Taschenlampenknopf treffen |
| 26 | Licht im Umkreis | Lampenknopf treffen |
| 27 | Vom Stoß zum Strom | Generator starten und Lampe verkabeln |
| 28 | Wind aus der Steckdose | Ventilator verkabeln |
| 29 | Ein heißer Punkt | Docht mit der Lupe entzünden |
| 30 | Licht zündet Lunte | Taschenlampenlicht bündeln |
| 31 | Der leichte Springer | Basketball und Trampolin |
| 32 | Die kurze Lunte | TNT-Flammenkontakt und Druckwelle |
| 33 | Ein Funke genügt | Sprengzünder und kurze Lunte |
| 34 | Wind wird Drehung | Windrad und Antriebsriemen |
| 35 | Einmal kräftig schlagen | Seitlicher Auslöser und einmaliger Schlag |

## Datenformat für weitere Levels

Die neuen Gadgets werden wie vorhandene Bauteile in `fixedGadgets`, `inventory` oder `initialPlacements` eingesetzt. Die Engine aktiviert ihre Mechaniken anhand des Gadget-Typs; spezielle Szenennummern sind nicht nötig.

```json
"connections": [
  { "id": "power-lamp", "kind": "wire", "sourceId": "generator", "sourcePortId": "power", "targetId": "lamp", "targetPortId": "socket" },
  { "id": "wind-drive", "kind": "belt", "sourceId": "windmill", "sourcePortId": "drive", "targetId": "conveyor", "targetPortId": "left" }
]
```

Die referenzierten IDs müssen zu vorhandenen Gadgets mit passenden Anschlüssen gehören. Der Validator verwirft falsche Anschlüsse, fehlende IDs und doppelte Verbindungen. Ziele können Zustände (`on`, `running`, `exploded`, `spent`) oder Signale wie `heat.ignited.<id>` und `tnt.exploded.<id>` prüfen.

Die Referenzlösungen in `tests/gadgets.test.mjs` prüfen alle elf Mini-Levels einschließlich fehlender Bauteile, falscher Treffer, unterbrochener Stromversorgung und mehrerer Simulationsraten. Die vorhandenen Physik- und Leveltests prüfen weiterhin die älteren Mechaniken. Level 16 bleibt mit schwächerem Wind lösbar; die Referenzlösung richtet den Ventilator dafür etwas flacher aus.

Steuerseile speichern ebenfalls Anschlussidentitäten statt lokaler Koordinaten:

```json
"controlRopes": [
  { "targetId": "gate", "targetPortId": "handle", "guides": [{ "gadgetId": "pulley", "portId": "guide" }], "source": { "gadgetId": "basketball", "portId": "pull" } }
]
```

`engine/gadget-ports.ts` löst die im Gadget-Katalog beschriebenen lokalen Punkte bei jeder Verwendung auf. `rope-end` stellt automatisch `pull` bereit; besondere Geometrien und mehrere benannte Anschlüsse werden über `ports` in der Gadget-Definition angegeben. Fehlende Anschluss-IDs werden abgewiesen. Riemen verbinden zwei `drive`-Ports, Stromleitungen führen von `power` nach `socket`, Steuerseile führen von `handle` über Rollen zum Zugpunkt. Rotation, Spiegelung und Größenänderung erhalten die gespeicherte Anschlussidentität.

## Aktivierung und Instanzbeziehungen (Stufe 4)

Gadget-Definitionen liefern über `mechanics` die benötigten Runtime-Hooks. Die räumlichen Engine-Mechaniken und deklarativen Regeln arbeiten ohnehin für alle registrierten Instanzen. `systems` ist aus dem endgültigen Format entfernt und wird beim Import abgewiesen. Die Darstellung liest jede Instanz über ihre stabile ID; der Validator prüft ausschließlich und ergänzt keine Eigenschaften. Frei platzierte Anfangszustände kommen aus `placementState` oder `defaultState` im Katalog.

Explizite Szenenabläufe speichern ihre Beziehungen direkt:

```json
"animalChases": [{"catId":"cat","mouseId":"mouse","exitId":"hole","gateId":"gate"}],
"catapults": [{"catId":"cat","mouseId":"mouse","seesawId":"lever","platformId":"platform","exitId":"hole"}],
"fishChases": [{"catId":"cat","fishId":"fish"}],
"seesawLaunches": [{"impactId":"impact","triggerId":"trigger","velocity":{"x":8,"y":-11}}],
"loadRope": {"weightId":"load","anchor":{"x":92,"y":64}}
```

Die Felder sind optional; `gateId` ist ebenfalls optional. Die Start-/Zielgeometrie kommt aus den zugeordneten Körpern. `seesawLaunches.velocity` ist ein ausdrücklich konfigurierter Weltimpuls des Spezialablaufs. Jede Tierpaarung bzw. Katapult-/Auslösefolge besitzt eigenen Fortschritt. Verweise müssen die richtige Gadget-Art adressieren; ein verschiebbarer Startaufbau in `initialPlacements` behält seine ID. Es gibt keine automatische Wahl des ersten Tiers oder ein stilles Erraten einer Zuordnung.

Eine Schere speichert `properties.balloon` als explizite Ballon-ID und funktioniert auch ohne Ballonzuordnung als Schere. Ein Glas kann über `properties.fishId` einen vorhandenen Fisch zuordnen; ohne Angabe erzeugt es seinen eigenen Fisch mit der ID `<glas-id>:fish`. Ein vorhandener Fisch wird nicht anhand seiner Nähe oder seines Namens zugeordnet. Ein Fisch darf nur einem Glas gehören. Der Editor entfernt Beziehungen zu gelöschten Instanzen.

Steuerseil-Zielports definieren ihre Wirkung mit `action: "close" | "open"`. Der Zugcallback erhält die vollständige Zielanschlussidentität. Fortschritt liegt unter `handleProgress:<portId>`, Zugereignisse unter `rope.pulled.<portKey>`; die Seilzustände bleiben voneinander unabhängig. Die bisherigen Geräte besitzen jeweils einen gemeinsamen Schließ-/Öffnungszustand. Mehrere Ports können dieselbe Gerätelatch betätigen, ohne ihre Zugfortschritte zusammenzulegen.

`light` beschreibt lokale Emission, Reichweite, Intensität, Richtungslicht und aktiven Zustand. `electrical.activeState` beschreibt den Betriebszustand eines Verbrauchers. Renderernamen und Artwork beeinflussen diese Physik nicht. `reactions` sind ausdrücklich beschreibende Kataloghinweise, keine konfigurierbaren Wirkungen. Reaktionen werden durch vorhandene Regeln, Tags und fachliche Mechanikmodule umgesetzt. Alte `waterReaction`, `fireReaction` oder `impactReaction` in `physics` werden abgewiesen.

`physics` enthält Körperparameter und tatsächlich verwendete Stoßschwellen. `impactThreshold` wirkt auf Scheren-/Hamsterradkontaktregeln sowie Glasbruch und Generatorstart. Masse, Reibung, Restitution, Sensor-/Statikzustand und Trägheit werden auch bei vorgefertigten Körpern angewendet; Eimer bleiben offene zusammengesetzte Körper und unterstützen Breiten-/Höhenskalierung. Eine ausdrücklich angegebene `density` berechnet die Masse aus der Fläche, sofern kein ausdrückliches `massKg` vorliegt; `massKg` hat Vorrang. Schwerkraftfaktor, Auftrieb und Geschwindigkeitsgrenze bleiben die vorhandenen Engine-Parameter. Der Levelvalidator prüft Feldnamen und Werte; eine zusätzliche Reaktionssprache gibt es nicht.

Riemen und Zahnradkontakt bilden einen bei jedem Schritt neu berechneten Antriebsgraphen. Nur aktive Eigenantriebe speisen ihn. Getrennte Empfänger und ganze abgetrennte Zahnradinseln werden inaktiv; Wiederverbindung stellt die Übertragung wieder her. Stromleitungen werden weiterhin separat aus den Generatorzuständen ausgewertet. Lastseilrouten behalten ihr eigenes Modell mit einem ausdrücklich ausgewählten Gewicht und genau einem Zugkörper; Anker, Ausgangshöhe und Massen kommen aus den Daten bzw. registrierten Körpern.


### Endgültiges Darstellungs- und Datenformat

`schemaVersion: 2` und `goal.kind` sind verbindlich. Verbindungen verlangen `sourcePortId` und `targetPortId`; Steuerseile speichern `PortReference` für Quelle und Umlenkrollen sowie Ziel-ID und Zielport. Kerzen können ihre Flammenlage ausdrücklich mit `properties.flameOffsetY` beschreiben. Ausgelieferte Levels speichern diese Werte direkt. Es gibt keine Importmigration, `standalone`-Markierung oder Version-1-Auswertung.

Der Körperrenderer verwendet Kataloganimationen und vorhandenes Artwork. Der Feuerrenderer zeichnet lokale Luntenfronten, Kanonenblitze und Raketenphasen je Instanz. Der Lastseilrenderer liest den konfigurierten Anker und aktuelle Körperpositionen unabhängig vom Szenennamen. Zahnräder verwenden den je Instanz fortgeschriebenen Rotorwinkel und die aktuelle Drehrichtung des laufenden Antriebsgraphen; beim Trennen bleibt der Winkel stehen. Erweiterungsschritte stehen in `ARCHITECTURE.md`.
