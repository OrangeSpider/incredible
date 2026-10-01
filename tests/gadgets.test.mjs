import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { MachinePhysicsEngine } from "../engine/physics-engine.ts";
import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import { gadgetPorts, connectPorts, distanceToPath } from "../game/gadget-connections.ts";
import { airflowAt, AIRFLOW_RANGE } from "../game/airflow.ts";
import { LEVELS, validateLevel } from "../levels/catalog.ts";
import { createScenario, loadLevel } from "./helpers/machine-scenario.mjs";

const solutions = [
  [25, [{type:"basketball",x:350,y:160}]],
  [26, [{type:"basketball",x:406,y:160}]],
  [27, [{type:"ball",x:260,y:160}], [{id:"wire",kind:"wire",sourceId:"generator",targetId:"lamp"}]],
  [28, [{type:"ball",x:220,y:160}], [{id:"wire",kind:"wire",sourceId:"generator",targetId:"fan"}]],
  [29, [{type:"magnifier",x:490,y:300}]],
  [30, [{type:"magnifier",x:490,y:300}]],
  [31, [{type:"basketball",x:340,y:130}]],
  [32, [{type:"tnt",x:288,y:328}]],
  [33, [{type:"tnt",x:408,y:368},{type:"ball",x:350,y:130}]],
  [34, [{type:"windmill",x:420,y:300}], [{id:"belt",kind:"belt",sourceId:"placed-0",targetId:"target"}]],
  [35, [{type:"ramp",x:280,y:330,rotation:.3}]],
];

for (const [number, parts, connections] of solutions) {
  test(`mini level ${number} completes through its physical mechanism`, () => {
    const scenario = createScenario(loadLevel(number), parts);
    if (connections) scenario.machine.connections = connections;
    assert.equal(scenario.step(600), true);
    scenario.runtime.dispose(); scenario.machine.destroy();
  });
  test(`mini level ${number} needs the player's missing gadget or connection`, () => {
    const scenario = createScenario(loadLevel(number));
    assert.equal(scenario.step(400), false);
    scenario.runtime.dispose(); scenario.machine.destroy();
  });
}

test("mini level solutions still work at 120 and 31 frames per second", () => {
  for (const dt of [8.333, 32]) for (const [number, parts, connections] of solutions) {
    const scenario = createScenario(loadLevel(number), parts);
    if (connections) scenario.machine.connections = connections;
    for (let t = dt; t <= 12000 && !scenario.won; t += dt) scenario.runtime.tick(t, dt);
    assert.equal(scenario.won, true, `level ${number} at ${dt} ms`);
  }
});

function machineWith(configs) {
  const machine = new MachinePhysicsEngine();
  machine.matter.gravity.y = 0;
  for (const config of configs) machine.addGadget(config);
  return machine;
}
const tick = (machine, frames = 120) => { for (let i = 0; i < frames; i++) machine.step(16.666); };

test("electric sockets require a running connected generator and lose power on disconnection", () => {
  const machine = machineWith([{id:"gen",type:"generator",x:0,y:0}, {id:"lamp",type:"socketLamp",x:200,y:0}, {id:"fan",type:"socketFan",x:300,y:0}]);
  machine.connections = [{id:"a",kind:"wire",sourceId:"gen",targetId:"lamp"}, {id:"b",kind:"wire",sourceId:"gen",targetId:"fan"}];
  tick(machine, 1); assert.equal(machine.state("lamp").state, "off");
  machine.setState("gen", "running"); tick(machine, 1);
  assert.equal(machine.state("lamp").state, "on"); assert.equal(machine.state("fan").state, "running");
  machine.connections = []; tick(machine, 1);
  assert.equal(machine.state("lamp").state, "off"); assert.equal(machine.state("fan").state, "off");
});

test("a body hit away from the flashlight button does not switch it on", () => {
  const machine = machineWith([{id:"light",type:"flashlight",x:100,y:100}, {id:"ball",type:"basketball",x:131,y:50}]);
  Matter.Body.setVelocity(machine.body("ball"), {x:0,y:3}); tick(machine, 6);
  assert.equal(machine.state("light").state, "off");
});

