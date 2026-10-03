# Refactoring in fünf aufeinanderfolgenden Chats

## Verbindliche Vorgaben

Die Anwendung ist noch nicht veröffentlicht. Bestehende Levels dürfen direkt angepasst oder neu erstellt werden. Es werden keine versteckten Migrationen, Legacy-Fallbacks oder neuen Kompatibilitätsschichten eingebaut. Die Empfehlung aus der Architekturanalyse ist in dieser Hinsicht durch die ausdrückliche Vorgabe des Nutzers ersetzt.

Das aktive Git-Projekt liegt in `D:/Dev/ChatGPT/incredible/incredible`. Der gleichnamige übergeordnete Projektordner enthält außerdem `incredible - Kopie`; dieser wird nicht bearbeitet. Zu Beginn dieser Folge ist der Anwendungscode unverändert, Git-HEAD ist `ba09b4e`.

Die Schritte laufen nacheinander im selben Checkout. Jeder Chat setzt nur seinen Schritt um, führt passende Prüfungen aus und dokumentiert die Übergabe hier. Keine parallelen Änderungen an späteren Schritten. Keine ECS-Umstellung, Vererbungshierarchie oder universelle Plugin-Engine. Kleine fachliche Funktionen und vorhandene Registries bevorzugen.

## 1. Gemeinsamer Simulationsaufbau

Status: abgeschlossen.

- Die Vorbereitung der Simulation aus `components/game/GameCanvas.tsx` in ein UI-unabhängiges Modul verschieben.
- Canvas und `tests/helpers/machine-scenario.mjs` verwenden dieselbe Aufbau-Funktion für Level, Platzierungen, Verbindungen, Steuerseile und gegebenenfalls Lastseilrouten.
- Erzeugung der Welt, Boden, Körperregistrierung und Vorbereitung der Runtime haben damit eine gemeinsame Quelle. Insbesondere platzierte Eimer und Wasser werden auch im Test über die Engine registriert.
- Die Darstellung bleibt im Canvas. Das Verhalten bestehender Mechaniken wird in diesem Schritt nicht gleichzeitig umgebaut.
- Abschluss: TypeScript und relevante Engine-/Leveltests bestehen; Tests decken den gemeinsamen Aufbau einschließlich mehrerer zusammengesetzter Gadgets ab. Änderungen, Prüfergebnisse und bekannte Folgepunkte unten dokumentieren.

## 2. Mechanikpfade vereinheitlichen

Status: abgeschlossen.

- Lunten und Kanonen auf einen Ausführungspfad bringen. Mehrere Kanonen unabhängig verarbeiten; alle Geschosse bei der Engine registrieren.
- Danach überlappende Scheren-, Trampolin- und Wippenlogik bereinigen, sodass jede Wirkung genau einen Verantwortlichen hat.
- Harte Ausnahmen anhand einzelner Regel-IDs durch eine klare Zuordnung von räumlichen Mechaniken und deklarativen Regeln ersetzen.
- Levels und Tests direkt auf das neue Verhalten anpassen. Keine Umschaltung zwischen alter und neuer Mechanik als Kompatibilitätsfunktion erhalten.
- Abschluss: Mehrinstanzfälle, kombinierte Mechaniken, Zielselektoren für erzeugte Objekte und relevante Level-Lösungen geprüft.

## 3. Anschlussdefinitionen vereinheitlichen

Status: abgeschlossen.

- Anschlussfähigkeiten, lokale Positionen und vollständige Anschlussidentitäten zentral beschreiben.
- Basketball mit `rope-end` erhält einen Seilanschluss ohne zusätzliche Typenliste.
- Neue Anschlussnamen werden vollständig verglichen; Ports bleiben bei Rotation, Spiegelung und Größenänderungen korrekt.
- Stromleitung, Antriebsriemen und Steuerseil behalten ihre fachlich unterschiedlichen Regeln.
- Bestehende Levelverbindungen direkt mit eindeutigen Anschluss-IDs speichern; keine Normalisierung fehlender IDs zur Laufzeit.
- Abschluss: Anschlussaufbau, doppelte Verbindungen, mehrere Ports sowie Trennen und Wiederverbinden geprüft.

## 4. Gadget-Aktivierung und Instanzzuordnungen bereinigen

Status: abgeschlossen.

- Automatisch benötigte Mechaniken aus Gadget-Definitionen beziehen. Explizite Abläufe bleiben ausdrücklich in Leveldaten konfiguriert.
- Feste IDs, erste Instanz eines Typs und Szenenkoordinaten aus wiederverwendbaren Runtime-Systemen entfernen.
- Beziehungen zwischen Instanzen explizit speichern; Zustände pro Instanz oder System führen.
- Lichtparameter und aktive Gerätezustände fachlich beschreiben, unabhängig vom Renderernamen.
- Reaktionsangaben und Overrides auf einen klaren, tatsächlich umgesetzten Vertrag bringen.
- Abschluss: Umbenannte IDs, mehrere Instanzen, freie Editorlevels und Antriebsverlust einschließlich Zahnradtrennung geprüft.

## 5. Darstellung, Datenformat und Abschlussprüfung

Status: abgeschlossen; alle fünf Schritte abgeschlossen.

