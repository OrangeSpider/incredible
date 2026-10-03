import {validateLevelRelations} from "./level-relations.ts";
import { validateConnections } from "./gadget-connections.ts";
import Matter from "matter-js";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { machinePlugin } from "../engine/body-factory.ts";
import type { GadgetConnection, LevelDefinition, PlaceableGadgetType } from "../engine/types.ts";
import { MachineRuntime } from "./machine-runtime.ts";
import { analyzePulleyRoute, ropeGeometry, type PulleyRouteKind, type RopePoint } from "./pulley.ts";
import { placedConfigId, type PlacedGadget, type RopeNode } from "./simulation-types.ts";
import type { ControlRope } from "./control-ropes.ts";

export function routeKindForPart(type: PlaceableGadgetType): PulleyRouteKind | null {
  if (type === "movingPulley")
    return "moving";
  if (type === "pulley")
    return "fixed";
  if (type === "ball")
    return "pull";
  return null;
}
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
  const uniqueBody = (type: PlaceableGadgetType) => { const bodies=machine.bodiesByType(type); return bodies.length===1?bodies[0]:null; };
  const machine = new MachinePhysicsEngine(level);
  machine.connections = structuredClone([...(connections ?? level.connections ?? [])]);
  const engine = machine.matter;
  const W = 900;
  const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label: "floor" });
  if (level.floor !== false)
    Matter.Composite.add(engine.world, floor);
  const levelBall = uniqueBody("ball");
  const tetheredBalloonConfigs = level.fixedGadgets.filter(gadget => gadget.type === "balloon" && gadget.state === "tethered");
  const scissorBalloons = tetheredBalloonConfigs.flatMap(gadget => { const body = machine.body(gadget.id); return body ? [body] : []; });
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
  // Singular bodies are view summaries only; mechanisms always resolve their own IDs.
  const cat=uniqueBody("cat"),balloon=uniqueBody("balloon"),seesawBody=uniqueBody("seesaw"),fishBowl=uniqueBody("fishBowl"),fishBody=uniqueBody("fish"),mouseBody=uniqueBody("mouse"),cannonBody=uniqueBody("cannon");
  const waterBodies=machine.bodiesByType("water"),bucketBody=uniqueBody("bucket"),hamsterWheelBody=uniqueBody("hamsterWheel"),conveyorBody=uniqueBody("conveyor"),rocketBodies=machine.bodiesByType("rocket");
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
  const gearBodies=machine.entities().filter(entity=>entity.tags.includes("gear")).flatMap(entity=>machine.body(entity.id)??[]);
  const gearDepth=new Map<number,number>();
  const queue=gearBodies.filter(body=>machine.state(machinePlugin(body)!.instanceId)?.type==="gearSource");
  for (const body of queue) gearDepth.set(body.id,0);
  while (queue.length) {
    const current=queue.shift()!;
    for (const candidate of gearBodies) {
      if (gearDepth.has(candidate.id)) continue;
      const distance=Math.hypot(current.position.x-candidate.position.x,current.position.y-candidate.position.y);
      if (distance>=70&&distance<=98) {gearDepth.set(candidate.id,(gearDepth.get(current.id)??0)+1);queue.push(candidate);}
    }
  }
  const gearsConnected=gearBodies.some(body=>machine.state(machinePlugin(body)!.instanceId)?.type==="gearTarget"&&gearDepth.has(body.id));
  const runtime = new MachineRuntime({
    level, machine, running, onWin,
    bodies: {
      cat, balloon, levelBall, weight, bucket: bucketBody, seesaw: seesawBody,
      fishBowl, fish: fishBody, mouse: mouseBody, cannon: cannonBody,
      candle: uniqueBody("candle"),
      hamsterWheel: hamsterWheelBody, conveyor: conveyorBody, water: waterBodies,
      scissorBalloons, rockets: rocketBodies,
    },
    controlRopes,
    gearsConnected,
    rope: {
      fixed: routeFixed, moving: routeMoving, placedBall, initialMovingPositions,
      initialBlockPosition, initialWeightY, ready: ropeReady, restLength: restRopeLength,
      physicsPoints,
    },
  });
  return { machine, runtime, gearDepth, placedById, bodyByPlacedId, routeAnalysis };
}
