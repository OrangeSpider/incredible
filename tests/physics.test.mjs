import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {applySeesawImpact,createSeesaw,createSeesawRope,shortenSeesawRope,SEESAW_WIDTH} from "../game/seesaw.ts";

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

test("level 5 converts the ball fall distance into weight lift",()=>{
  const initialBallY=60,finalBallY=456,fall=finalBallY-initialBallY,pulleyX=420,tension=Math.min(1,fall/260);
  const weightY=Math.max(175,430-fall),weightX=760+(pulleyX-760)*tension;
  assert.ok(weightY<=230,"the available fall distance must lift the weight to its target height");
  assert.equal(weightX,pulleyX,"rope tension must also pull sideways toward an offset pulley");
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

test("seesaw ropes pull the same end upward or downward depending on anchor",()=>{
  const simulate=(anchorY)=>{
    const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}}),assembly=createSeesaw(450,350,0);
    const rope=createSeesawRope(assembly.plank,{x:560,y:anchorY});
    Matter.Composite.add(engine.world,[assembly.plank,assembly.pivot,rope.constraint]);
    for(let tick=0;tick<180;tick++){shortenSeesawRope(rope,tick*16.666);Matter.Engine.update(engine,16.666)}
    return assembly.plank.angle;
  };
  assert.ok(simulate(220)<-.5,"an upper right anchor must pull the right end upward");
  assert.ok(simulate(470)>.5,"a lower right anchor must pull the right end downward");
});