test("a magnifier needs light, a clear path, alignment and time to ignite the wick", () => {
  const configs = [{id:"light",type:"flashlight",x:100,y:100,state:"on"}, {id:"lens",type:"magnifier",x:260,y:100}, {id:"wick",type:"candle",x:350,y:150,state:"unlit"}];
  const machine = machineWith(configs); tick(machine, 10); assert.equal(machine.state("wick").state, "unlit");
  tick(machine); assert.equal(machine.state("wick").state, "burning");
  for (const change of [ {id:"light",state:"off"}, {id:"lens",rotation:Math.PI/2}, {id:"wick",x:370} ]) {
    const wrong = machineWith(configs.map(config => config.id === change.id ? {...config,...change} : config));
    tick(wrong); assert.equal(wrong.state("wick").state, "unlit");
  }
  const blocked = machineWith([...configs,{id:"wall",type:"stoneWall",x:200,y:100}]); tick(blocked);
  assert.equal(blocked.state("wick").state, "unlit");
});

test("TNT needs direct flame at its fuse, burns briefly, explodes once and starts a nearby generator", () => {
  const configs = [{id:"flame",type:"candle",x:100,y:150}, {id:"tnt",type:"tnt",x:118,y:128}, {id:"gen",type:"generator",x:205,y:128}, {id:"ball",type:"basketball",x:118,y:50}];
  const machine = machineWith(configs); tick(machine, 2); assert.equal(machine.state("tnt").state, "burning");
  tick(machine, 20); assert.equal(machine.state("tnt").state, "burning");
  tick(machine, 25); assert.equal(machine.state("tnt").state, "exploded"); assert.equal(machine.state("gen").state, "running");
  assert.ok(machine.body("ball").velocity.y < 0); const before = machine.body("ball").velocity.y;
  tick(machine, 2); assert.ok(machine.body("ball").velocity.y >= before, "explosion must not repeatedly add velocity");
  const wrong = machineWith(configs.map(config => config.id === "tnt" ? {...config,y:170} : config)); tick(wrong);
  assert.equal(wrong.state("tnt").state, "idle");
});

test("water extinguishes a TNT fuse before it can explode", () => {
  const machine = machineWith([{id:"tnt",type:"tnt",x:100,y:100,state:"burning"}, {id:"water",type:"water",x:100,y:100}]);
  tick(machine); assert.equal(machine.state("tnt").state, "extinguished"); assert.equal(machine.signal("tnt.exploded.tnt"), undefined);
});

test("a detonator ignores side impacts and a glove ignores front impacts", () => {
  for (const [type, x, velocity] of [["detonator",50,{x:4,y:0}], ["boxingGlove",170,{x:-4,y:0}]]) {
    const machine = machineWith([{id:"device",type,x:100,y:100}, {id:"ball",type:"basketball",x,y:100}]);
    Matter.Body.setVelocity(machine.body("ball"), velocity); tick(machine, 10);
    assert.equal(machine.state("device").state, "ready");
  }
});

test("one glove punch hits its target once and a second rear impact cannot retrigger it", () => {
  const machine = machineWith([{id:"glove",type:"boxingGlove",x:100,y:100}, {id:"trigger",type:"basketball",x:40,y:100}, {id:"target",type:"basketball",x:180,y:100}]);
  Matter.Body.setVelocity(machine.body("trigger"), {x:4,y:0}); tick(machine, 30);
  assert.equal(machine.state("glove").state, "spent"); assert.ok(machine.body("target").velocity.x > 0);
  Matter.Body.setPosition(machine.body("trigger"), {x:40,y:100}); Matter.Body.setVelocity(machine.body("trigger"), {x:4,y:0});
  const age = machine.stateAgeMs("glove"); tick(machine, 20); assert.ok(machine.stateAgeMs("glove") > age);
});

