import assert from "node:assert/strict";
import test from "node:test";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { createDefaultEffectRegistry } from "../engine/effect-handlers.ts";
import { StepBehaviorRegistry } from "../engine/step-behaviors.ts";
import { resolveInteractions } from "../engine/interaction-rules.ts";

test("new continuous behavior can be registered without editing the engine", () => {
  let calls = 0;
  const behaviors = new StepBehaviorRegistry().register({
    id: "test-ball-behavior",
    selector: { tags: ["ball"] },
    step: () => { calls++; },
  });
  const machine = new MachinePhysicsEngine(undefined, createDefaultEffectRegistry(), behaviors);
  machine.addGadget({ id: "ball-1", type: "ball", x: 100, y: 100 });
  machine.addGadget({ id: "fan-1", type: "fan", x: 300, y: 100 });
  machine.step(16);
  assert.equal(calls, 1);
  machine.destroy();
});

test("state transitions are idempotent and reset animation time", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "wheel", type: "hamsterWheel", x: 100, y: 100 });
  let changes = 0;
  machine.subscribe(event => { if (event.type === "state") changes++; });
  machine.setState("wheel", "running");
  machine.setState("wheel", "running");
  assert.equal(changes, 1);
  machine.step(90);
  assert.equal(machine.animation("wheel")?.frame, 1);
  machine.destroy();
});

test("extinguished fire source cannot ignite another gadget", () => {
  const kinematics = {
    impactSpeed: 3,
    sourceX: 0, sourceY: 0, targetX: 0, targetY: 0,
    sourceState: "extinguished", targetState: "mounted",
    relativeVelocity: { x: 0, y: 0 },
  };
  assert.equal(resolveInteractions("candle", "rocket", "collision", kinematics).length, 0);
  assert.ok(resolveInteractions("candle", "rocket", "collision", {
    ...kinematics, sourceState: "burning",
  }).some(result => result.rule.id === "fire-ignites-rocket"));
});

test("Matter contacts feed declarative zone goals", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "delivery", type: "ball", x: 100, y: 100 });
  machine.addGadget({ id: "goal", type: "basket", x: 100, y: 100 });
  const goal = { kind: "zone", entity: { id: "delivery" }, zone: { id: "goal" } };
  assert.equal(machine.goalReached(goal), false);
  machine.step(16);
  assert.equal(machine.goalReached(goal), true);
  machine.destroy();
});
