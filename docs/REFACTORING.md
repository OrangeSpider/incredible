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

Status: bereit; Schritt 1 abgeschlossen. Noch nicht begonnen.

- Lunten und Kanonen auf einen Ausführungspfad bringen. Mehrere Kanonen unabhängig verarbeiten; alle Geschosse bei der Engine registrieren.
- Danach überlappende Scheren-, Trampolin- und Wippenlogik bereinigen, sodass jede Wirkung genau einen Verantwortlichen hat.
- Harte Ausnahmen anhand einzelner Regel-IDs durch eine klare Zuordnung von räumlichen Mechaniken und deklarativen Regeln ersetzen.
- Levels und Tests direkt auf das neue Verhalten anpassen. Keine Umschaltung zwischen alter und neuer Mechanik als Kompatibilitätsfunktion erhalten.
- Abschluss: Mehrinstanzfälle, kombinierte Mechaniken, Zielselektoren für erzeugte Objekte und relevante Level-Lösungen geprüft.

## 3. Anschlussdefinitionen vereinheitlichen

Status: wartet auf Schritt 2.

- Anschlussfähigkeiten, lokale Positionen und vollständige Anschlussidentitäten zentral beschreiben.
- Basketball mit `rope-end` erhält einen Seilanschluss ohne zusätzliche Typenliste.
- Neue Anschlussnamen werden vollständig verglichen; Ports bleiben bei Rotation, Spiegelung und Größenänderungen korrekt.
- Stromleitung, Antriebsriemen und Steuerseil behalten ihre fachlich unterschiedlichen Regeln.
- Bestehende Levelverbindungen direkt mit eindeutigen Anschluss-IDs speichern; keine Normalisierung fehlender IDs zur Laufzeit.
- Abschluss: Anschlussaufbau, doppelte Verbindungen, mehrere Ports sowie Trennen und Wiederverbinden geprüft.

## 4. Gadget-Aktivierung und Instanzzuordnungen bereinigen

Status: wartet auf Schritt 3.

- Automatisch benötigte Mechaniken aus Gadget-Definitionen beziehen. Explizite Abläufe bleiben ausdrücklich in Leveldaten konfiguriert.
- Feste IDs, erste Instanz eines Typs und Szenenkoordinaten aus wiederverwendbaren Runtime-Systemen entfernen.
- Beziehungen zwischen Instanzen explizit speichern; Zustände pro Instanz oder System führen.
- Lichtparameter und aktive Gerätezustände fachlich beschreiben, unabhängig vom Renderernamen.
- Reaktionsangaben und Overrides auf einen klaren, tatsächlich umgesetzten Vertrag bringen.
- Abschluss: Umbenannte IDs, mehrere Instanzen, freie Editorlevels und Antriebsverlust einschließlich Zahnradtrennung geprüft.

## 5. Darstellung, Datenformat und Abschlussprüfung

Status: wartet auf Schritt 4.

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
