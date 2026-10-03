import type { PlacedGadget, RopeNode } from "../../game/simulation-types.ts";
import { routeKindForPart } from "../../game/pulley.ts";
import { type PulleyRouteAnalysis, type PulleyRouteKind } from "../../game/pulley.ts";
import type Matter from "matter-js";
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

export function drawLoadRope(ctx: CanvasRenderingContext2D, now: number, running: boolean, anchor: {x:number;y:number}, path: readonly RopeNode[], placed: ReadonlyMap<number,PlacedGadget>, bodies: ReadonlyMap<number,Matter.Body>, moving: readonly Matter.Body[], weight: Matter.Body|null, analysis: PulleyRouteAnalysis) {
  const pulley = { anchor, path, analysis, moving: moving.map(body=>body.position), weight: weight?.position,
    typeForPlacedId: (id:number)=>placed.get(id)?.type,
    positionForPlacedId: (id:number)=>bodies.get(id)?.position, kindForPart:routeKindForPart };
      ctx.fillStyle = "#4c5960"; ctx.fillRect(pulley.anchor.x-25, pulley.anchor.y-42, 50, 12); ctx.strokeStyle = "#303b40"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(pulley.anchor.x, pulley.anchor.y-30); ctx.lineTo(pulley.anchor.x, pulley.anchor.y); ctx.stroke(); ctx.fillStyle = "#d39a28"; ctx.beginPath(); ctx.arc(pulley.anchor.x, pulley.anchor.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#173f50"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#6b391e"; ctx.font = "bold 11px system-ui"; ctx.fillText("FESTPUNKT", pulley.anchor.x+24, pulley.anchor.y+3);
      const visualPoints = pulley.path.flatMap(node => { if (node.kind === "anchor") return [{ ...pulley.anchor, kind: "anchor" as const }]; const partType = pulley.typeForPlacedId(node.placedId), position = pulley.positionForPlacedId(node.placedId), kind = partType ? pulley.kindForPart(partType) : null; return position && kind ? [{ ...position, kind }] : []; });
      drawFreeRope(ctx, visualPoints, now, running);
      if (pulley.moving.length && pulley.weight) { ctx.save(); ctx.strokeStyle = "#4c5960"; ctx.lineWidth = 3; for (const wheel of pulley.moving) { const start = { x: wheel.x, y: wheel.y + 32 }, end = { x: pulley.weight.x, y: pulley.weight.y - 39 }, distance = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)), links = Math.max(2, Math.floor(distance / 13)); for (let link = 1; link < links; link++) { const t = link / links, x = start.x + (end.x - start.x) * t, y = start.y + (end.y - start.y) * t; ctx.beginPath(); ctx.ellipse(x, y, 4, 7, Math.atan2(end.y - start.y, end.x - start.x), 0, Math.PI * 2); ctx.stroke(); } } ctx.restore(); }
      if (pulley.analysis.supportingStrands > 0) { ctx.fillStyle = "#173f50"; ctx.font = "bold 13px system-ui"; ctx.fillText(`${pulley.analysis.supportingStrands} mögliche tragende Seilabschnitte`, 36, 95); }

}

export function drawLoadRopePorts(ctx:CanvasRenderingContext2D,anchor:{x:number;y:number},placed:readonly PlacedGadget[],ropePath:readonly RopeNode[]) {
const selectedParts=new Map<number,number>();ropePath.forEach((node,index)=>{if(node.kind==="part")selectedParts.set(node.placedId,index)});const anchorOrder=ropePath.findIndex(node=>node.kind==="anchor"),drawPort=(x:number,y:number,order?:number,label?:string)=>{ctx.save();ctx.fillStyle=order!==undefined&&order>=0?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();if(order!==undefined&&order>=0){ctx.fillStyle="#173f50";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(String(order+1),x,y+4)}if(label){ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="left";ctx.fillText(label,x+28,y+4)}ctx.restore()};drawPort(anchor.x,anchor.y,anchorOrder>=0?anchorOrder:undefined);for(const part of placed){const kind=routeKindForPart(part.type);if(!kind)continue;drawPort(part.x,part.y,selectedParts.get(part.id),part.type==="pulley"?"FEST":part.type==="movingPulley"?"LOSE":"KUGEL")}
}
