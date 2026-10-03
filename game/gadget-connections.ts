import type { GadgetConnection, GadgetInstanceConfig } from "../engine/types.ts";
import { instancePorts, portKey, type InstancePort } from "../engine/gadget-ports.ts";
import { type Point } from "./control-ropes.ts";
export type GadgetPort = InstancePort & {kind:"power"|"socket"|"drive"};
export function gadgetPortKey(port: GadgetPort): string { return portKey(port); }
export function gadgetPorts(configs: readonly GadgetInstanceConfig[]): GadgetPort[] {
  return instancePorts(configs).filter((port):port is GadgetPort=>port.kind==="power"||port.kind==="socket"||port.kind==="drive");
}

export function connectionPorts(connection: GadgetConnection, ports: readonly GadgetPort[]): GadgetPort[] {
  const source = ports.find(port => port.gadgetId === connection.sourceId && port.kind === (connection.kind === "wire" ? "power" : "drive") && port.portId === connection.sourcePortId);
  const target = ports.find(port => port.gadgetId === connection.targetId && port.kind === (connection.kind === "wire" ? "socket" : "drive") && port.portId === connection.targetPortId);
  return source && target ? [source, target] : [];
}

export function sameConnection(a: GadgetConnection, b: GadgetConnection): boolean {
  if (a.kind !== b.kind) return false;
  const key = (id: string, portId: string) => portKey({gadgetId:id,portId});
  const source = key(a.sourceId, a.sourcePortId), target = key(a.targetId, a.targetPortId);
  return (source === key(b.sourceId, b.sourcePortId) && target === key(b.targetId, b.targetPortId)) || (source === key(b.targetId, b.targetPortId) && target === key(b.sourceId, b.sourcePortId));
}

export function connectPorts(a: GadgetPort, b: GadgetPort, kind: GadgetConnection["kind"], connections: readonly GadgetConnection[], id: string): GadgetConnection | null {
  if (a.gadgetId === b.gadgetId) return null;
  if (kind === "wire" && !((a.kind === "power" && b.kind === "socket") || (b.kind === "power" && a.kind === "socket"))) return null;
  if (kind === "belt" && (a.kind !== "drive" || b.kind !== "drive")) return null;
  const [source,target] = kind === "wire" && b.kind === "power" ? [b,a] : [a,b];
  const connection: GadgetConnection = { id, kind, sourceId:source.gadgetId, targetId:target.gadgetId, sourcePortId:source.portId, targetPortId:target.portId };
  if (connections.some(existing => sameConnection(existing, connection))) return null;
  return connection;
}

export function validateConnections(connections: readonly GadgetConnection[], configs: readonly GadgetInstanceConfig[]): void {
  const ports = gadgetPorts(configs), ids = new Set<string>();
  for (const connection of connections) {
    if (!connection || typeof connection.id !== "string" || !connection.id.trim() || ids.has(connection.id)) throw new Error("Connection needs a unique id");
    if (connection.kind !== "wire" && connection.kind !== "belt") throw new Error("Unknown connection kind");
    if (typeof connection.sourcePortId !== "string" || !connection.sourcePortId.trim() || typeof connection.targetPortId !== "string" || !connection.targetPortId.trim()) throw new Error(`Invalid connection port: ${connection.id}`);
    const [source, target] = connectionPorts(connection, ports);
    if (!source || !target || !connectPorts(source, target, connection.kind, [], connection.id)) throw new Error(`Invalid connection: ${connection.id}`);
    if (connections.some(other => other !== connection && sameConnection(other, connection))) throw new Error(`Duplicate connection: ${connection.id}`);
    ids.add(connection.id);
  }
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
