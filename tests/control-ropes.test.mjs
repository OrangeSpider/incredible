import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { createScenario, loadLevel } from "./helpers/machine-scenario.mjs";
import { advanceRopeDraft, attachmentPoint, ropePorts, ropeUsesGadget, ropePathBlocked } from "../game/control-ropes.ts";
import { LEVELS } from "../levels/catalog.ts";

const cable = (targetId, sourceId, guides = [], local = { x: 0, y: 0 }) => ({ targetId, guides, source: { gadgetId: sourceId, local } });
const sourceEnd = { x: 104.25, y: 0 };
const solutions = [
  { number: 14, placed: [{ type: "seesaw", x: 210, y: 410 }, { type: "pulley", x: 315, y: 445 }],
    ropes: [1, 2, 3].map(i => cable(`scissor-${i}`, "placed-0", ["placed-1"], sourceEnd)) },
  { number: 21, placed: [{ type: "pulley", x: 260, y: 125 }, { type: "ball", x: 260, y: 245 }],
    ropes: [cable("cutter", "placed-1", ["placed-0"])] },
  { number: 22, placed: [{ type: "pulley", x: 700, y: 125 }, { type: "pulley", x: 240, y: 125 }, { type: "ball", x: 240, y: 255 }],
    ropes: [cable("hatch", "placed-2", ["placed-0", "placed-1"])] },
  { number: 23, placed: [{ type: "pulley", x: 230, y: 420 }],
    ropes: [cable("hatch", "lift-balloon", ["placed-0"], { x: 0, y: 27 })] },
  { number: 24, placed: [{ type: "seesaw", x: 210, y: 410 }, { type: "pulley", x: 315, y: 445 }, { type: "pulley", x: 535, y: 140 }],
    ropes: [cable("hatch", "placed-0", ["placed-1"], sourceEnd), cable("cutter", "relay-ball", ["placed-2"])] },
];

test("level 5 is removed and the remaining level numbers stay stable", () => {
  assert.equal(LEVELS.some(level => level.number === 5), false);
  assert.equal(LEVELS.find(level => level.number === 14)?.id, "snip-snap");
  assert.deepEqual(LEVELS.filter(level => level.number >= 21 && level.number <= 24).map(level => level.number), [21, 22, 23, 24]);
});

for (const solution of solutions) {
  test(`level ${solution.number} completes through real connected rope motion`, () => {
    const scenario = createScenario(loadLevel(solution.number), solution.placed, solution.ropes);
    scenario.step(1200);
    assert.equal(scenario.won, true, JSON.stringify({ states: scenario.machine.allStates(), ropes: scenario.runtime.controlRopes.ropes }));
    for (const rope of solution.ropes) assert.equal(scenario.machine.signal(`rope.pulled.${rope.targetId}`), true);
    if (solution.number === 24) {
      const events = scenario.machine.eventHistory().map(event => event.name);
      assert.ok(events.indexOf("rope.pulled.hatch") < events.indexOf("rope.pulled.cutter"), "the second cable must wait for the first latch to release the relay ball");
    }
    scenario.runtime.dispose(); scenario.machine.destroy();
  });
  test(`level ${solution.number} cannot complete with its control ropes disconnected`, () => {
    const scenario = createScenario(loadLevel(solution.number), solution.placed);
    scenario.step(1200);
    assert.equal(scenario.won, false);
    scenario.runtime.dispose(); scenario.machine.destroy();
  });
}

test("a rising lever end pulls through a low pulley, while motion toward it leaves slack", () => {
  const solution = solutions[0];
  const scenario = createScenario(loadLevel(14), solution.placed, solution.ropes);
  const lever = scenario.machine.body("placed-0");
  Matter.Body.setAngle(lever, .3);
  scenario.runtime.controlRopes.step(id => scenario.runtime.closeScissorById(id));
  assert.ok(scenario.runtime.controlRopes.ropes.every(rope => !rope.triggered));
  Matter.Body.setAngle(lever, -.3);
  scenario.runtime.controlRopes.step(id => scenario.runtime.closeScissorById(id));
  assert.ok(scenario.runtime.controlRopes.ropes.every(rope => rope.triggered));
});

