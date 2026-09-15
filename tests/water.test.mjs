import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {advanceWaterFlow,createBucketAssembly,WATER_PARTICLE_COUNT,WATER_PARTICLE_RADIUS,WATER_SHAPE_RULES} from "../game/water.ts";
import {buildWaterField} from "../components/game/fluid-water-renderer.ts";

test("nearby water drops form one visible stream while distant drops stay separate",()=>{
  const nearby=buildWaterField([
    {x:20,y:20,vx:0,vy:0},{x:28,y:20,vx:0,vy:0},
  ],80,40,1);
  assert.ok(nearby.field[20*nearby.columns+24]>.34,"the gap between close drops is filled");

  const distant=buildWaterField([
    {x:20,y:20,vx:0,vy:0},{x:70,y:20,vx:0,vy:0},
  ],90,40,1);
  assert.equal(distant.field[20*distant.columns+45],0,"separate splashes do not become an artificial bridge");
});

test("nearby drops press apart without being pinned to the floor",()=>{
  const left=Matter.Bodies.circle(40,478,WATER_PARTICLE_RADIUS,{label:"water"});
  const right=Matter.Bodies.circle(46,478,WATER_PARTICLE_RADIUS,{label:"water"});
  advanceWaterFlow([left,right]);
  assert.ok(left.velocity.x<0&&right.velocity.x>0,"pressure spreads the puddle sideways");
  assert.equal(left.position.y,478,"water keeps its physical floor position");
});

test("bucket is an open compound shape containing stable water particles",()=>{
  const assembly=createBucketAssembly(220,160,-.08);
  assert.equal(assembly.water.length,WATER_PARTICLE_COUNT);
  assert.equal(assembly.bucket.isStatic,true,"the level controller rotates the bucket predictably");
  assert.equal(assembly.bucket.parts.length,4,"parent plus bottom and two side walls form an open bucket");
});

test("level 10 reference bucket placement pours around geometry and wets the candle",()=>{
  const engine=Matter.Engine.create({gravity:{x:0,y:1,scale:.001}});
  const assembly=createBucketAssembly(680,150,-.08);
  const candle=Matter.Bodies.rectangle(805,430,50,100,{isStatic:true,isSensor:true,label:"candle"});
  const bodies=[
    Matter.Bodies.rectangle(450,500,900,40,{isStatic:true,label:"floor"}),
    Matter.Bodies.rectangle(500,285,235,18,{isStatic:true,angle:.08,label:"steelBeam"}),
    Matter.Bodies.rectangle(335,390,24,180,{isStatic:true,label:"woodWall"}),
    Matter.Bodies.rectangle(675,395,42,170,{isStatic:true,label:"stoneWall"}),
    Matter.Bodies.rectangle(760,330,155,14,{isStatic:true,angle:.7,label:"ramp"}),
    candle,assembly.bucket,...assembly.water,
  ];
  Matter.Composite.add(engine.world,bodies);
  let wet=false;
  Matter.Events.on(engine,"collisionStart",event=>event.pairs.forEach(pair=>{
    const labels=[pair.bodyA.label,pair.bodyB.label];
    if(labels.includes("water")&&labels.includes("candle"))wet=true;
  }));
  const startAngle=-.08,pivotLocal={x:34,y:-23},pivot={
    x:680+Math.cos(startAngle)*pivotLocal.x-Math.sin(startAngle)*pivotLocal.y,
    y:150+Math.sin(startAngle)*pivotLocal.x+Math.cos(startAngle)*pivotLocal.y,
  };
  for(let tick=0;tick<600&&!wet;tick++){
    Matter.Engine.update(engine,16.666);
    advanceWaterFlow(assembly.water);
    const t=Math.min(1,tick/115),eased=t*t*(3-2*t),angle=startAngle+eased*2.1;
    const rotatedX=Math.cos(angle)*pivotLocal.x-Math.sin(angle)*pivotLocal.y,rotatedY=Math.sin(angle)*pivotLocal.x+Math.cos(angle)*pivotLocal.y;
    Matter.Body.setPosition(assembly.bucket,{x:pivot.x-rotatedX,y:pivot.y-rotatedY});
    Matter.Body.setAngle(assembly.bucket,angle);
  }
  assert.equal(wet,true,"a valid high-right placement must pour onto the candle");
  assert.ok(assembly.water.every(drop=>Number.isFinite(drop.position.x)&&Number.isFinite(drop.position.y)),"the particle simulation must remain stable");
});

test("water interaction matrix covers rigid shapes, animals, fire, floor and ignored rope",()=>{
  const text=WATER_SHAPE_RULES.map(rule=>`${rule.objects} ${rule.response}`).join(" ");
  for(const expected of ["Hamsterrad","Luftballon","Seil","Katze, Maus","Lunte, Kerze","Boden, Eimer","Stahlträger"]){
    assert.match(text,new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
});
