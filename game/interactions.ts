export type InteractionStatus = "aktiv" | "geplant";

export type Interaction = {
  source: string;
  target: string;
  trigger: string;
  effect: string;
  status: InteractionStatus;
};

/**
 * Fachliche Wahrheit für Objektwechselwirkungen. Die Physik-Engine berechnet
 * Bewegung und Kollision; diese Tabelle beschreibt die Spielregeln darüber.
 */
export const INTERACTIONS: Interaction[] = [
  { source: "Bowlingkugel", target: "Hamsterrad", trigger: "Kollision", effect: "Hamsterrad und verbundenes Laufband starten", status: "aktiv" },
  { source: "Hamsterrad", target: "Laufband", trigger: "Antriebsriemen ist gespannt", effect: "Überträgt Drehung; ohne Riemen bleibt das Band stehen", status: "aktiv" },
  { source: "Laufband", target: "Katze", trigger: "Kontakt bei laufendem Band", effect: "Katze wird mit konstanter Geschwindigkeit transportiert", status: "aktiv" },
  { source: "Katze", target: "Ausgang", trigger: "Betritt Zielbereich", effect: "Erzeugt das Signal cat.entered.exit", status: "aktiv" },
  { source: "Rampe", target: "Kugel / beweglicher Körper", trigger: "Kontakt", effect: "Lenkt Bewegung entsprechend ihrer Neigung um", status: "aktiv" },
  { source: "Schwerkraft", target: "Luftballon", trigger: "Simulation läuft", effect: "Auftrieb wirkt entgegen der Schwerkraft", status: "aktiv" },
  { source: "Holzplanke", target: "Luftballon", trigger: "Ballon berührt die Unterseite", effect: "Lenkt den aufsteigenden Ballon entlang ihrer Neigung", status: "aktiv" },
  { source: "Kerzenflamme", target: "Luftballon", trigger: "Berührung", effect: "Setzt balloon.popped=true", status: "aktiv" },
  { source: "Ventilator", target: "Luftballon", trigger: "Ballon befindet sich im gerichteten Luftkegel", effect: "Luftkraft wirkt in Blasrichtung und nimmt mit Entfernung ab", status: "aktiv" },
  { source: "Luftballon", target: "Zielring", trigger: "Ballon durchquert den Ring", effect: "Erzeugt das Signal balloon.passed.target_ring", status: "aktiv" },
  { source: "Spitze / Nadel", target: "Luftballon", trigger: "Beliebige Berührung", effect: "Setzt ausschließlich balloon.popped=true; andere Körper bleiben unbeeinflusst", status: "aktiv" },
  { source: "Katze", target: "Maus", trigger: "Katze und Maus sind annähernd auf gleicher Höhe", effect: "Maus flieht von der Katze weg", status: "aktiv" },
  { source: "Zahnrad", target: "Zahnrad", trigger: "Zahnkränze berühren sich mit passendem Achsabstand", effect: "Überträgt Drehung mit umgekehrter Richtung", status: "aktiv" },
  { source: "Seil", target: "Festrolle", trigger: "Seil liegt in der Rollenrille", effect: "Die fest montierte Achse bleibt stehen; nur Seil und Rolle laufen und lenken die Zugkraft um", status: "aktiv" },
  { source: "Seil", target: "Lose Rolle / Gewicht", trigger: "Seil umschlingt die lose Rolle", effect: "Rollenachse und angehängte Last bewegen sich gemeinsam; alle tragenden Seilabschnitte liefern ihre Zugkraft", status: "aktiv" },
  { source: "Offenes Seilende", target: "Beliebiger Aufbau", trigger: "Mindestens ein Seilende ist nicht an Festpunkt oder Zugkörper gebunden", effect: "Das Seil bleibt schlaff und kann keine Druck- oder Zwangskraft übertragen; die übrigen Körper bewegen sich trotzdem", status: "aktiv" },
  { source: "Bowlingkugel", target: "Trampolin", trigger: "Kollision von oben", effect: "Bewegungsimpuls wird von der Fläche weg nach oben umgelenkt", status: "aktiv" },
  { source: "Fallender Körper", target: "Wippe", trigger: "Aufprall außerhalb des Drehpunkts", effect: "Senkt die getroffene Seite und beschleunigt die gegenüberliegende Seite nach oben", status: "aktiv" },
  { source: "Wippe", target: "Katze", trigger: "Bowlingkugel trifft die freie Gegenseite", effect: "Katze erschrickt und wird auf die obere Ebene katapultiert", status: "aktiv" },
  { source: "Katze", target: "Maus", trigger: "Katze landet auf der Ebene der wartenden Maus", effect: "Katze wechselt in den Laufzyklus; Maus flieht zum Loch", status: "aktiv" },
  { source: "Fallender Körper", target: "Goldfischglas", trigger: "Aufprall von oben mit ausreichender Geschwindigkeit", effect: "Glas zerbricht und gibt Mr. Blue als beweglichen Körper frei", status: "aktiv" },
  { source: "Mr. Blue", target: "Joanne", trigger: "Mr. Blue zappelt sichtbar vor Joanne auf ungefähr gleicher Höhe", effect: "Joanne wechselt in den Laufzyklus und läuft zu Mr. Blue", status: "aktiv" },
  { source: "Fallende Kugel / Tennisball", target: "Offene Schere", trigger: "Aufprall von oben mit ausreichender Geschwindigkeit", effect: "Schließt die Schere und durchtrennt das Ballonseil", status: "aktiv" },
  { source: "Gespanntes Zugseil", target: "Scherengriff", trigger: "Ein verbundener Körper bewegt sich vom Griff weg und spannt das Seil", effect: "Zieht den Griff zu, schließt die Schere und durchtrennt das Ballonseil", status: "aktiv" },
  { source: "Geschlossene Schere", target: "Angebundener Luftballon", trigger: "Das eigene Ballonseil wurde durchtrennt", effect: "Gibt den Ballon frei; sein Auftrieb trägt ihn über den oberen Bildschirmrand", status: "aktiv" },
  { source: "Jalousie", target: "Stationäre Affe auf Fahrrad", trigger: "Zugseil wird betätigt und Banane wird sichtbar", effect: "Affe tritt; das Fahrrad erzeugt Drehmoment, bleibt aber am Ort", status: "aktiv" },
  { source: "Affenfahrrad", target: "Laufband", trigger: "Rad und Laufband sind mit einem Riemen verbunden", effect: "Überträgt Drehmoment als lineare Bandbewegung", status: "aktiv" },
  { source: "Laufband", target: "Kiste", trigger: "Kiste berührt das angetriebene Band", effect: "Bewegt die Kiste in Bandrichtung", status: "aktiv" },
  { source: "Kerzenflamme", target: "Lunte", trigger: "Direkter Kontakt", effect: "Startet einen fortschreitenden Abbrand entlang verbundener Luntenteile", status: "aktiv" },
  { source: "Lunte", target: "Kanone", trigger: "Abbrand erreicht den Zündkanal", effect: "Kanone feuert nach ihrer Zündverzögerung genau eine Kanonenkugel", status: "aktiv" },
  { source: "Kanone", target: "Kanonenkugel", trigger: "Zündung", effect: "Erzeugt eine kleinere, leichtere Kugel mit Impuls entlang des Rohrs", status: "aktiv" },
  { source: "Wasser", target: "Hamsterrad / Ventilator / Trampolin / Wippe / Kanone / Kugel / Laufband / Rampe", trigger: "Kontakt mit fester Außenkontur", effect: "Wird physikalisch umgelenkt und fließt außen herum", status: "aktiv" },
  { source: "Wasser", target: "Luftballon", trigger: "Kontakt mit der beweglichen Ballonhülle", effect: "Teilt sich an der Kontur und fließt außen herum, während der Ballon beweglich bleibt", status: "aktiv" },
  { source: "Wasser", target: "Seil", trigger: "Kreuzung des Seilverlaufs", effect: "Keine Kollision; Wasser ignoriert das Seil", status: "aktiv" },
  { source: "Wasser", target: "Katze / Maus", trigger: "Wasser kommt in die Fluchtzone", effect: "Tier bewegt sich vom nächsten Wasserteilchen weg", status: "aktiv" },
  { source: "Wasser", target: "Kerze / Lunte", trigger: "Direkter Kontakt", effect: "Löscht die Kerze oder stoppt den Abbrand an der nassen Lunte", status: "aktiv" },
  { source: "Wasser", target: "Eimer / Behälter", trigger: "Teilchen gelangen in den offenen Innenraum", effect: "Wasser sammelt sich innerhalb der festen Behälterwände", status: "aktiv" },
  { source: "Wasser", target: "Boden", trigger: "Aufprall und Schwerkraft", effect: "Erzeugt einen Spritzer und verteilt sich entlang des Bodens", status: "aktiv" },
  { source: "Wasser", target: "Stahlträger / Holzwand / Steinmauer", trigger: "Kollision mit Levelgeometrie", effect: "Fließt um die feste Form oder staut sich davor", status: "aktiv" },
  { source: "Wasser", target: "Holz / Kork / Boot", trigger: "Eintauchen", effect: "Auftrieb entsprechend verdrängtem Volumen", status: "geplant" },
  { source: "Lava", target: "Holz / Lunte", trigger: "Kontakt", effect: "Entzündet brennbares Material", status: "geplant" },
  { source: "Wasser", target: "Lava", trigger: "Kontakt beider Fluide", effect: "Wasser verdampft, Lava erstarrt zu einem Körper", status: "geplant" },
  { source: "Explosion", target: "Bewegliche Körper", trigger: "Lunte abgebrannt", effect: "Radialer Impuls; Stärke nimmt mit Entfernung ab", status: "geplant" },
];