- Verbleibende Gadget-Sonderfälle im Canvas in kleine Renderer verlagern; den gemeinsamen Simulationsaufbau ausschließlich für Simulation verwenden.
- Doppelte `standalone`-Listen und Sonderbehandlungen im Spielaufbau und Editor bereinigen.
- Validator als reine Prüfung gestalten. Kerzen-/Magnetmigrationen und unnötige alte Datenformate entfernen; ausgelieferte Levels auf das endgültige Format bringen.
- Dokumentation und Handbuch auf die tatsächliche Architektur abstimmen.
- Abschluss: Gesamte Testsuite, TypeScript, passender Produktionsbuild und Prüfung der relevanten Spiel-/Editorabläufe. Bei notwendigen Änderungen an Levels neue Lösungsprüfungen statt alter Kompatibilitätsannahmen verwenden.

## Ausgangsbefunde und Prüfungen

Die ausführliche Analyse liegt in `outputs/architecture-review.md`; Beobachtungen sind in `outputs/architecture-probes.mjs` reproduzierbar. Diese Dateien dokumentieren den Ausgangszustand. Ihre vorgeschlagene Importmigration gilt ausdrücklich nicht für diese Umsetzung.

Ausgangsbefunde: getrennte Kanonenpfade; fest codierte Objekt-IDs und Einzelinstanzen; fehlender Basketball-Seilanschluss; Anschlussvergleich reduziert Namen auf `right/default`; Lichtphysik hängt vom Renderer ab; Editor-Aktivierung per Magnet-Sonderfall; Validator verändert Kerzendaten; getrenntes Zahnrad bleibt `running`.

Ausgangsprüfung: 181 Tests bestehen mit `node --experimental-strip-types --test tests/*.test.mjs`; TypeScript besteht mit `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`. Der vorhandene Node 22.13.1 benötigt das Type-Stripping-Flag. Die HTML-Prüfung verwendete das vorhandene Build-Artefakt; kein neuer Produktionsbuild war Teil der Analyse.

## Übergaben

Jeder abgeschlossene Schritt ergänzt hier die betroffenen Module, tatsächliche Prüfergebnisse, bewusste Änderungen an Leveldaten und die Voraussetzungen für den nächsten Chat. Den Status des abgeschlossenen und des folgenden Schritts entsprechend aktualisieren. Weitere Chats werden erst nach Abschluss des vorherigen Schritts begonnen.


### Schritt 1 – gemeinsamer Simulationsaufbau (3. Oktober 2026)

- `game/simulation-setup.ts` enthält `createSimulation`: Welt und optionalen Boden erzeugen, feste und platzierte Gadgets über die Engine registrieren, Verbindungen übernehmen, Runtime-Körper zuordnen sowie Steuerseile, Lastseilrouten, Zahnradverbindungen und das bestehende Luntennetz vorbereiten. Der Aufbau ist ohne React, DOM oder Canvas ausführbar; Zeitschritte und Darstellung bleiben bei den Aufrufern.
- `GameCanvas.tsx` und `tests/helpers/machine-scenario.mjs` verwenden diese Funktion. Der Testhelfer ergänzt nur IDs/Rotation für seine knappen Platzierungsdaten, Gewinnbeobachtung und Zeitschritte. Sein optionales viertes Argument erlaubt Verbindungen und Lastseilrouten. Platzierte Eimer einschließlich aller Wasserteilchen sind nun auch in Tests Engine-Gadgets mit Instanz-IDs, Zuständen und Zielselektoren. Tests beachten jetzt ebenso `floor: false` und die vollständigen Runtime-Körperzuordnungen.
- Platzierungs- und Lastseiltypen liegen in `game/simulation-types.ts`; die bisherigen Komponentenimporte werden durch reine Exporte auf diese gemeinsame Definition geführt. `GameApp.tsx` bezieht die Lastseil-Typzuordnung direkt aus dem gemeinsamen Modul. Der Canvas verwendet dessen Körper-/Platzierungsmaps, Routenanalyse und Zahnradabstände ausschließlich zur Darstellung des vorbereiteten Zustands.
- Sieben neue Tests in `tests/simulation-setup.test.mjs` prüfen mehrere Eimer und Wippen mit Wasserregistrierung und Gelenken, den Testhelfer und optionalen Boden, Level-/Aufrufverbindungen samt Riemenstatus, bewegliche Lastseilgeometrie und Startpositionen, Steuerseilreferenzen, Vorschau/Physik-Overrides sowie die erhaltene Zahnrad- und Kanonen-Luntenvorbereitung. Die Architekturprüfung sichert die Delegation des Canvas ab.

Tatsächlich ausgeführte Abschlussprüfungen:

- `node --experimental-strip-types --test tests/simulation-setup.test.mjs`: 7 bestanden, 0 fehlgeschlagen.
- `node --experimental-strip-types --test tests/*.test.mjs`: 188 bestanden, 0 fehlgeschlagen, einschließlich Engine-, Editor-, Steuerseil- und Level-Lösungsprüfungen. Ausgabe: `outputs/step-1-tests.log`.
- `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`: erfolgreich.
- Keine Leveldaten geändert, keine Migration oder Kompatibilitätsmechanik ergänzt. Kein Produktionsbuild und keine manuelle Browserprüfung durchgeführt. Kein Commit oder Push.

