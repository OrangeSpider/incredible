import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import {advanceCatTowardFish,catSeesFish,FISHBOWL_BREAK_SPEED,fishbowlBreaks} from "../game/fish.ts";
import {CHARACTERS} from "../game/characters.ts";

test("the recurring animal characters keep their names",()=>{
  assert.deepEqual(CHARACTERS,{hamster:"Louis",cat:"Joanne",mouse:"Mogli",fish:"Mr. Blue"});
});

test("Mr. Blue's bowl breaks only from a sufficiently fast falling body",()=>{
  assert.equal(fishbowlBreaks(FISHBOWL_BREAK_SPEED-.01,true),false);
  assert.equal(fishbowlBreaks(FISHBOWL_BREAK_SPEED,true),true);
  assert.equal(fishbowlBreaks(12,false),false,"static scenery must not break the bowl");
});

test("a bowling ball can break the static fishbowl and release Mr. Blue",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const bowl=Matter.Bodies.circle(700,390,55,{isStatic:true,label:"fishbowl"});
  const fish=Matter.Bodies.circle(700,390,20,{isSensor:true,label:"fish"});Matter.Body.setStatic(fish,true);
  const ball=Matter.Bodies.circle(700,80,18,{density:.006,label:"ball"});
  const floor=Matter.Bodies.rectangle(450,500,900,40,{isStatic:true,label:"floor"});
  Matter.Composite.add(engine.world,[bowl,fish,ball,floor]);let broken=false,released=false,brokenTick=0;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(({bodyA,bodyB})=>{
    const labels=[bodyA.label,bodyB.label];
    if(labels.includes("fishbowl")&&labels.includes("ball")&&fishbowlBreaks(ball.velocity.y,!ball.isStatic)){
      broken=true;brokenTick=tick;bowl.isSensor=true;
    }
  }));
  let tick=0;
  for(;tick<360;tick++){Matter.Engine.update(engine,16.666);if(broken&&!released&&tick-brokenTick>=34){released=true;Matter.Body.setPosition(fish,{x:bowl.position.x,y:bowl.position.y+12});Matter.Body.setStatic(fish,false);fish.isSensor=false}}
  assert.equal(broken,true);
  assert.equal(released,true);
  assert.ok(fish.position.y>390,"Mr. Blue must fall out of the broken bowl");
  assert.ok(fish.position.y<480,"the floor must catch Mr. Blue");
});

test("Joanne sees visible Mr. Blue on her level and runs toward him",()=>{
  assert.equal(catSeesFish({catX:130,catY:450,fishX:700,fishY:460,fishVisible:true}),true);
  assert.equal(catSeesFish({catX:130,catY:450,fishX:700,fishY:300,fishVisible:true}),false);
  assert.equal(catSeesFish({catX:130,catY:450,fishX:700,fishY:460,fishVisible:false}),false);
  assert.ok(advanceCatTowardFish(130,700,100)>130);
  assert.equal(advanceCatTowardFish(690,700,100),652,"Joanne stops just before Mr. Blue");
});
