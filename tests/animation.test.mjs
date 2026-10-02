import assert from "node:assert/strict";
import test from "node:test";
import { resolveGadgetAnimation } from "../engine/animation.ts";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";

test("sprite frames advance across rows and loop", () => {
  const first = resolveGadgetAnimation("hamsterWheel", "running", 0);
  const fourth = resolveGadgetAnimation("hamsterWheel", "running", 270);
  const looped = resolveGadgetAnimation("hamsterWheel", "running", 540);
  assert.deepEqual([first.row, first.column], [0, 0]);
  assert.deepEqual([fourth.row, fourth.column], [1, 0]);
  assert.deepEqual([looped.row, looped.column], [0, 0]);
});

test("one-shot animation holds its final frame", () => {
  const firing = resolveGadgetAnimation("cannon", "firing", 10_000);
  assert.equal(firing.frame, 5);
  assert.equal(firing.definition.kind, "sprite");
});

test("unknown transition state falls back to default animation", () => {
  const fallback = resolveGadgetAnimation("balloon", "unknown", 0);
  assert.equal(fallback.state, "free");
});

test("rotors keep their phase when stopped and wind strength controls windmill animation speed", () => {
  const machine = new MachinePhysicsEngine();
  for (const config of [
    { id: "fan", type: "fan", x: 100, y: 100 },
    { id: "near", type: "windmill", x: 180, y: 100 },
    { id: "far", type: "windmill", x: 350, y: 100 },
    { id: "socket", type: "socketFan", x: 100, y: 400 },
    { id: "switch", type: "switchFan", x: 400, y: 400 },
  ]) machine.addGadget(config);
  machine.step(1000 / 60);
  const angle = id => Number(machine.state(id).properties.rotorAngle);
  assert.ok(angle("fan") > 0);
  assert.ok(angle("near") > angle("far"));
  assert.ok(angle("far") > 0);
  assert.equal(angle("socket"), 0); assert.equal(angle("switch"), 0);
  const stopped = [angle("fan"), angle("near"), angle("far")];
  machine.setState("fan", "off");
  for (let i = 0; i < 30; i++) machine.step(1000 / 60);
  assert.deepEqual([angle("fan"), angle("near"), angle("far")], stopped);
  machine.setState("fan", "running"); machine.step(1000 / 60);
  assert.ok(angle("fan") > stopped[0]); assert.ok(angle("near") > stopped[1]);
  machine.destroy();
});
