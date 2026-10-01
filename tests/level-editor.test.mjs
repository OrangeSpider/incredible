import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { evaluateGoal } from "../engine/goal-evaluator.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { validateLevel } from "../levels/catalog.ts";
import { combineGoals, exitGoal, hitGadget, newLevel, rectangleGoal, redo, remember, removeGadget, undo, updateGadget } from "../levels/authoring.ts";
import { levelFilename, readLevelDirectory, readLevelFiles, writeLevelFile } from "../levels/file-storage.ts";
import { initialConnections, initialPlacements, remainingInventory } from "../components/game/placements.ts";
import { placedConfigId } from "../components/game/types.ts";

const context = entities => ({ entities: () => entities, signal: () => undefined });
const file = (level, name = `${level.number}.json`) => ({ name, text: async () => JSON.stringify(level) });

test("area goals require the same gadget to satisfy both axes and exclude unrelated instances", () => {
  const goal = rectangleGoal({ id: "second-cat" }, { x: 400, y: 300 }, { x: 200, y: 100 });
  assert.deepEqual(goal, { kind: "area", selector: { id: "second-cat" }, x: 200, y: 100, width: 200, height: 200 });
  const first = { id: "first-cat", type: "cat", x: 300, y: 200 };
  assert.equal(evaluateGoal(goal, context([first, { id: "second-cat", type: "cat", x: 300, y: 350 }])), false);
  assert.equal(evaluateGoal(goal, context([first, { id: "second-cat", type: "cat", x: 200, y: 100 }])), true);
  const any = { ...goal, selector: { type: "cat" } };
  assert.equal(evaluateGoal(any, context([{ id: "a", type: "cat", x: 250, y: 400 }, { id: "b", type: "cat", x: 500, y: 200 }])), false);
});

test("exit goals support all four sides and motion reads the body's actual speed", () => {
  const positions = { top: { x: 450, y: -1 }, bottom: { x: 450, y: 521 }, left: { x: -1, y: 250 }, right: { x: 901, y: 250 } };
  for (const [side, position] of Object.entries(positions)) {
    const goal = exitGoal({ id: "ball-1" }, side);
    assert.equal(evaluateGoal(goal, context([{ id: "ball-1", type: "ball", x: 450, y: 250 }])), false);
    assert.equal(evaluateGoal(goal, context([{ id: "ball-1", type: "ball", ...position }])), true);
  }
  const machine = new MachinePhysicsEngine();
  const body = machine.addGadget({ id: "ball-1", type: "ball", x: 100, y: 100 });
  const goal = { kind: "motion", selector: { id: "ball-1" }, minimumSpeed: .5 };
  assert.equal(machine.goalReached(goal), false);
  Matter.Body.setVelocity(body, { x: 2, y: 0 });
  assert.equal(machine.goalReached(goal), true);
  machine.destroy();
});

test("player goals match only player parts, while preset placements keep stable identities and full inventory", () => {
  const level = newLevel();
  level.initialPlacements = [{ id: "my-cat", type: "cat", x: 100, y: 100 }, { id: "source", type: "generator", x: 200, y: 200 }];
  level.fixedGadgets = [{ id: "lamp", type: "socketLamp", x: 300, y: 200 }];
  level.inventory = [{ type: "cat", count: 2 }, { type: "wire", count: 1 }];
  level.connections = [{ id: "preset", kind: "wire", sourceId: "source", targetId: "lamp" }];
  level.goal = { kind: "motion", selector: { id: "my-cat" }, minimumSpeed: .5 };
  const checked = validateLevel(level), placed = initialPlacements(checked);
  assert.equal(placedConfigId(placed[0]), "my-cat");
  assert.deepEqual(initialConnections(checked), checked.connections);
  assert.equal(remainingInventory(level.inventory[0], checked, placed, level.connections, [], false), 2);
  assert.equal(remainingInventory(level.inventory[1], checked, placed, level.connections, [], false), 1);
  placed.push({ id: 1, type: "cat", x: 400, y: 200, rotation: 0, tags: ["player-part"] });
  assert.equal(remainingInventory(level.inventory[0], checked, placed, level.connections, [], false), 1);
  const goal = { kind: "state", selector: { type: "cat", tag: "player-part" }, state: "running" };
  assert.equal(evaluateGoal(goal, context([{ id: "preset", type: "cat", state: "running" }])), false);
  assert.equal(evaluateGoal(goal, context([{ id: "player", type: "cat", state: "running", tags: ["player-part"] }])), true);
});

