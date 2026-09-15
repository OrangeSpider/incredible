import { CATAPULT_PLATFORM } from "@/game/catapult";
import { CHARACTERS } from "@/game/characters";
import { LEVEL_FIVE_TARGET_Y, type PulleyRouteAnalysis, type PulleyRouteKind } from "@/game/pulley";
import type { LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import type { RopeNode } from "./types";

type SpriteDrawer = (row: number, frame: number, x: number, y: number, width: number, height: number, rotation?: number) => boolean;
type Point = Readonly<{ x: number; y: number }>;

/** Read-only render data. Scene presentation cannot step physics or change gadget state. */
export type ScenePresentationFrame = {
  ctx: CanvasRenderingContext2D;
  now: number;
  running: boolean;
  level: Pick<LevelDefinition, "buildTip">;
  sprites: {
    fire: SpriteDrawer;
    water: SpriteDrawer;
    fallbackFlame: (x: number, y: number, now: number, scale?: number) => void;
  };
  status: {
    beltConnected: boolean;
    motor: boolean;
    balloonPopped: boolean;
    mouseFleeing: boolean;
    gearsConnected: boolean;
    fuseIgnited: boolean;
    fuseExtinguished: boolean;
    fuseReady: boolean;
    candleExtinguished: boolean;
    bucketPlaced: boolean;
    seesawPlaced: boolean;
    catStartled: boolean;
    catImpactMode: "none" | "launch" | "drop";
    catOnPlatform: boolean;
    fishBowlBroken: boolean;
    fishVisible: boolean;
    fishChasing: boolean;
    rocketLaunched: number;
    rocketIgnited: number;
    candleFallen: boolean;
    singleScissorClosed: boolean;
    gateOpen: boolean;
    magnetRunning: boolean;
    cannonFired: boolean;
  };
  pulley: {
    anchor: Point;
    path: readonly RopeNode[];
    typeForPlacedId: (id: number) => PlaceableGadgetType | undefined;
    positionForPlacedId: (id: number) => Point | undefined;
    kindForPart: (type: PlaceableGadgetType) => PulleyRouteKind | null;
    moving: readonly Point[];
    weight: Point | null;
    analysis: PulleyRouteAnalysis;
  };
  scissors: {
    balloons: readonly Point[];
    closedAt: readonly number[];
    connections: readonly { scissorIndex: number; pull: Point }[];
  };
};

type Hint = { text: string; x: number; y: number };
type ScenePresentation = {
  decorate?: (frame: ScenePresentationFrame) => void;
  hints?: (frame: ScenePresentationFrame) => readonly Hint[];
};

const hint = (text: string, x: number, y = 32): Hint => ({ text, x, y });

function drawFreeRope(ctx: CanvasRenderingContext2D, points: { x: number; y: number; kind: PulleyRouteKind }[], now: number, running: boolean) {
  if (!points.length) return;
  const wobble = running ? Math.sin(now * .012) * 1.5 : 0, radius = 30;
  ctx.save(); ctx.strokeStyle = "#6b4930"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    if (index < points.length - 1 && (point.kind === "fixed" || point.kind === "moving")) {
      const previous = points[index - 1], next = points[index + 1], entry = Math.atan2(previous.y - point.y, previous.x - point.x), exit = Math.atan2(next.y - point.y, next.x - point.x), cross = (previous.x - point.x) * (next.y - point.y) - (previous.y - point.y) * (next.x - point.x);
      ctx.lineTo(point.x + Math.cos(entry) * radius, point.y + Math.sin(entry) * radius + wobble); ctx.arc(point.x, point.y, radius, entry, exit, cross > 0);
    } else ctx.lineTo(point.x, point.y + wobble);
  }
  ctx.stroke(); ctx.strokeStyle = "#b99362"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([]);
  const looseTail = (point: { x: number; y: number; kind: PulleyRouteKind }, side: number) => { if (point.kind === "anchor" || point.kind === "pull") return; ctx.strokeStyle = "#6b4930"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.quadraticCurveTo(point.x + side * 18, point.y + 18, point.x + side * 8, point.y + 38); ctx.stroke(); };
  looseTail(points[0], -1); looseTail(points.at(-1)!, 1); ctx.restore();
}

