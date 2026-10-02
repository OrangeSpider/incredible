import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import type { GadgetConnection, GadgetInstanceConfig } from "../engine/types.ts";
import { type Point } from "./control-ropes.ts";

import { localPoint } from "../engine/gadget-geometry.ts";
import { conveyorWheelCenters, GENERATOR_DRIVE_CENTER } from "./drive.ts";

export type GadgetPort = Point & { gadgetId: string; portId: string; kind: "power" | "socket" | "drive"; label: string; radius?: number };

export function gadgetPortKey(port: GadgetPort): string { return `${port.gadgetId}:${port.portId}`; }

export function gadgetPorts(configs: readonly GadgetInstanceConfig[]): GadgetPort[] {
  return configs.flatMap(config => {
    const definition = GADGET_CATALOG[config.type], supply = definition.electrical?.supply;
    const ports: GadgetPort[] = [];
    if (supply === "generator" || supply === "socket") ports.push({
      ...localPoint(config, { x: 36, y: 20 }),
      gadgetId: config.id, portId: supply === "generator" ? "power" : "socket", kind: supply === "generator" ? "power" : "socket", label: supply === "generator" ? "STROM" : "STECKDOSE",
    });
    if (definition.tags.includes("belt-port") || definition.tags.includes("gear")) {
      const wheels = config.type === "conveyor"
        ? conveyorWheelCenters(0, 0, config.physics?.width ?? definition.physics.width ?? 270).map((point, index) => ({ ...point, portId: index ? "right" : "left", radius: 22 }))
        : [{ ...(config.type === "hamsterWheel" ? { x: 55, y: 13 } : config.type === "generator" ? GENERATOR_DRIVE_CENTER : { x: 0, y: 0 }), portId: "drive", radius: config.type === "hamsterWheel" ? 18 : config.type === "generator" ? 21 : 12 }];
      for (const wheel of wheels) ports.push({ ...localPoint(config, wheel), gadgetId: config.id, portId: wheel.portId, radius: wheel.radius, kind: "drive", label: "ANTRIEB" });
    }
    return ports;
  });
}

/** Missing port IDs in older levels select the first compatible port (the left conveyor wheel). */
export function connectionPorts(connection: GadgetConnection, ports: readonly GadgetPort[]): GadgetPort[] {
  const source = ports.find(port => port.gadgetId === connection.sourceId && port.kind === (connection.kind === "wire" ? "power" : "drive") && (connection.sourcePortId === undefined || port.portId === connection.sourcePortId));
  const target = ports.find(port => port.gadgetId === connection.targetId && port.kind === (connection.kind === "wire" ? "socket" : "drive") && (connection.targetPortId === undefined || port.portId === connection.targetPortId));
  return source && target ? [source, target] : [];
}

export function sameConnection(a: GadgetConnection, b: GadgetConnection): boolean {
  if (a.kind !== b.kind) return false;
  const key = (id: string, portId?: string) => `${id}:${portId === "right" ? "right" : "default"}`;
  const source = key(a.sourceId, a.sourcePortId), target = key(a.targetId, a.targetPortId);
  return (source === key(b.sourceId, b.sourcePortId) && target === key(b.targetId, b.targetPortId)) || (source === key(b.targetId, b.targetPortId) && target === key(b.sourceId, b.sourcePortId));
}

export function connectPorts(a: GadgetPort, b: GadgetPort, kind: GadgetConnection["kind"], connections: readonly GadgetConnection[], id: string): GadgetConnection | null {
  if (a.gadgetId === b.gadgetId) return null;
  if (kind === "wire" && !((a.kind === "power" && b.kind === "socket") || (b.kind === "power" && a.kind === "socket"))) return null;
  if (kind === "belt" && (a.kind !== "drive" || b.kind !== "drive")) return null;
  const sourceId = b.kind === "power" ? b.gadgetId : a.gadgetId;
  const targetId = b.kind === "power" ? a.gadgetId : b.gadgetId;
  const connection: GadgetConnection = { id, kind, sourceId, targetId, ...(kind === "belt" ? { sourcePortId: a.portId, targetPortId: b.portId } : {}) };
  if (connections.some(existing => sameConnection(existing, connection))) return null;
  return connection;
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
