import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { localPoint, localVector } from "../engine/gadget-geometry.ts";
import { SEESAW_MAX_ANGLE } from "../game/seesaw.ts";
import { validateLevel } from "../levels/catalog.ts";
import { newLevel, updateGadget, remember, undo, redo } from "../levels/authoring.ts";
import { initialPlacements } from "../components/game/placements.ts";

test("editor settings survive save/load, movable placements, undo and redo", () => {
  for (const group of ["fixedGadgets", "initialPlacements"]) for (const rotation of [-SEESAW_MAX_ANGLE, 0, SEESAW_MAX_ANGLE]) {
    const level = newLevel();
    level[group] = [{ id: "lever", type: "seesaw", x: 300, y: 300 }, { id: "glove", type: "boxingGlove", x: 600, y: 200, properties: { custom: "preserved" } }];
    const next = updateGadget(updateGadget(level, "lever", { rotation }), "glove", { properties: { custom: "preserved", punchStrength: 15 } });
    const history = remember({ past: [], present: level, future: [] }, next);
    assert.deepEqual(undo(history).present, level);
    assert.deepEqual(redo(undo(history)).present, next);
    const loaded = validateLevel(JSON.parse(JSON.stringify(next)));
    assert.deepEqual(loaded, next);
    if (group === "initialPlacements") assert.equal(initialPlacements(loaded)[1].properties.punchStrength, 15);
    const machine = new MachinePhysicsEngine();
    try {
      for (const config of loaded[group]) machine.addGadget(config);
      assert.equal(machine.body("lever").angle, rotation);
      machine.step(16);
      assert.ok(Math.abs(machine.body("lever").angle - rotation) < 1e-8);
      assert.equal(machine.config("glove").properties.punchStrength, 15);
    } finally { machine.destroy(); }
  }
});

test("glove strength scales its single impulse in rotated and mirrored directions", () => {
  for (const rotation of [0, Math.PI / 2, .7]) for (const flipX of [false, true]) for (const strength of [undefined, 3, 18]) {
    const machine = new MachinePhysicsEngine();
    const config = { id: "glove", type: "boxingGlove", x: 400, y: 250, rotation, flipX, properties: strength === undefined ? undefined : { punchStrength: strength } };
    try {
      const glove = machine.addGadget(config);
      const trigger = machine.addGadget({ id: "trigger", type: "basketball", ...localPoint(config, { x: -60, y: 0 }) });
      const target = machine.addGadget({ id: "target", type: "basketball", ...localPoint(config, { x: 35, y: 0 }) });
      const direction = localVector(config, { x: 1, y: 0 });
      Matter.Body.setVelocity(trigger, { x: direction.x * 4, y: direction.y * 4 });
      machine.mechanics.collision(glove, trigger);
      machine.mechanics.beforeStep(16);
      const expected = strength ?? 9;
      assert.equal(machine.state("glove").state, "spent");
      assert.ok(Math.abs(target.velocity.x - direction.x * expected) < 1e-8);
      assert.ok(Math.abs(target.velocity.y - direction.y * expected) < 1e-8);
      machine.mechanics.collision(glove, trigger);
      machine.mechanics.beforeStep(16);
      assert.ok(Math.abs(target.velocity.x - direction.x * expected) < 1e-8, "a repeated impact must not apply another punch");
      assert.ok(Math.abs(target.velocity.y - direction.y * expected) < 1e-8);
    } finally { machine.destroy(); }
  }
});

test("level import rejects invalid glove strengths in both placement groups", () => {
  for (const group of ["fixedGadgets", "initialPlacements"]) for (const punchStrength of [0, -1, NaN, Infinity, "9", true]) {
    const level = newLevel();
    level[group] = [{ id: "glove", type: "boxingGlove", x: 100, y: 100, properties: { punchStrength } }];
    assert.throws(() => validateLevel(level), /punchStrength/);
  }
});
