import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGadgetBody } from "../engine/body-factory.ts";
import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import { resolveInteractions } from "../engine/interaction-rules.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { LEVELS, validateLevel } from "../levels/catalog.ts";

const collision = (sourceY = 100, targetY = 100, impactSpeed = 8) => ({
  impactSpeed,
  sourceX: 100,
  sourceY,
  targetX: 100,
  targetY,
  relativeVelocity: { x: 0, y: impactSpeed },
});

test("page.tsx is only the route entry point", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /GameApp/);
  assert.doesNotMatch(source, /Matter|level===|fixedGadgets|canvas/i);
  assert.ok(source.split("\n").length < 12, "the route must not contain game implementation");
});

test("canvas delegates simulation and collision handling to the machine runtime", async () => {
  const source = await readFile(new URL("../components/game/GameCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /new MachineRuntime\(/);
  assert.doesNotMatch(source, /Matter\.Events\.on|machine\.step\(|machine\.setState\(|onWin\(/);
  assert.doesNotMatch(source, /(?:level\.)?scene\s*===/);
});

test("all shipped levels are validated standalone JSON documents", () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual(LEVELS.map((level) => level.number), Array.from({ length: 15 }, (_, index) => index + 1));
  for (const level of LEVELS) {
    assert.deepEqual(validateLevel(level), level);
    assert.ok(level.inventory.every((entry) => GADGET_CATALOG[entry.type]));
    assert.ok(level.fixedGadgets.every((gadget) => GADGET_CATALOG[gadget.type]));
    assert.ok(level.title && level.objective && level.hint && level.buildTip && level.successText);
    assert.equal(level.schemaVersion, 2);
    assert.ok(level.goal.kind);
  }
});

test("gadget definitions contain body, reaction and state-animation data", () => {
  for (const gadget of Object.values(GADGET_CATALOG)) {
    assert.ok(gadget.categories.length > 0, `${gadget.type} needs a category`);
    assert.ok(gadget.physics.shape, `${gadget.type} needs a collision shape`);
    assert.ok(gadget.physics.massKg >= 0, `${gadget.type} needs a mass`);
    assert.ok(gadget.physics.waterReaction, `${gadget.type} needs a water reaction`);
    assert.ok(gadget.physics.fireReaction, `${gadget.type} needs a fire reaction`);
    assert.ok(gadget.animations[gadget.defaultState], `${gadget.type} needs an animation for its default state`);
  }
  assert.deepEqual(Object.keys(GADGET_CATALOG.cat.animations), ["idle", "running", "startled", "falling"]);
  assert.deepEqual(Object.keys(GADGET_CATALOG.fuse.animations), ["idle", "burning", "burned", "extinguished"]);
});

test("shared categories keep ball interactions compact while preserving mass", () => {
  const bowling = createGadgetBody({ id: "bowling", type: "ball", x: 0, y: 0 });
  const tennis = createGadgetBody({ id: "tennis", type: "tennisBall", x: 0, y: 0 });
  assert.ok(bowling && tennis);
  assert.equal(bowling.mass, GADGET_CATALOG.ball.physics.massKg);
  assert.equal(tennis.mass, GADGET_CATALOG.tennisBall.physics.massKg);
  assert.ok(bowling.mass > tennis.mass * 100);
  assert.ok(resolveInteractions("ball", "scissor", "collision", collision(40, 100)).some((entry) => entry.rule.effect === "close"));
  assert.ok(resolveInteractions("tennisBall", "scissor", "collision", collision(40, 100)).some((entry) => entry.rule.effect === "close"));
});

test("interaction resolver applies fire, water and sharp-object rules to the correct gadget", () => {
  const needle = resolveInteractions("balloon", "needle", "collision", collision())[0];
  assert.equal(needle.rule.effect, "pop");
  assert.equal(needle.rule.stateTarget, "source", "the balloon, not the needle, must pop");
  assert.ok(resolveInteractions("water", "candle", "collision", collision()).some((entry) => entry.rule.effect === "extinguish"));
  assert.ok(resolveInteractions("water", "fuse", "collision", collision()).some((entry) => entry.rule.effect === "extinguish"));
});

test("the runtime engine creates level bodies from JSON and changes gadget state", () => {
  const level = validateLevel({
    schemaVersion: 1,
    id: "engine-collision-test",
    number: 99,
    scene: "engine-collision-test",
    title: "Engine test",
    objective: "Pop",
    hint: "",
    buildTip: "",
    successText: "",
    inventory: [],
    fixedGadgets: [
      { id: "balloon", type: "balloon", x: 100, y: 100 },
      { id: "needle", type: "needle", x: 100, y: 100 },
    ],
    systems: ["buoyancy", "sharp-objects"],
    goal: { mode: "event", event: "balloon.popped" },
  });
  const engine = new MachinePhysicsEngine(level);
  engine.step(16.666);
  assert.equal(engine.state("balloon")?.state, "popped");
  engine.destroy();
});

test("level editor supports JSON import, local drafts, download and in-game apply", async () => {
  const source = await readFile(new URL("../components/game/LevelEditor.tsx", import.meta.url), "utf8");
  assert.match(source, /application\/json/);
  assert.match(source, /initialPlacements/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /Im Spiel testen/);
});
