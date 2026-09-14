"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createBucketAssembly } from "@/game/water";
import { applySeesawImpact,limitSeesawRotation,SEESAW_WIDTH } from "@/game/seesaw";
import { analyzePulleyRoute,BOWLING_PULL_KG,dampPulleyVelocity,LEVEL_FIVE_INITIAL_WEIGHT_Y,LEVEL_FIVE_LOAD_KG,LEVEL_FIVE_TARGET_Y,PULLEY_GRAVITY_PX,pulleyTargetReached,PulleyRouteKind,ropeConstraintCorrection,ropeGeometry,RopePoint } from "@/game/pulley";
import {catSpriteOffsetX,catSpritePose} from "@/game/cat";
import {advanceCatAndMouse,CATAPULT_MOUSE_HOLE_X,CATAPULT_PLATFORM,catapultImpactMode,catapultLaunchVelocity,catapultReleasePosition} from "@/game/catapult";
import {mouseSpriteFrame} from "@/game/mouse";
import {animalHasSupport,isAnimalFalling} from "@/game/animals";
import {FuseNetwork} from "@/game/fuse";
import {CHARACTERS} from "@/game/characters";
import {advanceCatTowardFish,catSeesFish,FISH_REVEAL_DELAY_MS,fishbowlBreaks} from "@/game/fish";
import {ropePullIsTaut,SCISSOR_LAYOUT,scissorClosesFromImpact,scissorPullPoint} from "@/game/scissors";
import {drawConveyor,drawDriveBelt,driveBeltGeometry} from "@/game/drive";
import {nextRocketState,rocketVisual} from "@/game/rocket";
import { MachinePhysicsEngine } from "@/engine/physics-engine";
import { machinePlugin } from "@/engine/body-factory";
import type { LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import type { PlacedGadget, RopeNode, ScissorRope } from "./types";

const ROPE_ANCHOR={x:92,y:64};
const FAN_VISIBLE_RANGE=210;
const FAN_MAX_RANGE=FAN_VISIBLE_RANGE*2;

function drawFreeRope(ctx:CanvasRenderingContext2D,points:{x:number;y:number;kind:PulleyRouteKind}[],now:number,running:boolean){
  if(!points.length)return;const wobble=running?Math.sin(now*.012)*1.5:0,radius=30;
  ctx.save();ctx.strokeStyle="#6b4930";ctx.lineWidth=5;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let index=1;index<points.length;index++){
    const point=points[index];
    if(index<points.length-1&&(point.kind==="fixed"||point.kind==="moving")){
      const previous=points[index-1],next=points[index+1],entry=Math.atan2(previous.y-point.y,previous.x-point.x),exit=Math.atan2(next.y-point.y,next.x-point.x),cross=(previous.x-point.x)*(next.y-point.y)-(previous.y-point.y)*(next.x-point.x);ctx.lineTo(point.x+Math.cos(entry)*radius,point.y+Math.sin(entry)*radius+wobble);ctx.arc(point.x,point.y,radius,entry,exit,cross>0);
    }else ctx.lineTo(point.x,point.y+wobble);
  }
  ctx.stroke();ctx.strokeStyle="#b99362";ctx.lineWidth=1.5;ctx.setLineDash([5,6]);ctx.stroke();ctx.setLineDash([]);
  const looseTail=(point:{x:number;y:number;kind:PulleyRouteKind},side:number)=>{if(point.kind==="anchor"||point.kind==="pull")return;ctx.strokeStyle="#6b4930";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.quadraticCurveTo(point.x+side*18,point.y+18,point.x+side*8,point.y+38);ctx.stroke()};looseTail(points[0],-1);looseTail(points.at(-1)!,1);ctx.restore();
}

export function routeKindForPart(type:PlaceableGadgetType):PulleyRouteKind|null{
  if(type==="movingPulley")return"moving";if(type==="pulley")return"fixed";if(type==="ball")return"pull";return null;
}

const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

type GameCanvasProps = {
  level: LevelDefinition;
  placed: PlacedGadget[];
  ropePath: RopeNode[];
  scissorRopes: ScissorRope[];
  pendingScissor: number | null;
  ropeMode: boolean;
  selectedTool: PlaceableGadgetType | null;
  selectedId: number | null;
  running: boolean;
  attempt: number;
  onWin: () => void;
};