const presentations = {
  "corner-cable": {
    hints: () => [hint("Fallende Kugel → Rolle → Scherengriff", 285)],
  },
  "double-redirect": {
    hints: () => [hint("Zug über zwei Rollen – die Falltür gibt die Kugel frei", 235)],
  },
  "balloon-doorman": {
    hints: () => [hint("Ballon steigt → Seil zieht → Falltür öffnet", 275)],
  },
  "rope-relay": {
    hints: () => [hint("Wippe → Seil → Falltür → Kugel → Seil → Schere", 235)],
  },
  "first-impulse": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#183f49"; ctx.fillRect(780, 345, 105, 135); ctx.fillStyle = "#eac97a"; ctx.font = "bold 16px Georgia"; ctx.fillText("AUSGANG", 790, 375); ctx.fillText("→", 820, 420); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.beltConnected ? "Es fehlt die Verbindung zum Laufband" : status.motor ? "Riemen überträgt den Antrieb" : "Triff das Hamsterrad mit einer Kugel", 330, 260)],
  },
  "balloon-candle": {
    decorate: ({ ctx, now, sprites }: ScenePresentationFrame) => { ctx.fillStyle = "#7b4c24"; ctx.fillRect(770, 135, 72, 10); ctx.fillStyle = "#f1cb62"; ctx.fillRect(793, 75, 24, 64); if (!sprites.fire(0, Math.floor(now / 105) % 6, 805, 51, 82, 90)) sprites.fallbackFlame(805, 58, now, 1.05); },
    hints: ({ status }: ScenePresentationFrame) => status.balloonPopped ? [] : [hint("Lenke den Ballon mit den Planken zur Flamme", 275)],
  },
  tailwind: {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.strokeStyle = "#c73b2e"; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(780, 150, 45, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#f1c351"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(780, 150, 45, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#5d371e"; ctx.font = "bold 14px system-ui"; ctx.fillText("ZIELRING", 744, 218); },
    hints: () => [hint("Richte den Ventilator aus und triff den Zielring", 275)],
  },
  "spring-force": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.strokeStyle = "#7a421e"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(715, 145); ctx.lineTo(720, 210); ctx.quadraticCurveTo(760, 235, 805, 210); ctx.lineTo(808, 145); ctx.stroke(); ctx.fillStyle = "#a52d24"; ctx.font = "bold 14px system-ui"; ctx.fillText("KORB", 742, 250); },
    hints: () => [hint("Lenke den Fall mit dem Trampolin in den Korb", 270)],
  },
  "block-and-tackle": {
    decorate: ({ ctx, now, running, pulley }: ScenePresentationFrame) => {
      ctx.strokeStyle = "#bd3428"; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.beginPath(); ctx.moveTo(50, LEVEL_FIVE_TARGET_Y); ctx.lineTo(850, LEVEL_FIVE_TARGET_Y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#6b391e"; ctx.font = "bold 13px system-ui"; ctx.fillText("OBERKANTE BIS HIER", 654, LEVEL_FIVE_TARGET_Y - 15);
      ctx.fillStyle = "#4c5960"; ctx.fillRect(67, 22, 50, 12); ctx.strokeStyle = "#303b40"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(92, 34); ctx.lineTo(pulley.anchor.x, pulley.anchor.y); ctx.stroke(); ctx.fillStyle = "#d39a28"; ctx.beginPath(); ctx.arc(pulley.anchor.x, pulley.anchor.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#173f50"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#6b391e"; ctx.font = "bold 11px system-ui"; ctx.fillText("FESTPUNKT", 116, 67);
      const visualPoints = pulley.path.flatMap(node => { if (node.kind === "anchor") return [{ ...pulley.anchor, kind: "anchor" as const }]; const partType = pulley.typeForPlacedId(node.placedId), position = pulley.positionForPlacedId(node.placedId), kind = partType ? pulley.kindForPart(partType) : null; return position && kind ? [{ ...position, kind }] : []; });
      drawFreeRope(ctx, visualPoints, now, running);
      if (pulley.moving.length && pulley.weight) { ctx.save(); ctx.strokeStyle = "#4c5960"; ctx.lineWidth = 3; for (const wheel of pulley.moving) { const start = { x: wheel.x, y: wheel.y + 32 }, end = { x: pulley.weight.x, y: pulley.weight.y - 39 }, distance = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)), links = Math.max(2, Math.floor(distance / 13)); for (let link = 1; link < links; link++) { const t = link / links, x = start.x + (end.x - start.x) * t, y = start.y + (end.y - start.y) * t; ctx.beginPath(); ctx.ellipse(x, y, 4, 7, Math.atan2(end.y - start.y, end.x - start.x), 0, Math.PI * 2); ctx.stroke(); } } ctx.restore(); }
      if (pulley.analysis.supportingStrands > 0) { ctx.fillStyle = "#173f50"; ctx.font = "bold 13px system-ui"; ctx.fillText(`${pulley.analysis.supportingStrands} mögliche tragende Seilabschnitte`, 36, 95); }
    },
    hints: ({ pulley }: ScenePresentationFrame) => [hint(!pulley.path.length ? "Wähle das Seil und klicke beliebige Anschlusspunkte" : pulley.analysis.tensioned ? "Seil gespannt – Verlauf, Massen und Schwerkraft bestimmen die Bewegung" : "Offenes Seil – der Aufbau darf trotzdem gestartet werden", 220)],
  },
  "needle-test": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#6b391e"; ctx.font = "bold 14px system-ui"; ctx.fillText("Die Nadel reagiert ausschließlich auf den Ballon.", 285, 32); },
    hints: ({ status }: ScenePresentationFrame) => status.balloonPopped ? [] : [hint("Lenke den Ballon in die platzierte Nadel", 300)],
  },
  "mouse-escape": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#173f50"; ctx.fillRect(820, 330, 65, 120); ctx.fillStyle = "#f1d28d"; ctx.font = "bold 13px system-ui"; ctx.fillText("MAUS-", 830, 365); ctx.fillText("LOCH", 834, 382); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.mouseFleeing ? "Katze und Maus müssen auf gleicher Höhe sein" : "Die Maus flieht – die Katze ist langsamer", 275)],
  },
  "gear-train": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#6b391e"; ctx.font = "bold 13px system-ui"; ctx.fillText("ANTRIEB", 220, 230); ctx.fillText("ZIELRAD", 565, 230); },
    hints: ({ status }: ScenePresentationFrame) => [hint(status.gearsConnected ? "Die Zahnradkette greift vollständig ineinander" : "Zwischen den Zahnrädern sind noch Lücken", 285)],
  },
  "fire-cannon": {
    decorate: ({ ctx, now, sprites }: ScenePresentationFrame) => { ctx.fillStyle = "#7b4c24"; ctx.fillRect(70, 440, 65, 10); ctx.fillStyle = "#f1cb62"; ctx.fillRect(91, 390, 22, 52); if (!sprites.fire(0, Math.floor(now / 105) % 6, 102, 366, 82, 90)) sprites.fallbackFlame(102, 374, now); ctx.strokeStyle = "#c73b2e"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(825, 230, 48, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#6b391e"; ctx.font = "bold 13px system-ui"; ctx.fillText("ZIEL", 808, 300); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.fuseIgnited ? "Kein Luntenteil berührt die Flamme" : status.fuseExtinguished ? "Die nasse Lunte ist erloschen" : !status.fuseReady ? "Die Flammenfronten breiten sich räumlich aus …" : "Die Kanonenlunte brennt zur Kanone …", 270)],
  },
  "water-march": {
    decorate: ({ ctx, now, sprites, status }: ScenePresentationFrame) => { ctx.fillStyle = "#7b4c24"; ctx.fillRect(770, 470, 70, 10); ctx.fillStyle = "#f1cb62"; ctx.fillRect(794, 390, 22, 80); if (!status.candleExtinguished) { if (!sprites.fire(0, Math.floor(now / 105) % 6, 805, 371, 82, 90)) sprites.fallbackFlame(805, 380, now); } else { ctx.fillStyle = "#8b9ba0"; for (let puff = 0; puff < 4; puff++) { ctx.globalAlpha = .55 - puff * .1; ctx.beginPath(); ctx.arc(802 + Math.sin(now * .004 + puff) * 8, 374 - puff * 9, 8 + puff * 2, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; sprites.water(1, 5, 805, 450, 76, 38); } ctx.fillStyle = "#6b391e"; ctx.font = "bold 12px system-ui"; ctx.fillText("KERZE", 785, 505); },
    hints: ({ status }: ScenePresentationFrame) => [hint(status.candleExtinguished ? "Die Kerze ist gelöscht!" : !status.bucketPlaced ? "Platziere den Wassereimer" : "Leite den Schwall um Stahl, Holz und Stein zur Kerze", 250)],
  },
  "lever-effect": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.strokeStyle = "#7a421e"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(635, 105); ctx.lineTo(640, 165); ctx.quadraticCurveTo(680, 190, 725, 165); ctx.lineTo(728, 105); ctx.stroke(); ctx.fillStyle = "#a52d24"; ctx.font = "bold 14px system-ui"; ctx.fillText("ZIELKORB", 646, 210); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.seesawPlaced ? "Platziere die Wippe unter der roten Kugel" : "Lass die Bowlingkugel auf das andere Ende fallen", 270)],
  },
  "cat-jump": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#6b391e"; ctx.font = "bold 13px system-ui"; ctx.fillText("OBERE EBENE", 560, CATAPULT_PLATFORM.y - 24); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.catStartled ? "Triff die freie linke Seite der Wippe" : status.catImpactMode === "drop" ? "Die Katzenseite sinkt – die Katze fällt nach unten" : !status.catOnPlatform ? "Die Katze erschrickt und fliegt zur oberen Ebene" : "Die Katze verfolgt die Maus", 275)],
  },
  "mr-blue-rescue": {
    decorate: ({ ctx }: ScenePresentationFrame) => { ctx.fillStyle = "#173f50"; ctx.font = "bold 13px system-ui"; ctx.fillText(CHARACTERS.cat.toUpperCase(), 92, 395); ctx.fillText(CHARACTERS.fish.toUpperCase(), 662, 325); },
    hints: ({ status }: ScenePresentationFrame) => [hint(!status.fishBowlBroken ? `Lass einen Körper auf ${CHARACTERS.fish}s Glas fallen` : !status.fishVisible ? "Das Glas zerbricht …" : !status.fishChasing ? `${CHARACTERS.fish} zappelt – kann ${CHARACTERS.cat} ihn sehen?` : `${CHARACTERS.cat} läuft zu ${CHARACTERS.fish}`, 260)],
  },
  "snip-snap": {
    hints: ({ scissors }: ScenePresentationFrame) => { const closed = scissors.closedAt.filter(Boolean).length; return [hint(closed === 3 ? "Alle Ballons sind frei – jetzt müssen sie oben hinaus!" : `${closed} von 3 Scheren geschlossen`, 340)]; },
  },
  "rocket-parade": {
    hints: ({ status }: ScenePresentationFrame) => {
      const { beltConnected, motor, rocketLaunched, rocketIgnited, candleFallen } = status;
      return [hint(!beltConnected ? "Verbinde Louis und das Laufband mit dem Antriebsriemen" : !motor ? "Fange die Kerze auf und lenke sie über Louis" : rocketLaunched === 4 ? "Vier Raketen sind gestartet!" : rocketIgnited ? `${rocketLaunched} gestartet · ${rocketIgnited - rocketLaunched} zünden · Kerze fährt weiter` : "Louis läuft – bringe die Kerzenflamme unter die vier Düsen", 220), ...(candleFallen ? [hint("Die Kerze ist heruntergefallen – versuche eine andere Plankenführung.", 230, 58)] : [])];
    },
  },
  "water-guard": {
    decorate: ({ctx,now,sprites,status}:ScenePresentationFrame) => {
      ctx.strokeStyle="#c73b2e";ctx.lineWidth=9;ctx.beginPath();ctx.arc(750,145,45,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle="#f5ca64";ctx.lineWidth=3;ctx.beginPath();ctx.arc(750,145,45+Math.sin(now/250)*2,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle="#7b4c24";ctx.fillRect(773,470,65,9);ctx.fillStyle="#f1cb62";ctx.fillRect(793,390,24,80);
      if(!status.candleExtinguished){if(!sprites.fire(0,Math.floor(now/105)%6,805,371,82,90))sprites.fallbackFlame(805,380,now)}
      else{ctx.fillStyle="rgba(140,158,160,.55)";for(let puff=0;puff<3;puff++){ctx.beginPath();ctx.arc(801+Math.sin(now/300+puff)*7,370-puff*12,7+puff*3,0,Math.PI*2);ctx.fill()}}
      ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("ERST LÖSCHEN",747,515);ctx.fillText("DANN FLIEGEN",708,207);
    },
    hints:({status}:ScenePresentationFrame)=>[hint(!status.bucketPlaced?"Setze Eimer und Planken für den Löschweg":!status.candleExtinguished?"Wasser zur Kerze, Luftstrom zum Ballon":"Flamme aus! Lenke den Ballon in den Ring",275)],
  },
  "air-mail": {
    decorate:({ctx,now,status}:ScenePresentationFrame)=>{
      ctx.strokeStyle="#c73b2e";ctx.lineWidth=9;ctx.beginPath();ctx.arc(620,12,45,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle="#f4c64e";ctx.lineWidth=3;ctx.beginPath();ctx.arc(620,12,45+Math.sin(now/220)*2,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=status.singleScissorClosed?"#aa8966":"#6b4930";ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(620,142);ctx.lineTo(620,status.singleScissorClosed?170:310);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("VON OBEN TREFFEN",556,400);
    },
    hints:({status}:ScenePresentationFrame)=>[hint(status.singleScissorClosed?"Schere geschlossen – der Ballon steigt zum Ring":"Drehe das Trampolin so, dass der Tennisball auf der Schere landet",240)],
  },
  "magnet-arc": {
    decorate:({ctx,now,sprites}:ScenePresentationFrame)=>{
      ctx.fillStyle="#7b4c24";ctx.fillRect(70,440,65,10);ctx.fillStyle="#f1cb62";ctx.fillRect(91,390,22,52);
      if(!sprites.fire(0,Math.floor(now/105)%6,102,366,82,90))sprites.fallbackFlame(102,374,now);
      ctx.strokeStyle="#c73b2e";ctx.lineWidth=9;ctx.beginPath();ctx.arc(820,245,48,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("MAGNETISCHER UMWEG",570,73);
    },
    hints:({status}:ScenePresentationFrame)=>[hint(!status.fuseIgnited?"Verbinde Kerze und Kanone mit der Lunte":!status.cannonFired?"Die Lunte brennt – Magnet über die Mauer setzen":status.magnetRunning?"Das Magnetfeld krümmt die Flugbahn":"Der Schuss ist unterwegs",250)],
  },
  "two-balls-one-gate": {
    decorate:({ctx,now,status}:ScenePresentationFrame)=>{
      ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(538,406);ctx.lineTo(542,459);ctx.quadraticCurveTo(600,478,658,459);ctx.lineTo(662,406);ctx.stroke();
      ctx.fillStyle="#a52d24";ctx.font="bold 12px system-ui";ctx.fillText("ZIELKORB",567,506);
      ctx.fillStyle="#6b391e";ctx.fillText("AUSLÖSER",625,310);
      if(status.gateOpen){ctx.strokeStyle="rgba(241,190,68,.7)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(600,320,31+Math.sin(now/130)*4,0,Math.PI*2);ctx.stroke()}
    },
    hints:({status}:ScenePresentationFrame)=>[hint(!status.seesawPlaced?"Platziere die Wippe zwischen die beiden fallenden Kugeln":!status.gateOpen?"Schwere Kugel links, Tennisball rechts – triff das Tor":"Tor offen! Die Bowlingkugel fällt in den Korb",250)],
  },
  "mogli-breakout": {
    decorate:({ctx,now,sprites,status}:ScenePresentationFrame)=>{
      ctx.fillStyle="#7b4c24";ctx.fillRect(70,440,65,10);ctx.fillStyle="#f1cb62";ctx.fillRect(91,390,22,52);
      if(!sprites.fire(0,Math.floor(now/105)%6,102,366,82,90))sprites.fallbackFlame(102,374,now);
      ctx.fillStyle="#173f50";ctx.fillRect(817,359,66,121);ctx.fillStyle="#f1d28d";ctx.font="bold 13px system-ui";ctx.fillText("MAUS-",826,392);ctx.fillText("LOCH",828,410);
      ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText(status.gateOpen?"FLUCHTWEG OFFEN":"TOR VERSCHLOSSEN",690,255);
    },
    hints:({status}:ScenePresentationFrame)=>[hint(!status.fuseIgnited?"Zünde die Kanone mit einer durchgehenden Lunte":!status.gateOpen?"Lenke die Kugel mit dem Magneten über die Mauer zum Tor":"Das Tor ist offen – Mogli kann entkommen",245)],
  },
} satisfies Record<string, ScenePresentation>;

export function presentationForScene(scene: string): ScenePresentation | undefined {
  return (presentations as Readonly<Record<string, ScenePresentation>>)[scene];
}

export function drawSceneHints(presentation: ScenePresentation | undefined, frame: ScenePresentationFrame): void {
  frame.ctx.fillStyle = "#4b2b17"; frame.ctx.font = "bold 15px system-ui";
  for (const line of presentation?.hints?.(frame) ?? [hint(frame.level.buildTip, 220)]) frame.ctx.fillText(line.text, line.x, line.y);
}