test("undo restores deleted gadgets together with their exact goals, ropes and wires", () => {
  const level = newLevel();
  level.fixedGadgets = [{ id: "generator", type: "generator", x: 100, y: 100 }, { id: "lamp", type: "socketLamp", x: 300, y: 100 }, { id: "scissor", type: "scissor", x: 200, y: 200 }, { id: "ball", type: "ball", x: 200, y: 300 }];
  level.goal = combineGoals([{ kind: "state", selector: { id: "generator" }, state: "running" }, { kind: "state", selector: { id: "lamp" }, state: "on" }]);
  level.connections = [{ id: "wire", kind: "wire", sourceId: "generator", targetId: "lamp" }];
  level.controlRopes = [{ targetId: "scissor", guides: [], source: { gadgetId: "ball", local: { x: 0, y: 0 } } }];
  let history = { past: [], present: validateLevel(level), future: [] };
  history = remember(history, removeGadget(history.present, "generator"));
  assert.equal(history.present.connections.length, 0);
  assert.equal(history.present.goal.selector.id, "lamp");
  history = remember(history, removeGadget(history.present, "ball"));
  assert.equal(history.present.controlRopes.length, 0);
  history = undo(undo(history));
  assert.deepEqual(history.present, level);
  assert.equal(redo(history).present.connections.length, 0);
  assert.equal(remember(history, { ...level, title: "Changed" }).future.length, 0);
});

test("hit testing respects rotated gadget shapes, overlaps and editing fixed or movable instances", () => {
  const level = newLevel();
  level.fixedGadgets = [{ id: "plank", type: "ramp", x: 200, y: 200, rotation: Math.PI / 2 }];
  level.initialPlacements = [{ id: "ball", type: "ball", x: 200, y: 200 }];
  assert.equal(hitGadget(level.fixedGadgets, { x: 200, y: 260 })?.id, "plank");
  assert.equal(hitGadget(level.fixedGadgets, { x: 260, y: 200 }), undefined);
  assert.equal(hitGadget([...level.fixedGadgets, ...level.initialPlacements], { x: 200, y: 200 })?.id, "ball");
  assert.equal(updateGadget(level, "plank", { x: 250 }).fixedGadgets[0].x, 250);
  assert.equal(updateGadget(level, "ball", { x: 350 }).initialPlacements[0].x, 350);
});

test("folder loading validates every file and sorts by number then natural filename", async () => {
  const first = { ...newLevel(1), id: "first" }, tenth = { ...newLevel(10), id: "tenth" }, same = { ...newLevel(1), id: "same" };
  const loaded = await readLevelFiles([file(tenth), file(same, "level-10.json"), file(first, "level-2.json"), { name: "level.schema.json", text: async () => "{}" }]);
  assert.deepEqual(loaded.map(item => item.level.id), ["first", "same", "tenth"]);
  await assert.rejects(readLevelFiles([file(first), file(first, "copy.json")]), /Doppelte Level-ID/);
  await assert.rejects(readLevelFiles([{ name: "broken.json", text: async () => "invalid" }]), /broken.json/);
  await assert.rejects(readLevelFiles([]), /keine Leveldateien/);
});