Voraussetzungen und Grenzen für Schritt 2:

Der gemeinsame Aufbau ist jetzt die Quelle für Canvas und Szenariotests. Vorhandene feste IDs/Labels, Auswahl einzelner Runtime-Körper, der Zahnradgraph anhand der Ausgangspositionen und das einzelne `cannon-fuse` bleiben bewusst erhalten. Insbesondere wurden weder die Umschaltung zwischen GadgetMechanics und Runtime-Systemen noch Geschossregistrierung, Brenndauern, Scheren-, Trampolin- oder Wippenwirkungen verändert. Schritt 2 kann die Lunten-/Kanonenpfade auf dieser gemeinsamen Basis vereinheitlichen und Mehrinstanz-/Geschossselektortests ergänzen; hierfür gelten weiterhin direkte Levelanpassungen ohne Migrationen. Die generelle Bereinigung der Instanzzuordnungen folgt erst in Schritt 4.


### Schritt 2 – Mechanikpfade vereinheitlicht (3. Oktober 2026)

- `GadgetMechanics` besitzt das einzige räumliche Luntennetz. Jede Kanone hat eine eigene Lunte (`<id>:fuse`), eigenen Fortschritt und genau einen registrierten Schuss (`<id>:shot`). Instanzsignale `cannon.fired.<id>` ergänzen das fachliche Gesamtsignal. Die Umschaltung anhand von `fuse-network`, der alte Runtime-Schusspfad und globale Abbrand-/Schusszustände sind entfernt. Nasse Lunten löschen nur ihren eigenen Abschnitt. Die Netz-Snapshots stehen auch in der pausierten Bauvorschau bereit.
- Regeln kennzeichnen mit `execution` ihre Zuständigkeit: ohne Angabe deklarativer EffectRegistry-Pfad, `spatial` für geometrische GadgetMechanics, `runtime` für explizite Levelabläufe. Die Engine überspringt diese beschreibenden Regeln in allen Ausführungseinstiegen. Keine Ausnahmen anhand einzelner Regel-IDs. Räumlicher Flammenkontakt, Glasbruch und Wippenübertragung behalten ihre Spezialmodelle.
- Trampoline verwenden ausschließlich den deklarativen Bounce-Effekt. Wippenimpuls und Winkelbegrenzung liegen ausschließlich in GadgetMechanics für alle Wippen; die Runtime behält Levelziele und die expliziten Katapult-/Torabläufe. Scheren schließen über die deklarative Aufprallregel oder den bestehenden Steuerseilzug. Der Zustand löst einmalig die zugeordnete Ballonfreigabe aus; der zusätzliche Einzel-Scherenpfad ist entfernt. Die allgemeine Aktivierung und Zuordnung beliebiger platzierter Scheren bleiben Schritt 4 vorbehalten.
- Canvas zeichnet Luntenfronten und Kanonenblitze anhand der jeweiligen Engine-Instanz. Szenenstatus ist eine Zusammenfassung dieser Zustände, keine zweite Ausführungssteuerung.
- Leveldaten direkt angepasst: Levels 9, 18 und 20 entfernen `fuse-network`; Level 17 verwendet `scissors` statt `single-scissor`. Die beiden entfernten Capability-Namen werden nicht mehr akzeptiert. Keine Migration oder Fallbacks. Wegen der registrierten Geschossphysik verwendet die geprüfte Lösung für Level 20 nun den Magneten bei `(600, 180)` statt `(600, 160)`; die drei Lunten bleiben bei `(150,360,0)`, `(250,352,-0.08)`, `(350,340,-0.08)`. Das Tor öffnet und Mogli erreicht den Ausgang.

Tatsächlich ausgeführte Abschlussprüfungen:

- Drei neue Szenariotests in `tests/mechanic-paths.test.mjs`: unabhängige Zündung zweier Kanonen und einmalige Schusserzeugung, Geschoss-Zielselektoren nach ID/Typ/Tag, isoliertes Löschen nasser Lunten sowie kombinierte Trampolin-/Scheren-/Wippenwirkungen mit Zählung der Zustandswechsel und Impulse. Alle nutzen den gemeinsamen Aufbau; gezielte Kollisionen werden für die Zählprüfung eingespeist.
- Bestehende Aufbau- und Raketenprüfungen verwenden die per Instanz verfügbaren Snapshots. Die bisherigen Level-Lösungstests einschließlich 9, 17, 18, 19 und der angepassten Lösung 20 bestehen.
- `node --experimental-strip-types --test tests/*.test.mjs`: 191 bestanden, 0 fehlgeschlagen. Ausgabe: `outputs/step-2-tests.log`.
- `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`: erfolgreich.
- Kein Produktionsbuild und keine manuelle Browserprüfung durchgeführt. Kein Commit oder Push.

Übergabe für Schritt 3:

