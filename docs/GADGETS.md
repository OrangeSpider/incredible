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
  { "id": "power-lamp", "kind": "wire", "sourceId": "generator", "targetId": "lamp" },
  { "id": "wind-drive", "kind": "belt", "sourceId": "windmill", "targetId": "conveyor" }
]
```

Die referenzierten IDs müssen zu vorhandenen Gadgets mit passenden Anschlüssen gehören. Der Validator verwirft falsche Anschlüsse, fehlende IDs und doppelte Verbindungen. Ziele können Zustände (`on`, `running`, `exploded`, `spent`) oder Signale wie `heat.ignited.<id>` und `tnt.exploded.<id>` prüfen.

Die Referenzlösungen in `tests/gadgets.test.mjs` prüfen alle elf Mini-Levels einschließlich fehlender Bauteile, falscher Treffer, unterbrochener Stromversorgung und mehrerer Simulationsraten. Die vorhandenen Physik- und Leveltests prüfen weiterhin die älteren Mechaniken. Level 16 bleibt mit schwächerem Wind lösbar; die Referenzlösung richtet den Ventilator dafür etwas flacher aus.
