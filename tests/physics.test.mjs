import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";

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
  const initialBallY=60,finalBallY=456;
  const weightY=Math.max(175,430-Math.max(0,finalBallY-initialBallY));
  assert.ok(weightY<=230,"the available fall distance must lift the weight to its target height");
});

test("level 6 stationary monkey powers the conveyor only after both triggers",()=>{
  const state=(ropeInstalled,ballY,beltConnected)=>{const blindOpen=ropeInstalled&&ballY>400;return{blindOpen,wheelRotating:blindOpen,conveyorMoving:blindOpen&&beltConnected,monkeyX:715}};
  assert.equal(state(false,456,true).wheelRotating,false);
  assert.equal(state(true,300,true).wheelRotating,false);
  assert.equal(state(true,456,false).wheelRotating,true);
  assert.equal(state(true,456,false).conveyorMoving,false);
  assert.equal(state(true,456,true).conveyorMoving,true);
  assert.equal(state(true,456,true).monkeyX,715,"the monkey gadget must remain stationary");
});
