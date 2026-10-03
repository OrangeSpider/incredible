import Matter from "matter-js";
import { bodyPoint } from "../engine/gadget-geometry.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { machinePlugin } from "../engine/body-factory.ts";
import type { GadgetConnection, LevelDefinition, PlaceableGadgetType } from "../engine/types.ts";
import { MachineRuntime } from "./machine-runtime.ts";
import { FuseNetwork } from "./fuse.ts";
import { analyzePulleyRoute, LEVEL_FIVE_INITIAL_WEIGHT_Y, ropeGeometry, type PulleyRouteKind, type RopePoint } from "./pulley.ts";
import { placedConfigId, type PlacedGadget, type RopeNode } from "./simulation-types.ts";
import type { ControlRope } from "./control-ropes.ts";
export const ROPE_ANCHOR = { x: 92, y: 64 };
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
export function createSimulation({ level, placed = [], connections, controlRopes = [], ropePath = [], running, onWin }: SimulationSetupOptions) {
  const hasSystem = (system: string) => level.systems.includes(system);
  const machine = new MachinePhysicsEngine(level);
  machine.connections = structuredClone([...(connections ?? level.connections ?? [])]);
  const engine = machine.matter;
  const W = 900;
  const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label: "floor" });
  if (level.floor !== false)
    Matter.Composite.add(engine.world, floor);
  const levelBall = machine.body("falling-ball");
  const weight = machine.body("weight");
  let seesawBody: Matter.Body | null = machine.bodiesByType("seesaw")[0] ?? null;
  const fishBowl = machine.body("fish-bowl");
  const fishBody = machine.body("mr-blue");
  const tetheredBalloonConfigs = level.fixedGadgets.filter(gadget => gadget.type === "balloon" && gadget.state === "tethered");
  const scissorBalloons = tetheredBalloonConfigs.flatMap(gadget => { const body = machine.body(gadget.id); return body ? [body] : []; });
  for (const p of placed) {
    const physics = p.type === "movingPulley" || (p.type === "ball" && level.systems.includes("pulley-rope"))
      ? { isStatic: true }
      : p.type === "mouse" ? { isStatic: !running } : undefined;
    const body = machine.addGadget({
      id: placedConfigId(p), type: p.type, x: p.x, y: p.y, rotation: p.rotation,
      flipX: p.flipX, flipY: p.flipY, collisionLabel: p.collisionLabel ?? p.type,
      physics: { ...physics, ...p.physics }, properties: p.properties,
      role: p.role, tags: p.tags, state: p.state,
    });
    if (p.type === "seesaw")
      seesawBody = body;
    if (body)
      body.plugin = { ...body.plugin, placedId: p.id };
  }
  const cat = machine.bodiesByType("cat")[0] ?? null;
  const balloon = machine.bodiesByType("balloon").find(body => body.label === "levelBalloon") ?? null;
  const waterBodies = machine.bodiesByType("water");
  const bucketBody = machine.bodiesByType("bucket")[0] ?? null;
  const hamsterWheelBody = machine.bodiesByType("hamsterWheel")[0] ?? null;
  const conveyorBody = machine.bodiesByType("conveyor")[0] ?? null;
  const rocketBodies = machine.bodiesByType("rocket");
  const driveBelt = placed.find(p => p.type === "belt") ?? null;
  const wheelId = hamsterWheelBody && machinePlugin(hamsterWheelBody)?.instanceId, conveyorId = conveyorBody && machinePlugin(conveyorBody)?.instanceId;
  const beltConnected = !!driveBelt || machine.connections.some(connection => connection.kind === "belt" && ((connection.sourceId === wheelId && connection.targetId === conveyorId) || (connection.sourceId === conveyorId && connection.targetId === wheelId)));
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
  const ballNode = ropePath.find(node => node.kind === "part" && placedById.get(node.placedId)?.type === "ball");
  const placedBall = ballNode?.kind === "part" ? (bodyByPlacedId.get(ballNode.placedId) ?? null) : null;
  const initialWeightY = LEVEL_FIVE_INITIAL_WEIGHT_Y;
  const initialMovingPositions = routeMoving.map(body => ({ ...body.position }));
  if (hasSystem("pulley-rope") && weight && routeMoving.length) {
    const lowerCenterX = routeMoving.reduce((sum, body) => sum + body.position.x, 0) / routeMoving.length;
    Matter.Body.setPosition(weight, { x: lowerCenterX, y: initialWeightY });
  }
  const physicsPoints = (): RopePoint[] => ropePath.flatMap(node => {
    if (node.kind === "anchor") return [{ ...ROPE_ANCHOR, group: "static" as const }];
    const part = placedById.get(node.placedId), body = bodyByPlacedId.get(node.placedId);
    if (!part || !body) return [];
    return [{ x: body.position.x, y: body.position.y,
      group: part.type === "ball" ? "ball" as const : part.type === "movingPulley" ? "block" as const : "static" as const }];
  });
  const ropeReady = routeAnalysis.tensioned && !!placedBall;
  const restRopeLength = ropeGeometry(physicsPoints()).length;
  const initialBlockPosition = weight ? { ...weight.position } : { x: 760, y: initialWeightY };
  const mouseBody = Matter.Composite.allBodies(engine.world).find(body => body.label === "mouse") ?? null;
  const gearBodies = Matter.Composite.allBodies(engine.world).filter(body => ["gearSource", "gear", "gearTarget"].includes(body.label));
  const gearDepth = new Map<number, number>();
  const gearSource = gearBodies.find(body => body.label === "gearSource");
  if (gearSource) {
    gearDepth.set(gearSource.id, 0);
    const queue = [gearSource];
    while (queue.length) {
      const current = queue.shift()!;
      for (const candidate of gearBodies) {
        if (gearDepth.has(candidate.id))
          continue;
        const distance = Math.hypot(current.position.x - candidate.position.x, current.position.y - candidate.position.y);
        if (Math.abs(distance - 84) < 14) {
          gearDepth.set(candidate.id, (gearDepth.get(current.id) ?? 0) + 1);
          queue.push(candidate);
        }
      }
    }
  }
  const gearsConnected = gearBodies.some(body => body.label === "gearTarget" && gearDepth.has(body.id));
  const cannonBody = Matter.Composite.allBodies(engine.world).find(body => body.label === "cannon") ?? null, fuseBodies = Matter.Composite.allBodies(engine.world).filter(body => body.label === "fuse");
  const worldPoint = (body: Matter.Body, x: number, y: number) => bodyPoint(body, { x, y }), fuseId = (body: Matter.Body) => `fuse-${body.id}`, cannonFuseId = "cannon-fuse";
  // Preserve the existing single-cannon fuse preparation until step 2.
  const fuseNetwork = new FuseNetwork([
    ...fuseBodies.map(body => ({ id: fuseId(body), start: worldPoint(body, -55, 0),
      end: worldPoint(body, 55, 0), burnDurationMs: 1200 })),
    ...(cannonBody ? [{ id: cannonFuseId, start: worldPoint(cannonBody, -18, -42),
      end: worldPoint(cannonBody, -26, -17), burnDurationMs: 1300, samples: 14 }] : []),
  ], 22, 105);
  const runtime = new MachineRuntime({
    level, machine, running, onWin, beltConnected,
    bodies: {
      cat, balloon, levelBall, weight, bucket: bucketBody, seesaw: seesawBody,
      fishBowl, fish: fishBody, mouse: mouseBody, cannon: cannonBody,
      candle: machine.bodiesByType("candle").find(body => body.label === "candle") ?? null,
      hamsterWheel: hamsterWheelBody, conveyor: conveyorBody, water: waterBodies,
      scissorBalloons, rockets: rocketBodies,
    },
    scissorConnections: [],
    controlRopes,
    tetheredBalloonIds: tetheredBalloonConfigs.map(gadget => gadget.id),
    fuseNetwork, fuseId, cannonFuseId, gearsConnected,
    rope: {
      fixed: routeFixed, moving: routeMoving, placedBall, initialMovingPositions,
      initialBlockPosition, initialWeightY, ready: ropeReady, restLength: restRopeLength,
      physicsPoints,
    },
  });
  return { machine, runtime, gearDepth, placedById, bodyByPlacedId, routeAnalysis };
}
