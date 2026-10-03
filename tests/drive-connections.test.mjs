import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { localPoint } from "../engine/gadget-geometry.ts";
import { gadgetPorts, connectPorts, connectionPorts } from "../game/gadget-connections.ts";
import { conveyorWheelCenters, GENERATOR_DRIVE_CENTER } from "../game/drive.ts";
import { newLevel } from "../levels/authoring.ts";
import { validateLevel } from "../levels/catalog.ts";

const tick = (machine, frames = 1) => { for (let i = 0; i < frames; i++) machine.step(1000 / 60); };
const machineWith = configs => {
  const machine = new MachinePhysicsEngine();
  machine.matter.gravity.y = 0;
  configs.forEach(config => machine.addGadget(config));
  return machine;
};

test("both conveyor wheels retain their transformed endpoints through export, validation and runtime", () => {
  const conveyor = { id: "conveyor", type: "conveyor", x: 400, y: 300, rotation: .6, flipX: true, flipY: true, physics: { width: 400 } };
  const generator = { id: "generator", type: "generator", x: 730, y: 220, rotation: -.5, flipX: true };
  const wheel = { id: "wheel", type: "hamsterWheel", x: 150, y: 300 };
  const configs = [conveyor, generator, wheel], ports = gadgetPorts(configs);
  const [left, right] = ports.filter(port => port.gadgetId === "conveyor");
  for (const [index, port] of [left, right].entries()) {
    const expected = localPoint(conveyor, conveyorWheelCenters(0, 0, 400)[index]);
    assert.deepEqual({ x: port.x, y: port.y }, expected);
  }
  const generatorPort = ports.find(port => port.gadgetId === "generator" && port.kind === "drive");
  assert.deepEqual({ x: generatorPort.x, y: generatorPort.y }, localPoint(generator, GENERATOR_DRIVE_CENTER));
  const wheelPort = ports.find(port => port.gadgetId === "wheel");
  assert.deepEqual({ x: wheelPort.x, y: wheelPort.y }, localPoint(wheel, { x: 55, y: 13 }));

  const first = connectPorts(wheelPort, left, "belt", [], "left-belt");
  const second = connectPorts(right, generatorPort, "belt", [first], "right-belt");
  const level = validateLevel(JSON.parse(JSON.stringify({ ...newLevel(), fixedGadgets: configs, connections: [first, second] })));
  const machine = new MachinePhysicsEngine(level);
  assert.equal(level.connections[1].sourcePortId, "right");
  assert.deepEqual(machine.mechanics.connectionPoints(second.id), [right, generatorPort]);
  const missing = { id: "old", kind: "belt", sourceId: "wheel", targetId: "conveyor" };
  assert.deepEqual(connectionPorts(missing, ports), []);
  assert.throws(()=>validateLevel({...level,connections:[missing]}), /connection port/);
  assert.equal(connectPorts(left,wheelPort,"belt",[first],"duplicate"),null);
  assert.ok(connectPorts(wheelPort,right,"belt",[first],"other-wheel"));
  assert.throws(()=>validateLevel({...level,connections:[first,{...first,id:"duplicate"}]}),/Duplicate connection/);
  assert.throws(() => validateLevel({ ...level, connections: [{ ...second, sourcePortId: "missing" }] }), /Invalid connection/);
  machine.destroy();
});

test("either conveyor wheel transfers drive through the other wheel to a generator and socket", () => {
  for (const inputPort of ["left", "right"]) {
    const configs = [{ id: "wheel", type: "hamsterWheel", x: 100, y: 100, state: "running" }, { id: "conveyor", type: "conveyor", x: 420, y: 300 }, { id: "gen", type: "generator", x: 730, y: 100 }, { id: "lamp", type: "socketLamp", x: 800, y: 400 }];
    const machine = machineWith(configs), ports = gadgetPorts(configs);
    const port = (id, portId = "drive") => ports.find(port => port.gadgetId === id && port.portId === portId);
    machine.connections = [connectPorts(port("conveyor", inputPort), port("wheel"), "belt", [], "input"), connectPorts(port("gen"), port("conveyor", inputPort === "left" ? "right" : "left"), "belt", [], "output"), { id: "wire", kind: "wire", sourceId: "gen", targetId: "lamp" , sourcePortId: "power", targetPortId: "socket" }];
    tick(machine);
    assert.equal(machine.state("conveyor").state, "running");
    assert.equal(machine.state("gen").state, "running");
    assert.equal(machine.state("lamp").state, "on");
    machine.setState("wheel", "idle"); tick(machine);
    assert.equal(machine.state("conveyor").state, "idle");
    assert.equal(machine.state("gen").state, "idle");
    assert.equal(machine.state("lamp").state, "off");
    machine.destroy();
  }
});

test("a belt-powered generator stops on lost wind or disconnection and restarts on reconnection", () => {
  const machine = machineWith([{ id: "fan", type: "fan", x: 100, y: 100 }, { id: "wind", type: "windmill", x: 250, y: 100 }, { id: "gen", type: "generator", x: 550, y: 100 }, { id: "lamp", type: "socketLamp", x: 750, y: 100 }]);
  const belt = { id: "belt", kind: "belt", sourceId: "gen", targetId: "wind" , sourcePortId: "drive", targetPortId: "drive" }, wire = { id: "wire", kind: "wire", sourceId: "gen", targetId: "lamp" , sourcePortId: "power", targetPortId: "socket" };
  machine.connections = [belt, wire]; tick(machine);
  assert.equal(machine.state("gen").state, "running"); assert.equal(machine.state("lamp").state, "on");
  machine.setState("fan", "off"); tick(machine);
  assert.equal(machine.state("gen").state, "idle"); assert.equal(machine.state("lamp").state, "off");
  machine.setState("fan", "running"); tick(machine);
  assert.equal(machine.state("gen").state, "running");
  machine.connections = [wire]; tick(machine);
  assert.equal(machine.state("gen").state, "idle"); assert.equal(machine.state("lamp").state, "off");
  machine.connections = [belt, wire]; tick(machine);
  assert.equal(machine.state("gen").state, "running"); assert.equal(machine.state("lamp").state, "on");
  machine.destroy();
});

test("switching a generator on while belt-driven keeps it running after its belt is removed", () => {
  const machine = machineWith([{ id: "wheel", type: "hamsterWheel", x: 100, y: 100, state: "running" }, { id: "gen", type: "generator", x: 400, y: 100 }, { id: "lamp", type: "socketLamp", x: 750, y: 100 }, { id: "ball", type: "ball", x: 320, y: 100 }]);
  const wire = { id: "wire", kind: "wire", sourceId: "gen", targetId: "lamp" , sourcePortId: "power", targetPortId: "socket" };
  machine.connections = [{ id: "belt", kind: "belt", sourceId: "wheel", targetId: "gen" , sourcePortId: "drive", targetPortId: "drive" }, wire]; tick(machine);
  Matter.Body.setVelocity(machine.body("ball"), { x: 4, y: 0 }); tick(machine, 12);
  assert.equal(machine.signal("generator.started.gen"), true);
  machine.connections = [wire]; tick(machine);
  assert.equal(machine.state("gen").state, "running"); assert.equal(machine.state("lamp").state, "on");
  machine.destroy();
});