export default function GameCanvas({ level, placed, ropePath, scissorRopes, pendingScissor, ropeMode, selectedTool, selectedId, running, attempt, onWin }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scene = level.scene;
    const hasSystem = (system: string) => level.systems.includes(system);
    const standaloneMouseChase = hasSystem("cat-mouse") && !hasSystem("catapult") && !hasSystem("cat-fish");
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const fireSprites=new Image();fireSprites.src="/assets/fire-animation-sprites.png";
    const drawFireSprite=(row:number,frame:number,x:number,y:number,width:number,height:number,rotation=0)=>{
      if(!fireSprites.complete||!fireSprites.naturalWidth)return false;
      const cellWidth=fireSprites.naturalWidth/6,cellHeight=fireSprites.naturalHeight/3;
      ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(fireSprites,frame*cellWidth,row*cellHeight,cellWidth,cellHeight,-width/2,-height/2,width,height);ctx.restore();return true;
    };
    const waterSprites=new Image();waterSprites.src="/assets/water-animation-sprites.png";
    const drawWaterSprite=(row:number,frame:number,x:number,y:number,width:number,height:number,rotation=0)=>{
      if(!waterSprites.complete||!waterSprites.naturalWidth)return false;
      const cellWidth=waterSprites.naturalWidth/6,cellHeight=waterSprites.naturalHeight/3;
      ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(waterSprites,frame*cellWidth,row*cellHeight,cellWidth,cellHeight,-width/2,-height/2,width,height);ctx.restore();return true;
    };
    const hamsterSprites=new Image();hamsterSprites.src="/assets/hamster-wheel-sprites.png";
    const drawHamsterSprite=(frame:number,x:number,y:number,width:number,height:number)=>{
      if(!hamsterSprites.complete||!hamsterSprites.naturalWidth)return false;
      const normalized=((frame%6)+6)%6,columns=3,cellWidth=hamsterSprites.naturalWidth/columns,cellHeight=hamsterSprites.naturalHeight/2,column=normalized%columns,row=Math.floor(normalized/columns);
      ctx.drawImage(hamsterSprites,column*cellWidth,row*cellHeight,cellWidth,cellHeight,x-width/2,y-height/2,width,height);return true;
    };
    const catSprites=new Image();catSprites.src="/assets/cat-animation-sprites.png";
    const drawCatSprite=(row:number,frame:number,x:number,y:number,size:number)=>{
      if(!catSprites.complete||!catSprites.naturalWidth)return false;
      const cellWidth=catSprites.naturalWidth/3,cellHeight=catSprites.naturalHeight/3,column=((frame%3)+3)%3;
      ctx.drawImage(catSprites,column*cellWidth,row*cellHeight,cellWidth,cellHeight,x-size/2,y-size/2,size,size);return true;
    };
    const mouseSprites=new Image();mouseSprites.src="/assets/mouse-running-sprites.png";
    const drawMouseSprite=(frame:number,x:number,y:number,size:number)=>{
      if(!mouseSprites.complete||!mouseSprites.naturalWidth)return false;
      const column=((frame%3)+3)%3,cellWidth=mouseSprites.naturalWidth/3,cellHeight=mouseSprites.naturalHeight;
      ctx.drawImage(mouseSprites,column*cellWidth,0,cellWidth,cellHeight,x-size/2,y-size/2,size,size);return true;
    };
    const mrBlueSprites=new Image();mrBlueSprites.src="/assets/mr-blue-animation-sprites.png";
    const drawMrBlueSprite=(row:number,frame:number,x:number,y:number,size:number)=>{
      if(!mrBlueSprites.complete||!mrBlueSprites.naturalWidth)return false;
      const column=((frame%3)+3)%3,cellWidth=mrBlueSprites.naturalWidth/3,cellHeight=mrBlueSprites.naturalHeight/3;
      ctx.drawImage(mrBlueSprites,column*cellWidth,row*cellHeight,cellWidth,cellHeight,x-size/2,y-size/2,size,size);return true;
    };
    const rocketSprites=new Image();rocketSprites.src="/assets/rocket-launch-sprites.png";
    const drawRocketSprite=(row:number,frame:number,x:number,y:number,size:number)=>{
      if(!rocketSprites.complete||!rocketSprites.naturalWidth)return false;
      const column=((frame%4)+4)%4,cellWidth=rocketSprites.naturalWidth/4,cellHeight=rocketSprites.naturalHeight/2;
      ctx.drawImage(rocketSprites,column*cellWidth,row*cellHeight,cellWidth,cellHeight,x-size/2,y-size/2,size,size);return true;
    };
    // Die drei Zappelzeichnungen haben unterschiedlich viel transparenten Rand.
    // Diese optischen Anker halten Mr. Blue am selben Ort, ohne den Sprung zu glätten.
    const mrBlueFlopOffsets=[{x:-4,y:2},{x:-2,y:2},{x:7,y:2}] as const;
    const drawFallbackFlame=(x:number,y:number,now:number,scale=1)=>{const sway=Math.sin(now*.018)*3*scale;ctx.save();ctx.translate(x,y);ctx.fillStyle="#e94620";ctx.beginPath();ctx.moveTo(-9*scale,10*scale);ctx.quadraticCurveTo((-15+sway)*scale,-4*scale,sway,-18*scale);ctx.quadraticCurveTo((14+sway)*scale,-3*scale,9*scale,10*scale);ctx.fill();ctx.fillStyle="#ffd34f";ctx.beginPath();ctx.ellipse(sway*.35,3*scale,4*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.restore()};
    // The level JSON is the source of truth for every fixed body. The engine
    // builds the Matter.js bodies from the shared gadget catalog and also owns
    // state transitions and categorized gadget interactions.
    const machine = new MachinePhysicsEngine(level);
    const engine = machine.matter;
    const W = 900, H = 520;
    const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label:"floor" });
    Matter.Composite.add(engine.world, floor);
    const waterBodies:Matter.Body[]=[],waterSplashAt=new Map<number,number>();
    const cat=machine.bodiesByType("cat")[0]??null;
    const balloon=machine.bodiesByType("balloon").find(body=>body.label==="levelBalloon")??null;
    const levelBall=machine.body("falling-ball");
    const weight=machine.body("weight");
    let bucketBody:Matter.Body|null=null;
    let seesawBody:Matter.Body|null=machine.bodiesByType("seesaw")[0]??null;
    const fishBowl=machine.body("fish-bowl");
    const fishBody=machine.body("mr-blue");
    const hamsterWheelBody=machine.bodiesByType("hamsterWheel")[0]??null;
    const conveyorBody=machine.bodiesByType("conveyor")[0]??null;
    const fallingCandle=machine.body("falling-candle");
    const rocketBodies=machine.bodiesByType("rocket");
    const conveyorConfig=level.fixedGadgets.find(gadget=>gadget.type==="conveyor");
    const conveyorWidth=Number(conveyorConfig?.physics?.width??270);
    const tetheredBalloonConfigs=level.fixedGadgets.filter(gadget=>gadget.type==="balloon"&&gadget.state==="tethered");
    const scissorBalloons=tetheredBalloonConfigs.flatMap(gadget=>{const body=machine.body(gadget.id);return body?[body]:[]});
    for(const p of placed){
      let body:Matter.Body|null;
      if(p.type==="bucket"){
        const assembly=createBucketAssembly(p.x,p.y,p.rotation);body=assembly.bucket;bucketBody=body;
        waterBodies.push(...assembly.water);Matter.Composite.add(engine.world,[body,...assembly.water]);
      }else{
        const physics = p.type==="movingPulley" || (p.type==="ball"&&level.systems.includes("pulley-rope"))
          ? {isStatic:true}
          : p.type==="mouse" ? {isStatic:!running} : undefined;
        body=machine.addGadget({id:`placed-${p.id}`,type:p.type,x:p.x,y:p.y,rotation:p.rotation,collisionLabel:p.type,physics});
        if(p.type==="seesaw")seesawBody=body;
      }
      if(body)body.plugin={...body.plugin,placedId:p.id};
    }
    const driveBelt=placed.find(p=>p.type==="belt")??null,beltConnected=!!driveBelt,allBodies=Matter.Composite.allBodies(engine.world),bodyByPlacedId=new Map<number,Matter.Body>();
    allBodies.forEach(body=>{const placedId=body.plugin?.placedId;if(typeof placedId==="number")bodyByPlacedId.set(placedId,body)});
    const scissorRopePhysics=scissorRopes.flatMap(connection=>{const pullBody=bodyByPlacedId.get(connection.placedId);if(!pullBody)return[];const anchor=scissorPullPoint(connection.scissorIndex),restLength=Math.hypot(pullBody.position.x-anchor.x,pullBody.position.y-anchor.y),constraint=Matter.Constraint.create({pointA:anchor,bodyB:pullBody,length:restLength,stiffness:.42,damping:.14,label:`scissorRope-${connection.scissorIndex}`});Matter.Composite.add(engine.world,constraint);return[{...connection,pullBody,anchor,restLength}]});
    const placedById=new Map(placed.map(part=>[part.id,part])),routeKinds=ropePath.map(node=>node.kind==="anchor"?"anchor":routeKindForPart(placedById.get(node.placedId)?.type??"rope")).filter((kind):kind is PulleyRouteKind=>kind!==null),routeAnalysis=analyzePulleyRoute(routeKinds);
    const routeFixed=ropePath.flatMap(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="pulley"?[bodyByPlacedId.get(node.placedId)].filter((body):body is Matter.Body=>!!body):[]),routeMoving=ropePath.flatMap(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="movingPulley"?[bodyByPlacedId.get(node.placedId)].filter((body):body is Matter.Body=>!!body):[]),ballNode=ropePath.find(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="ball"),placedBall=ballNode?.kind==="part"?(bodyByPlacedId.get(ballNode.placedId)??null):null;
    const initialWeightY=LEVEL_FIVE_INITIAL_WEIGHT_Y,initialMovingPositions=routeMoving.map(body=>({...body.position}));if(hasSystem("pulley-rope")&&weight&&routeMoving.length){const lowerCenterX=routeMoving.reduce((sum,body)=>sum+body.position.x,0)/routeMoving.length;Matter.Body.setPosition(weight,{x:lowerCenterX,y:initialWeightY})}
    const physicsPoints=():RopePoint[]=>ropePath.flatMap(node=>{if(node.kind==="anchor")return[{...ROPE_ANCHOR,group:"static" as const}];const part=placedById.get(node.placedId),body=bodyByPlacedId.get(node.placedId);if(!part||!body)return[];return[{x:body.position.x,y:body.position.y,group:part.type==="ball"?"ball" as const:part.type==="movingPulley"?"block" as const:"static" as const}]});
    const ropeReady=routeAnalysis.tensioned&&!!placedBall,restRopeLength=ropeGeometry(physicsPoints()).length,initialBlockPosition=weight?{...weight.position}:{x:760,y:initialWeightY};
    const mouseBody=Matter.Composite.allBodies(engine.world).find(body=>body.label==="mouse")??null;
    const gearBodies=Matter.Composite.allBodies(engine.world).filter(body=>["gearSource","gear","gearTarget"].includes(body.label));const gearDepth=new Map<number,number>();const gearSource=gearBodies.find(body=>body.label==="gearSource");if(gearSource){gearDepth.set(gearSource.id,0);const queue=[gearSource];while(queue.length){const current=queue.shift()!;for(const candidate of gearBodies){if(gearDepth.has(candidate.id))continue;const distance=Math.hypot(current.position.x-candidate.position.x,current.position.y-candidate.position.y);if(Math.abs(distance-84)<14){gearDepth.set(candidate.id,(gearDepth.get(current.id)??0)+1);queue.push(candidate)}}}}const gearsConnected=gearBodies.some(body=>body.label==="gearTarget"&&gearDepth.has(body.id));
    const cannonBody=Matter.Composite.allBodies(engine.world).find(body=>body.label==="cannon")??null,fuseBodies=Matter.Composite.allBodies(engine.world).filter(body=>body.label==="fuse");
    const worldPoint=(body:Matter.Body,x:number,y:number)=>({x:body.position.x+x*Math.cos(body.angle)-y*Math.sin(body.angle),y:body.position.y+x*Math.sin(body.angle)+y*Math.cos(body.angle)}),fuseId=(body:Matter.Body)=>`fuse-${body.id}`,cannonFuseId="cannon-fuse";
    const fuseNetwork=new FuseNetwork([...fuseBodies.map(body=>({id:fuseId(body),start:worldPoint(body,-55,0),end:worldPoint(body,55,0),burnDurationMs:1200})),...(cannonBody?[{id:cannonFuseId,start:worldPoint(cannonBody,-18,-42),end:worldPoint(cannonBody,-26,-17),burnDurationMs:1300,samples:14}]:[])],22,105);
    const wetFuseIds=new Set<number>(),bucketStartAngle=bucketBody?.angle??0,bucketStartPosition=bucketBody?{...bucketBody.position}:null,bucketPivot=bucketStartPosition?{x:bucketStartPosition.x+Math.cos(bucketStartAngle)*34-Math.sin(bucketStartAngle)*-23,y:bucketStartPosition.y+Math.sin(bucketStartAngle)*34+Math.cos(bucketStartAngle)*-23}:null;
    const ballVelocity={x:0,y:0},blockVelocity={x:0,y:0},scissorClosedAt=[0,0,0],rocketIgnitedAt=new Map<string,number>();let motor=false,motorStartedAt=0,driveTransferred=false,balloonPopped=false,mouseFleeAt=0,catStartledAt=0,catImpactMode:"none"|"launch"|"drop"="none",catFallStartedAt=0,catOnPlatformAt=0,fishBowlBrokenAt=0,fishReleased=false,fishFlopAt=0,fishChaseAt=0,gearTurnAt=0,fuseClock=0,fuseIgnited=false,fuseReady=false,fuseExtinguishedAt=0,cannonFired=false,cannonFiredAt=0,cannonHitAt=0,candleWetHits=0,candleExtinguished=false,candleExtinguishedAt=0,bucketTipAt=0,seesawHitAt=0,blockPosition={...initialBlockPosition},pulleyTurn=0,won=false,raf=0,last=performance.now();
    const wheelInstanceId=hamsterWheelBody&&machinePlugin(hamsterWheelBody)?.instanceId;
    const conveyorInstanceId=conveyorBody&&machinePlugin(conveyorBody)?.instanceId;
    const unsubscribeMachine=machine.subscribe(event=>{
      if(event.type==="state"&&event.instanceId===wheelInstanceId&&event.state==="running"&&!motor){motor=true;motorStartedAt=performance.now()}
      if(event.type==="state"&&event.state==="burning"&&event.instanceId&&rocketBodies.some(body=>machinePlugin(body)?.instanceId===event.instanceId)&&!rocketIgnitedAt.has(event.instanceId))rocketIgnitedAt.set(event.instanceId,performance.now());
    });
    const closeScissor=(index:number,now:number)=>{if(scissorClosedAt[index]||!scissorBalloons[index])return;scissorClosedAt[index]=now;const released=scissorBalloons[index],scissorId=level.fixedGadgets.find(gadget=>gadget.collisionLabel===`scissor-${index}`)?.id,balloonId=tetheredBalloonConfigs[index]?.id;if(scissorId)machine.setState(scissorId,"closed");if(balloonId)machine.setState(balloonId,"free");Matter.Body.setStatic(released,false);Matter.Body.setVelocity(released,{x:(index-1)*.18,y:-1.2})};
    Matter.Events.on(engine, "collisionStart", e => e.pairs.forEach(({ bodyA, bodyB }) => {
      const labels = [bodyA.label, bodyB.label];
      const water=bodyA.label==="water"?bodyA:bodyB.label==="water"?bodyB:null;
      if (labels.includes("wheel") && labels.some(label=>["ball","tennisBall","candle"].includes(label)) && beltConnected && !motor) { motor = true; motorStartedAt = performance.now();const wheel=[bodyA,bodyB].find(body=>body.label==="wheel"),id=wheel&&machinePlugin(wheel)?.instanceId;if(id)machine.setState(id,"running"); }
      if (labels.includes("exit") && labels.includes("cat") && !won) { won = true; onWin(); }
      if (labels.includes("candle") && labels.includes("levelBalloon") && !won) { balloonPopped=true;const id=balloon&&machinePlugin(balloon)?.instanceId;if(id)machine.setState(id,"popped");won=true;onWin(); }
      if (labels.includes("targetRing") && labels.includes("levelBalloon") && !won) { won=true; onWin(); }
      if(labels.includes("needle")&&labels.includes("levelBalloon")&&!won){balloonPopped=true;const id=balloon&&machinePlugin(balloon)?.instanceId;if(id)machine.setState(id,"popped");won=true;onWin()}
      if(labels.includes("cannonball")&&labels.includes("cannonTarget")&&!won&&!cannonHitAt)cannonHitAt=performance.now();
      if(labels.includes("trampoline")&&labels.includes("levelBall")&&levelBall){
        const trampoline=bodyA.label==="trampoline"?bodyA:bodyB;
        Matter.Body.setVelocity(levelBall,{x:Math.sin(trampoline.angle)*20,y:-Math.abs(Math.cos(trampoline.angle))*20});
      }
      if(labels.includes("basket")&&labels.includes("levelBall")&&!won){won=true;onWin()}
      const scissorIndex=labels.map(label=>label.startsWith("scissor-")?Number(label.slice(9)):-1).find(index=>index>=0);
      if(hasSystem("scissors")&&scissorIndex!==undefined){const impact=bodyA.label===`scissor-${scissorIndex}`?bodyB:bodyA;if(["ball","tennisBall"].includes(impact.label)&&impact.position.y<SCISSOR_LAYOUT[scissorIndex].y&&scissorClosesFromImpact(Math.max(impact.velocity.y,impact.speed),!impact.isStatic))closeScissor(scissorIndex,performance.now())}
      if(hasSystem("breakable-container")&&labels.includes("fishbowl")&&!fishBowlBrokenAt&&fishBowl&&fishBody){
        const impact=bodyA.label==="fishbowl"?bodyB:bodyA;
        if(fishbowlBreaks(impact.velocity.y,!impact.isStatic)){fishBowlBrokenAt=performance.now();fishBowl.isSensor=true;machine.setState("fish-bowl","breaking")}
      }
      if(labels.includes("seesaw")&&(labels.includes("ball")||labels.includes("tennisBall"))&&seesawBody){
        const impact=[bodyA,bodyB].find(body=>["ball","tennisBall"].includes(body.label))!;
        if(hasSystem("catapult")&&cat&&!catStartledAt){
          catStartledAt=performance.now();catImpactMode=catapultImpactMode(impact.position.x,seesawBody.position.x);applySeesawImpact(engine,seesawBody,impact);
          if(catImpactMode==="launch"){Matter.Body.setPosition(cat,catapultReleasePosition(cat.position));Matter.Body.setVelocity(cat,catapultLaunchVelocity(impact.velocity.y))}
        }else if(!hasSystem("catapult"))applySeesawImpact(engine,seesawBody,impact);
      }
      if(hasSystem("catapult")&&labels.includes("cat")&&labels.includes("catapultPlatform")&&cat&&catStartledAt&&!catOnPlatformAt){catOnPlatformAt=performance.now();Matter.Body.setStatic(cat,true);Matter.Body.setPosition(cat,{x:Math.max(540,Math.min(680,cat.position.x)),y:CATAPULT_PLATFORM.animalY});Matter.Body.setAngle(cat,0)}
      if(labels.includes("seesawBasket")&&labels.includes("seesawPayload")&&!won&&!seesawHitAt)seesawHitAt=performance.now();
      if(water&&labels.includes("floor")&&!waterSplashAt.has(water.id))waterSplashAt.set(water.id,performance.now());
      if(water&&labels.includes("candle")&&!candleExtinguished){candleWetHits++;if(candleWetHits>=1){candleExtinguished=true;candleExtinguishedAt=performance.now();const candle=[bodyA,bodyB].find(body=>body.label==="candle"),id=candle&&machinePlugin(candle)?.instanceId;if(id)machine.setState(id,"extinguished")}}
      if(water&&labels.includes("fuse")){const fuse=bodyA.label==="fuse"?bodyA:bodyB,id=machinePlugin(fuse)?.instanceId;wetFuseIds.add(fuse.id);if(id)machine.setState(id,"extinguished");if(fuseIgnited&&!fuseExtinguishedAt)fuseExtinguishedAt=performance.now()}
    }));
    const drawGear = (x:number,y:number,r:number,turn:number) => { ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle="#d39a28"; for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-5,-5,12,10)} ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173d50";ctx.beginPath();ctx.arc(0,0,r*.28,0,Math.PI*2);ctx.fill();ctx.restore(); };
    const drawScissor=(index:number,now:number)=>{const item=SCISSOR_LAYOUT[index],age=scissorClosedAt[index]?now-scissorClosedAt[index]:0,closed=scissorClosedAt[index]?clamp01(age/260):0,spread=.62*(1-closed)+.08*closed;ctx.save();ctx.translate(item.x,item.y);ctx.lineCap="round";ctx.strokeStyle="#65777d";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(spread)*38,-Math.cos(spread)*38);ctx.moveTo(0,0);ctx.lineTo(-Math.sin(spread)*38,-Math.cos(spread)*38);ctx.stroke();ctx.strokeStyle="#dbe6e7";ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle="#b94432";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-Math.sin(spread)*29,Math.cos(spread)*29);ctx.moveTo(0,0);ctx.lineTo(Math.sin(spread)*29,Math.cos(spread)*29);ctx.stroke();ctx.lineWidth=5;for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*Math.sin(spread)*31,Math.cos(spread)*31,10,8,side*spread,0,Math.PI*2);ctx.stroke()}ctx.fillStyle="#d9a32c";ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#5b3a20";ctx.lineWidth=2;ctx.stroke();ctx.restore()};
    const stabilizeWater=()=>waterBodies.forEach(drop=>{const speed=Math.hypot(drop.velocity.x,drop.velocity.y);if(speed>11)Matter.Body.setVelocity(drop,{x:drop.velocity.x/speed*11,y:drop.velocity.y/speed*11});if(drop.position.y>476.5){Matter.Body.setPosition(drop,{x:drop.position.x,y:476.5});Matter.Body.setVelocity(drop,{x:drop.velocity.x*.76,y:0})}if(drop.position.y<-15){Matter.Body.setPosition(drop,{x:drop.position.x,y:-15});Matter.Body.setVelocity(drop,{x:drop.velocity.x,y:Math.abs(drop.velocity.y)*.25})}if(drop.position.x<4||drop.position.x>896){const x=Math.max(4,Math.min(896,drop.position.x));Matter.Body.setPosition(drop,{x,y:drop.position.y});Matter.Body.setVelocity(drop,{x:-drop.velocity.x*.25,y:drop.velocity.y})}});
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now;
      if(running&&hasSystem("scissors"))scissorRopePhysics.forEach(connection=>{if(!scissorClosedAt[connection.scissorIndex]&&ropePullIsTaut(connection.anchor,connection.pullBody.position,connection.pullBody.velocity,connection.restLength))closeScissor(connection.scissorIndex,now)});
      if(running&&motor&&beltConnected&&!driveTransferred&&wheelInstanceId&&conveyorInstanceId){machine.resolve(wheelInstanceId,conveyorInstanceId,"connection");driveTransferred=true}
      if(running){stabilizeWater();machine.step(dt);stabilizeWater()}
      if(running&&hasSystem("rocket-launch"))for(const rocketBody of rocketBodies){const id=machinePlugin(rocketBody)?.instanceId;if(!id)continue;const state=machine.state(id)?.state??"mounted",next=nextRocketState(state,rocketIgnitedAt.get(id),now);if(next!==state)machine.setState(id,next)}
      const catHasSupport=!!cat&&animalHasSupport(cat,Matter.Composite.allBodies(engine.world));
      const catFalling=!!cat&&running&&!cat.isStatic&&isAnimalFalling(cat.velocity.y,catHasSupport);
      if(catFalling&&!catFallStartedAt)catFallStartedAt=now;else if(!catFalling)catFallStartedAt=0;
      if(running&&bucketBody&&bucketPivot){if(!bucketTipAt)bucketTipAt=now;const tip=clamp01((now-bucketTipAt)/1900),eased=tip*tip*(3-2*tip),angle=bucketStartAngle+eased*2.1,pivotLocal={x:34,y:-23},rotatedX=Math.cos(angle)*pivotLocal.x-Math.sin(angle)*pivotLocal.y,rotatedY=Math.sin(angle)*pivotLocal.x+Math.cos(angle)*pivotLocal.y;Matter.Body.setPosition(bucketBody,{x:bucketPivot.x-rotatedX,y:bucketPivot.y-rotatedY});Matter.Body.setAngle(bucketBody,angle)}
      // Das Laufband gibt eine konstante Transportgeschwindigkeit vor. Keine
      // wiederholten Kräfte: Die Katze wird also nicht ungewollt beschleunigt.
      if (running && motor && cat) Matter.Body.setPosition(cat,{x:Math.min(850,555+(now-motorStartedAt)*.075),y:365});
      if(running&&balloon&&!balloonPopped){
        if(hasSystem("fan-airflow"))Matter.Composite.allBodies(engine.world).filter(body=>body.label==="fan").forEach(fan=>{
          const dx=balloon!.position.x-fan.position.x,dy=balloon!.position.y-fan.position.y,c=Math.cos(fan.angle),s=Math.sin(fan.angle);
          const forward=dx*c+dy*s,side=-dx*s+dy*c;
          if(forward>0&&forward<FAN_MAX_RANGE&&Math.abs(side)<100+forward*.3){const force=.00035*(1-forward/FAN_MAX_RANGE);Matter.Body.applyForce(balloon!,balloon!.position,{x:c*force,y:s*force})}
        });
      }
      if(running&&hasSystem("pulley-rope")&&placedBall&&weight){
        const seconds=dt/1000,previousBall={...placedBall.position};ballVelocity.y+=PULLEY_GRAVITY_PX*seconds;blockVelocity.y+=PULLEY_GRAVITY_PX*seconds;Matter.Body.setPosition(placedBall,{x:Math.max(18,Math.min(882,placedBall.position.x+ballVelocity.x*seconds)),y:Math.min(462,placedBall.position.y+ballVelocity.y*seconds)});if(placedBall.position.y>=462&&ballVelocity.y>0)ballVelocity.y=0;
        if(routeMoving.length){blockPosition={x:Math.max(45,Math.min(855,blockPosition.x+blockVelocity.x*seconds)),y:Math.min(initialWeightY,blockPosition.y+blockVelocity.y*seconds)};if(blockPosition.y>=initialWeightY&&blockVelocity.y>0)blockVelocity.y=0;const dx=blockPosition.x-initialBlockPosition.x,dy=blockPosition.y-initialBlockPosition.y;Matter.Body.setPosition(weight,blockPosition);routeMoving.forEach((body,index)=>Matter.Body.setPosition(body,{x:initialMovingPositions[index].x+dx,y:initialMovingPositions[index].y+dy}))}
        if(ropeReady){for(let iteration=0;iteration<6;iteration++){const correction=ropeConstraintCorrection(physicsPoints(),restRopeLength,BOWLING_PULL_KG,LEVEL_FIVE_LOAD_KG);if(correction.stretch<.01)break;Matter.Body.setPosition(placedBall,{x:placedBall.position.x+correction.ball.x,y:placedBall.position.y+correction.ball.y});blockPosition={x:blockPosition.x+correction.block.x,y:Math.min(initialWeightY,blockPosition.y+correction.block.y)};const dx=blockPosition.x-initialBlockPosition.x,dy=blockPosition.y-initialBlockPosition.y;Matter.Body.setPosition(weight,blockPosition);routeMoving.forEach((body,index)=>Matter.Body.setPosition(body,{x:initialMovingPositions[index].x+dx,y:initialMovingPositions[index].y+dy}))}const geometry=ropeGeometry(physicsPoints()),rate=geometry.ballGradient.x*ballVelocity.x+geometry.ballGradient.y*ballVelocity.y+geometry.blockGradient.x*blockVelocity.x+geometry.blockGradient.y*blockVelocity.y,denominator=(geometry.ballGradient.x**2+geometry.ballGradient.y**2)/BOWLING_PULL_KG+(geometry.blockGradient.x**2+geometry.blockGradient.y**2)/LEVEL_FIVE_LOAD_KG;if(rate>0&&denominator>1e-9){const impulse=rate/denominator;ballVelocity.x-=geometry.ballGradient.x*impulse/BOWLING_PULL_KG;ballVelocity.y-=geometry.ballGradient.y*impulse/BOWLING_PULL_KG;blockVelocity.x-=geometry.blockGradient.x*impulse/LEVEL_FIVE_LOAD_KG;blockVelocity.y-=geometry.blockGradient.y*impulse/LEVEL_FIVE_LOAD_KG}}
        const dampedBall=dampPulleyVelocity(ballVelocity,seconds),dampedBlock=dampPulleyVelocity(blockVelocity,seconds);ballVelocity.x=dampedBall.x;ballVelocity.y=dampedBall.y;blockVelocity.x=dampedBlock.x;blockVelocity.y=dampedBlock.y;
        pulleyTurn+=Math.hypot(placedBall.position.x-previousBall.x,placedBall.position.y-previousBall.y)/30;routeFixed.forEach(body=>Matter.Body.setAngle(body,pulleyTurn));routeMoving.forEach(body=>Matter.Body.setAngle(body,-pulleyTurn));if(routeMoving.length&&pulleyTargetReached(weight.position.y)&&!won){won=true;onWin()}
      }
      if(running&&standaloneMouseChase&&mouseBody&&cat){if(!mouseFleeAt&&Math.abs(mouseBody.position.y-cat.position.y)<35&&mouseBody.position.x>cat.position.x)mouseFleeAt=now;if(mouseFleeAt){Matter.Body.setPosition(mouseBody,{x:Math.min(835,mouseBody.position.x+dt*.09),y:mouseBody.position.y});Matter.Body.setPosition(cat,{x:Math.min(760,cat.position.x+dt*.055),y:cat.position.y});if(mouseBody.position.x>=810&&!won){won=true;onWin()}}}
      if(running&&hasSystem("catapult")&&catOnPlatformAt&&mouseBody&&cat){const next=advanceCatAndMouse(cat.position.x,mouseBody.position.x,dt);Matter.Body.setPosition(cat,{x:next.catX,y:CATAPULT_PLATFORM.animalY});Matter.Body.setPosition(mouseBody,{x:next.mouseX,y:CATAPULT_PLATFORM.animalY});if(next.mouseX>=CATAPULT_MOUSE_HOLE_X&&!won){won=true;onWin()}}
      if(running&&hasSystem("fish-release")&&fishBowlBrokenAt&&!fishReleased&&fishBowl&&fishBody&&now-fishBowlBrokenAt>=FISH_REVEAL_DELAY_MS){fishReleased=true;machine.setState("fish-bowl","broken");machine.setState("mr-blue","flopping");Matter.Body.setPosition(fishBody,{x:fishBowl.position.x,y:fishBowl.position.y+12});Matter.Body.setStatic(fishBody,false);fishBody.isSensor=false;Matter.Body.setVelocity(fishBody,{x:0,y:1.5})}
      if(running&&hasSystem("fish-release")&&fishReleased&&fishBody&&fishBody.position.y>455&&now-fishFlopAt>520){fishFlopAt=now;Matter.Body.setVelocity(fishBody,{x:Math.sin(now*.011)*.38,y:-1.35})}
      const fishVisible=fishReleased;
      if(running&&hasSystem("cat-fish")&&cat&&fishBody&&catSeesFish({catX:cat.position.x,catY:cat.position.y,fishX:fishBody.position.x,fishY:fishBody.position.y,fishVisible})){
        if(!fishChaseAt)fishChaseAt=now;Matter.Body.setPosition(cat,{x:advanceCatTowardFish(cat.position.x,fishBody.position.x,dt),y:cat.position.y});Matter.Body.setVelocity(cat,{x:0,y:cat.velocity.y});
        if(Math.abs(fishBody.position.x-cat.position.x)<=52&&!won){won=true;onWin()}
      }
      if(running&&hasSystem("scissors")){scissorBalloons.forEach((freeBalloon,index)=>{if(scissorClosedAt[index])Matter.Body.applyForce(freeBalloon,freeBalloon.position,{x:0,y:-.00032})});if(scissorClosedAt.every(Boolean)&&scissorBalloons.every(freeBalloon=>freeBalloon.position.y<-30)&&!won){won=true;onWin()}}
      if(running&&waterBodies.length){for(const animal of [cat,mouseBody]){if(!animal)continue;let nearest:Matter.Body|null=null,distance=Infinity;for(const drop of waterBodies){const d=Math.hypot(animal.position.x-drop.position.x,animal.position.y-drop.position.y);if(d<distance){nearest=drop;distance=d}}if(nearest&&distance<62){const direction=animal.position.x<nearest.position.x?-1:1;Matter.Body.setPosition(animal,{x:Math.max(30,Math.min(870,animal.position.x+direction*dt*.13)),y:animal.position.y})}}}
      if(running&&hasSystem("gear-network")&&gearsConnected){if(!gearTurnAt)gearTurnAt=now;if(now-gearTurnAt>1100&&!won){won=true;onWin()}}
      if(running&&hasSystem("fuse-network")&&!fuseExtinguishedAt){fuseClock+=dt;fuseNetwork.igniteNear({x:102,y:366},30,fuseClock);fuseNetwork.update(fuseClock);fuseIgnited=fuseNetwork.hasAnyBurned(fuseClock);fuseReady=fuseNetwork.burnTimeAt(cannonFuseId,0)<Infinity;if(cannonBody&&!cannonFired&&fuseNetwork.hasBurnedEnd(cannonFuseId,fuseClock)){cannonFired=true;cannonFiredAt=now;const cannonId=machinePlugin(cannonBody)?.instanceId;if(cannonId)machine.setState(cannonId,"firing");const direction={x:Math.cos(cannonBody.angle),y:Math.sin(cannonBody.angle)};const shot=Matter.Bodies.circle(cannonBody.position.x+direction.x*58,cannonBody.position.y+direction.y*58,11,{density:.0025,restitution:.3,label:"cannonball"});Matter.Body.setVelocity(shot,{x:direction.x*14,y:direction.y*14});Matter.Composite.add(engine.world,shot)}}
      if(running&&seesawBody)limitSeesawRotation(seesawBody)
      if(cannonHitAt&&!won&&now-cannonHitAt>520){won=true;onWin()}
      if(candleExtinguishedAt&&!won&&now-candleExtinguishedAt>700){won=true;onWin()}
      if(seesawHitAt&&!won&&now-seesawHitAt>450){won=true;onWin()}
      if(running&&!won&&machine.goalReached(level.goal)){won=true;onWin()}
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40);
      if(conveyorBody&&hamsterWheelBody&&hasSystem("conveyor")){
        const conveyorRunning=motor&&beltConnected,conveyorVisual=drawConveyor(ctx,{centerX:conveyorBody.position.x,centerY:conveyorBody.position.y,width:conveyorWidth,now,running:conveyorRunning});
        const sourcePort={x:hamsterWheelBody.position.x+55,y:hamsterWheelBody.position.y+13},targetPort=conveyorVisual.leftWheel;
        if(beltConnected)drawDriveBelt(ctx,driveBeltGeometry(sourcePort,targetPort,18,conveyorVisual.wheelRadius),now,conveyorRunning);
        const hamsterFrame=motor?Math.floor(now/90)%6:0;if(!drawHamsterSprite(hamsterFrame,hamsterWheelBody.position.x,hamsterWheelBody.position.y,116,116))drawGear(hamsterWheelBody.position.x,hamsterWheelBody.position.y,42,motor?now/180:0);
        ctx.fillStyle="#d69b29";ctx.strokeStyle="#173f50";ctx.lineWidth=4;ctx.beginPath();ctx.arc(sourcePort.x,sourcePort.y,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(sourcePort.x,sourcePort.y,4,0,Math.PI*2);ctx.fill();
        if(selectedTool==="belt"&&!running){const drawPort=(point:{x:number;y:number},label:string)=>{ctx.save();ctx.fillStyle=beltConnected?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(point.x,point.y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.fillText(label,point.x+17,point.y+4);ctx.restore()};drawPort(sourcePort,"LOUIS");drawPort(targetPort,"LAUFBAND")}
        if(driveBelt&&selectedId===driveBelt.id&&!running){const center={x:(sourcePort.x+targetPort.x)/2,y:(sourcePort.y+targetPort.y)/2};ctx.save();ctx.strokeStyle="#e5392c";ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.strokeRect(center.x-49,center.y-24,98,48);ctx.setLineDash([]);ctx.fillStyle="#fff4cf";ctx.fillRect(center.x-35,center.y-12,70,22);ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText("RIEMEN",center.x,center.y+4);ctx.restore()}
      }
      if(scene==="first-impulse"){
        ctx.fillStyle="#183f49";ctx.fillRect(780,345,105,135);ctx.fillStyle="#eac97a";ctx.font="bold 16px Georgia";ctx.fillText("AUSGANG",790,375);ctx.fillText("→",820,420);
      }else if(scene==="balloon-candle"){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,135,72,10);ctx.fillStyle="#f1cb62";ctx.fillRect(793,75,24,64);if(!drawFireSprite(0,Math.floor(now/105)%6,805,51,82,90))drawFallbackFlame(805,58,now,1.05);
      }else if(scene==="tailwind"){
        ctx.strokeStyle="#c73b2e";ctx.lineWidth=12;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#f1c351";ctx.lineWidth=4;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#5d371e";ctx.font="bold 14px system-ui";ctx.fillText("ZIELRING",744,218);
      }else if(scene==="spring-force"){
        ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(715,145);ctx.lineTo(720,210);ctx.quadraticCurveTo(760,235,805,210);ctx.lineTo(808,145);ctx.stroke();ctx.fillStyle="#a52d24";ctx.font="bold 14px system-ui";ctx.fillText("KORB",742,250);
      }else if(scene==="block-and-tackle"){
        ctx.strokeStyle="#bd3428";ctx.lineWidth=4;ctx.setLineDash([10,7]);ctx.beginPath();ctx.moveTo(50,LEVEL_FIVE_TARGET_Y);ctx.lineTo(850,LEVEL_FIVE_TARGET_Y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("OBERKANTE BIS HIER",654,LEVEL_FIVE_TARGET_Y-15);
        ctx.fillStyle="#4c5960";ctx.fillRect(67,22,50,12);ctx.strokeStyle="#303b40";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(92,34);ctx.lineTo(ROPE_ANCHOR.x,ROPE_ANCHOR.y);ctx.stroke();ctx.fillStyle="#d39a28";ctx.beginPath();ctx.arc(ROPE_ANCHOR.x,ROPE_ANCHOR.y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#6b391e";ctx.font="bold 11px system-ui";ctx.fillText("FESTPUNKT",116,67);
        const visualPoints=ropePath.flatMap(node=>{if(node.kind==="anchor")return[{...ROPE_ANCHOR,kind:"anchor" as const}];const part=placedById.get(node.placedId),body=bodyByPlacedId.get(node.placedId),kind=part?routeKindForPart(part.type):null;return body&&kind?[{x:body.position.x,y:body.position.y,kind}]:[]});drawFreeRope(ctx,visualPoints,now,running);
        if(routeMoving.length&&weight){ctx.save();ctx.strokeStyle="#4c5960";ctx.lineWidth=3;for(const pulley of routeMoving){const start={x:pulley.position.x,y:pulley.position.y+32},end={x:weight.position.x,y:weight.position.y-39},distance=Math.max(1,Math.hypot(end.x-start.x,end.y-start.y)),links=Math.max(2,Math.floor(distance/13));for(let link=1;link<links;link++){const t=link/links,x=start.x+(end.x-start.x)*t,y=start.y+(end.y-start.y)*t;ctx.beginPath();ctx.ellipse(x,y,4,7,Math.atan2(end.y-start.y,end.x-start.x),0,Math.PI*2);ctx.stroke()}}ctx.restore()}
        if(routeAnalysis.supportingStrands>0){ctx.fillStyle="#173f50";ctx.font="bold 13px system-ui";ctx.fillText(`${routeAnalysis.supportingStrands} mögliche tragende Seilabschnitte`,36,95)}
      }else if(scene==="needle-test"){
        ctx.fillStyle="#6b391e";ctx.font="bold 14px system-ui";ctx.fillText("Die Nadel reagiert ausschließlich auf den Ballon.",285,32);
      }else if(scene==="mouse-escape"){
        ctx.fillStyle="#173f50";ctx.fillRect(820,330,65,120);ctx.fillStyle="#f1d28d";ctx.font="bold 13px system-ui";ctx.fillText("MAUS-",830,365);ctx.fillText("LOCH",834,382);
      }else if(scene==="gear-train"){
        ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("ANTRIEB",220,230);ctx.fillText("ZIELRAD",565,230);
      }else if(scene==="fire-cannon"){
        ctx.fillStyle="#7b4c24";ctx.fillRect(70,440,65,10);ctx.fillStyle="#f1cb62";ctx.fillRect(91,390,22,52);if(!drawFireSprite(0,Math.floor(now/105)%6,102,366,82,90))drawFallbackFlame(102,374,now);ctx.strokeStyle="#c73b2e";ctx.lineWidth=9;ctx.beginPath();ctx.arc(825,230,48,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("ZIEL",808,300);
      }else if(scene==="water-march"){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,470,70,10);ctx.fillStyle="#f1cb62";ctx.fillRect(794,390,22,80);if(!candleExtinguished){if(!drawFireSprite(0,Math.floor(now/105)%6,805,371,82,90))drawFallbackFlame(805,380,now)}else{ctx.fillStyle="#8b9ba0";for(let puff=0;puff<4;puff++){ctx.globalAlpha=.55-puff*.1;ctx.beginPath();ctx.arc(802+Math.sin(now*.004+puff)*8,374-puff*9,8+puff*2,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;drawWaterSprite(1,5,805,450,76,38)}ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("KERZE",785,505);
      }else if(scene==="lever-effect"){
        ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(635,105);ctx.lineTo(640,165);ctx.quadraticCurveTo(680,190,725,165);ctx.lineTo(728,105);ctx.stroke();ctx.fillStyle="#a52d24";ctx.font="bold 14px system-ui";ctx.fillText("ZIELKORB",646,210);
      }else if(scene==="cat-jump"){
        ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("OBERE EBENE",560,CATAPULT_PLATFORM.y-24);
      }else if(scene==="mr-blue-rescue"){
        ctx.fillStyle="#173f50";ctx.font="bold 13px system-ui";ctx.fillText(CHARACTERS.cat.toUpperCase(),92,395);ctx.fillText(CHARACTERS.fish.toUpperCase(),662,325);
      }else if(scene==="snip-snap"){
        ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("VORPLATZIERTE KUGEL",62,50);
        for(let index=0;index<SCISSOR_LAYOUT.length;index++){
          const item=SCISSOR_LAYOUT[index],freeBalloon=scissorBalloons[index],cut=!!scissorClosedAt[index];ctx.save();ctx.strokeStyle=cut?"#9a8062":"#6b4930";ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.beginPath();if(cut){ctx.moveTo(freeBalloon.position.x,freeBalloon.position.y+23);ctx.quadraticCurveTo(freeBalloon.position.x+9,freeBalloon.position.y+46,freeBalloon.position.x-3,freeBalloon.position.y+64);ctx.moveTo(item.x,item.y+12);ctx.lineTo(item.x,480)}else{ctx.moveTo(freeBalloon.position.x,freeBalloon.position.y+23);ctx.lineTo(item.x,480)}ctx.stroke();ctx.setLineDash([]);ctx.restore();drawScissor(index,now);
        }
        for(const connection of scissorRopePhysics){const pull=connection.pullBody.position,anchor=scissorPullPoint(connection.scissorIndex),sag=running?4:14;ctx.save();ctx.strokeStyle="#6b4930";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.quadraticCurveTo((anchor.x+pull.x)/2,(anchor.y+pull.y)/2+sag,pull.x,pull.y);ctx.stroke();ctx.strokeStyle="#b99362";ctx.lineWidth=1.5;ctx.setLineDash([5,6]);ctx.stroke();ctx.restore()}
      }
      if(waterBodies.length){ctx.strokeStyle="rgba(33,158,211,.34)";ctx.lineWidth=7;ctx.lineCap="round";for(let i=0;i<waterBodies.length;i++)for(let j=i+1;j<waterBodies.length;j++){const a=waterBodies[i].position,b=waterBodies[j].position;if(Math.hypot(a.x-b.x,a.y-b.y)<10){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}}
      for(const b of Matter.Composite.allBodies(engine.world)){
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
        if(b.label==="ball"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="tennisBall"){ctx.fillStyle="#d7eb4c";ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff8c5";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-8,0,9,-1.15,1.15);ctx.stroke();ctx.beginPath();ctx.arc(8,0,9,2,4.3);ctx.stroke()}
        if(b.label==="scissorBalloon"){const colors=["#e84d52","#3f9bd2","#efb630"],index=scissorBalloons.indexOf(b);ctx.fillStyle=colors[Math.max(0,index)];ctx.beginPath();ctx.ellipse(0,0,21,27,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,.55)";ctx.beginPath();ctx.ellipse(-7,-9,5,9,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=colors[Math.max(0,index)];ctx.beginPath();ctx.moveTo(-5,25);ctx.lineTo(5,25);ctx.lineTo(0,34);ctx.closePath();ctx.fill()}
        if(b.label==="ramp"){ctx.fillStyle="#8d5426";ctx.fillRect(-75,-7,150,14);ctx.strokeStyle="#4e2a14";ctx.strokeRect(-75,-7,150,14)}
        if(b.label==="candle"&&hasSystem("rocket-launch")){ctx.fillStyle="#f1cb62";ctx.strokeStyle="#9a6426";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-12,-19,24,53,5);ctx.fill();ctx.stroke();ctx.fillStyle="rgba(255,255,255,.5)";ctx.fillRect(-7,-13,4,40);ctx.strokeStyle="#49382a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(0,-28);ctx.stroke();if(!drawFireSprite(0,Math.floor(now/105)%6,0,-40,52,58))drawFallbackFlame(0,-36,now,.7)}
        if(b.label==="levelBalloon"&&!balloonPopped){ctx.fillStyle="#1976b9";ctx.beginPath();ctx.ellipse(0,0,22,28,0,0,7);ctx.fill();ctx.strokeStyle="#305468";ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(0,62);ctx.stroke()}
        if(b.label==="fan"){ctx.fillStyle="#18475a";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.fillStyle="#d6a12c";ctx.font="35px serif";ctx.fillText("✣",-18,12);ctx.strokeStyle="#54a8c2";ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(35,-20);ctx.lineTo(FAN_VISIBLE_RANGE,-65);ctx.moveTo(35,20);ctx.lineTo(FAN_VISIBLE_RANGE,65);ctx.stroke();ctx.setLineDash([])}
        if(b.label==="levelBall"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="trampoline"){ctx.fillStyle="#c33a2c";ctx.fillRect(-68,-9,136,18);ctx.strokeStyle="#173f50";ctx.lineWidth=4;ctx.strokeRect(-68,-9,136,18);ctx.strokeStyle="#f4c64e";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(0,-55);ctx.lineTo(-8,-43);ctx.moveTo(0,-55);ctx.lineTo(8,-43);ctx.stroke()}
        if(b.label==="seesaw"){const half=SEESAW_WIDTH/2;ctx.fillStyle="#ad6a2d";ctx.fillRect(-half,-9,SEESAW_WIDTH,18);ctx.fillStyle="#e3aa54";ctx.fillRect(-half,-9,SEESAW_WIDTH,5);ctx.strokeStyle="#51301a";ctx.lineWidth=3;ctx.strokeRect(-half,-9,SEESAW_WIDTH,18);ctx.fillStyle="#173f50";for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*(half-10),0,6,0,Math.PI*2);ctx.fill()}ctx.save();ctx.rotate(-b.angle);ctx.fillStyle="#a43a27";ctx.beginPath();ctx.moveTo(-27,46);ctx.lineTo(27,46);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.strokeStyle="#65251b";ctx.stroke();ctx.restore()}
        if(b.label==="pulley"){ctx.fillStyle="#d39a28";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,0);ctx.stroke()}
        if(b.label==="movingPulley"){ctx.fillStyle="#4f9da8";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,0);ctx.stroke();ctx.save();ctx.rotate(-b.angle);ctx.fillStyle="#f4e5c0";ctx.font="bold 10px system-ui";ctx.fillText("LOSE",-15,4);ctx.restore()}
        if(b.label==="weight"){ctx.strokeStyle="#303b40";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-39,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#555d60";ctx.fillRect(-32,-32,64,64);ctx.fillStyle="#f0d59a";ctx.font="bold 14px system-ui";ctx.fillText("50 kg",-21,5)}
        if(b.label==="steelBeam"){ctx.fillStyle="#6e858d";ctx.fillRect(-118,-9,236,18);ctx.fillStyle="#c3d0d2";ctx.fillRect(-118,-9,236,4);ctx.fillStyle="#3e5963";for(let rivet=-100;rivet<=100;rivet+=40){ctx.beginPath();ctx.arc(rivet,0,3,0,Math.PI*2);ctx.fill()}}
        if(b.label==="woodWall"){ctx.fillStyle="#9b5e2a";ctx.fillRect(-12,-90,24,180);ctx.strokeStyle="#5a321a";for(let plank=-80;plank<90;plank+=28){ctx.strokeRect(-12,plank,24,28);ctx.beginPath();ctx.moveTo(-8,plank+7);ctx.lineTo(8,plank+20);ctx.stroke()}}
        if(b.label==="stoneWall"){ctx.fillStyle="#7d817e";ctx.fillRect(-21,-85,42,170);ctx.strokeStyle="#4e5554";ctx.lineWidth=2;for(let row=-85;row<85;row+=24){ctx.beginPath();ctx.moveTo(-21,row);ctx.lineTo(21,row);ctx.stroke();const seam=(Math.floor((row+85)/24)%2===0)?0:-10;ctx.beginPath();ctx.moveTo(seam,row);ctx.lineTo(seam,row+24);ctx.stroke()}}
        if(b.label==="cat"){const airborneStartle=hasSystem("catapult")&&catImpactMode==="launch"&&catStartledAt>0&&!catOnPlatformAt,fallingStartle=catFallStartedAt>0,startledAt=airborneStartle?catStartledAt:fallingStartle?catFallStartedAt:null,catRunning=motor||(standaloneMouseChase&&mouseFleeAt>0)||(hasSystem("catapult")&&catOnPlatformAt>0)||(hasSystem("cat-fish")&&fishChaseAt>0),pose=catSpritePose(now,{running:catRunning,startledAt,holdStartled:airborneStartle||fallingStartle}),size=pose.state==="idle"?90:pose.state==="running"?106:112,offsetX=catSpriteOffsetX(pose,size),offsetY=pose.state==="idle"?-12:pose.state==="startled"?-16:0;if(!drawCatSprite(pose.row,pose.frame,offsetX,offsetY,size)){ctx.font="54px serif";ctx.fillText("🐈",-34,20)}}
        if(b.label==="needle"){ctx.fillStyle="#737c80";ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(-9,35);ctx.lineTo(9,35);ctx.closePath();ctx.fill();ctx.fillStyle="#a96c2d";ctx.fillRect(-14,28,28,12)}
        if(b.label==="mouse"){const mouseRunning=(standaloneMouseChase&&mouseFleeAt>0)||(hasSystem("catapult")&&catOnPlatformAt>0),frame=mouseSpriteFrame(now,mouseRunning);if(!drawMouseSprite(frame,0,-5,60)){ctx.font="36px serif";ctx.fillText("🐁",-20,14)}}
        if(b.label==="fishbowl"){const breakAge=fishBowlBrokenAt?now-fishBowlBrokenAt:-1;if(!fishBowlBrokenAt){if(!drawMrBlueSprite(0,Math.floor(now/460)%3,0,-4,150)){ctx.font="70px serif";ctx.fillText("🐠",-38,22)}}else if(breakAge<FISH_REVEAL_DELAY_MS){drawMrBlueSprite(1,Math.min(2,Math.floor(breakAge/(FISH_REVEAL_DELAY_MS/3))),0,-4,150)}}
        if(b.label==="fish"&&fishVisible){const frame=Math.floor((now-fishBowlBrokenAt)/150)%3,offset=mrBlueFlopOffsets[frame];if(!drawMrBlueSprite(2,frame,offset.x,offset.y,86)){ctx.font="44px serif";ctx.fillText("🐟",-24,15)}}
        if(b.label==="catapultPlatform"){ctx.fillStyle="#6e858d";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,18);ctx.fillStyle="#c3d0d2";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,4);ctx.fillStyle="#3e5963";for(let rivet=-170;rivet<=170;rivet+=40){ctx.beginPath();ctx.arc(rivet,0,3,0,Math.PI*2);ctx.fill()}}
        if(b.label==="catapultMouseHole"){ctx.fillStyle="#173f50";ctx.fillRect(-28,-55,56,110);ctx.fillStyle="#f1d28d";ctx.font="bold 12px system-ui";ctx.fillText("MAUS-",-21,-5);ctx.fillText("LOCH",-18,12)}
        if(["gear","gearSource","gearTarget"].includes(b.label)){const depth=gearDepth.get(b.id);ctx.rotate(running&&depth!==undefined?(now/170)*(depth%2?-1:1):0);ctx.fillStyle=b.label==="gearTarget"?"#bf432d":"#d39a28";for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(34,-6,15,12)}ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="cannon"){ctx.fillStyle="#263d43";ctx.fillRect(-42,-16,82,32);ctx.fillStyle="#b26a29";ctx.beginPath();ctx.arc(-18,25,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#263d43";ctx.fillRect(32,-21,20,42);const fuse=fuseNetwork.snapshot(cannonFuseId,fuseClock),point=(t:number)=>({x:-18+(-26+18)*t,y:-42+(-17+42)*t});ctx.lineWidth=5;ctx.lineCap="round";for(let index=0;index<fuse.samples.length-1;index++){const from=point(fuse.samples[index].t),to=point(fuse.samples[index+1].t);ctx.strokeStyle=fuse.samples[index].burned?"#a29a8d":"#49382a";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}if(!fuseExtinguishedAt)for(const t of fuse.flames){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y,34,34))drawFallbackFlame(flame.x,flame.y,now,.55)}if(cannonFiredAt&&now-cannonFiredAt<520){const flashFrame=Math.min(5,Math.floor((now-cannonFiredAt)/87));if(!drawFireSprite(2,flashFrame,70,0,105,78))drawFallbackFlame(67,0,now,1.5)}}
        if(b.label==="fuse"){const fuse=fuseNetwork.snapshot(fuseId(b),fuseClock),point=(t:number)=>({x:-55+110*t,y:16*t*(1-t)});ctx.lineWidth=7;ctx.lineCap="round";for(let index=0;index<fuse.samples.length-1;index++){const from=point(fuse.samples[index].t),to=point(fuse.samples[index+1].t);ctx.strokeStyle=fuse.samples[index].burned?"#a29a8d":"#4f3d2b";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}if(!fuseExtinguishedAt)for(const t of fuse.flames){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y-3,34,34))drawFallbackFlame(flame.x,flame.y-3,now,.55)}if(wetFuseIds.has(b.id)){ctx.strokeStyle="#2ca7d8";ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(50,4);ctx.stroke();ctx.setLineDash([])}}
        if(b.label==="bucket"){ctx.fillStyle="rgba(76,141,168,.38)";ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(38,-28);ctx.lineTo(29,32);ctx.lineTo(-29,32);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#b7dbe4";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-25,38,Math.PI,0);ctx.stroke();ctx.fillStyle="#d8edf0";ctx.fillRect(-38,-31,76,7);if(running&&Math.abs(b.angle)>.18){if(!bucketTipAt)bucketTipAt=now;const streamFrame=Math.min(5,Math.floor((now-bucketTipAt)/230));drawWaterSprite(2,streamFrame,43,-22,105,78,0)}}
        if(b.label==="water"){const splashAt=waterSplashAt.get(b.id),splashAge=splashAt?now-splashAt:Infinity;if(splashAge<420){drawWaterSprite(1,Math.min(5,Math.floor(splashAge/70)),0,-2,34,24)}else{const speed=Math.hypot(b.velocity.x,b.velocity.y);if(speed>2){ctx.strokeStyle="rgba(80,190,232,.48)";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-b.velocity.x*1.8,-b.velocity.y*1.8);ctx.lineTo(0,0);ctx.stroke()}if(!drawWaterSprite(0,(b.id+Math.floor(now/120))%6,0,0,24,20)){ctx.fillStyle="#42b9e9";ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill()}}}
        if(b.label==="cannonball"){ctx.fillStyle="#333f43";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="rocket"){const id=machinePlugin(b)?.instanceId,state=id?(machine.state(id)?.state??"mounted"):"mounted",visual=rocketVisual(state,id?rocketIgnitedAt.get(id):undefined,now);if(visual.visible&&!drawRocketSprite(visual.row,visual.frame,0,visual.offsetY,visual.size)){ctx.fillStyle="#d94d32";ctx.beginPath();ctx.moveTo(0,-55+visual.offsetY);ctx.lineTo(-24,18+visual.offsetY);ctx.lineTo(24,18+visual.offsetY);ctx.closePath();ctx.fill()}if(visual.smokeOpacity>0){ctx.save();ctx.globalAlpha=visual.smokeOpacity;ctx.fillStyle="#d8d2c7";for(let puff=0;puff<7;puff++){const angle=puff/7*Math.PI*2,radius=9+(puff%3)*3;ctx.beginPath();ctx.arc(Math.cos(angle+now*.001)*22,55+Math.sin(angle)*10,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
        if(b.label==="seesawPayload"){ctx.fillStyle="#c73b2e";ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4c64e";ctx.beginPath();ctx.arc(-5,-5,4,0,Math.PI*2);ctx.fill()}
        if(b.plugin?.placedId===selectedId&&!running){ctx.strokeStyle="#e5392c";ctx.lineWidth=3;ctx.setLineDash([7,5]);if(b.label==="seesaw")ctx.strokeRect(-126,-48,252,96);else if(["ramp","trampoline","fuse","cannon","bucket"].includes(b.label))ctx.strokeRect(-64,-38,128,76);else{ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([])}ctx.restore();
      }
      if(hasSystem("pulley-rope")&&ropeMode&&!running){const selectedParts=new Map<number,number>();ropePath.forEach((node,index)=>{if(node.kind==="part")selectedParts.set(node.placedId,index)});const anchorOrder=ropePath.findIndex(node=>node.kind==="anchor"),drawPort=(x:number,y:number,order?:number,label?:string)=>{ctx.save();ctx.fillStyle=order!==undefined&&order>=0?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();if(order!==undefined&&order>=0){ctx.fillStyle="#173f50";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(String(order+1),x,y+4)}if(label){ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="left";ctx.fillText(label,x+28,y+4)}ctx.restore()};drawPort(ROPE_ANCHOR.x,ROPE_ANCHOR.y,anchorOrder>=0?anchorOrder:undefined);for(const part of placed){const kind=routeKindForPart(part.type);if(!kind)continue;drawPort(part.x,part.y,selectedParts.get(part.id),part.type==="pulley"?"FEST":part.type==="movingPulley"?"LOSE":"KUGEL")}}
      if(hasSystem("scissors")&&ropeMode&&!running){const drawPort=(x:number,y:number,label:string,active=false)=>{ctx.save();ctx.fillStyle=active?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.fillText(label,x+17,y+4);ctx.restore()};SCISSOR_LAYOUT.forEach((_,index)=>{if(!scissorRopes.some(rope=>rope.scissorIndex===index)){const port=scissorPullPoint(index);drawPort(port.x,port.y,`GRIFF ${index+1}`,pendingScissor===index)}});for(const part of placed){if(!["ball","tennisBall"].includes(part.type))continue;const body=bodyByPlacedId.get(part.id);if(body)drawPort(body.position.x,body.position.y,part.type==="tennisBall"?"TENNISBALL":"KUGEL")}}
      ctx.fillStyle="#4b2b17";ctx.font="bold 15px system-ui";
      if(scene==="first-impulse")ctx.fillText(!beltConnected?"Es fehlt die Verbindung zum Laufband":motor?"Riemen überträgt den Antrieb":"Triff das Hamsterrad mit einer Kugel",330,260);
      if(scene==="balloon-candle"&&!balloonPopped)ctx.fillText("Lenke den Ballon mit den Planken zur Flamme",275,32);
      if(scene==="tailwind")ctx.fillText("Richte den Ventilator aus und triff den Zielring",275,32);
      if(scene==="spring-force")ctx.fillText("Lenke den Fall mit dem Trampolin in den Korb",270,32);
      if(scene==="block-and-tackle")ctx.fillText(!ropePath.length?"Wähle das Seil und klicke beliebige Anschlusspunkte":routeAnalysis.tensioned?"Seil gespannt – Verlauf, Massen und Schwerkraft bestimmen die Bewegung":"Offenes Seil – der Aufbau darf trotzdem gestartet werden",220,32);
      if(scene==="needle-test"&&!balloonPopped)ctx.fillText("Lenke den Ballon in die platzierte Nadel",300,32);
      if(scene==="mouse-escape")ctx.fillText(!mouseFleeAt?"Katze und Maus müssen auf gleicher Höhe sein":"Die Maus flieht – die Katze ist langsamer",275,32);
      if(scene==="gear-train")ctx.fillText(gearsConnected?"Die Zahnradkette greift vollständig ineinander":"Zwischen den Zahnrädern sind noch Lücken",285,32);
      if(scene==="fire-cannon")ctx.fillText(!fuseIgnited?"Kein Luntenteil berührt die Flamme":fuseExtinguishedAt?"Die nasse Lunte ist erloschen":!fuseReady?"Die Flammenfronten breiten sich räumlich aus …":"Die Kanonenlunte brennt zur Kanone …",270,32);
      if(scene==="water-march")ctx.fillText(candleExtinguished?"Die Kerze ist gelöscht!":!bucketBody?"Platziere den Wassereimer":"Leite den Schwall um Stahl, Holz und Stein zur Kerze",250,32);
      if(scene==="lever-effect")ctx.fillText(!seesawBody?"Platziere die Wippe unter der roten Kugel":"Lass die Bowlingkugel auf das andere Ende fallen",270,32);
      if(scene==="cat-jump")ctx.fillText(!catStartledAt?"Triff die freie linke Seite der Wippe":catImpactMode==="drop"?"Die Katzenseite sinkt – die Katze fällt nach unten":!catOnPlatformAt?"Die Katze erschrickt und fliegt zur oberen Ebene":"Die Katze verfolgt die Maus",275,32);
      if(scene==="mr-blue-rescue")ctx.fillText(!fishBowlBrokenAt?`Lass einen Körper auf ${CHARACTERS.fish}s Glas fallen`:!fishVisible?"Das Glas zerbricht …":!fishChaseAt?`${CHARACTERS.fish} zappelt – kann ${CHARACTERS.cat} ihn sehen?`:`${CHARACTERS.cat} läuft zu ${CHARACTERS.fish}`,260,32);
      if(scene==="snip-snap"){const closed=scissorClosedAt.filter(Boolean).length;ctx.fillText(closed===3?"Alle Ballons sind frei – jetzt müssen sie oben hinaus!":`${closed} von 3 Scheren geschlossen`,340,32)}
      if(scene==="rocket-parade"){const launched=rocketBodies.filter(body=>{const id=machinePlugin(body)?.instanceId;return id&&machine.state(id)?.state==="launched"}).length,ignited=rocketIgnitedAt.size;ctx.fillText(!beltConnected?"Verbinde Louis und das Laufband mit dem Antriebsriemen":!motor?"Fange die Kerze auf und lenke sie über Louis":launched===4?"Vier Raketen sind gestartet!":ignited?`${launched} gestartet · ${ignited-launched} zünden · Kerze fährt weiter`:`Louis läuft – bringe die Kerzenflamme unter die vier Düsen`,220,32);if(fallingCandle&&fallingCandle.position.y>510)ctx.fillText("Die Kerze ist heruntergefallen – versuche eine andere Plankenführung.",230,58)}
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);unsubscribeMachine();machine.destroy()};
  },[level,placed,ropePath,scissorRopes,pendingScissor,ropeMode,selectedTool,selectedId,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}
