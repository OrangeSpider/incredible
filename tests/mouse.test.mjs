import assert from "node:assert/strict";
import test from "node:test";
import {resolveGadgetAnimation} from "../engine/animation.ts";
test("mouse waits in one stable pose and runs through three catalog frames",()=>{
  assert.equal(resolveGadgetAnimation("mouse","waiting",0).frame,0);
  assert.equal(resolveGadgetAnimation("mouse","waiting",999).frame,0);
  assert.deepEqual([0,1,2].map(frame=>resolveGadgetAnimation("mouse","running",frame*110).frame),[0,1,2]);
  assert.equal(resolveGadgetAnimation("mouse","running",330).frame,0);
});