Anschlussdefinitionen und die bisherigen Steuerseil-/Riemen-/Stromleitungsregeln wurden nicht umgebaut. Schritt 3 kann die Portidentitäten vereinheitlichen. Allgemeine Mechanikaktivierung, feste IDs in expliziten Levelabläufen, erste Instanzen in Runtime-Körperzuordnungen und Scherenzuordnungen aus festen Levelgadgets bleiben für Schritt 4. Das Luntennetz wird bei Änderungen seines Gadgetbestands neu aufgebaut; dynamisches Hinzufügen von Lunten während einer laufenden Simulation ist kein geprüfter Ablauf dieser Stufe. Der Canvas enthält weiterhin Render-Sonderfälle für Schritt 5.


### Schritt 3 – Anschlussdefinitionen vereinheitlicht (3. Oktober 2026)

- `engine/gadget-ports.ts` und `GadgetDefinition.ports` beschreiben Anschlussarten, benannte IDs und lokale Geometrie gemeinsam. `PortReference` und `portKey` bilden vollständige Identitäten einschließlich beliebiger Anschlussnamen und Trennzeichen ab. Generische Zugpunkte kommen aus `rope-end`; der Basketball benötigt keine weitere Typenliste. Die rote Lastkugel trägt jetzt ebenfalls ihre bisher implizite Fähigkeit als `rope-end`. Besondere Griff-, Rollen-, Ballon-, Wippen-, Hamsterrad-, Generator- und Laufbandgeometrien stehen im Katalog; Laufbandzeichnung und Ports teilen die Radgeometrie aus `game/drive.ts`.
- Strom-/Riemen-Ports und Steuerseil-Ports beziehen sich auf diese Definitionen. Simulation, Bauvorschau, Zeichnung, Hit-Tests im Spiel/Editor und Levelvalidierung verwenden dieselben lokalen Punkte mit Rotation und Spiegelung. Wippenbreite und Ballongröße werden beim Auflösen berücksichtigt; gespeicherte Steuerseile enthalten keine eingefrorenen lokalen Koordinaten mehr.
- `GadgetConnection` verlangt `sourcePortId` und `targetPortId`. Stromleitungen speichern stets die Erzeuger- und Steckdosen-IDs in richtiger Orientierung, unabhängig von der Klickreihenfolge. Der Vergleich `right/default` und die Auswahl des ersten kompatiblen Ports bei fehlenden IDs sind entfernt. `validateConnections` prüft Import, Engine-Levelaufbau, gemeinsamen Simulationsaufbau und laufende Antriebs-/Stromverbindungen. Fehlende IDs, unpassende Ports und doppelte Verbindungen werden abgewiesen.
- Steuerseile speichern `targetId` plus `targetPortId`, `guides: [{gadgetId, portId}]` und `source: {gadgetId, portId}`. `validateControlRopes` prüft Import und Runtime-Aufbau. Auswahl, Entfernen, Inventar und Duplikate verwenden die vollständige Zielanschlussidentität; mehrere benannte Ziel- und Rollenanschlüsse bleiben unterscheidbar. Rollen-Duplikate werden auch bei unterschiedlicher JSON-Feldreihenfolge erkannt. Der gemeinsame Aufbau und Testhelfer übernehmen gespeicherte Level-Steuerseile, sofern der Aufrufer sie nicht ausdrücklich ersetzt.
- Direkt betroffene alte Anschlussannahmen entfernt: Ein platziertes `belt`-Gadget erzeugt keine implizite Hamsterrad-/Laufbandverbindung mehr. Der Marker, die separate Canvas-Riemenzeichnung und die doppelte Inventarzählung dieses Pfads sind entfernt. Riemen werden über ausdrücklich verbundene `drive`-Ports gebaut. Zugseil-, Strom- und Antriebsphysik bleiben getrennte fachliche Mechaniken.
- Betroffene Module: Gadget-Katalog/-Typen/-Ports, `game/gadget-connections.ts`, `game/control-ropes.ts`, Engine/Mechanics, `simulation-setup.ts`, Spiel/Editor/Steuerseilzeichnung, Inventar und `levels/authoring.ts`/`catalog.ts`. `levels/level.schema.json`, gespeicherte Testlevel und `docs/GADGETS.md` beschreiben das neue Format direkt. Die ausgelieferten `level-*.json` enthalten bislang keine vorgegebenen `connections` oder `controlRopes`; in Schritt 3 mussten dort keine Verbindungen migriert oder Puzzlelösungen verändert werden. Die Leveländerungen aus Schritt 2 bleiben erhalten.

Tatsächlich ausgeführte Abschlussprüfungen:

- Sieben neue Prüfungen in `tests/attachment-ports.test.mjs` verwenden den gemeinsamen Simulationsaufbau: Basketball zieht einen Riegel; Wippenanschlüsse bei Rotation, Spiegelung und Größenänderung; beliebige benannte Riemenports und kollisionsfreie Identitätsschlüssel; Stromklickreihenfolge und Trennen/Wiederverbinden; Zurückweisung fehlender/ungültiger IDs; mehrere Griff-/Rollenports mit Export/Import und Wiederaufbau; Level 1 mit expliziter Riemenverbindung. Der letzte Test speist den Anstoß am Hamsterrad gezielt ein und prüft danach reale Übertragung und Levelziel.
- Bestehende Steuerseillösungen 14 und 21–24, Antriebsverlust/-wiederverbindung und Gadget-/Level-Lösungen einschließlich der unveränderten Schritt-2-Lösung für Level 20 bestehen. Bestehende Testdaten verwenden jetzt ausdrücklich alle Anschluss-IDs.
- `node --experimental-strip-types --test tests/*.test.mjs`: 198 bestanden, 0 fehlgeschlagen. Ausgabe: `outputs/step-3-tests.log`.
- `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`: erfolgreich.
- `git diff --check`: keine Fehler. Kein Produktionsbuild und keine manuelle Browserprüfung durchgeführt; der vorhandene HTML-Test nutzt weiterhin bestehende Build-Artefakte. Kein Commit oder Push.

