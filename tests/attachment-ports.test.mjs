import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import { bodyPoint, localPoint } from "../engine/gadget-geometry.ts";
import { localPort } from "../engine/gadget-ports.ts";
import { newLevel } from "../levels/authoring.ts";
import { validateLevel } from "../levels/catalog.ts";
import { createSimulation } from "../game/simulation-setup.ts";
import { advanceRopeDraft, controlRopeKey, ropeConfigPoints, ropePorts } from "../game/control-ropes.ts";
import { connectPorts, connectionPorts, gadgetPorts } from "../game/gadget-connections.ts";

function setup(t, level, connections) {
  const simulation = createSimulation({level, connections, running:true, onWin:()=>{}});
  t.after(()=>{simulation.runtime.dispose();simulation.machine.destroy()});
  simulation.machine.matter.gravity.y=0;
  return simulation;
}
const rope = (source = "ball", portId = "pull") => ({targetId:"gate",targetPortId:"handle",guides:[],source:{gadgetId:source,portId}});

test("basketball inherits a rope-end port and pulls a latch through shared setup", t => {
  const level = validateLevel({...newLevel(),fixedGadgets:[
    {id:"gate",type:"snapGate",x:100,y:100}, {id:"ball",type:"basketball",x:260,y:100},
  ],controlRopes:[rope()]});
  const ports=ropePorts(level.fixedGadgets);
  const draft=advanceRopeDraft(null,ports[0],[],1);
  assert.deepEqual(advanceRopeDraft(draft.pending,ports[1],[],1).connection,rope());
  const {machine,runtime}=setup(t,level);
  Matter.Body.translate(machine.body("ball"),{x:20,y:0});
  runtime.controlRopes.step(id=>machine.setState(id,"open"));
  assert.equal(machine.state("gate").state,"open");
  assert.equal(machine.signal("rope.pulled.gate"),true);
});

test("named rope ends resolve resized, mirrored and rotating lever geometry", t => {
  const lever={id:"lever",type:"seesaw",x:300,y:300,rotation:.6,flipX:true,flipY:true,physics:{width:400}};
  const level=validateLevel({...newLevel(),fixedGadgets:[{id:"gate",type:"snapGate",x:100,y:100},lever],controlRopes:[rope("lever","right")]});
  const {machine,runtime}=setup(t,level);
  const end=localPort(lever,"right","source");
  assert.deepEqual(ropeConfigPoints(level.controlRopes[0],level.fixedGadgets).at(-1),localPoint(lever,end.local));
  assert.deepEqual(runtime.controlRopes.points(level.controlRopes[0]).at(-1),bodyPoint(machine.body("lever"),end.local));
  Matter.Body.setAngle(machine.body("lever"),-.4);
  assert.deepEqual(runtime.controlRopes.points(level.controlRopes[0]).at(-1),bodyPoint(machine.body("lever"),end.local));
  // Rebuilding after an editor resize recalculates the endpoint, never reuses saved coordinates.
  const resized={...level,fixedGadgets:[level.fixedGadgets[0],{...lever,physics:{width:600}}]};
  const rebuilt=setup(t,resized);
  assert.deepEqual(rebuilt.runtime.controlRopes.points(rope("lever","right")).at(-1),localPoint(resized.fixedGadgets[1],{x:288,y:0}));
});

test("all named drive ports stay distinct, including delimiter characters in identities", t => {
  const original=GADGET_CATALOG.windmill.ports;
  t.after(()=>{GADGET_CATALOG.windmill.ports=original});
  GADGET_CATALOG.windmill.ports=()=>["input","auxiliary","right"].map((id,i)=>({id,kind:"drive",local:{x:i*10,y:0},label:id}));
  const level={...newLevel(),fixedGadgets:[{id:"wind",type:"windmill",x:100,y:100},{id:"gen",type:"generator",x:400,y:100}]};
  const ports=gadgetPorts(level.fixedGadgets),target=ports.find(port=>port.gadgetId==="gen"&&port.kind==="drive");
  const connections=[];
  for(const source of ports.filter(port=>port.gadgetId==="wind")) {
    const connection=connectPorts(source,target,"belt",connections,source.portId);
    assert.ok(connection); connections.push(connection);
    assert.equal(connectPorts(target,source,"belt",connections,"duplicate"),null);
    assert.deepEqual(connectionPorts(connection,ports),[source,target]);
  }
  const validated=validateLevel(JSON.parse(JSON.stringify({...level,connections})));
  const {machine}=setup(t,validated);
  assert.equal(machine.connections.length,3);
  assert.equal(connectPorts({...ports[0],gadgetId:"a:b",portId:"c"},target,"belt",[
    {id:"other",kind:"belt",sourceId:"a",sourcePortId:"b:c",targetId:target.gadgetId,targetPortId:target.portId},
  ],"distinct").sourceId,"a:b");
});

test("wire click order preserves oriented port identities and power through reconnect", t => {
  const level={...newLevel(),fixedGadgets:[{id:"gen",type:"generator",x:100,y:100,state:"running",rotation:.8,flipX:true},
    {id:"lamp",type:"socketLamp",x:500,y:100,flipY:true}]};
  const ports=gadgetPorts(level.fixedGadgets),source=ports.find(port=>port.kind==="power"),target=ports.find(port=>port.kind==="socket");
  const forward=connectPorts(source,target,"wire",[],"wire"),reverse=connectPorts(target,source,"wire",[],"wire");
  assert.deepEqual(forward,reverse);
  assert.equal(connectPorts(source,target,"wire",[reverse],"duplicate"),null);
  const {machine}=setup(t,validateLevel({...level,connections:[reverse]}));
  assert.deepEqual(machine.mechanics.connectionPoints("wire"),[source,target]);
  machine.step(16); assert.equal(machine.state("lamp").state,"on");
  machine.connections=[]; machine.step(16); assert.equal(machine.state("lamp").state,"off");
  machine.connections=[forward]; machine.step(16); assert.equal(machine.state("lamp").state,"on");
});

