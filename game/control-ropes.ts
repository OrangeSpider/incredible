import { instancePorts, localPort, portKey } from "../engine/gadget-ports.ts";
import type { GadgetInstanceConfig, ControlRopeConfig, PortReference } from "../engine/types.ts";
import type { MachinePhysicsEngine } from "../engine/physics-engine.ts";

import { bodyPoint } from "../engine/gadget-geometry.ts";

export type Point = { x: number; y: number };
export type RopeAttachment = PortReference;
export type ControlRope = ControlRopeConfig;
export type PendingControlRope = Omit<ControlRope,"source">;
export type RopePort = RopeAttachment & Point & { local: Point; kind: "target" | "guide" | "source"; label: string };
export function controlRopeKey(rope:Pick<ControlRope,"targetId"|"targetPortId">):string { return portKey({gadgetId:rope.targetId,portId:rope.targetPortId}); }
export const HANDLE_TRAVEL = 12;
export const ROPE_SLACK = 3;

export function attachmentPoint(position: Point, angle: number, local: Point): Point {
  return { x: position.x + local.x * Math.cos(angle) - local.y * Math.sin(angle), y: position.y + local.x * Math.sin(angle) + local.y * Math.cos(angle) };
}

/** Shared local definitions drive hit testing, drawing and simulation. */
export function ropePorts(gadgets: readonly GadgetInstanceConfig[]): RopePort[] {
  return instancePorts(gadgets).filter((port):port is RopePort=>port.kind==="target"||port.kind==="guide"||port.kind==="source");
}
export function ropeConfigPoints(rope:ControlRope, configs:readonly GadgetInstanceConfig[]):Point[] {
  const ports=ropePorts(configs);
  const refs=[{gadgetId:rope.targetId,portId:rope.targetPortId},...rope.guides,rope.source];
  const selected=refs.map(ref=>ports.find(port=>port.gadgetId===ref.gadgetId&&port.portId===ref.portId));
  return selected.every(port=>port)?selected.map(port=>({x:port!.x,y:port!.y})):[];
}

export function advanceRopeDraft(pending: PendingControlRope | null, port: RopePort, ropes: readonly ControlRope[], limit: number): { pending: PendingControlRope | null; connection?: ControlRope } {
  if (port.kind === "target") {
    if (ropes.length >= limit || ropes.some(rope => rope.targetId === port.gadgetId && rope.targetPortId === port.portId)) return { pending };
    return { pending: { targetId: port.gadgetId, targetPortId:port.portId, guides: [] } };
  }
  if (!pending) return { pending };
  if (port.kind === "guide") return { pending: pending.guides.some(guide=>guide.gadgetId===port.gadgetId&&guide.portId===port.portId) ? pending : { ...pending, guides: [...pending.guides, {gadgetId:port.gadgetId,portId:port.portId}] } };
  return { pending: null, connection: { ...pending, source: { gadgetId: port.gadgetId, portId:port.portId } } };
}

export function ropeUsesGadget(rope: ControlRope, id: string) {
  return rope.targetId === id || rope.source.gadgetId === id || rope.guides.some(guide=>guide.gadgetId===id);
}

export function validateControlRopes(ropes: readonly ControlRope[], configs: readonly GadgetInstanceConfig[]): void {
  const ports = ropePorts(configs), targets = new Set<string>();
  for (const rope of ropes) {
    if (!rope || !rope.targetId || !rope.targetPortId || !Array.isArray(rope.guides) || !rope.source?.gadgetId || !rope.source.portId) throw new Error("Invalid control rope ports");
    const targetKey = controlRopeKey(rope);
    if (!ports.some(port => port.gadgetId === rope.targetId && port.portId === rope.targetPortId && port.kind === "target") || targets.has(targetKey)) throw new Error(`Invalid or duplicate rope target: ${rope.targetId}`);
    if (!ports.some(port => port.gadgetId === rope.source.gadgetId && port.portId === rope.source.portId && port.kind === "source")) throw new Error("Invalid control rope ports: source");
    const guides = new Set<string>();
    for (const guide of rope.guides) {
      if (!guide || !ports.some(port => port.gadgetId === guide.gadgetId && port.portId === guide.portId && port.kind === "guide") || guides.has(portKey(guide))) throw new Error("Invalid rope guides");
      guides.add(portKey(guide));
    }
    targets.add(targetKey);
  }
}

function pathLength(points: readonly Point[]) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

export function ropePathBlocked(points: readonly Point[], polygons: readonly (readonly Point[])[]): boolean {
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return points.slice(1).some((end, i) => polygons.some(vertices => vertices.some((a, j) => {
    const b = vertices[(j + 1) % vertices.length], start = points[i];
    return cross(start, end, a) * cross(start, end, b) < 0 && cross(a, b, start) * cross(a, b, end) < 0;
  })));
}

export type ControlRopeState = { definition: ControlRope; restLength: number; progress: number; triggered: boolean; blocked: boolean; points: Point[] };

/** A control cable pays out the handle travel, then releases its latch. It cannot push. */
export class ControlRopeMechanism {
  readonly ropes: ControlRopeState[];
  constructor(privateMachine: MachinePhysicsEngine, definitions: readonly ControlRope[]) {
    this.machine = privateMachine;
    validateControlRopes(definitions, privateMachine.entities().map(entity => privateMachine.config(entity.id)!));
    this.ropes = definitions.flatMap(definition => {
      const points = this.points(definition);
      if(!points) throw new Error("Invalid control rope ports");
      return [{ definition, points, restLength: pathLength(points) + ROPE_SLACK, progress: 0, triggered: false, blocked: this.blocked(points) }];
    });
  }
  private readonly machine: MachinePhysicsEngine;

  private blocked(points: Point[]) {
    const walls = [...this.machine.bodiesByType("stoneWall"), ...this.machine.bodiesByType("woodWall"), ...this.machine.bodiesByType("steelBeam")];
    return ropePathBlocked(points, walls.map(body => body.vertices));
  }

  points(definition: ControlRope): Point[] | null {
    const refs=[{gadgetId:definition.targetId,portId:definition.targetPortId,kind:"target" as const},...definition.guides.map(guide=>({...guide,kind:"guide" as const})),{...definition.source,kind:"source" as const}];
    const points=refs.map(ref=>{
      const config=this.machine.config(ref.gadgetId),body=this.machine.body(ref.gadgetId);
      const port=config&&localPort(config,ref.portId,ref.kind);
      return body&&port?bodyPoint(body,port.local):null;
    });
    return points.every(point=>point)?points as Point[]:null;
  }

  step(trigger: (targetId: string) => void) {
    for (const rope of this.ropes) {
      const points = this.points(rope.definition);
      if (!points) continue;
      rope.points = points;
      if (rope.triggered) continue;
      rope.blocked = this.blocked(points);
      if (rope.blocked) { rope.progress = 0; const state=this.machine.state(rope.definition.targetId);if(state)state.properties.handleProgress=0; continue; }
      const state = this.machine.state(rope.definition.targetId);
      if ((state?.type === "scissor" && state.state === "closed") || (state?.type === "snapGate" && state.state === "open")) { rope.triggered = true; continue; }
      rope.progress = Math.max(0, Math.min(1, (pathLength(points) - rope.restLength) / HANDLE_TRAVEL));
      if (state) state.properties.handleProgress = rope.progress;
      if (rope.progress >= 1) {
        rope.triggered = true;
        trigger(rope.definition.targetId);
        this.machine.setSignal(`rope.pulled.${rope.definition.targetId}`);
      }
    }
  }
}
