import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {createSimulation} from "../game/simulation-setup.ts";
import {createScenario, loadLevel} from "./helpers/machine-scenario.mjs";
import {WATER_PARTICLE_COUNT} from "../game/water.ts";
import {LEVEL_FIVE_INITIAL_WEIGHT_Y} from "../game/pulley.ts";

const level = (extra = {}) => ({...loadLevel(14), systems: [], fixedGadgets: [], connections: [], ...extra});
const part = (id, type, x, y, extra = {}) => ({id, type, x, y, rotation: 0, ...extra});
const setup = (t, options) => {
  const simulation = createSimulation({level: level(), running: true, onWin: () => {}, ...options});
  t.after(() => {simulation.runtime.dispose(); simulation.machine.destroy()});
  return simulation;
};

test("shared setup registers several bucket assemblies and pivot gadgets", t => {
  const {machine, runtime, bodyByPlacedId} = setup(t, {
    level: level({fixedGadgets: [{id: "fixed-bucket", type: "bucket", x: 100, y: 100}]}),
    placed: [part(4, "bucket", 300, 100, {configId: "player-bucket", flipX: true, rotation: .3}),
      part(9, "bucket", 500, 100), part(12, "seesaw", 300, 400), part(13, "seesaw", 600, 400)],
  });
  assert.equal(machine.bodiesByType("bucket").length, 3);
  assert.equal(machine.bodiesByType("water").length, 3 * WATER_PARTICLE_COUNT);
  assert.equal(runtime.options.bodies.water.length, 3 * WATER_PARTICLE_COUNT);
  assert.equal(bodyByPlacedId.get(4), machine.body("player-bucket"));
  assert.equal(machine.body("player-bucket").angle, .3);
  assert.equal(machine.body("player-bucket").plugin.machine.flipX, true);
  for (const id of ["fixed-bucket", "player-bucket", "placed-9"]) {
    for (let index = 0; index < WATER_PARTICLE_COUNT; index++) {
      const dropId = `${id}:water:${index}`;
      assert.equal(machine.state(dropId).type, "water");
      assert.ok(machine.entities().some(entity => entity.id === dropId));
      assert.ok(Matter.Composite.allBodies(machine.world).includes(machine.body(dropId)));
    }
  }
  const joints = Matter.Composite.allConstraints(machine.world).map(joint => joint.label);
  assert.ok(joints.includes("joint:placed-12"));
  assert.ok(joints.includes("joint:placed-13"));
  assert.equal(runtime.options.bodies.seesaw, machine.body("placed-13"));
});

test("test helper uses registered bucket water and honors a missing floor", t => {
  const scenario = createScenario(level({floor: false}), [{type: "bucket", x: 200, y: 200}]);
  t.after(() => {scenario.runtime.dispose(); scenario.machine.destroy()});
  assert.ok(scenario.machine.body("placed-0"));
  assert.equal(scenario.runtime.options.bodies.bucket, scenario.machine.body("placed-0"));
  assert.equal(scenario.machine.entities().filter(entity => entity.type === "water").length, WATER_PARTICLE_COUNT);
  assert.equal(Matter.Composite.allBodies(scenario.machine.world).some(body => body.label === "floor"), false);
  const {machine} = setup(t, {});
  assert.equal(Matter.Composite.allBodies(machine.world).filter(body => body.label === "floor").length, 1);
});

test("connections prepare the belt runtime and explicit empty connections override the level", t => {
  const connections = [{id: "belt", kind: "belt", sourceId: "wheel", targetId: "conveyor", sourcePortId: "drive", targetPortId: "left" }];
  const scene = level({fixedGadgets: [{id: "wheel", type: "hamsterWheel", x: 100, y: 100},
    {id: "conveyor", type: "conveyor", x: 300, y: 300}], connections});
  const inherited = setup(t, {level: scene});
  assert.equal(inherited.runtime.options.beltConnected, true);
  assert.deepEqual(inherited.machine.connections, connections);
  assert.notEqual(inherited.machine.connections[0], connections[0]);
  const empty = setup(t, {level: scene, connections: []});
  assert.equal(empty.runtime.options.beltConnected, false);
  assert.deepEqual(empty.machine.connections, []);
  const supplied = setup(t, {level: {...scene, connections: []}, connections});
  assert.equal(supplied.runtime.options.beltConnected, true);
});

