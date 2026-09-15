import type { GadgetInstanceConfig, GadgetType } from "../engine/types.ts";
import type { MachinePhysicsEngine } from "../engine/physics-engine.ts";

export type Point = { x: number; y: number };
export type RopeAttachment = { gadgetId: string; local: Point };
export type ControlRope = { targetId: string; guides: string[]; source: RopeAttachment };
export type PendingControlRope = { targetId: string; guides: string[] };
export type RopePort = RopeAttachment & Point & { kind: "target" | "guide" | "source"; label: string };
export const HANDLE_TRAVEL = 12;
export const ROPE_SLACK = 3;

export function attachmentPoint(position: Point, angle: number, local: Point): Point {
  return { x: position.x + local.x * Math.cos(angle) - local.y * Math.sin(angle), y: position.y + local.x * Math.sin(angle) + local.y * Math.cos(angle) };
}

export function handleOffset(type: GadgetType): Point {
  return type === "scissor" ? { x: 27, y: 27 } : { x: 16, y: 0 };
}

/** Shared by hit testing and drawing, including the two rotating lever ends. */
export function ropePorts(gadgets: readonly GadgetInstanceConfig[]): RopePort[] {
  return gadgets.flatMap(gadget => {
    const ports: Array<{ local: Point; kind: RopePort["kind"]; label: string }> = [];
    if (gadget.type === "scissor" || gadget.type === "snapGate") ports.push({ local: handleOffset(gadget.type), kind: "target", label: gadget.type === "scissor" ? "GRIFF" : "RIEGEL" });
    else if (gadget.type === "pulley") ports.push({ local: { x: 0, y: 0 }, kind: "guide", label: "ROLLE" });
    else if (gadget.type === "seesaw") {
      const end = Number(gadget.physics?.width ?? 232.5) / 2 - 12;
      for (const side of [-1, 1]) ports.push({ local: { x: side * end, y: 0 }, kind: "source", label: side < 0 ? "LINKES ENDE" : "RECHTES ENDE" });
    } else if (["ball", "tennisBall", "weight", "balloon", "payloadBall"].includes(gadget.type)) ports.push({ local: { x: 0, y: gadget.type === "balloon" ? 27 : 0 }, kind: "source", label: "ZUGPUNKT" });
    return ports.map(port => ({ ...port, gadgetId: gadget.id, ...attachmentPoint(gadget, gadget.rotation ?? 0, port.local) }));
  });
}

export function advanceRopeDraft(pending: PendingControlRope | null, port: RopePort, ropes: readonly ControlRope[], limit: number): { pending: PendingControlRope | null; connection?: ControlRope } {
  if (port.kind === "target") {
    if (ropes.length >= limit || ropes.some(rope => rope.targetId === port.gadgetId)) return { pending };
    return { pending: { targetId: port.gadgetId, guides: [] } };
  }
  if (!pending) return { pending };
  if (port.kind === "guide") return { pending: pending.guides.includes(port.gadgetId) ? pending : { ...pending, guides: [...pending.guides, port.gadgetId] } };
  return { pending: null, connection: { ...pending, source: { gadgetId: port.gadgetId, local: { ...port.local } } } };
}

export function ropeUsesGadget(rope: ControlRope, id: string) {
  return rope.targetId === id || rope.source.gadgetId === id || rope.guides.includes(id);
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
    this.ropes = definitions.flatMap(definition => {
      const points = this.points(definition);
      return points ? [{ definition, points, restLength: pathLength(points) + ROPE_SLACK, progress: 0, triggered: false, blocked: this.blocked(points) }] : [];
    });
  }
  private readonly machine: MachinePhysicsEngine;

  private blocked(points: Point[]) {
    const walls = [...this.machine.bodiesByType("stoneWall"), ...this.machine.bodiesByType("woodWall"), ...this.machine.bodiesByType("steelBeam")];
    return ropePathBlocked(points, walls.map(body => body.vertices));
  }

  points(definition: ControlRope): Point[] | null {
    const target = this.machine.body(definition.targetId), source = this.machine.body(definition.source.gadgetId);
    const type = this.machine.state(definition.targetId)?.type;
    if (!target || !source || !type) return null;
    const guides = definition.guides.map(id => this.machine.body(id));
    if (guides.some(body => !body)) return null;
    return [attachmentPoint(target.position, target.angle, handleOffset(type)), ...guides.map(body => ({ ...body!.position })), attachmentPoint(source.position, source.angle, definition.source.local)];
  }

  step(trigger: (targetId: string) => void) {
    for (const rope of this.ropes) {
      const points = this.points(rope.definition);
      if (!points) continue;
      rope.points = points;
      if (rope.triggered) continue;
      rope.blocked = this.blocked(points);
      if (rope.blocked) { rope.progress = 0; continue; }
      const state = this.machine.state(rope.definition.targetId);
      if ((state?.type === "scissor" && state.state === "closed") || (state?.type === "snapGate" && state.state === "open")) { rope.triggered = true; continue; }
      rope.progress = Math.max(0, Math.min(1, (pathLength(points) - rope.restLength) / HANDLE_TRAVEL));
      if (rope.progress >= 1) {
        rope.triggered = true;
        trigger(rope.definition.targetId);
        this.machine.setSignal(`rope.pulled.${rope.definition.targetId}`);
      }
    }
  }
}