test("rope attachment rotates with the selected lever end", () => {
  const lever = { id: "lever", type: "seesaw", x: 210, y: 410, rotation: -.3 };
  const ports = ropePorts([lever]);
  assert.equal(ports.length, 2);
  assert.deepEqual({ x: ports[1].x, y: ports[1].y }, attachmentPoint(lever, lever.rotation, sourceEnd));
  assert.ok(ports[0].y > lever.y && ports[1].y < lever.y);
});

test("rope building supports intermediate pulleys and completes at a lever end", () => {
  const ports = ropePorts([
    { id: "cutter", type: "scissor", x: 700, y: 280 },
    { id: "guide", type: "pulley", x: 300, y: 440 },
    { id: "lever", type: "seesaw", x: 210, y: 410 },
  ]);
  const start = advanceRopeDraft(null, ports[0], [], 1);
  const guide = advanceRopeDraft(start.pending, ports[1], [], 1);
  const finish = advanceRopeDraft(guide.pending, ports[3], [], 1);
  assert.equal(finish.pending, null, "completion leaves no unfinished rope capturing input");
  assert.deepEqual(finish.connection, cable("cutter", "lever", ["guide"], sourceEnd));
  assert.equal(ropeUsesGadget(finish.connection, "guide"), true, "removing a guide also removes its cables");
  assert.equal(ropeUsesGadget(finish.connection, "unrelated"), false);
  assert.equal(advanceRopeDraft(null, ports[0], [finish.connection], 1).connection, undefined, "the inventory limit cannot be exceeded");
});

test("moving a connected lever recalculates the initial cable length without dropping the attachment", () => {
  const solution = solutions[0];
  const moved = solution.placed.map(part => ({ ...part, x: part.x + 35, y: part.y - 20, rotation: .1 }));
  const scenario = createScenario(loadLevel(14), moved, solution.ropes);
  assert.equal(scenario.runtime.controlRopes.ropes.length, 3);
  scenario.runtime.controlRopes.step(() => assert.fail("editing must not pull the handle"));
  assert.ok(scenario.runtime.controlRopes.ropes.every(rope => rope.progress === 0));
});

test("a control cable cannot transmit through a solid wall", () => {
  const wall = [{ x: 400, y: 200 }, { x: 450, y: 200 }, { x: 450, y: 480 }, { x: 400, y: 480 }];
  assert.equal(ropePathBlocked([{ x: 200, y: 300 }, { x: 700, y: 300 }], [wall]), true);
  assert.equal(ropePathBlocked([{ x: 200, y: 300 }, { x: 250, y: 120 }, { x: 700, y: 160 }], [wall]), false);
  const blockedLevel = loadLevel(21);
  blockedLevel.fixedGadgets.push({id:"test-wall",type:"stoneWall",x:450,y:365,physics:{height:230}});
  const scenario = createScenario(blockedLevel, [{ type: "ball", x: 260, y: 320 }], [cable("cutter", "placed-0")]);
  scenario.step(600);
  assert.equal(scenario.won, false);
  assert.equal(scenario.runtime.controlRopes.ropes[0].blocked, true);
});

for (const dt of [1000 / 120, 32]) test(`rope solutions remain playable at a ${Math.round(1000 / dt)} fps simulation cadence`, () => {
  for (const solution of solutions) {
    const scenario = createScenario(loadLevel(solution.number), solution.placed, solution.ropes);
    for (let time = dt; time < 15000 && !scenario.won; time += dt) scenario.runtime.tick(time, dt);
    assert.equal(scenario.won, true, `level ${solution.number} must still be solvable`);
    scenario.runtime.dispose(); scenario.machine.destroy();
  }
});
