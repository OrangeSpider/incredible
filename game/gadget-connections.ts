import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import type { GadgetConnection, GadgetInstanceConfig } from "../engine/types.ts";
import { attachmentPoint, type Point } from "./control-ropes.ts";

export type GadgetPort = Point & { gadgetId: string; kind: "power" | "socket" | "drive"; label: string };

export function gadgetPorts(configs: readonly GadgetInstanceConfig[]): GadgetPort[] {
  return configs.flatMap(config => {
    const definition = GADGET_CATALOG[config.type], supply = definition.electrical?.supply;
    const ports: GadgetPort[] = [];
    if (supply === "generator" || supply === "socket") ports.push({
      ...attachmentPoint(config, config.rotation ?? 0, { x: 36, y: 20 }),
      gadgetId: config.id, kind: supply === "generator" ? "power" : "socket", label: supply === "generator" ? "STROM" : "STECKDOSE",
    });
    if (definition.tags.includes("belt-port") || definition.tags.includes("gear")) ports.push({
      ...attachmentPoint(config, config.rotation ?? 0, config.type === "conveyor" ? { x: -(config.physics?.width ?? 270) / 2 + 16, y: 0 } : { x: 0, y: 0 }),
      gadgetId: config.id, kind: "drive", label: "ANTRIEB",
    });
    return ports;
  });
}

export function connectPorts(a: GadgetPort, b: GadgetPort, kind: GadgetConnection["kind"], connections: readonly GadgetConnection[], id: string): GadgetConnection | null {
  if (a.gadgetId === b.gadgetId) return null;
  if (kind === "wire" && !((a.kind === "power" && b.kind === "socket") || (b.kind === "power" && a.kind === "socket"))) return null;
  if (kind === "belt" && (a.kind !== "drive" || b.kind !== "drive")) return null;
  const sourceId = b.kind === "power" ? b.gadgetId : a.gadgetId;
  const targetId = b.kind === "power" ? a.gadgetId : b.gadgetId;
  if (connections.some(connection => connection.kind === kind && ((connection.sourceId === sourceId && connection.targetId === targetId) || (connection.sourceId === targetId && connection.targetId === sourceId)))) return null;
  return { id, kind, sourceId, targetId };
}

export function distanceToPath(point: Point, points: readonly Point[]): number {
  let distance = Infinity;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return distance;
}
