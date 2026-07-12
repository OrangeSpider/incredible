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
  { source: "Katze", target: "Ausgang", trigger: "Betritt Zielbereich", effect: "Levelziel wird erfüllt", status: "aktiv" },
  { source: "Rampe", target: "Kugel / beweglicher Körper", trigger: "Kontakt", effect: "Lenkt Bewegung entsprechend ihrer Neigung um", status: "aktiv" },
  { source: "Schwerkraft", target: "Luftballon", trigger: "Simulation läuft", effect: "Auftrieb wirkt entgegen der Schwerkraft", status: "aktiv" },
  { source: "Holzplanke", target: "Luftballon", trigger: "Ballon berührt die Unterseite", effect: "Lenkt den aufsteigenden Ballon entlang ihrer Neigung", status: "aktiv" },
  { source: "Kerzenflamme", target: "Luftballon", trigger: "Berührung", effect: "Ballon platzt und das Levelziel ist erfüllt", status: "aktiv" },
  { source: "Ventilator", target: "Ballon / Segel / Flamme", trigger: "Objekt im Luftkegel", effect: "Luftkraft wirkt mit Entfernung und Abschattung", status: "geplant" },
  { source: "Spitze / Nadel", target: "Luftballon", trigger: "Kollision oberhalb Mindesttempo", effect: "Ballon platzt; Seil und Last werden frei", status: "geplant" },
  { source: "Maus", target: "Katze", trigger: "Sichtlinie und Reichweite", effect: "Katze läuft auf die Maus zu", status: "geplant" },
  { source: "Zahnrad", target: "Zahnrad", trigger: "Zähne greifen ineinander", effect: "Überträgt Drehung mit umgekehrter Richtung", status: "geplant" },
  { source: "Seil", target: "Rolle / Gewicht", trigger: "An beiden Enden verbunden", effect: "Überträgt Zugkraft, aber keinen Druck", status: "geplant" },
  { source: "Kerzenflamme", target: "Lunte / Holz", trigger: "Wärmekontakt über Zeit", effect: "Entzündet brennbares Material", status: "geplant" },
  { source: "Wasser", target: "Kerze / Lunte", trigger: "Ausreichende Wassermenge", effect: "Löscht die Flamme", status: "geplant" },
  { source: "Wasser", target: "Eimer / Behälter", trigger: "Teilchen gelangen in Innenraum", effect: "Füllstand und Gewicht steigen", status: "geplant" },
  { source: "Wasser", target: "Holz / Kork / Boot", trigger: "Eintauchen", effect: "Auftrieb entsprechend verdrängtem Volumen", status: "geplant" },
  { source: "Lava", target: "Holz / Lunte", trigger: "Kontakt", effect: "Entzündet brennbares Material", status: "geplant" },
  { source: "Wasser", target: "Lava", trigger: "Kontakt beider Fluide", effect: "Wasser verdampft, Lava erstarrt zu einem Körper", status: "geplant" },
  { source: "Explosion", target: "Bewegliche Körper", trigger: "Lunte abgebrannt", effect: "Radialer Impuls; Stärke nimmt mit Entfernung ab", status: "geplant" },
];
