import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { conveyorWheelCenters, driveBeltGeometry } from "../game/drive.ts";
import { nextRocketState, rocketVisual, ROCKET_IGNITION_MS, ROCKET_TOTAL_LAUNCH_MS } from "../game/rocket.ts";
import { resolveInteractions } from "../engine/interaction-rules.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { LEVEL_BY_ID } from "../levels/catalog.ts";

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
  assert.equal(level.goal.conditions?.length, 5);
  assert.ok(level.goal.conditions?.some((condition) => condition.signal === "rocket-conveyor.state"));
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
  for (let frame = 0; frame < 360; frame++) engine.step(16.666);
  assert.equal(engine.state("louis-wheel")?.state, "running");
  assert.equal(engine.state("rocket-conveyor")?.state, "running");
  for (let rocket = 1; rocket <= 4; rocket++) assert.equal(engine.state(`rocket-${rocket}`)?.state, "burning");
  engine.destroy();
});
