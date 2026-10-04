import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { MachinePhysicsEngine, ROLLING_AIR_FRICTION, WORLD_GRAVITY_SCALE } from "../engine/physics-engine.ts";
import { GADGET_CATALOG, PALETTE_GROUPS } from "../engine/gadget-catalog.ts";
import { localPoint, localVector, inversePoint, resizeGadget, resizeHandles, gadgetSize, candleFlameLocal, rocketNozzleLocal } from "../engine/gadget-geometry.ts";
import { gadgetPorts } from "../game/gadget-connections.ts";
import { airflowAt } from "../game/airflow.ts";
import { validateLevel, LEVEL_BY_ID } from "../levels/catalog.ts";
import { gadgetPositionMode, newLevel, setGadgetPositionMode, updateGadget, remember, undo, redo, hitGadget } from "../levels/authoring.ts";
import { initialPlacements } from "../components/game/placements.ts";
import { createDefaultStepBehaviors } from "../engine/step-behaviors.ts";
import { ropePorts } from "../game/control-ropes.ts";

const advance = (machine, ms) => { for(let time=0;time<ms;time+=1000/60) machine.step(1000/60); };
test("rolling balls retain momentum longer and use the stronger world gravity",()=>{
  const machine=new MachinePhysicsEngine();
  const floor=Matter.Bodies.rectangle(300,500,600,40,{isStatic:true}),rolling=machine.addGadget({id:"rolling",type:"ball",x:300,y:461}),airborne=machine.addGadget({id:"airborne",type:"ball",x:100,y:100});
  Matter.Composite.add(machine.world,floor);machine.step(16);
  assert.equal(rolling.frictionAir,ROLLING_AIR_FRICTION);
  assert.equal(airborne.frictionAir,GADGET_CATALOG.ball.physics.airFriction);
  assert.equal(machine.matter.gravity.scale,WORLD_GRAVITY_SCALE);
  assert.ok(WORLD_GRAVITY_SCALE>.001);
  machine.destroy();
});
test("a stationary candle ignites a stationary rocket only at its nozzle and completes the launch without level systems",()=>{
  for(const state of ["burning","unlit","extinguished"]){
    const m=new MachinePhysicsEngine();
    m.addGadget({id:"candle",type:"candle",x:300,y:350,state});
    m.addGadget({id:"rocket",type:"rocket",x:300,y:250});
    m.addGadget({id:"wrong-side",type:"rocket",x:300,y:390});
    m.step(16);assert.equal(m.state("rocket").state,state==="burning"?"burning":"mounted");
    assert.equal(m.state("wrong-side").state,"mounted");
    advance(m,1900);assert.equal(m.state("rocket").state,state==="burning"?"launched":"mounted");m.destroy();
  }
});
test("flipped candle flame and rocket nozzle use the same transformed anchors",()=>{
  for(const flipX of [false,true])for(const flipY of [false,true]){
    const m=new MachinePhysicsEngine(),c={id:"c",type:"candle",x:400,y:260,rotation:.7,flipX,flipY};
    const f=localPoint(c,candleFlameLocal(c)),r={id:"r",type:"rocket",x:0,y:0,rotation:.7,flipX,flipY};
    const nozzle=localVector(r,rocketNozzleLocal(r));r.x=f.x-nozzle.x;r.y=f.y-nozzle.y;
    m.addGadget(c);m.addGadget(r);m.step(16);assert.equal(m.state("r").state,"burning");m.destroy();
  }
});
test("multiple editor fishbowls release one fish each and their invisible bodies never support the ball",()=>{
  const m=new MachinePhysicsEngine();
  for(const [id,x] of [["a",200],["b",650]]){
    m.addGadget({id,type:"fishBowl",x,y:280});
    m.addGadget({id:`${id}-ball`,type:"ball",x,y:180});
    Matter.Body.setVelocity(m.body(`${id}-ball`),{x:0,y:7});
  }
  advance(m,500);
  for(const id of ["a","b"]){assert.equal(m.body(id).isSensor,true);assert.equal(m.body(id).collisionFilter.mask,0);assert.equal(m.state(id).state,"breaking");assert.ok(m.body(`${id}-ball`).position.y>350);}
  advance(m,700);assert.equal(m.bodiesByType("fish").length,2);
  for(const id of ["a","b"]){assert.equal(m.state(id).state,"broken");assert.equal(m.state(`${id}:fish`).state,"flopping");assert.equal(m.body(`${id}:fish`).isStatic,false);}
  advance(m,500);assert.equal(m.bodiesByType("fish").length,2);m.destroy();
});
test("existing level fish is reused and slow or upward impacts do not break a bowl",()=>{
  const m=new MachinePhysicsEngine();m.addGadget({id:"fish-bowl",type:"fishBowl",x:300,y:300,properties:{fishId:"mr-blue"}});m.addGadget({id:"mr-blue",type:"fish",x:300,y:300});
  m.addGadget({id:"ball",type:"ball",x:300,y:228});m.step(16);assert.equal(m.state("fish-bowl").state,"intact");assert.equal(m.bodiesByType("fish").length,1);
  Matter.Body.setPosition(m.body("ball"),{x:300,y:240});Matter.Body.setVelocity(m.body("ball"),{x:0,y:-7});m.step(16);assert.equal(m.state("fish-bowl").state,"intact");m.destroy();
});
test("resize keeps the opposite end fixed at arbitrary rotation and both flip axes",()=>{
  for(const type of ["ramp","steelBeam","woodWall","stoneWall"])for(const end of [0,1])for(const flipX of [false,true])for(const flipY of [false,true]){
    const c={id:"part",type,x:450,y:260,rotation:.83,flipX,flipY},axis=GADGET_CATALOG[type].resizeAxis;
    const handles=resizeHandles(c),pointer=localPoint(c,{x:axis==="x"?(end?1:-1)*220:0,y:axis==="y"?(end?1:-1)*220:0});
    const resized=resizeGadget(c,end,pointer),after=resizeHandles(resized);
    assert.ok(Math.hypot(after[1-end].x-handles[1-end].x,after[1-end].y-handles[1-end].y)<1e-8);
    assert.equal(gadgetSize(resized)[axis==="x"?"height":"width"],gadgetSize(c)[axis==="x"?"height":"width"]);
    assert.equal(hitGadget([resized],localPoint(resized,{x:0,y:0})).id,"part");
  }
});
test("flip mirrors physical airflow and electrical ports while preserving their identities",()=>{
  const m=new MachinePhysicsEngine(),config={id:"fan",type:"fan",x:400,y:300,flipX:true};const body=m.addGadget(config);
  assert.ok(airflowAt(body,{x:300,y:300})>0);assert.equal(airflowAt(body,{x:500,y:300}),0);
  const g={id:"g",type:"generator",x:400,y:300,flipX:true,flipY:true,rotation:.3};const port=gadgetPorts([g])[0];
  assert.deepEqual({x:port.x,y:port.y},localPoint(g,{x:36,y:20}));assert.equal(port.gadgetId,"g");m.destroy();
});
test("transforms round trip through level validation, initial placements and undo/redo",()=>{
  const level=newLevel();level.initialPlacements=[{id:"plank",type:"ramp",x:400,y:300,flipX:true,flipY:true,rotation:1,physics:{width:1200,height:14}}];
  const loaded=validateLevel(JSON.parse(JSON.stringify(level)));assert.equal(initialPlacements(loaded)[0].flipY,true);assert.equal(loaded.initialPlacements[0].physics.width,1200);
  const next=updateGadget(level,"plank",{flipX:false,physics:{width:900,height:14}}),history=remember({past:[],present:level,future:[]},next);
  assert.deepEqual(undo(history).present,level);assert.deepEqual(redo(undo(history)).present,next);
  assert.throws(()=>validateLevel({...level,initialPlacements:[{...level.initialPlacements[0],flipX:"true"}]}),/flipX/);
  assert.throws(()=>validateLevel({...level,initialPlacements:[{...level.initialPlacements[0],physics:{width:-10}}]}),/dimension/);
});
test("editor position modes preserve gadget defaults and let a candle fall onto the floor",()=>{
  for(const type of ["hamsterWheel","rocket","generator"])assert.equal(gadgetPositionMode({id:type,type,x:100,y:100}),"fixed");
  for(const type of ["ball","tennisBall","basketball"])assert.equal(gadgetPositionMode({id:type,type,x:100,y:100}),"gravity");
  const seesaw={id:"seesaw",type:"seesaw",x:100,y:100};
  assert.equal(gadgetPositionMode(seesaw),"fixed","a pivot fixes the seesaw's position");
  const seesawLevel={...newLevel(),fixedGadgets:[seesaw]};
  assert.deepEqual(setGadgetPositionMode(seesawLevel,"seesaw","gravity"),seesawLevel,"the editor cannot detach a catalog pivot");

  const level=newLevel();level.fixedGadgets=[{id:"candle",type:"candle",x:300,y:100}];
  const falling=setGadgetPositionMode(level,"candle","gravity"),candle=falling.fixedGadgets[0];
  assert.equal(gadgetPositionMode(candle),"gravity");
  assert.deepEqual({shape:candle.physics.shape,isSensor:candle.physics.isSensor,isStatic:candle.physics.isStatic,gravityScale:candle.physics.gravityScale},
    {shape:"rectangle",isSensor:false,isStatic:false,gravityScale:1});
  assert.deepEqual(validateLevel(JSON.parse(JSON.stringify(falling))),falling);

  const machine=new MachinePhysicsEngine(falling),start=machine.body("candle").position.y;
  Matter.Composite.add(machine.world,Matter.Bodies.rectangle(450,500,900,40,{isStatic:true,label:"floor"}));
  advance(machine,4000);
  assert.ok(machine.body("candle").position.y>start);
  assert.ok(machine.body("candle").position.y<470);
  machine.destroy();

  const fixed=setGadgetPositionMode(falling,"candle","fixed").fixedGadgets[0];
  assert.equal(gadgetPositionMode(fixed),"fixed");
  assert.equal(fixed.physics.shape,"sensor");
  assert.equal(fixed.physics.isSensor,true);
});
test("every gadget belongs to exactly one palette group and all shipped level sizes are preserved",()=>{
  for(const gadget of Object.values(GADGET_CATALOG))assert.ok(PALETTE_GROUPS.includes(gadget.paletteGroup),gadget.type);
  for(const level of LEVEL_BY_ID.values())assert.deepEqual(validateLevel(JSON.parse(JSON.stringify(level))),level);
});
test("a free editor cannon fires once from its own burning fuse and mirrored direction",()=>{
  for(const flipX of [false,true]){
    const m=new MachinePhysicsEngine(),c={id:"gun",type:"cannon",x:450,y:200,rotation:0,flipX};m.addGadget(c);
    const start=localPoint(c,{x:-18,y:-42});m.addGadget({id:"c",type:"candle",x:start.x,y:start.y+50});
    advance(m,1800);assert.equal(m.state("gun").state,"firing");assert.equal(m.bodiesByType("cannonball").length,1);
    assert.ok(m.body("gun:shot").velocity.x*(flipX?-1:1)>0);advance(m,500);assert.equal(m.bodiesByType("cannonball").length,1);m.destroy();
  }
});
test("a fast cannonball breaks a fishbowl from any firing direction",()=>{
  for(const [x,y,vx,vy] of [[300,370,0,-8],[230,300,8,0]]){
    const m=new MachinePhysicsEngine();
    m.addGadget({id:"bowl",type:"fishBowl",x:300,y:300});
    const shot=m.addGadget({id:"shot",type:"cannonball",x,y});
    Matter.Body.setVelocity(shot,{x:vx,y:vy});advance(m,250);
    assert.equal(m.state("bowl").state,"breaking");
    assert.equal(m.signal("fishBowl.broken.bowl"),true);m.destroy();
  }
});
test("level 2 flame and level 32 TNT remain reachable with their reference arrangements",()=>{
  const balloonLevel=LEVEL_BY_ID.get("balloon-candle"),balloon=new MachinePhysicsEngine(balloonLevel);
  [[180,370],[320,305],[460,240],[600,175],[740,110]].forEach(([x,y],i)=>balloon.addGadget({id:`plank-${i}`,type:"ramp",x,y,rotation:-.45}));
  advance(balloon,16000);assert.equal(balloon.goalReached(balloonLevel.goal),true);balloon.destroy();
  const tntLevel=LEVEL_BY_ID.get("tnt-impulse"),tnt=new MachinePhysicsEngine(tntLevel);
  tnt.addGadget({id:"tnt",type:"tnt",x:288,y:328});tnt.step(16);advance(tnt,630);assert.equal(tnt.state("tnt").state,"burning");
  advance(tnt,50);assert.equal(tnt.state("tnt").state,"exploded");advance(tnt,5000);assert.equal(tnt.goalReached(tntLevel.goal),true);tnt.destroy();
});
test("imported active rocket and broken bowl finish their instance states",()=>{
  const m=new MachinePhysicsEngine();m.addGadget({id:"r",type:"rocket",x:100,y:200,state:"launching"});m.addGadget({id:"b",type:"fishBowl",x:400,y:200,state:"broken"});
  advance(m,1500);assert.equal(m.state("r").state,"launched");assert.equal(m.state("b:fish").state,"flopping");assert.equal(m.body("b").collisionFilter.mask,0);m.destroy();
});
test("a conveyor transports along its mirrored local surface at any rotation",()=>{
  for(const flipX of [false,true])for(const flipY of [false,true])for(const rotation of [0,.7]){
    const m=new MachinePhysicsEngine(),belt={id:"belt",type:"conveyor",x:400,y:250,rotation,flipX,flipY,state:"running"},ball={id:"ball",type:"ball",...localPoint(belt,{x:0,y:-32})};
    m.addGadget(belt);m.addGadget(ball);const endpoint=config=>({config,state:m.state(config.id),body:m.body(config.id)});
    createDefaultStepBehaviors().step([endpoint(belt),endpoint(ball)],16);
    const forward=localVector(belt,{x:1,y:0}),velocity=m.body("ball").velocity;
    assert.ok(Math.abs(velocity.x*forward.x+velocity.y*forward.y-3.4)<1e-8);m.destroy();
  }
});
test("compound bucket walls, water and rope handles mirror around the same local axes",()=>{
  const m=new MachinePhysicsEngine(),base={id:"plain",type:"bucket",x:400,y:300,rotation:.5};m.addGadget(base);
  for(const flipX of [false,true])for(const flipY of [false,true]){
    const config={...base,id:`bucket-${flipX}-${flipY}`,flipX,flipY};m.addGadget(config);
    const plain=m.body("plain").parts.slice(1).flatMap(part=>part.vertices),mirrored=m.body(config.id).parts.slice(1).flatMap(part=>part.vertices);
    plain.forEach((vertex,i)=>{const expected=localPoint(config,inversePoint(base,vertex));assert.ok(Math.hypot(mirrored[i].x-expected.x,mirrored[i].y-expected.y)<1e-8);});
    const expected=localPoint(config,{x:-24.5,y:-18}),drop=m.body(`${config.id}:water:0`);assert.ok(Math.hypot(drop.position.x-expected.x,drop.position.y-expected.y)<1e-8);
    const scissor={...config,id:"s",type:"scissor"},port=ropePorts([scissor])[0];assert.deepEqual({x:port.x,y:port.y},localPoint(scissor,{x:27,y:27}));
  }
  m.destroy();
});