Konkrete Übergabe für Schritt 4:

Die neuen Anschlussidentitäten sind verbindlich; keine fehlenden IDs normalisieren und keine alten Steuerseilkoordinaten importieren. Weitere Gadgets bekommen lokale Definitionen über `ports` oder die vorhandenen Fähigkeiten. Explizite Levelverbindungen müssen beide Ports benennen. Die allgemeine Aktivierung bleibt unverändert: Steuerseilzeichnung/-Bedienung und Zielwirkung hängen weiterhin an Runtime-Systemen; `ControlRopeMechanism` meldet Zug an die Zielinstanz, deren konkrete Aktivierung ist Gegenstand von Schritt 4. Der Steuerseil-Griffzustand liegt derzeit weiterhin pro Gadget, auch wenn mehrere Zielports adressierbar sind.

Feste Szenen-IDs, erste Hamsterrad-/Laufband-/Wippeninstanzen, Scheren-Ballon-Zuordnungen und Szenenabläufe wurden nicht allgemein bereinigt. Insbesondere bleibt `runtime.options.beltConnected` ein Aufbau-Snapshot für den bestehenden Hamster-Szenenablauf; die fachliche Riemen-/Strommechanik berechnet ihre Verbindungen laufend neu. Schritt 4 soll diese Instanzzuordnungen und Aktivierung samt Antriebsverlust/Zahnradtrennung vereinheitlichen. Der vorhandene Lastseilrouten-Sonderablauf (`pulley-rope`, einschließlich Szenenanker und Instanzwahl) bleibt ebenfalls für die Szenenbereinigung; diese Stufe betrifft die benannten Gadget-Anschlüsse und Steuerseile. Die übrige Renderer-/Formatbereinigung und Build-/Browserabschlussprüfung bleiben Schritt 5.

Nachprüfung zu Schritt 3: Die neuen Imports in `GameCanvas.tsx` standen versehentlich vor der Client-Direktive. `"use client"` steht nun wieder am Dateianfang. `node node_modules/next/dist/bin/next build` (Next.js 16.2.6, Turbopack) ist vollständig erfolgreich, einschließlich TypeScript und statischer Seitenerzeugung. Die separate TypeScript-Prüfung besteht ebenfalls. Der npm-Aufruf war lokal durch einen EPERM-Fehler beim Zugriff auf den Benutzerpfad blockiert; der direkte Next-Aufruf funktionierte. Keine manuelle Browserprüfung durchgeführt.


### Schritt 4 – Aktivierung und Instanzbeziehungen bereinigt (3. Oktober 2026)

