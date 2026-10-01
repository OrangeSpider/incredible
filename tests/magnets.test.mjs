import assert from "node:assert/strict";
import test from "node:test";
import { newLevel } from "../levels/authoring.ts";
import { validateLevel } from "../levels/catalog.ts";
import { readLevelFiles, writeLevelFile } from "../levels/file-storage.ts";
import { createScenario } from "./helpers/machine-scenario.mjs";

const magnet = { id: "magnet", type: "magnet", x: 300, y: 250, rotation: 0 };
const shot = { type: "cannonball", x: 200, y: 150, rotation: 0 };

function assertAttraction(level, placed = [shot]) {
  const scenario = createScenario(level, placed);
  try {
    scenario.step(1);
    assert.ok(scenario.machine.bodiesByType("cannonball")[0].velocity.x > 0, "the cannonball must accelerate toward the magnet");
    assert.ok(scenario.machine.allStates().some(state => state.type === "magnet" && state.state === "running"));
  } finally {
    scenario.runtime.dispose();
    scenario.machine.destroy();
  }
}

test("testing a new editor level attracts cannonballs without manual system configuration", () => {
  const level = newLevel();
  level.fixedGadgets = [magnet];
  assertAttraction(validateLevel(level));
});

test("older editor files activate fixed, preset and inventory magnets when loaded", async t => {
  for (const source of ["fixedGadgets", "initialPlacements", "inventory"]) {
    await t.test(source, async () => {
      const level = newLevel();
      level.systems = level.systems.filter(system => system !== "magnetic-field");
      level[source] = source === "inventory" ? [{ type: "magnet", count: 1 }] : [magnet];
      const original = structuredClone(level);
      const [loaded] = await readLevelFiles([{ name: "old-editor-level.json", text: async () => JSON.stringify(level) }]);
      const checked = validateLevel(loaded.level);
      assert.equal(checked.systems.filter(system => system === "magnetic-field").length, 1);
      assert.deepEqual(level, original, "loading must not mutate the original document");
      assertAttraction(checked, source === "fixedGadgets" ? [shot] : [shot, ...(checked.initialPlacements.length ? checked.initialPlacements : [magnet])]);
    });
  }
});

test("saving an older editor level persists its required magnet system", async () => {
  const level = newLevel();
  level.systems = level.systems.filter(system => system !== "magnetic-field");
  level.fixedGadgets = [magnet];
  let saved = "";
  const directory = { getFileHandle: async () => ({ createWritable: async () => ({ write: async data => { saved = data; }, close: async () => {} }) }) };
  await writeLevelFile(directory, level);
  assertAttraction(JSON.parse(saved));
  assert.equal(level.systems.includes("magnetic-field"), false);
});

test("magnet recovery preserves unrelated levels and rejects duplicate systems", () => {
  const level = { ...newLevel(), systems: [] };
  assert.deepEqual(validateLevel(level), level);
  assert.throws(() => validateLevel({ ...level, fixedGadgets: [magnet], systems: ["magnetic-field", "magnetic-field"] }), /Duplicate level system/);
});
