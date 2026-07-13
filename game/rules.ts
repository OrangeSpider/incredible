export type GoalMode="all"|"any"|"none"|"survive";
export type GoalCondition={signal:string;operator:"occurred"|"not_occurred"|"equals"|"gte";value?:string|number};
export type GoalSpec={mode:GoalMode;conditions:GoalCondition[];durationMs?:number};

export const LEVEL_GOALS:GoalSpec[]=[
  {mode:"all",conditions:[{signal:"cat.entered.exit",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"balloon.popped",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"balloon.passed.target_ring",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"bowling_ball.entered.basket",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"weight.height",operator:"gte",value:330}]},
  {mode:"all",conditions:[{signal:"balloon.popped_by_needle",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"mouse.entered.hole",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"target_gear.rotating",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"cannonball.hit.target",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"candle.extinguished_by_water",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"seesaw_payload.entered.basket",operator:"occurred"}]},
];

export const GOAL_MODES=[
  {mode:"ALL",meaning:"Alle Bedingungen müssen erfüllt sein",example:"Alle Luftballons sind geplatzt"},
  {mode:"ANY",meaning:"Mindestens eine Bedingung genügt",example:"Katze erreicht einen von mehreren Ausgängen"},
  {mode:"NONE",meaning:"Keines der verbotenen Ereignisse darf eintreten",example:"Kugel verlässt den Bildschirm weder links noch rechts"},
  {mode:"SURVIVE",meaning:"Bedingungen bleiben für eine Zeitspanne gültig",example:"Maschine läuft zehn Sekunden, ohne dass ein Ball verloren geht"},
] as const;

export const FORCE_SOURCES=[
  {gadget:"Hamsterrad",kind:"Drehmoment",direction:"Drehbewegung",rule:"Nur solange das Rad läuft; über Riemen oder Kette übertragbar"},
  {gadget:"Affenfahrrad",kind:"Drehmoment",direction:"Drehbewegung am stationären Rad",rule:"Startet, sobald die geöffnete Jalousie die Banane sichtbar macht"},
  {gadget:"Luftballon",kind:"Auftrieb",direction:"Nach oben",rule:"Abhängig von Tragkraft und angehängter Masse"},
  {gadget:"Bowlingkugel",kind:"Gewichtskraft",direction:"Nach unten",rule:"Schwerkraft wirkt entsprechend der Masse"},
  {gadget:"Laufband",kind:"Kontaktkraft",direction:"Links oder rechts",rule:"Wirkt auf alle Körper mit Kontakt zur Bandoberfläche"},
  {gadget:"Ventilator",kind:"Strömungskraft",direction:"Entlang des Luftkegels",rule:"Nimmt mit Entfernung ab; endet spätestens bei doppelter Sichtweite"},
  {gadget:"Trampolin",kind:"Stoßimpuls",direction:"Von der Fläche weg, überwiegend nach oben",rule:"Lenkt eintreffende Bewegung um"},
  {gadget:"Wippe",kind:"Hebelübertragung",direction:"Getroffene Seite abwärts, Gegenseite aufwärts",rule:"Erzeugt keine Energie; sie überträgt Impuls und Drehmoment um ihren festen Drehpunkt"},
  {gadget:"Festrolle",kind:"Kraftumlenkung",direction:"Entlang beider Seilenden",rule:"Die Achse bleibt fest; die Rolle ändert nur Richtung und Verlauf der Seilkraft"},
  {gadget:"Lose Rolle / Flaschenzug",kind:"Gekoppelte Bewegung",direction:"Achse und Last bewegen sich gemeinsam",rule:"Jeder tragende Seilabschnitt zieht am beweglichen Block; gemeinsame Seillänge koppelt Zugweg und Hub"},
  {gadget:"Kanone",kind:"Explosionsimpuls",direction:"Entlang des Kanonenrohrs",rule:"Wird nach vollständig abgebrannter Lunte einmalig freigesetzt"},
  {gadget:"Wassereimer",kind:"Gewicht und Schwall",direction:"Schwerkraft und Eimeröffnung",rule:"Kippt um sein Scharnier; Wasserteilchen verlassen die offene Seite"},
  {gadget:"Wasser",kind:"Partikelströmung",direction:"Schwerkraft, Kollision und Gefälle",rule:"Fließt um feste Formen, verteilt sich am Boden und sammelt sich in offenen Behältern"},
] as const;