- `GadgetDefinition.mechanics` liefert die intrinsischen Runtime-Hooks über die vorhandene Factory-Registry. Der gemeinsame Aufbau aktiviert sie aus allen tatsächlich aufgebauten Instanzen. Neue Editorlevels benötigen keine Systemliste; die Magnet-Reparatur im Validator und das automatische Ergänzen von `tension-rope` im Editor sind entfernt. `systems` bleibt bis Schritt 5 für vorhandene Präsentationshinweise akzeptiert und aktiviert keine Physik.
- Der feste Hamster-Szenenablauf samt `runtime.options.beltConnected`, Einzelrad-/Einzellaufbandzuordnung und positionsgesetztem Katzentransport ist entfernt. Hamsterräder starten über die vorhandene Aufprallregel, explizite Portverbindungen treiben Laufbänder an, und der vorhandene Kontaktmechanismus transportiert aufliegende Körper. Riemen und räumliche Zahnradkontakte werden in einem laufenden Antriebsgraphen berechnet. Auch abgetrennte Zahnradinseln und selbst nur fremdangetriebene Hamsterräder stoppen; Eigenaktivierung sowie Wiederverbindung funktionieren. Der frühere zweite deklarative Zahnradpfad ist als `spatial` beschrieben und führt keine weitere Übertragung aus.
- `runtime-animals.ts` besitzt kleine explizite Tier-/Katapult-/Wippenauslöseabläufe. `animalChases`, `catapults`, `fishChases` und `seesawLaunches` speichern konkrete Beziehungen; jede Folge besitzt eigene Fortschrittszustände. Ziele, Torgrenzen und Plattformgeometrie werden aus den referenzierten Körpern berechnet. Keine fest benannten Tiere, Tore oder Trigger und keine Wahl der ersten Instanz in diesen Abläufen. `seesawLaunches.velocity` ist ein ausdrücklich im Level gespeicherter Weltimpuls des erhaltenen Spezialablaufs.
- Scheren werden über Engine-Konfigurationen aller Instanzen aufgelöst, einschließlich frei platzierter und verschobener Gadgets. `properties.balloon` bezeichnet ausdrücklich ihren Ballon; Schließzeiten und einmalige Freigabe liegen in einer ID-Map. Gläser verwenden `properties.fishId` oder erzeugen ihren eigenen deterministisch benannten Fisch; Namens- und Näherungszuordnungen sind entfernt. `level-relations.ts` prüft Referenzarten, Parameter und doppelte Fischzuordnungen. Editor-Löschung entfernt betroffene Beziehungen.
- Steuerseilcallbacks tragen Ziel-ID und Port-ID. Portdefinitionen geben `action` (`close`/`open`) vor; Zugfortschritt und Zugereignisse verwenden die vollständige Anschlussidentität. Mehrere Zugports haben unabhängige Fortschritte; wenn sie dieselbe Geräteschließung betätigen, bleibt der fachliche Gerätezustand gemeinsam. Der bestehende Scherengriff-Renderer liest gezielt `handleProgress:handle`.
- `light` enthält lokale Emission, Reichweite, Intensität, Richtungslicht und aktiven Zustand. `electrical.activeState` beschreibt den Betriebszustand. Renderernamen sind aus der Lichtphysik entfernt. Reaktionsangaben stehen als ausdrücklich beschreibende `reactions` außerhalb von `physics`; alte Reaktions-Overrides werden zurückgewiesen. Vorhandene Regeln/Tags/Mechanikmodule bleiben für Wirkungen zuständig. Physische Overrides wirken auf konkrete Körperparameter, Scheren-/Hamsterstoßschwellen, Glasbruch und Generatorstart; vorgefertigte Eimerkörper übernehmen Masse, Material-/Statik-/Sensor-/Trägheitsparameter und Größenänderung. Explizite Dichte bestimmt die Masse nur ohne explizites `massKg`, das Vorrang hat.
- Der Lastseil-Spezialablauf benötigt `loadRope` mit `weightId` und `anchor`. Er verwendet die tatsächliche Gewichtshöhe, Körpermassen, bewegliche Routenpunkte und vorhandenen Boden. Mehrere Gewichtsgadgets stören seine Zuordnung nicht; mehr als ein Zugkörper in einer Route wird abgewiesen. Der Szenenanker und die erste Ball-/Gewichtsinstanz sind entfernt. Singuläre Körper und der anfängliche Zahnradabstandsgraph im Aufbau sind ausschließlich Darstellungszusammenfassungen; bei mehreren Exemplaren wird kein erster Körper gewählt.

Direkte Level- und Formatänderungen:

- Levels 7, 12, 13, 19 und 20 speichern die expliziten Tier-, Katapult-, Fisch- bzw. Triggerbeziehungen; Level 13 speichert zusätzlich die Glas-/Fischreferenz. `level.schema.json` und `docs/GADGETS.md` beschreiben diese Felder.
- Level 7 verwendet Mogli jetzt als verschiebbaren `initialPlacements`-Startaufbau mit stabiler ID statt als anonymes Inventargadget. Dies ist nötig, weil das Spiel neue Inventargadgets mit zeitbasierten IDs erzeugt. Neue geprüfte Lösung: Mogli von `(400,130)` nach `(400,370)` verschieben; Joanne und Ausgang bleiben unverändert. Der Test verwendet absichtlich eine andere numerische Platzierungs-ID und die stabile `configId`. Keine Auswahl der ersten Maus und kein ID-Fallback.
- Level 19 behält seine vorhandene Wippenlösung bei `(355,420)` und speichert den bisherigen Sonderimpuls `(8,-11)` ausdrücklich im Ablauf. Level 15 entfernt eine redundant zur expliziten Masse angegebene Dichte; sein Verhalten bleibt erhalten. Die anderen bisherigen gemeinsamen Szenariolösungen bleiben erhalten, einschließlich Level 20 mit Magnet `(600,180)` aus Schritt 2.
- Gezielte notwendige Darstellungsänderungen betreffen Anker aus Leveldaten, Steuerseilmodus ohne Aktivierungslabel, Anschlussfortschritt und die Kennzeichnung beschreibender Wasserangaben. Keine allgemeine Renderer-Auslagerung dieser Stufe.

Tatsächlich ausgeführte Abschlussprüfungen:

