export type GoalMode="all"|"any"|"none"|"survive";
export type GoalCondition={signal:string;operator:"occurred"|"not_occurred"|"equals"|"gte";value?:string|number};
export type GoalSpec={mode:GoalMode;conditions:GoalCondition[];durationMs?:number};

export const LEVEL_GOALS:GoalSpec[]=[
  {mode:"all",conditions:[{signal:"cat.entered.exit",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"balloon.popped",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"balloon.passed.target_ring",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"bowling_ball.entered.basket",operator:"occurred"}]},
  {mode:"all",conditions:[{signal:"weight.height",operator:"gte",value:230}]},
  {mode:"all",conditions:[{signal:"blind.open",operator:"occurred"},{signal:"monkey.wheel.rotating",operator:"occurred"},{signal:"crate.entered.exit",operator:"occurred"}]},
];

export const GOAL_MODES=[
  {mode:"ALL",meaning:"Alle Bedingungen müssen erfüllt sein",example:"Alle Luftballons sind geplatzt"},
  {mode:"ANY",meaning:"Mindestens eine Bedingung genügt",example:"Katze erreicht einen von mehreren Ausgängen"},
  {mode:"NONE",meaning:"Keines der verbotenen Ereignisse darf eintreten",example:"Kugel verlässt den Bildschirm weder links noch rechts"},
  {mode:"SURVIVE",meaning:"Bedingungen bleiben für eine Zeitspanne gültig",example:"Maschine läuft zehn Sekunden, ohne dass ein Ball verloren geht"},
] as const;

export const FORCE_SOURCES=[
  {gadget:"Mausrad",kind:"Drehmoment",direction:"Drehbewegung",rule:"Nur solange die Maus läuft; über Riemen oder Kette übertragbar"},
  {gadget:"Affenfahrrad",kind:"Drehmoment",direction:"Drehbewegung am stationären Rad",rule:"Startet, sobald die geöffnete Jalousie die Banane sichtbar macht"},
  {gadget:"Luftballon",kind:"Auftrieb",direction:"Nach oben",rule:"Abhängig von Tragkraft und angehängter Masse"},
  {gadget:"Bowlingkugel",kind:"Gewichtskraft",direction:"Nach unten",rule:"Schwerkraft wirkt entsprechend der Masse"},
  {gadget:"Laufband",kind:"Kontaktkraft",direction:"Links oder rechts",rule:"Wirkt auf alle Körper mit Kontakt zur Bandoberfläche"},
  {gadget:"Ventilator",kind:"Strömungskraft",direction:"Entlang des Luftkegels",rule:"Nimmt mit Entfernung ab; endet spätestens bei doppelter Sichtweite"},
  {gadget:"Trampolin",kind:"Stoßimpuls",direction:"Von der Fläche weg, überwiegend nach oben",rule:"Lenkt eintreffende Bewegung um"},
] as const;