test("directory save and reload round trip preserves nested filenames and one JSON per level", async () => {
  const makeFolder = name => {
    const entries = new Map();
    return { name, kind: "directory", entries, async *values() { yield* entries.values(); },
      async getDirectoryHandle(name) { if (!entries.has(name)) entries.set(name, makeFolder(name)); return entries.get(name); },
      async getFileHandle(name) {
        if (!entries.has(name)) {
          let text = "";
          entries.set(name, { name, kind: "file", getFile: async () => ({ text: async () => text }), createWritable: async () => ({ write: async data => { text = data; }, close: async () => {} }) });
        }
        return entries.get(name);
      } };
  };
  const folder = makeFolder("Levels"), level = newLevel(2);
  level.fixedGadgets = [{ id: "ball", type: "ball", x: 100, y: 100 }];
  level.goal = rectangleGoal({ id: "ball" }, { x: 0, y: 200 }, { x: 200, y: 400 });
  await writeLevelFile(folder, level, "chapter-1/my-level.json");
  await writeLevelFile(folder, { ...level, title: "Updated" }, "chapter-1/my-level.json");
  await writeLevelFile(folder, { ...newLevel(3), id: "next-level" });
  const loaded = await readLevelDirectory(folder);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].path, "chapter-1/my-level.json");
  assert.equal(loaded[0].level.title, "Updated");
  assert.deepEqual(loaded[0].level.goal, level.goal);
  assert.equal(levelFilename(loaded[1].level), "03-next-level.json");
  await assert.rejects(writeLevelFile(folder, level, "../escape.json"), /Dateiname/);
});

test("multiple cats and preset buckets have independent registered bodies", () => {
  const level = newLevel();
  level.fixedGadgets = [{ id: "cat-one", type: "cat", x: 100, y: 100 }, { id: "cat-two", type: "cat", x: 400, y: 100 }, { id: "bucket", type: "bucket", x: 200, y: 100 }];
  const machine = new MachinePhysicsEngine(validateLevel(level));
  assert.equal(machine.bodiesByType("cat").length, 2);
  assert.equal(machine.bodiesByType("water").length, 48);
  assert.equal(machine.body("bucket").parts.length, 4);
  machine.step(16);
  assert.equal(machine.state("cat-one").id, "cat-one");
  assert.equal(machine.state("cat-two").id, "cat-two");
  machine.destroy();
});

test("button and socket fans activate independently", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "button", type: "switchFan", x: 200, y: 200 });
  machine.addGadget({ id: "socket", type: "socketFan", x: 500, y: 200 });
  machine.addGadget({ id: "ball", type: "ball", x: 200, y: 100 });
  machine.addGadget({ id: "generator", type: "generator", x: 700, y: 300 });
  for (let frame = 0; frame < 120; frame++) machine.step(16);
  assert.equal(machine.state("button").state, "running");
  assert.equal(machine.state("socket").state, "off");
  machine.connections = [{ id: "wire", kind: "wire", sourceId: "generator", targetId: "socket" }];
  machine.setState("generator", "running"); machine.step(16);
  assert.equal(machine.state("socket").state, "running");
  machine.destroy();
});

test("socket flashlight keeps a directed beam and an unlit candle can be ignited", () => {
  const machine = new MachinePhysicsEngine();
  machine.addGadget({ id: "generator", type: "generator", x: 100, y: 200, state: "running" });
  machine.addGadget({ id: "light", type: "socketFlashlight", x: 250, y: 200 });
  machine.addGadget({ id: "lens", type: "magnifier", x: 390, y: 200 });
  machine.addGadget({ id: "candle", type: "candle", x: 480, y: 250, state: "unlit" });
  machine.connections = [{ id: "wire", kind: "wire", sourceId: "generator", targetId: "light" }];
  for (let frame = 0; frame < 90; frame++) machine.step(16);
  assert.equal(machine.state("light").state, "on");
  assert.equal(machine.mechanics.lights.find(light => light.id === "light").angle, 0);
  assert.equal(machine.state("candle").state, "burning");
  machine.destroy();
});

test("new goal and rope validation rejects invalid dimensions, motion and dangling references", () => {
  const level = newLevel();
  level.fixedGadgets = [{ id: "ball", type: "ball", x: 100, y: 100 }];
  assert.throws(() => validateLevel({ ...level, goal: { kind: "area", selector: { id: "ball" }, x: 0, y: 0, width: 0, height: 10 } }), /dimensions/);
  assert.throws(() => validateLevel({ ...level, goal: { kind: "motion", selector: { id: "ball" }, minimumSpeed: 0 } }), /minimumSpeed/);
  assert.throws(() => validateLevel({ ...level, fixedGadgets: [{ ...level.fixedGadgets[0], x: NaN }] }), /coordinates/);
  assert.throws(() => validateLevel({ ...level, controlRopes: [{ targetId: "missing", guides: [], source: { gadgetId: "ball", local: { x: 0, y: 0 } } }] }), /rope target/);
});