- Vierzehn neue Tests in `tests/gadget-activation.test.mjs` verwenden `createSimulation` bzw. den gemeinsamen Szenariohelfer: umbenannte IDs, unabhängige Hamsterrad-/Riemenpaare, gemischte Riemen-/Zahnradnetze, getrennte Inseln und Wiederverbindung, fremdangetriebene Hamsterräder, frei platzierte/verschobene Scheren, unabhängige benannte Zugports und ihre Zielwirkungen, Renderer-/Artwork-unabhängigkeit, fachliche aktive Zustände, wirksame Stoß-/Bewegungs-/Eimer-/Dichte-Overrides, unabhängige Tierpaare und Fischzuordnungen, übersetzte Katapultszene, explizites Lastseilgewicht/Anker sowie Editor-Löschung und Datenfehler. Die Scheren-/Kontakt-/Anstoßprüfungen speisen ausgewählte Kontakte gezielt ein; sie sind keine manuelle Spielbedienung.
- Bestehende Tests wurden direkt auf den neuen Vertrag umgestellt (keine Magnet-Migration, explizite Fischreferenz, eindeutige Darstellungssummaries und Lastseildaten). Der Level-1-Test speist jetzt einen tatsächlich schnellen Anstoß ein; danach prüft er reale Laufbandübertragung und Zielerfüllung.
- `node --experimental-strip-types --test tests/*.test.mjs`: 212 bestanden, 0 fehlgeschlagen. Ausgabe: `outputs/step-4-tests.log`.
- `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`: erfolgreich. Ausgabe: `outputs/step-4-typescript.log` (ohne Diagnostik).
- `node node_modules/next/dist/bin/next build`: erfolgreich, einschließlich TypeScript und statischer Seitenerzeugung. Ausgabe: `outputs/step-4-build.log`.
- `git diff --check`: keine Fehler. Keine manuelle Browserprüfung. Kein Commit oder Push.

Konkrete Übergabe und Grenzen für Schritt 5:

Die Runtime-Physik hängt nicht mehr an Szenenlabels, festen Tier-/Scheren-/Tor-IDs oder eingefrorenem Riemenstatus. Die verbleibenden `systems`-Hinweise, feste Render-IDs/-Labels, alten Szenenpräsentationszustände und Anfangs-Zahnradabstände betreffen weiterhin Darstellung. Schritt 5 soll die Renderer mit den vorhandenen Instanzzuständen verbinden, die verbleibenden `standalone`-Listen und Format-/Importthemen bereinigen, Handbuch und Dokumentation vollständig abgleichen und die Spiel-/Editorbedienung im Browser prüfen. Insbesondere Level 7 mit verschiebbarem Mogli, Mehrinstanzanimationen, Steuerseilgriffe, Datenanker der Lastseilroute und die erhaltenen Puzzlelösungen visuell prüfen. Die alte Kerzenanpassung im Validator bleibt planmäßig noch für die abschließende Formatbereinigung; die für Stufe 4 notwendige Magnetanpassung ist bereits entfernt.

Der Lastseilablauf bleibt bewusst eine ausdrücklich konfigurierte einzelne Route mit einem Lastverbund und einem Zugkörper; er ist keine beliebige Seilnetz-Engine. Die neuen Beziehungen können in Level-JSON konfiguriert werden; diese Stufe ergänzt keine allgemeine Ablauf-UI. Intrinsische Runtime-Hooks werden bei `createSimulation` aus dem vollständigen Bauzustand vorbereitet; dynamisches Hinzufügen neuer Gadget-Arten während einer laufenden Simulation ist kein geprüfter Editorablauf. Reaktionshinweise sind keine Wirkungsversprechen für sämtliche Materialkombinationen. Kein Browser- oder vollständiger Handbuchabgleich ist als bereits ausgeführt zu verstehen.

### Schritt 5 – Darstellung und endgültiges Datenformat (3. Oktober 2026)

- `GameCanvas.tsx` koordiniert den gemeinsamen Aufbau, die Zeit und die Zeichnung. `gadget-body-renderer.ts`, `fire-gadget-renderer.ts` und `load-rope-renderer.ts` übernehmen Körperanimationen, lokale Feuer-/Raketenwirkungen sowie Lastseil und Anschlussvorschau. Die entfernte `scene-presentation.ts` zeichnete doppelte Szenenobjekte und verwendete feste IDs sowie globale Zustände. Ziele erscheinen über die vorhandenen Zielgadgets und Zielbereiche; der Bauhinweis stammt direkt aus dem Level.
- Tiere, Kanonen, Lunten und Raketen zeichnen den Zustand und die Zeit ihrer jeweiligen Instanz. Tierabläufe setzen die vorhandenen Instanzzustände auch beim Katapultstart und bei der Landung. Zahnräder speichern ihren tatsächlich angetriebenen Rotorwinkel pro Instanz; nach Trennung bleibt der Winkel stehen. Ballonseile berücksichtigen feste und platzierte Instanzen. Scherengriffe verwenden weiterhin den Fortschritt ihres benannten Anschlusses. Die Lastseilverankerung samt Halterung folgt ausschließlich `loadRope.anchor`.
- Globale Tier-/Feuer-/Raketen-Präsentationszustände, unbenutzte Wasser-Kollisionszusammenfassungen, singuläre Darstellungs-Körperzuordnungen und der anfängliche Zahnradabstandsgraph sind entfernt. Der Simulationsaufbau liefert die tatsächlichen Instanzen und die vorbereitete Lastseilroute. Die fachliche Zuordnung von Lastseil-Bauteilen liegt in `game/pulley.ts`.
- Spiel und Editor verwenden `GadgetDefinition.placementState ?? defaultState` für neue freie Gadgets. Der Fisch startet frei als `flopping`; zugeordnete Glasfische bleiben zunächst `hidden`. Die doppelten `standalone`-Typenlisten und die ausgelieferten Standalone-Flags sind entfernt. Neue Gadgets benötigen keine zusätzliche Platzierungsliste.
- Das verbindliche Leveldatenformat ist ausschließlich `schemaVersion: 2` mit komponierbaren `goal.kind`-Zielen, vollständigen Portidentitäten und expliziten Instanzbeziehungen. `systems`, Schema 1 und alte `goal.mode`-Ziele werden abgewiesen. Legacy-Typen, Evaluator- und Authoring-Konvertierung sowie die alte System-ID-Liste sind entfernt. Der Validator prüft, ohne Eingaben zu verändern, und liefert eine unveränderte Kopie. Die Kerzenanpassung anhand des Kollisionslabels ist entfernt; Levels 9, 18 und 20 behalten ihre bereits ausdrücklich gespeicherte `flameOffsetY: -50`-Geometrie.
- Alle 34 ausgelieferten Leveldateien entfernen `systems`; Levels 29 und 32 entfernen außerdem `properties.standalone`. Keine Puzzlepositionen oder Lösungen wurden in Schritt 5 geändert. Die Lösungen aus Schritt 4 gelten weiterhin, insbesondere Level 7 mit Mogli bei `(400,370)` und Level 20 mit Magnet `(600,180)`. Keine Migration oder Kompatibilitätsschicht ergänzt.
- README, `docs/ARCHITECTURE.md`, `docs/GADGETS.md` und das im Spiel angezeigte Physikhandbuch beschreiben den endgültigen Vertrag, Erweiterungspunkte und die fachlichen Grenzen.

