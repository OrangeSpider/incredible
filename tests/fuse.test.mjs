import assert from "node:assert/strict";
import test from "node:test";
import {FuseNetwork} from "../game/fuse.ts";

test("a fuse ignited in its middle burns in both directions",()=>{
  const network=new FuseNetwork([{id:"fuse",start:{x:0,y:0},end:{x:110,y:0},burnDurationMs:1100}]);
  network.ignite("fuse",.5,0);network.update(560);
  assert.ok(network.burnTimeAt("fuse",0)<=560,"the left-going front must reach the start");
  assert.ok(network.burnTimeAt("fuse",1)<=560,"the right-going front must reach the end");
});

test("a burning fuse ignites a crossing fuse at the contact point and splits",()=>{
  const network=new FuseNetwork([
    {id:"horizontal",start:{x:0,y:50},end:{x:100,y:50},burnDurationMs:1000},
    {id:"vertical",start:{x:50,y:0},end:{x:50,y:100},burnDurationMs:1000},
  ],12);
  network.ignite("horizontal",0,0);network.update(500);
  assert.ok(network.burnTimeAt("vertical",.5)<=500,"the crossing must ignite without relying on array order");
  assert.ok(network.burnTimeAt("vertical",0)<Infinity&&network.burnTimeAt("vertical",1)<Infinity,"the new fire must propagate both ways");
});

test("the cannon fuse burns from its exposed end toward the cannon",()=>{
  const network=new FuseNetwork([{id:"cannon",start:{x:0,y:0},end:{x:0,y:30},burnDurationMs:1300}]);
  network.igniteNear({x:0,y:0},2,100);
  assert.equal(network.burnTimeAt("cannon",0),100);
  assert.equal(network.burnTimeAt("cannon",1),1400);
});

test("a full standard fuse segment keeps the deliberately slower burn speed",()=>{
  const network=new FuseNetwork([{id:"slow",start:{x:0,y:0},end:{x:110,y:0}}]);
  network.ignite("slow",0,0);
  assert.equal(network.burnTimeAt("slow",1),1200);
});