test("wind and a belt are both needed; blocking wind stops the target drive", () => {
  const machine = machineWith([{id:"fan",type:"fan",x:100,y:100}, {id:"wind",type:"windmill",x:250,y:100}, {id:"gear",type:"gearTarget",x:500,y:100}]);
  tick(machine, 1); assert.equal(machine.state("wind").state, "running"); assert.equal(machine.state("gear").state, "idle");
  machine.connections = [{id:"belt",kind:"belt",sourceId:"wind",targetId:"gear"}]; tick(machine, 1); assert.equal(machine.state("gear").state, "running");
  assert.ok(machine.body("gear").angularVelocity > 0);
  machine.addGadget({id:"wall",type:"stoneWall",x:180,y:100}); tick(machine, 1);
  assert.equal(machine.state("wind").state, "idle"); assert.equal(machine.state("gear").state, "idle");
  assert.equal(machine.body("gear").angularVelocity, 0);
});

test("a wind-driven conveyor transports a resting ball without a hamster wheel", () => {
  const machine = new MachinePhysicsEngine();
  for (const config of [{id:"fan",type:"fan",x:100,y:100}, {id:"wind",type:"windmill",x:250,y:100}, {id:"belt",type:"conveyor",x:500,y:320}, {id:"ball",type:"basketball",x:470,y:289}]) machine.addGadget(config);
  machine.connections = [{id:"drive",kind:"belt",sourceId:"wind",targetId:"belt"}];
  tick(machine, 20); assert.equal(machine.state("belt").state, "running"); assert.ok(machine.body("ball").position.x > 500);
  machine.setState("fan","off"); tick(machine,1); assert.equal(machine.state("belt").state,"idle");
});

test("airflow is limited to its visible cone and an unpowered socket fan exerts no wind", () => {
  const machine = machineWith([{id:"fan",type:"socketFan",x:100,y:100}, {id:"ball",type:"basketball",x:200,y:100}]);
  assert.equal(airflowAt(machine.body("fan"),{x:100+AIRFLOW_RANGE+1,y:100}),0);
  assert.equal(airflowAt(machine.body("fan"),{x:200,y:230}),0);
  tick(machine, 20); assert.equal(machine.body("ball").velocity.x,0);
});

test("basketball mass and rebound differ from bowling and tennis balls", () => {
  assert.ok(GADGET_CATALOG.basketball.physics.massKg < GADGET_CATALOG.ball.physics.massKg);
  assert.ok(GADGET_CATALOG.basketball.physics.massKg > GADGET_CATALOG.tennisBall.physics.massKg);
  assert.ok(GADGET_CATALOG.basketball.physics.restitution > GADGET_CATALOG.ball.physics.restitution);
});

test("connections have compatible rotated ports, reject duplicates and remain selectable", () => {
  const configs = [{id:"gen",type:"generator",x:100,y:100,rotation:Math.PI/2}, {id:"lamp",type:"socketLamp",x:300,y:100}, {id:"battery",type:"lamp",x:500,y:100}];
  const ports = gadgetPorts(configs); assert.equal(ports.length,2);
  assert.equal(ports[0].x,80); assert.equal(ports[0].y,136);
  const wire = connectPorts(ports[1],ports[0],"wire",[],"wire"); assert.equal(wire.sourceId,"gen");
  assert.equal(connectPorts(ports[0],ports[1],"wire",[wire],"duplicate"),null);
  assert.equal(connectPorts(ports[0],ports[1],"belt",[],"wrong"),null);
  assert.ok(distanceToPath({x:190,y:129},ports) < 10);
  const valid = {...loadLevel(27),connections:[{id:"wire",kind:"wire",sourceId:"generator",targetId:"lamp"}]};
  assert.deepEqual(validateLevel(valid).connections,valid.connections);
  assert.throws(()=>validateLevel({...valid,connections:[{...valid.connections[0],targetId:"missing"}]}),/Invalid connection/);
  assert.throws(()=>validateLevel({...valid,connections:[...valid.connections,{...valid.connections[0],id:"other"}]}),/Duplicate connection/);
});

test("levels 21 and 22 no longer contain the unnecessary wall", () => {
  for (const n of [21,22]) assert.equal(LEVELS.find(level=>level.number===n).fixedGadgets.some(gadget=>gadget.type==="stoneWall"),false);
});
