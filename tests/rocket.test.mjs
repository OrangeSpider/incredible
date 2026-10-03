import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { conveyorWheelCenters, driveBeltGeometry } from "../game/drive.ts";
import { nextRocketState, rocketVisual, ROCKET_IGNITION_MS, ROCKET_TOTAL_LAUNCH_MS } from "../game/rocket.ts";
import { resolveInteractions } from "../engine/interaction-rules.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { LEVEL_BY_ID } from "../levels/catalog.ts";
import { localPoint } from "../engine/gadget-geometry.ts";
import { newLevel } from "../levels/authoring.ts";
import { createScenario } from "./helpers/machine-scenario.mjs";

const collision = {
  impactSpeed: 2,
  sourceX: 100,
  sourceY: 120,
  targetX: 100,
  targetY: 100,
  relativeVelocity: { x: 2, y: 0 },
};

test("a candle flame ignites a rocket through the shared interaction table", () => {
  const interactions = resolveInteractions("candle", "rocket", "collision", collision);
  assert.ok(interactions.some((entry) => entry.rule.id === "fire-ignites-rocket" && entry.rule.effect === "ignite"));
});

test("rocket launch lifecycle has a visible ignition and upward launch phase", () => {
  const start = 1_000;
  assert.equal(nextRocketState("burning", start, start + ROCKET_IGNITION_MS - 1), "burning");
  assert.equal(nextRocketState("burning", start, start + ROCKET_IGNITION_MS), "launching");
  assert.equal(nextRocketState("launching", start, start + ROCKET_TOTAL_LAUNCH_MS), "launched");
  const ignition = rocketVisual("burning", start, start + 400);
  const launch = rocketVisual("launching", start, start + 1_200);
  assert.equal(ignition.row, 0);
  assert.equal(launch.row, 1);
  assert.ok(launch.offsetY < -100);
  assert.ok(launch.smokeOpacity > 0);
});

test("drive belt tangents touch both visible wheels", () => {
  const source = { x: 260, y: 363 };
  const [target] = conveyorWheelCenters(570, 420, 600);
  const geometry = driveBeltGeometry(source, target, 18, 22);
  assert.equal(geometry.tangents.length, 2);
  for (const tangent of geometry.tangents) {
    assert.ok(Math.abs(Math.hypot(tangent.source.x - source.x, tangent.source.y - source.y) - 18) < 1e-8);
    assert.ok(Math.abs(Math.hypot(tangent.target.x - target.x, tangent.target.y - target.y) - 22) < 1e-8);
  }
});

test("rocket parade is a fully configured JSON level", () => {
  const level = LEVEL_BY_ID.get("rocket-parade");
  assert.ok(level);
  assert.equal(level.number, 15);
  assert.equal(level.fixedGadgets.filter((gadget) => gadget.type === "rocket").length, 4);
  assert.equal(level.inventory.find((entry) => entry.type === "ramp")?.count, 6);
  assert.equal(level.inventory.find((entry) => entry.type === "belt")?.count, 1);
  const candle = level.fixedGadgets.find((gadget) => gadget.id === "falling-candle");
  assert.equal(candle?.physics?.isStatic, false);
  assert.equal(candle?.physics?.gravityScale, 1);
  assert.equal(level.goal.kind, "all");
  assert.ok(level.goal.goals.some((goal) => goal.kind === "state" && goal.selector.id === "rocket-conveyor"));
  assert.ok(level.goal.goals.some((goal) => goal.kind === "count" && goal.selector.type === "rocket" && goal.value === 4));
});

test("a two-plank route can start Louis and carry the candle under all rockets", () => {
  const level = LEVEL_BY_ID.get("rocket-parade");
  assert.ok(level);
  const engine = new MachinePhysicsEngine(level);
  Matter.Composite.add(engine.world, Matter.Bodies.rectangle(450, 500, 900, 40, { isStatic: true, label: "floor" }));
  engine.addGadget({ id: "solution-ramp-1", type: "ramp", x: 110, y: 250, rotation: .244 });
  engine.addGadget({ id: "solution-ramp-2", type: "ramp", x: 325, y: 360, rotation: .505 });
  engine.subscribe((event) => {
    if (event.type === "state" && event.instanceId === "louis-wheel" && event.state === "running") engine.setState("rocket-conveyor", "running");
  });
  for (let frame = 0; frame < 660; frame++) engine.step(16.666);
  assert.equal(engine.state("louis-wheel")?.state, "running");
  assert.equal(engine.state("rocket-conveyor")?.state, "running");
  for (let rocket = 1; rocket <= 4; rocket++) assert.equal(engine.state(`rocket-${rocket}`)?.state, "launched");
  assert.equal(engine.goalReached(level.goal), true);
  engine.destroy();
});