test("missing or wrong attachment IDs are rejected by import and shared simulation", t => {
  const level={...newLevel(),fixedGadgets:[{id:"gate",type:"snapGate",x:100,y:100},{id:"ball",type:"basketball",x:300,y:100}]};
  for(const invalid of [{...rope(),targetPortId:undefined},{...rope(),source:{gadgetId:"ball",local:{x:0,y:0}}},
    {...rope(),source:{gadgetId:"ball",portId:"unknown"}},{...rope(),guides:[{gadgetId:"ball",portId:"pull"}]}]) {
    assert.throws(()=>validateLevel({...level,controlRopes:[invalid]}),/rope/);
  }
  const {machine}=setup(t,level);
  assert.throws(()=>{machine.connections=[{id:"missing",kind:"wire",sourceId:"gen",targetId:"lamp"}]},/connection port/);
  assert.throws(()=>setup(t,{...level,controlRopes:[{...rope(),source:{gadgetId:"ball",portId:"missing"}}]}),/control rope ports/);
});

test("multiple named handles and guides retain their identities on disconnect and reconnect", t => {
  const originalGate=GADGET_CATALOG.snapGate.ports, originalPulley=GADGET_CATALOG.pulley.ports;
  t.after(()=>{GADGET_CATALOG.snapGate.ports=originalGate;GADGET_CATALOG.pulley.ports=originalPulley});
  GADGET_CATALOG.snapGate.ports=()=>["upper","lower"].map((id,i)=>({id,kind:"target",action:"open",local:{x:16,y:i*30},label:id}));
  GADGET_CATALOG.pulley.ports=()=>["front","back"].map((id,i)=>({id,kind:"guide",local:{x:0,y:i*20},label:id}));
  const level={...newLevel(),fixedGadgets:[{id:"gate",type:"snapGate",x:100,y:100},
    {id:"guide",type:"pulley",x:200,y:120,rotation:.5,flipY:true}, {id:"ball",type:"basketball",x:300,y:200}]};
  const ports=ropePorts(level.fixedGadgets),ropes=[];
  for(const [target,guide] of [["upper","front"],["lower","back"]]) {
    let pending=advanceRopeDraft(null,ports.find(port=>port.portId===target),ropes,2).pending;
    pending=advanceRopeDraft(pending,ports.find(port=>port.portId===guide),ropes,2).pending;
    ropes.push(advanceRopeDraft(pending,ports.find(port=>port.portId==="pull"),ropes,2).connection);
  }
  assert.notEqual(controlRopeKey(ropes[0]),controlRopeKey(ropes[1]));
  assert.equal(advanceRopeDraft(null,ports[0],ropes,3).pending,null);
  const saved=validateLevel(JSON.parse(JSON.stringify({...level,controlRopes:ropes})));
  const {runtime}=setup(t,saved);
  assert.equal(runtime.controlRopes.ropes.length,2);
  for(const rope of ropes) assert.deepEqual(runtime.controlRopes.points(rope),ropeConfigPoints(rope,level.fixedGadgets));
  const disconnected={...saved,controlRopes:saved.controlRopes.filter(rope=>controlRopeKey(rope)!==controlRopeKey(ropes[0]))};
  assert.equal(setup(t,disconnected).runtime.controlRopes.ropes.length,1);
  const pending=advanceRopeDraft(null,ports[0],disconnected.controlRopes,2).pending;
  assert.equal(pending.targetPortId,"upper");
  assert.equal(setup(t,saved).runtime.controlRopes.ropes.length,2);
  const duplicateGuide={...ropes[0],guides:[{portId:"front",gadgetId:"guide"},{gadgetId:"guide",portId:"front"}]};
  assert.throws(()=>validateLevel({...saved,controlRopes:[duplicateGuide]}),/rope guides/);
});

test("level 1 drive connection is explicit and remains solvable without a placed belt gadget", t => {
  // The reference collision is injected; movement, transmission and the goal use the real runtime.
  return import("./helpers/machine-scenario.mjs").then(({loadLevel})=>{
    const level=loadLevel("01"),ports=gadgetPorts(level.fixedGadgets);
    const connection=connectPorts(ports.find(port=>port.gadgetId==="louis-wheel"),ports.find(port=>port.gadgetId==="conveyor"),"belt",[],"drive");
    const validated=validateLevel(JSON.parse(JSON.stringify({...level,connections:[connection]})));
    const {machine,runtime}=setup(t,validated);
    machine.addGadget({id:"impact",type:"ball",x:100,y:100});
    Matter.Body.setVelocity(machine.body("impact"),{x:3,y:0});
    machine.processCollision(machine.body("impact"),machine.body("louis-wheel"),{x:1,y:0});
    for(let i=0;i<300;i++)runtime.tick((i+1)*1000/60,1000/60);
    assert.equal(machine.state("conveyor").state,"running");
    assert.equal(runtime.state.won,true);
  });
});
