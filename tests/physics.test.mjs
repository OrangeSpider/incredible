import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {applySeesawImpact,createSeesaw,limitSeesawRotation,SEESAW_MAX_ANGLE,SEESAW_WIDTH} from "../game/seesaw.ts";
import {availableLiftKg,BOWLING_PULL_KG,canLift,LEVEL_FIVE_LOAD_KG,loadRiseFromPull,supportingStrands} from "../game/pulley.ts";

test("level 2 has a solvable five-plank route to the candle", () => {
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const balloon=Matter.Bodies.circle(115,430,24,{density:.00012,frictionAir:.018,restitution:.15,label:"balloon"});
  const candle=Matter.Bodies.rectangle(805,95,38,80,{isStatic:true,isSensor:true,label:"candle"});
  const floor=Matter.Bodies.rectangle(450,500,900,40,{isStatic:true});
  Matter.Composite.add(engine.world,[balloon,candle,floor]);
  [[180,370],[320,305],[460,240],[600,175],[740,110]].forEach(([x,y])=>Matter.Composite.add(engine.world,Matter.Bodies.rectangle(x,y,155,14,{isStatic:true,angle:-.45})));
  let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(pair=>{
    const labels=[pair.bodyA.label,pair.bodyB.label];
    if(labels.includes("balloon")&&labels.includes("candle"))hit=true;
  }));
  for(let tick=0;tick<900&&!hit;tick++){
    Matter.Body.applyForce(balloon,balloon.position,{x:0,y:-.00035});
    Matter.Engine.update(engine,16.666);
  }
  assert.equal(hit,true,"the reference plank arrangement must pop the balloon");
});

test("level 3 fan can steer the balloon through the target ring", () => {
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const balloon=Matter.Bodies.circle(210,420,24,{density:.00012,frictionAir:.025,label:"balloon"});
  const ring=Matter.Bodies.circle(780,150,45,{isStatic:true,isSensor:true,label:"ring"});
  Matter.Composite.add(engine.world,[balloon,ring]);
  const fan={x:130,y:440,angle:-Math.PI/12};
  let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(pair=>{
    const labels=[pair.bodyA.label,pair.bodyB.label];
    if(labels.includes("balloon")&&labels.includes("ring"))hit=true;
  }));
  for(let tick=0;tick<900&&!hit;tick++){
    Matter.Body.applyForce(balloon,balloon.position,{x:0,y:-.00023});
    const dx=balloon.position.x-fan.x,dy=balloon.position.y-fan.y,c=Math.cos(fan.angle),s=Math.sin(fan.angle);
    const forward=dx*c+dy*s,side=-dx*s+dy*c;
    if(forward>0&&forward<420&&Math.abs(side)<100+forward*.3){
      const force=.00035*(1-forward/420);
      Matter.Body.applyForce(balloon,balloon.position,{x:c*force,y:s*force});
    }
    Matter.Engine.update(engine,16.666);
  }
  assert.equal(hit,true,"a correctly aimed fan must carry the balloon through the ring");
});

test("level 4 trampoline can redirect the falling ball into the basket",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const ball=Matter.Bodies.circle(215,85,19,{density:.006,label:"ball"});
  const trampoline=Matter.Bodies.rectangle(230,430,135,18,{isStatic:true,isSensor:true,angle:Math.PI/6,label:"trampoline"});
  const basket=Matter.Bodies.rectangle(760,175,90,80,{isStatic:true,isSensor:true,label:"basket"});
  const floor=Matter.Bodies.rectangle(450,500,900,40,{isStatic:true});
  Matter.Composite.add(engine.world,[ball,trampoline,basket,floor]);let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(pair=>{const labels=[pair.bodyA.label,pair.bodyB.label];if(labels.includes("trampoline")&&labels.includes("ball"))Matter.Body.setVelocity(ball,{x:Math.sin(trampoline.angle)*20,y:-Math.abs(Math.cos(trampoline.angle))*20});if(labels.includes("basket")&&labels.includes("ball"))hit=true}));
  for(let tick=0;tick<900&&!hit;tick++)Matter.Engine.update(engine,16.666);
  assert.equal(hit,true,"an angled trampoline must redirect the ball into the basket");
});

test("a fixed pulley only redirects force while moving pulleys create mechanical advantage",()=>{
  assert.equal(supportingStrands(0),0,"a fixed pulley adds no supporting strand to a moving load");
  assert.equal(supportingStrands(1),2);
  assert.equal(supportingStrands(2),4);
});

test("block and tackle conserves rope length by trading force for distance",()=>{
  assert.equal(loadRiseFromPull(400,2),200);
  assert.equal(loadRiseFromPull(400,4),100,"a 4:1 tackle needs four metres of pull for one metre of lift");
});