Tatsächlich ausgeführte Abschlussprüfungen:

- Sechs neue Prüfungen in `tests/presentation.test.mjs`: eingefrorene Kerzendaten bleiben unverändert; unabhängige Katzen-/Mausanimationen; Feuerzeichnung bei beliebigen Kollisionslabels; Zahnradphase nach Trennung; unabhängige Scherengriffe; expliziter versetzter Lastseilanker. Die Ziel-DSL-Tests weisen Schema 1, alte Zielmodi und `systems` zurück. Alte Tests wurden direkt auf den endgültigen Vertrag umgestellt; der unbenutzte feste Katzen-/Maus-Präsentationspfad wurde entfernt.
- `node --experimental-strip-types --test tests/*.test.mjs`: 217 bestanden, 0 fehlgeschlagen, einschließlich bestehender Engine-, Editor-, Mechanik- und Level-Lösungsprüfungen. Ausgabe: `outputs/step-5-tests.log`.
- `node node_modules/typescript/bin/tsc -p tsconfig.next.json --noEmit --incremental false`: erfolgreich. Ausgabe: `outputs/step-5-typescript.log` (ohne Diagnostik).
- `node node_modules/next/dist/bin/next build`: erfolgreich, einschließlich TypeScript und statischer Seitenerzeugung. Ausgabe: `outputs/step-5-build.log`.
- Manuelle Browserprüfung über die reguläre Spiel-/Editoroberfläche: Level 7 nach Verschieben Moglis gewonnen, zuletzt nochmals im fertigen Produktionsbuild (`outputs/step-5-level7-production.jpg`). Im Editor geladene Mehrinstanzszene zeigt getrennte Tierzustände, nur die tatsächlich entzündete Rakete und getrennte angetriebene/ruhende Zahnräder (`outputs/step-5-multi.jpg`). Steuerseil verbunden, entfernt und erneut verbunden; nur die gezogene Schere schließt (`outputs/step-5-rope.jpg`). Lastseil mit Anker `(420,140)` und zwei tragenden Strängen aufgebaut und gestartet; Gewicht steigt (`outputs/step-5-load-anchor.jpg`, `outputs/step-5-load-running.jpg`). Freien Fisch im neuen Editorlevel platziert, Undo/Redo und JSON geprüft, anschließend mit gültigem Ziel im Spiel gestartet.
- Browserdiagnostik ohne JavaScript-Fehler. Matter.js meldet den bestehenden Hinweis, dass Zeitschritte höchstens 16,667 ms empfohlen sind; die bisherige Canvas-Begrenzung auf 32 ms wurde in dieser Stufe nicht geändert.
- `git diff --check`: keine Fehler. Kein Commit, Push oder Deployment.

Abschluss und verbleibende Grenzen:

Alle fünf Refactoring-Schritte sind abgeschlossen; es ist kein weiterer Übergabechat nötig. Lastseile bleiben eine ausdrücklich konfigurierte einzelne Route, Beziehungen werden über Leveldaten konfiguriert, und neue Gadget-Arten werden beim Simulationsaufbau aktiviert. Eine beliebige Seilnetz-Engine, eine allgemeine Ablauf-UI oder das Hinzufügen neuer Arten während laufender Simulation waren nicht Teil dieser Folge.

Die gesamte automatisierte Suite enthält weiterhin den HTML-Test gegen ein bereits vorhandenes `dist`-Artefakt. Der erfolgreiche neue Next-Produktionsbuild und die Level-7-Prüfung im Browser prüfen die aktuelle Anwendung; ein neuer Worker-/Deployment-Build wurde nicht ausgeführt. Nicht alle 34 Levels wurden manuell durchgespielt. Ein echter Ordnerauswahl-/Dateiexportablauf wurde nicht manuell geprüft; der Browsernachweis für Editorlevel verwendet JSON-Übernahme und „Im Spiel testen“.
