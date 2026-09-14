import assert from "node:assert/strict";
import test from "node:test";
import {MOUSE_RUN_FRAME_MS,mouseSpriteFrame} from "../game/mouse.ts";

test("mouse waits in one stable pose and runs through three frames",()=>{
  assert.equal(mouseSpriteFrame(0,false),1);
  assert.equal(mouseSpriteFrame(999,false),1);
  assert.deepEqual([0,1,2].map(frame=>mouseSpriteFrame(frame*MOUSE_RUN_FRAME_MS,true)),[0,1,2]);
  assert.equal(mouseSpriteFrame(3*MOUSE_RUN_FRAME_MS,true),0);
});