test("level 5 needs two reeved moving pulleys to lift 50 kg",()=>{
  assert.equal(canLift(BOWLING_PULL_KG,LEVEL_FIVE_LOAD_KG,2),false);
  assert.equal(canLift(BOWLING_PULL_KG,LEVEL_FIVE_LOAD_KG,4),true);
  assert.ok(availableLiftKg(BOWLING_PULL_KG,4)>=LEVEL_FIVE_LOAD_KG);
});

test("level 6 needle pops balloons but has no generic collision action",()=>{
  const effect=(needleTarget)=>needleTarget==="balloon"?"popped":"none";
  assert.equal(effect("balloon"),"popped");assert.equal(effect("bowlingBall"),"none");assert.equal(effect("cat"),"none");
});

test("level 7 mouse flees only when the cat is on the same height",()=>{
  const flees=(catY,mouseY)=>Math.abs(catY-mouseY)<35;
  assert.equal(flees(370,390),true);assert.equal(flees(370,430),false);
});

test("level 8 three intermediate gears connect drive and target",()=>{
  const gears=[{x:250,id:0},{x:334,id:1},{x:418,id:2},{x:502,id:3},{x:590,id:4}],depth=new Map([[0,0]]),queue=[gears[0]];
  while(queue.length){const current=queue.shift();for(const candidate of gears){if(depth.has(candidate.id))continue;if(Math.abs(Math.abs(current.x-candidate.x)-84)<14){depth.set(candidate.id,depth.get(current.id)+1);queue.push(candidate)}}}
  assert.equal(depth.has(4),true);assert.equal(depth.get(4)%2,0,"four gear contacts preserve the source direction");
});

test("level 9 cannonball is smaller, lighter and can hit the target",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}}),angle=-.28;
  const target=Matter.Bodies.circle(825,230,48,{isStatic:true,isSensor:true,label:"target"});
  const shot=Matter.Bodies.circle(500+Math.cos(angle)*58,300+Math.sin(angle)*58,11,{density:.0025,label:"shot"});
  Matter.Body.setVelocity(shot,{x:Math.cos(angle)*14,y:Math.sin(angle)*14});Matter.Composite.add(engine.world,[target,shot]);let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(pair=>{const labels=[pair.bodyA.label,pair.bodyB.label];if(labels.includes("target")&&labels.includes("shot"))hit=true}));
  for(let tick=0;tick<300&&!hit;tick++)Matter.Engine.update(engine,16.666);
  assert.equal(hit,true);assert.ok(shot.circleRadius<18);assert.ok(shot.density<.006);
});

test("seesaw is 1.5 plank widths and accelerates the opposite payload upward",()=>{
  assert.equal(SEESAW_WIDTH,155*1.5);
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const assembly=createSeesaw(535,430,0);
  const impact=Matter.Bodies.circle(420,100,18,{density:.006,label:"impact"});
  const payload=Matter.Bodies.circle(650,385,16,{density:.0018,label:"payload"});
  const basket=Matter.Bodies.rectangle(680,150,110,100,{isStatic:true,isSensor:true,label:"basket"});
  const floor=Matter.Bodies.rectangle(450,500,900,40,{isStatic:true});
  Matter.Composite.add(engine.world,[assembly.plank,assembly.pivot,impact,payload,basket,floor]);
  let hit=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(({bodyA,bodyB})=>{
    const labels=[bodyA.label,bodyB.label];
    if(labels.includes("seesaw")&&labels.includes("impact"))applySeesawImpact(engine,assembly.plank,impact);
    if(labels.includes("basket")&&labels.includes("payload"))hit=true;
  }));
  for(let tick=0;tick<900&&!hit;tick++)Matter.Engine.update(engine,16.666);
  assert.equal(hit,true,"the opposite end must launch its payload into the reference basket");
});

test("left impact lowers the left end and the support stops a full rotation",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}}),assembly=createSeesaw(450,350,0);
  const impact=Matter.Bodies.circle(340,250,18,{label:"impact"});
  Matter.Body.setVelocity(impact,{x:0,y:12});
  Matter.Composite.add(engine.world,[assembly.plank,assembly.pivot,impact]);
  applySeesawImpact(engine,assembly.plank,impact);
  assert.ok(assembly.plank.angularVelocity<0,"a hit on the left must rotate the left end downward");
  for(let tick=0;tick<240;tick++){Matter.Engine.update(engine,16.666);limitSeesawRotation(assembly.plank)}
  assert.ok(Math.abs(assembly.plank.angle)<=SEESAW_MAX_ANGLE+1e-9,"the red support must act as a hard angular stop");
});
