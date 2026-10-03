import {validateLevelRelations} from "./level-relations.ts";
import { validateConnections } from "./gadget-connections.ts";
import Matter from "matter-js";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import type { GadgetConnection, LevelDefinition } from "../engine/types.ts";
import { MachineRuntime } from "./machine-runtime.ts";
import { analyzePulleyRoute, ropeGeometry, routeKindForPart, type PulleyRouteKind, type RopePoint } from "./pulley.ts";
import { placedConfigId, type PlacedGadget, type RopeNode } from "./simulation-types.ts";
import type { ControlRope } from "./control-ropes.ts";

export type SimulationSetupOptions = {
  level: LevelDefinition;
  placed?: readonly PlacedGadget[];
  connections?: readonly GadgetConnection[];
  controlRopes?: readonly ControlRope[];
  ropePath?: readonly RopeNode[];
  running: boolean;
  onWin: () => void;
};
/** Shared world and runtime preparation; drawing and clocks belong to callers. */
export function createSimulation({ level, placed = [], connections, controlRopes = level.controlRopes ?? [], ropePath = [], running, onWin }: SimulationSetupOptions) {
  const anchor = level.loadRope?.anchor;
  const machine = new MachinePhysicsEngine(level);
  machine.connections = structuredClone([...(connections ?? level.connections ?? [])]);
  const engine = machine.matter;
  const W = 900;
  const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label: "floor" });
  if (level.floor !== false)
    Matter.Composite.add(engine.world, floor);
  for (const p of placed) {
    const physics = ["movingPulley","ball"].includes(p.type) && ropePath.some(node=>node.kind==="part"&&node.placedId===p.id) && !!level.loadRope
      ? { isStatic: true }
      : p.type === "mouse" ? { isStatic: !running } : undefined;
    const body = machine.addGadget({
      id: placedConfigId(p), type: p.type, x: p.x, y: p.y, rotation: p.rotation,
      flipX: p.flipX, flipY: p.flipY, collisionLabel: p.collisionLabel ?? p.type,
      physics: { ...physics, ...p.physics }, properties: p.properties,
      role: p.role, tags: p.tags, state: p.state,
    });
    if (body)
      body.plugin = { ...body.plugin, placedId: p.id };
  }
  const weight = level.loadRope ? machine.body(level.loadRope.weightId) : null;
  validateLevelRelations(level,machine.entities().map(entity=>machine.config(entity.id)!));
  validateConnections(machine.connections,machine.entities().map(entity=>machine.config(entity.id)!));
  const bodyByPlacedId = new Map<number, Matter.Body>();
  for (const body of Matter.Composite.allBodies(engine.world)) {
    const placedId = body.plugin?.placedId;
    if (typeof placedId === "number") bodyByPlacedId.set(placedId, body);
  }
  const placedById = new Map(placed.map(part => [part.id, part]));
  const routeKinds = ropePath.map(node => node.kind === "anchor" ? "anchor"
    : routeKindForPart(placedById.get(node.placedId)?.type ?? "rope"))
    .filter((kind): kind is PulleyRouteKind => kind !== null);
  const routeAnalysis = analyzePulleyRoute(routeKinds);
  const routeFixed = ropePath.flatMap(node => node.kind === "part" && placedById.get(node.placedId)?.type === "pulley"
    ? [bodyByPlacedId.get(node.placedId)].filter((body): body is Matter.Body => !!body) : []);
  const routeMoving = ropePath.flatMap(node => node.kind === "part" && placedById.get(node.placedId)?.type === "movingPulley"
    ? [bodyByPlacedId.get(node.placedId)].filter((body): body is Matter.Body => !!body) : []);
  const ballNodes = ropePath.filter(node => node.kind === "part" && placedById.get(node.placedId)?.type === "ball");
  if (ballNodes.length>1) throw new Error("Load rope requires one pulling body");
  const ballNode = ballNodes[0];
  const placedBall = ballNode?.kind === "part" ? (bodyByPlacedId.get(ballNode.placedId) ?? null) : null;
  const initialWeightY = weight?.position.y ?? 0;
  const initialMovingPositions = routeMoving.map(body => ({ ...body.position }));
  if (level.loadRope && weight && routeMoving.length) {
    const lowerCenterX = routeMoving.reduce((sum, body) => sum + body.position.x, 0) / routeMoving.length;
    Matter.Body.setPosition(weight, { x: lowerCenterX, y: initialWeightY });
  }
  const physicsPoints = (): RopePoint[] => ropePath.flatMap(node => {
    if (node.kind === "anchor") return anchor ? [{ ...anchor, group: "static" as const }] : [];
    const part = placedById.get(node.placedId), body = bodyByPlacedId.get(node.placedId);
    if (!part || !body) return [];
    return [{ x: body.position.x, y: body.position.y,
      group: part.type === "ball" ? "ball" as const : part.type === "movingPulley" ? "block" as const : "static" as const }];
  });
  const ropeReady = !!level.loadRope && routeAnalysis.tensioned && !!placedBall;
  const restRopeLength = ropeGeometry(physicsPoints()).length;
  const initialBlockPosition = weight ? { ...weight.position } : { x: 0, y: initialWeightY };
  const runtime = new MachineRuntime({
    level, machine, running, onWin,
    bodies: { weight, water: machine.bodiesByType("water") },
    controlRopes,
    rope: {
      fixed: routeFixed, moving: routeMoving, placedBall, initialMovingPositions,
      initialBlockPosition, initialWeightY, ready: ropeReady, restLength: restRopeLength,
      physicsPoints,
    },
  });
  return { machine, runtime, placedById, bodyByPlacedId, routeAnalysis };
}
