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
  { source: "Bowlingkugel", target: "Mausrad", trigger: "Kollision", effect: "Mausrad und verbundenes Laufband starten", status: "aktiv" },
  { source: "Mausrad", target: "Laufband", trigger: "Antriebsriemen ist gespannt", effect: "Überträgt Drehung; ohne Riemen bleibt das Band stehen", status: "aktiv" },
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
  { source: "Seil", target: "Rolle / Gewicht", trigger: "An beiden Enden verbunden", effect: "Überträgt Zugkraft entlang des Seilverlaufs – auch seitlich; Rollen lenken sie um", status: "aktiv" },
  { source: "Bowlingkugel", target: "Trampolin", trigger: "Kollision von oben", effect: "Bewegungsimpuls wird von der Fläche weg nach oben umgelenkt", status: "aktiv" },
  { source: "Jalousie", target: "Stationäre Affe auf Fahrrad", trigger: "Zugseil wird betätigt und Banane wird sichtbar", effect: "Affe tritt; das Fahrrad erzeugt Drehmoment, bleibt aber am Ort", status: "aktiv" },
  { source: "Affenfahrrad", target: "Laufband", trigger: "Rad und Laufband sind mit einem Riemen verbunden", effect: "Überträgt Drehmoment als lineare Bandbewegung", status: "aktiv" },
  { source: "Laufband", target: "Kiste", trigger: "Kiste berührt das angetriebene Band", effect: "Bewegt die Kiste in Bandrichtung", status: "aktiv" },
  { source: "Kerzenflamme", target: "Lunte", trigger: "Direkter Kontakt", effect: "Startet einen fortschreitenden Abbrand entlang verbundener Luntenteile", status: "aktiv" },
  { source: "Lunte", target: "Kanone", trigger: "Abbrand erreicht den Zündkanal", effect: "Kanone feuert nach ihrer Zündverzögerung genau eine Kanonenkugel", status: "aktiv" },
  { source: "Kanone", target: "Kanonenkugel", trigger: "Zündung", effect: "Erzeugt eine kleinere, leichtere Kugel mit Impuls entlang des Rohrs", status: "aktiv" },
  { source: "Wasser", target: "Kerze / Lunte", trigger: "Ausreichende Wassermenge", effect: "Löscht die Flamme", status: "geplant" },
  { source: "Wasser", target: "Eimer / Behälter", trigger: "Teilchen gelangen in Innenraum", effect: "Füllstand und Gewicht steigen", status: "geplant" },
  { source: "Wasser", target: "Holz / Kork / Boot", trigger: "Eintauchen", effect: "Auftrieb entsprechend verdrängtem Volumen", status: "geplant" },
  { source: "Lava", target: "Holz / Lunte", trigger: "Kontakt", effect: "Entzündet brennbares Material", status: "geplant" },
  { source: "Wasser", target: "Lava", trigger: "Kontakt beider Fluide", effect: "Wasser verdampft, Lava erstarrt zu einem Körper", status: "geplant" },
  { source: "Explosion", target: "Bewegliche Körper", trigger: "Lunte abgebrannt", effect: "Radialer Impuls; Stärke nimmt mit Entfernung ab", status: "geplant" },
];
