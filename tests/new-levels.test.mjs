import test from "node:test";
import assert from "node:assert/strict";
import {createScenario,loadLevel} from "./helpers/machine-scenario.mjs";

test("level 16 reference arrangement extinguishes the candle and guides the balloon through its ring",()=>{
  const scenario=createScenario(loadLevel(16),[
    {type:"bucket",x:680,y:150,rotation:-.08},
    {type:"ramp",x:760,y:330,rotation:.7},
    {type:"fan",x:130,y:430,rotation:-.47},
  ]);
  scenario.step(900);
  assert.equal(scenario.machine.state("candle")?.state,"extinguished");
  assert.equal(scenario.won,true);
});

test("level 17 reference rebound closes the scissor and releases the balloon",()=>{
  const scenario=createScenario(loadLevel(17),[
    {type:"trampoline",x:320,y:430,rotation:.73},
  ]);
  scenario.step(900);
  assert.equal(scenario.machine.state("cutter")?.state,"closed");
  assert.equal(scenario.won,true);
});

const fuseRun=[
  {type:"fuse",x:150,y:360,rotation:0},
  {type:"fuse",x:250,y:352,rotation:-.08},
  {type:"fuse",x:350,y:340,rotation:-.08},
];

test("level 18 reference fuse and magnet curve a cannonball onto the target",()=>{
  const scenario=createScenario(loadLevel(18),[
    ...fuseRun,{type:"magnet",x:700,y:180,rotation:0},
  ]);
  scenario.step(1000);
  assert.equal(scenario.machine.state("placed-3")?.state,"running");
  assert.equal(scenario.won,true);
});

test("level 19 reference seesaw opens the gate before the payload reaches the basket",()=>{
  const scenario=createScenario(loadLevel(19),[
    {type:"seesaw",x:355,y:420,rotation:0},
  ]);
  scenario.step(900);
  assert.equal(scenario.machine.state("snap-gate")?.state,"open");
  assert.equal(scenario.won,true);
});

test("level 20 reference fuse and magnet open Mogli's escape route",()=>{
  const scenario=createScenario(loadLevel(20),[
    ...fuseRun,{type:"magnet",x:600,y:160,rotation:0},
  ]);
  scenario.step(1100);
  assert.equal(scenario.machine.state("snap-gate")?.state,"open");
  assert.equal(scenario.won,true);
});
