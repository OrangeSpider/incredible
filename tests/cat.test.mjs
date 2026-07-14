import assert from "node:assert/strict";
import test from "node:test";
import {CAT_STARTLE_DURATION_MS,catIsRunning,catSpritePose} from "../game/cat.ts";

test("cat sits in one stable pose and has a three-frame running loop",()=>{
  assert.deepEqual(catSpritePose(0,{running:false,startledAt:null}),{state:"idle",row:0,frame:0});
  assert.deepEqual(catSpritePose(1800,{running:false,startledAt:null}),{state:"idle",row:0,frame:0});
  assert.deepEqual(catSpritePose(200,{running:true,startledAt:null}),{state:"running",row:1,frame:2});
});

test("level 7 switches the cat to its running animation during the mouse chase",()=>{
  assert.equal(catIsRunning({motor:false,level:6,mouseFleeAt:0}),false);
  assert.equal(catIsRunning({motor:false,level:6,mouseFleeAt:1000}),true);
  assert.equal(catIsRunning({motor:false,level:5,mouseFleeAt:1000}),false);
  assert.equal(catIsRunning({motor:true,level:0,mouseFleeAt:0}),true);
});

test("startled cat shows three shock frames and then runs away",()=>{
  const startledAt=1000;
  assert.deepEqual(catSpritePose(startledAt,{running:false,startledAt}),{state:"startled",row:2,frame:0});
  assert.deepEqual(catSpritePose(startledAt+220,{running:false,startledAt}),{state:"startled",row:2,frame:1});
  assert.deepEqual(catSpritePose(startledAt+440,{running:false,startledAt}),{state:"startled",row:2,frame:2});
  assert.deepEqual(catSpritePose(startledAt+CAT_STARTLE_DURATION_MS,{running:false,startledAt}),{state:"running",row:1,frame:0});
});