const burnTargets = [
  [{ type: "candle", x: 300, y: 380, state: "unlit" }, "burning"],
  [{ type: "fuse", x: 300, y: 330 }, "burned"],
  [{ type: "cannon", x: 318, y: 372, rotation: 0 }, "firing"],
  [{ type: "tnt", x: 318, y: 358 }, "exploded"],
];

for (const [target, finalState] of burnTargets) test(`a passing rocket ignites ${target.type} at its wick and leaves distant objects alone`, () => {
  for (const dt of [1000 / 120, 1000 / 60, 32]) {
    const machine = new MachinePhysicsEngine();
    machine.matter.gravity.y = 0;
    machine.addGadget({ id: "rocket", type: "rocket", x: 300, y: 400, state: "launching" });
    machine.addGadget({ ...target, id: "near" });
    machine.addGadget({ ...target, id: "far", x: target.x + 200 });
    machine.step(dt);
    assert.equal(machine.state("near").state, target.state ?? "idle", "the flame must first reach the target");
    for (let elapsed = dt; elapsed < 2600; elapsed += dt) machine.step(dt);
    assert.equal(machine.state("near").state, finalState, `${target.type} at ${dt} ms`);
    assert.equal(machine.state("far").state, target.state ?? "idle");
    if (target.type === "cannon") assert.equal(machine.bodiesByType("cannonball").length, 1);
    machine.destroy();
  }
});

test("rocket exhaust follows rotated and mirrored flight paths", () => {
  for (const rotation of [0, Math.PI / 2, .7]) for (const flipX of [false, true]) for (const flipY of [false, true]) {
    const machine = new MachinePhysicsEngine();
    const rocket = { id: "rocket", type: "rocket", x: 450, y: 260, state: "launching", rotation, flipX, flipY };
    const wick = localPoint(rocket, { x: 0, y: -70 });
    machine.addGadget(rocket);
    machine.addGadget({ id: "candle", type: "candle", x: wick.x, y: wick.y + 50, state: "unlit" });
    for (let i = 0; i < 75; i++) machine.step(1000 / 60);
    assert.equal(machine.state("candle").state, "burning");
    machine.destroy();
  }
});

test("rocket exhaust sweeps between frames and disappears after launch", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "rocket", type: "rocket", x: 300, y: 400, state: "launching" });
  machine.addGadget({ id: "wick", type: "candle", x: 300, y: 440, state: "unlit" });
  machine.step(600);
  assert.equal(machine.state("wick").state, "burning", "a thin wick between frame positions must ignite");
  machine.setState("wick", "extinguished");
  for (let i = 0; i < 60; i++) machine.step(1000 / 60);
  assert.equal(machine.state("rocket").state, "launched");
  machine.addGadget({ id: "late", type: "candle", x: 300, y: 350, state: "unlit" });
  machine.step(1000 / 60);
  assert.equal(machine.state("late").state, "unlit");
  assert.equal(machine.state("wick").state, "extinguished");
  machine.destroy();
});

test("rocket flames respect wet wicks and cannot fire a cannon through its muzzle", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "rocket", type: "rocket", x: 300, y: 400, state: "launching" });
  for (const [index, [target]] of burnTargets.entries()) if (target.type !== "cannon") machine.addGadget({ ...target, id: `wet-${index}`, state: "extinguished" });
  machine.addGadget({ id: "gun", type: "cannon", x: 242, y: 330, rotation: 0 });
  for (let i = 0; i < 180; i++) machine.step(1000 / 60);
  for (const [index, [target]] of burnTargets.entries()) if (target.type !== "cannon") assert.equal(machine.state(`wet-${index}`).state, "extinguished");
  assert.equal(machine.state("gun").state, "idle");
  machine.destroy();
});

test("rocket exhaust also feeds the existing level fuse networks and fires their cannon once", () => {
  const level = newLevel();
  level.systems = [];
  level.fixedGadgets = [
    { id: "rocket", type: "rocket", x: 300, y: 400, state: "launching" },
    { id: "fuse", type: "fuse", x: 340, y: 330 },
    { id: "gun", type: "cannon", x: 413, y: 372, rotation: 0 },
  ];
  const scenario = createScenario(level);
  scenario.step(260);
  assert.equal(scenario.machine.mechanics.fuseSnapshot("fuse").samples.some(sample => sample.burned), true);
  assert.equal(scenario.machine.state("gun").state, "firing");
  assert.equal(Matter.Composite.allBodies(scenario.machine.world).filter(body => body.label === "cannonball").length, 1);
  scenario.runtime.dispose(); scenario.machine.destroy();
});

test("an ignition timestamp of zero still advances the rocket visual", () => {
  assert.equal(nextRocketState("burning", 0, ROCKET_IGNITION_MS), "launching");
  assert.ok(rocketVisual("launching", 0, 1000).offsetY < 0);
});