test("shared setup prepares live load rope geometry and initial weight position", t => {
  const placed = [part(1, "movingPulley", 400, 300), part(2, "pulley", 600, 100), part(3, "ball", 700, 300)];
  const ropePath = [{kind: "anchor"}, ...[1, 2, 3].map(placedId => ({kind: "part", placedId}))];
  const {machine, runtime, routeAnalysis} = setup(t, {level: level({systems: ["pulley-rope"],
    fixedGadgets: [{id: "weight", type: "weight", x: 760, y: 390}]}), placed, ropePath});
  const rope = runtime.options.rope;
  assert.equal(rope.ready, true);
  assert.equal(routeAnalysis.supportingStrands, 2);
  assert.equal(rope.fixed[0], machine.body("placed-2"));
  assert.equal(rope.moving[0], machine.body("placed-1"));
  assert.equal(rope.placedBall, machine.body("placed-3"));
  assert.deepEqual(rope.initialMovingPositions, [{x: 400, y: 300}]);
  assert.deepEqual(rope.initialBlockPosition, {x: 400, y: LEVEL_FIVE_INITIAL_WEIGHT_Y});
  assert.ok(rope.restLength > 0);
  assert.equal(rope.placedBall.isStatic, true);
  Matter.Body.setPosition(rope.placedBall, {x: 710, y: 320});
  assert.deepEqual(rope.physicsPoints().at(-1), {x: 710, y: 320, group: "ball"});
  const open = setup(t, {placed, ropePath: ropePath.slice(1)});
  assert.equal(open.runtime.options.rope.ready, false);
});

test("shared setup passes control ropes with placement IDs to the mechanism", t => {
  const controlRopes = [{targetId: "cutter", targetPortId:"handle", guides: [{gadgetId:"placed-7",portId:"guide"}], source: {gadgetId: "placed-8", portId:"pull"}}];
  const {runtime, machine} = setup(t, {level: level({fixedGadgets: [{id: "cutter", type: "scissor", x: 100, y: 100}]}),
    placed: [part(7, "pulley", 200, 100), part(8, "ball", 200, 300)], controlRopes});
  assert.deepEqual(runtime.options.controlRopes, controlRopes);
  assert.equal(runtime.controlRopes.ropes.length, 1);
  assert.ok(machine.body(runtime.options.controlRopes[0].source.gadgetId));
});

test("placement physics overrides and preview mouse state remain unchanged", t => {
  const {machine} = setup(t, {running: false, placed: [part(1, "mouse", 100, 100),
    part(2, "mouse", 200, 100, {physics: {isStatic: false}})]});
  assert.equal(machine.body("placed-1").isStatic, true);
  assert.equal(machine.body("placed-2").isStatic, false);
});

test("shared setup prepares gear connectivity and per-instance cannon fuses", t => {
  const {machine, runtime, gearDepth} = setup(t, {level: level({fixedGadgets: [
    {id: "source", type: "gear", collisionLabel: "gearSource", x: 100, y: 100},
    {id: "middle", type: "gear", collisionLabel: "gear", x: 184, y: 100},
    {id: "target", type: "gear", collisionLabel: "gearTarget", x: 268, y: 100},
    {id: "cannon", type: "cannon", collisionLabel: "cannon", x: 500, y: 300},
    {id: "second-cannon", type: "cannon", collisionLabel: "cannon", x: 700, y: 300},
  ]}), placed: [part(10, "fuse", 400, 200, {rotation: .4})]});
  assert.equal(runtime.options.gearsConnected, true);
  assert.equal(gearDepth.get(machine.body("target").id), 2);
  assert.equal(runtime.options.bodies.cannon, machine.body("cannon"));
  const fuse = machine.mechanics.fuseSnapshot("placed-10");
  assert.ok(fuse.samples.length > 0);
  assert.equal(machine.mechanics.fuseSnapshot("cannon:fuse").samples.length, 14);
  assert.equal(machine.mechanics.fuseSnapshot("second-cannon:fuse").samples.length, 14);
});
