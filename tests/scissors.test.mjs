import assert from "node:assert/strict";
import Matter from "matter-js";
import test from "node:test";
import {ropePullIsTaut,SCISSOR_IMPACT_SPEED,scissorClosesFromImpact,scissorPullPoint} from "../game/scissors.ts";
import {applySeesawImpact,createSeesaw,limitSeesawRotation} from "../game/seesaw.ts";

test("a falling ball closes an open scissor",()=>{
  assert.equal(scissorClosesFromImpact(SCISSOR_IMPACT_SPEED-.01,true),false);
  assert.equal(scissorClosesFromImpact(SCISSOR_IMPACT_SPEED,true),true);
  assert.equal(scissorClosesFromImpact(20,false),false);
});

test("only outward tension at the visible handle closes a rope-driven scissor",()=>{
  const anchor=scissorPullPoint(0),restLength=160;
  assert.equal(ropePullIsTaut(anchor,{x:anchor.x,y:anchor.y+160},{x:0,y:2},restLength),true);
  assert.equal(ropePullIsTaut(anchor,{x:anchor.x,y:anchor.y+120},{x:0,y:8},restLength),false,"a slack rope cannot push the handle");
  assert.equal(ropePullIsTaut(anchor,{x:anchor.x,y:anchor.y+160},{x:0,y:-2},restLength),false,"motion toward the handle releases tension");
});

test("a released balloon rises above the screen",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const balloon=Matter.Bodies.circle(420,100,22,{density:.00012,frictionAir:.025,label:"scissorBalloon"});
  Matter.Composite.add(engine.world,balloon);
  for(let tick=0;tick<500&&balloon.position.y>-30;tick++){
    Matter.Body.applyForce(balloon,balloon.position,{x:0,y:-.00032});
    Matter.Engine.update(engine,16.666);
  }
  assert.ok(balloon.position.y<=-30,"the cut balloon must cross the upper screen edge");
});

test("the preplaced ball and a seesaw can launch a payload into the first scissor",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}}),seesaw=createSeesaw(200,430,0);
  const trigger=Matter.Bodies.circle(130,82,18,{density:.006,label:"trigger"});
  const payload=Matter.Bodies.circle(300,390,18,{density:.006,label:"payload"});
  const scissor=Matter.Bodies.rectangle(420,340,70,56,{isStatic:true,label:"scissor"});
  const floor=Matter.Bodies.rectangle(450,500,900,40,{isStatic:true,label:"floor"});
  Matter.Composite.add(engine.world,[seesaw.plank,seesaw.pivot,trigger,payload,scissor,floor]);let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(({bodyA,bodyB})=>{
    const bodies=[bodyA,bodyB];
    if(bodies.includes(seesaw.plank)&&(bodies.includes(trigger)||bodies.includes(payload))){const impact=bodies.find(body=>body!==seesaw.plank);if(impact)applySeesawImpact(engine,seesaw.plank,impact)}
    if(bodies.includes(payload)&&bodies.includes(scissor))hit=true;
  }));
  for(let tick=0;tick<500&&!hit;tick++){Matter.Engine.update(engine,16.666);limitSeesawRotation(seesaw.plank)}
  assert.equal(hit,true,"the reference seesaw placement must make the level solvable");
});
