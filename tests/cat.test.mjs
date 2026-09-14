import assert from "node:assert/strict";
import test from "node:test";
import {CAT_IDLE_FRAME_MS,CAT_STARTLE_DURATION_MS,catIsRunning,catSpriteOffsetX,catSpritePose} from "../game/cat.ts";
import {ANIMAL_FALL_SPEED,isAnimalFalling} from "../game/animals.ts";

test("sitting cat blinks without continuously changing its body pose",()=>{
  assert.deepEqual(catSpritePose(0,{running:false,startledAt:null}),{state:"idle",row:0,frame:0});
  assert.deepEqual(catSpritePose(3*CAT_IDLE_FRAME_MS,{running:false,startledAt:null}),{state:"idle",row:0,frame:1});
  assert.deepEqual(catSpritePose(4*CAT_IDLE_FRAME_MS,{running:false,startledAt:null}),{state:"idle",row:0,frame:2});
  assert.deepEqual(catSpritePose(5*CAT_IDLE_FRAME_MS,{running:false,startledAt:null}),{state:"idle",row:0,frame:0});
  assert.equal(catSpriteOffsetX({state:"idle",row:0,frame:0},90),0);
  assert.ok(catSpriteOffsetX({state:"idle",row:0,frame:1},90)>5);
  assert.ok(catSpriteOffsetX({state:"idle",row:0,frame:2},90)>11);
});

test("cat has a three-frame running loop",()=>{
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

test("a catapulted cat holds its shocked pose until landing",()=>{
  const pose=catSpritePose(2000,{running:false,startledAt:0,holdStartled:true});
  assert.equal(pose.state,"startled");assert.equal(pose.frame,2);
});

test("a cat switches to its startled pose once it is falling",()=>{
  assert.equal(isAnimalFalling(ANIMAL_FALL_SPEED),false);
  assert.equal(isAnimalFalling(ANIMAL_FALL_SPEED+.01),true);
  assert.equal(isAnimalFalling(ANIMAL_FALL_SPEED+.01,true),false);
  assert.equal(catSpritePose(3000,{running:false,startledAt:1000,holdStartled:true}).state,"startled");
});
