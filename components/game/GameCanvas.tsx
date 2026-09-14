"use client";

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createBucketAssembly } from "@/game/water";
import { SEESAW_WIDTH } from "@/game/seesaw";
import { analyzePulleyRoute,LEVEL_FIVE_INITIAL_WEIGHT_Y, type PulleyRouteKind,ropeGeometry,type RopePoint } from "@/game/pulley";
import {catSpriteOffsetX,catSpritePose} from "@/game/cat";
import {CATAPULT_PLATFORM} from "@/game/catapult";
import {mouseSpriteFrame} from "@/game/mouse";
import {FuseNetwork} from "@/game/fuse";
import {FISH_REVEAL_DELAY_MS} from "@/game/fish";
import {SCISSOR_LAYOUT,scissorPullPoint} from "@/game/scissors";
import {drawConveyor,drawDriveBelt,driveBeltGeometry} from "@/game/drive";
import {rocketVisual} from "@/game/rocket";
import {MachineRuntime} from "@/game/machine-runtime";
import { MachinePhysicsEngine } from "@/engine/physics-engine";
import { machinePlugin } from "@/engine/body-factory";
import type { LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import type { PlacedGadget, RopeNode, ScissorRope } from "./types";
import { drawSceneHints, presentationForScene, type ScenePresentationFrame } from "./scene-presentation";
import { createCatalogSpriteRenderer } from "./catalog-sprite-renderer";

const ROPE_ANCHOR={x:92,y:64};
const FAN_VISIBLE_RANGE=210;
const CUSTOM_SPRITE_LABELS=new Set(["wheel","cat","mouse","fish","fishbowl","rocket","cannon","fuse","bucket","candle"]);

export function routeKindForPart(type:PlaceableGadgetType):PulleyRouteKind|null{
  if(type==="movingPulley")return"moving";if(type==="pulley")return"fixed";if(type==="ball")return"pull";return null;
}


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
    const scenePresentation = presentationForScene(level.scene);
    const hasSystem = (system: string) => level.systems.includes(system);
    const standaloneMouseChase = hasSystem("cat-mouse") && !hasSystem("catapult") && !hasSystem("cat-fish");
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const drawCatalogSprite = createCatalogSpriteRenderer();
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
    const runtime = new MachineRuntime({
      level, machine, running, onWin, beltConnected,
      bodies: {
        cat, balloon, levelBall, weight, bucket: bucketBody, seesaw: seesawBody,
        fishBowl, fish: fishBody, mouse: mouseBody, cannon: cannonBody,
        candle: machine.bodiesByType("candle").find(body => body.label === "candle") ?? null,
        hamsterWheel: hamsterWheelBody, conveyor: conveyorBody, water: waterBodies,
        scissorBalloons, rockets: rocketBodies,
      },
      scissorConnections: scissorRopePhysics,
      tetheredBalloonIds: tetheredBalloonConfigs.map(gadget => gadget.id),
      fuseNetwork, fuseId, cannonFuseId, gearsConnected,
      rope: {
        fixed: routeFixed, moving: routeMoving, placedBall, initialMovingPositions,
        initialBlockPosition, initialWeightY, ready: ropeReady, restLength: restRopeLength,
        physicsPoints,
      },
    });
    let raf=0,last=performance.now();
    const drawGear = (x:number,y:number,r:number,turn:number) => { ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle="#d39a28"; for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-5,-5,12,10)} ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173d50";ctx.beginPath();ctx.arc(0,0,r*.28,0,Math.PI*2);ctx.fill();ctx.restore(); };
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now;
      runtime.tick(now, dt);
      const {
        motor, balloonPopped, mouseFleeAt, catStartledAt, catImpactMode,
        catFallStartedAt, catOnPlatformAt, fishBowlBrokenAt, fishChaseAt,
        fuseClock, fuseIgnited, fuseReady, fuseExtinguishedAt,
        cannonFiredAt, candleExtinguished, bucketTipAt,
      } = runtime.state;
      const fishVisible = runtime.state.fishReleased;
      const {waterSplashAt, wetFuseIds, scissorClosedAt, rocketIgnitedAt} = runtime;
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40);
      if(conveyorBody&&hamsterWheelBody&&hasSystem("conveyor")){
        const conveyorRunning=motor&&beltConnected,conveyorVisual=drawConveyor(ctx,{centerX:conveyorBody.position.x,centerY:conveyorBody.position.y,width:conveyorWidth,now,running:conveyorRunning});
        const sourcePort={x:hamsterWheelBody.position.x+55,y:hamsterWheelBody.position.y+13},targetPort=conveyorVisual.leftWheel;
        if(beltConnected)drawDriveBelt(ctx,driveBeltGeometry(sourcePort,targetPort,18,conveyorVisual.wheelRadius),now,conveyorRunning);
        const hamsterId=machinePlugin(hamsterWheelBody)?.instanceId;
        if(!drawCatalogSprite(ctx,hamsterId?machine.animation(hamsterId):null,hamsterWheelBody.position.x,hamsterWheelBody.position.y))drawGear(hamsterWheelBody.position.x,hamsterWheelBody.position.y,42,motor?now/180:0);
        ctx.fillStyle="#d69b29";ctx.strokeStyle="#173f50";ctx.lineWidth=4;ctx.beginPath();ctx.arc(sourcePort.x,sourcePort.y,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(sourcePort.x,sourcePort.y,4,0,Math.PI*2);ctx.fill();
        if(selectedTool==="belt"&&!running){const drawPort=(point:{x:number;y:number},label:string)=>{ctx.save();ctx.fillStyle=beltConnected?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(point.x,point.y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.fillText(label,point.x+17,point.y+4);ctx.restore()};drawPort(sourcePort,"LOUIS");drawPort(targetPort,"LAUFBAND")}
        if(driveBelt&&selectedId===driveBelt.id&&!running){const center={x:(sourcePort.x+targetPort.x)/2,y:(sourcePort.y+targetPort.y)/2};ctx.save();ctx.strokeStyle="#e5392c";ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.strokeRect(center.x-49,center.y-24,98,48);ctx.setLineDash([]);ctx.fillStyle="#fff4cf";ctx.fillRect(center.x-35,center.y-12,70,22);ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText("RIEMEN",center.x,center.y+4);ctx.restore()}
      }
      const sceneFrame: ScenePresentationFrame = {
        ctx, now, running, level,
        sprites: { fire: drawFireSprite, water: drawWaterSprite, fallbackFlame: drawFallbackFlame },
        status: {
          beltConnected, motor, balloonPopped,
          mouseFleeing: !!mouseFleeAt,
          gearsConnected,
          fuseIgnited, fuseExtinguished: !!fuseExtinguishedAt, fuseReady,
          candleExtinguished, bucketPlaced: !!bucketBody, seesawPlaced: !!seesawBody,
          catStartled: !!catStartledAt, catImpactMode, catOnPlatform: !!catOnPlatformAt,
          fishBowlBroken: !!fishBowlBrokenAt, fishVisible, fishChasing: !!fishChaseAt,
          rocketLaunched: rocketBodies.filter(body => { const id = machinePlugin(body)?.instanceId; return id && machine.state(id)?.state === "launched"; }).length,
          rocketIgnited: rocketIgnitedAt.size,
          candleFallen: !!fallingCandle && fallingCandle.position.y > 510,
        },
        pulley: {
          anchor: ROPE_ANCHOR, path: ropePath,
          typeForPlacedId: id => placedById.get(id)?.type,
          positionForPlacedId: id => { const body = bodyByPlacedId.get(id); return body ? { ...body.position } : undefined; },
          kindForPart: routeKindForPart,
          moving: routeMoving.map(body => ({ ...body.position })),
          weight: weight ? { ...weight.position } : null,
          analysis: routeAnalysis,
        },
        scissors: {
          balloons: scissorBalloons.map(body => ({ ...body.position })),
          closedAt: [...scissorClosedAt],
          connections: scissorRopePhysics.map(connection => ({ scissorIndex: connection.scissorIndex, pull: { ...connection.pullBody.position } })),
        },
      };
      scenePresentation?.decorate?.(sceneFrame);
      if(waterBodies.length){ctx.strokeStyle="rgba(33,158,211,.34)";ctx.lineWidth=7;ctx.lineCap="round";for(let i=0;i<waterBodies.length;i++)for(let j=i+1;j<waterBodies.length;j++){const a=waterBodies[i].position,b=waterBodies[j].position;if(Math.hypot(a.x-b.x,a.y-b.y)<10){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}}
      for(const b of Matter.Composite.allBodies(engine.world)){
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
        const gadgetId=machinePlugin(b)?.instanceId;
        const catalogAnimation=gadgetId?machine.animation(gadgetId):null;
        const genericSprite=!CUSTOM_SPRITE_LABELS.has(b.label)&&drawCatalogSprite(ctx,catalogAnimation,0,0);
        if(!genericSprite){
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
        if(b.label==="mouse"){const mouseRunning=(standaloneMouseChase&&mouseFleeAt>0)||(hasSystem("catapult")&&catOnPlatformAt>0),id=machinePlugin(b)?.instanceId,frame=mouseSpriteFrame(now,mouseRunning);if(!drawCatalogSprite(ctx,id?machine.animation(id):null,0,-5)&&!drawMouseSprite(frame,0,-5,60)){ctx.font="36px serif";ctx.fillText("🐁",-20,14)}}
        if(b.label==="fishbowl"){const breakAge=fishBowlBrokenAt?now-fishBowlBrokenAt:-1;if(!fishBowlBrokenAt){if(!drawMrBlueSprite(0,Math.floor(now/460)%3,0,-4,150)){ctx.font="70px serif";ctx.fillText("🐠",-38,22)}}else if(breakAge<FISH_REVEAL_DELAY_MS){drawMrBlueSprite(1,Math.min(2,Math.floor(breakAge/(FISH_REVEAL_DELAY_MS/3))),0,-4,150)}}
        if(b.label==="fish"&&fishVisible){const id=machinePlugin(b)?.instanceId,animation=id?machine.animation(id):null,frame=animation?.frame??Math.floor((now-fishBowlBrokenAt)/150)%3,offset=mrBlueFlopOffsets[frame%3];if(!drawCatalogSprite(ctx,animation,offset.x,offset.y)&&!drawMrBlueSprite(2,frame,offset.x,offset.y,86)){ctx.font="44px serif";ctx.fillText("🐟",-24,15)}}
        if(b.label==="catapultPlatform"){ctx.fillStyle="#6e858d";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,18);ctx.fillStyle="#c3d0d2";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,4);ctx.fillStyle="#3e5963";for(let rivet=-170;rivet<=170;rivet+=40){ctx.beginPath();ctx.arc(rivet,0,3,0,Math.PI*2);ctx.fill()}}
        if(b.label==="catapultMouseHole"){ctx.fillStyle="#173f50";ctx.fillRect(-28,-55,56,110);ctx.fillStyle="#f1d28d";ctx.font="bold 12px system-ui";ctx.fillText("MAUS-",-21,-5);ctx.fillText("LOCH",-18,12)}
        if(["gear","gearSource","gearTarget"].includes(b.label)){const depth=gearDepth.get(b.id);ctx.rotate(running&&depth!==undefined?(now/170)*(depth%2?-1:1):0);ctx.fillStyle=b.label==="gearTarget"?"#bf432d":"#d39a28";for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(34,-6,15,12)}ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="cannon"){ctx.fillStyle="#263d43";ctx.fillRect(-42,-16,82,32);ctx.fillStyle="#b26a29";ctx.beginPath();ctx.arc(-18,25,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#263d43";ctx.fillRect(32,-21,20,42);const fuse=fuseNetwork.snapshot(cannonFuseId,fuseClock),point=(t:number)=>({x:-18+(-26+18)*t,y:-42+(-17+42)*t});ctx.lineWidth=5;ctx.lineCap="round";for(let index=0;index<fuse.samples.length-1;index++){const from=point(fuse.samples[index].t),to=point(fuse.samples[index+1].t);ctx.strokeStyle=fuse.samples[index].burned?"#a29a8d":"#49382a";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}if(!fuseExtinguishedAt)for(const t of fuse.flames){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y,34,34))drawFallbackFlame(flame.x,flame.y,now,.55)}if(cannonFiredAt&&now-cannonFiredAt<520){const flashFrame=Math.min(5,Math.floor((now-cannonFiredAt)/87));if(!drawFireSprite(2,flashFrame,70,0,105,78))drawFallbackFlame(67,0,now,1.5)}}
        if(b.label==="fuse"){const fuse=fuseNetwork.snapshot(fuseId(b),fuseClock),point=(t:number)=>({x:-55+110*t,y:16*t*(1-t)});ctx.lineWidth=7;ctx.lineCap="round";for(let index=0;index<fuse.samples.length-1;index++){const from=point(fuse.samples[index].t),to=point(fuse.samples[index+1].t);ctx.strokeStyle=fuse.samples[index].burned?"#a29a8d":"#4f3d2b";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}if(!fuseExtinguishedAt)for(const t of fuse.flames){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y-3,34,34))drawFallbackFlame(flame.x,flame.y-3,now,.55)}if(wetFuseIds.has(b.id)){ctx.strokeStyle="#2ca7d8";ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(50,4);ctx.stroke();ctx.setLineDash([])}}
        if(b.label==="bucket"){ctx.fillStyle="rgba(76,141,168,.38)";ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(38,-28);ctx.lineTo(29,32);ctx.lineTo(-29,32);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#b7dbe4";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-25,38,Math.PI,0);ctx.stroke();ctx.fillStyle="#d8edf0";ctx.fillRect(-38,-31,76,7);if(running&&Math.abs(b.angle)>.18){const streamFrame=Math.min(5,Math.floor((now-bucketTipAt)/230));drawWaterSprite(2,streamFrame,43,-22,105,78,0)}}
        if(b.label==="water"){const splashAt=waterSplashAt.get(b.id),splashAge=splashAt?now-splashAt:Infinity;if(splashAge<420){drawWaterSprite(1,Math.min(5,Math.floor(splashAge/70)),0,-2,34,24)}else{const speed=Math.hypot(b.velocity.x,b.velocity.y);if(speed>2){ctx.strokeStyle="rgba(80,190,232,.48)";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-b.velocity.x*1.8,-b.velocity.y*1.8);ctx.lineTo(0,0);ctx.stroke()}if(!drawWaterSprite(0,(b.id+Math.floor(now/120))%6,0,0,24,20)){ctx.fillStyle="#42b9e9";ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill()}}}
        if(b.label==="cannonball"){ctx.fillStyle="#333f43";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="rocket"){const id=machinePlugin(b)?.instanceId,state=id?(machine.state(id)?.state??"mounted"):"mounted",visual=rocketVisual(state,id?rocketIgnitedAt.get(id):undefined,now);if(visual.visible&&!drawRocketSprite(visual.row,visual.frame,0,visual.offsetY,visual.size)){ctx.fillStyle="#d94d32";ctx.beginPath();ctx.moveTo(0,-55+visual.offsetY);ctx.lineTo(-24,18+visual.offsetY);ctx.lineTo(24,18+visual.offsetY);ctx.closePath();ctx.fill()}if(visual.smokeOpacity>0){ctx.save();ctx.globalAlpha=visual.smokeOpacity;ctx.fillStyle="#d8d2c7";for(let puff=0;puff<7;puff++){const angle=puff/7*Math.PI*2,radius=9+(puff%3)*3;ctx.beginPath();ctx.arc(Math.cos(angle+now*.001)*22,55+Math.sin(angle)*10,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
        if(b.label==="seesawPayload"){ctx.fillStyle="#c73b2e";ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4c64e";ctx.beginPath();ctx.arc(-5,-5,4,0,Math.PI*2);ctx.fill()}
        }
        if(b.plugin?.placedId===selectedId&&!running){ctx.strokeStyle="#e5392c";ctx.lineWidth=3;ctx.setLineDash([7,5]);if(b.label==="seesaw")ctx.strokeRect(-126,-48,252,96);else if(["ramp","trampoline","fuse","cannon","bucket"].includes(b.label))ctx.strokeRect(-64,-38,128,76);else{ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([])}ctx.restore();
      }
      if(hasSystem("pulley-rope")&&ropeMode&&!running){const selectedParts=new Map<number,number>();ropePath.forEach((node,index)=>{if(node.kind==="part")selectedParts.set(node.placedId,index)});const anchorOrder=ropePath.findIndex(node=>node.kind==="anchor"),drawPort=(x:number,y:number,order?:number,label?:string)=>{ctx.save();ctx.fillStyle=order!==undefined&&order>=0?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();if(order!==undefined&&order>=0){ctx.fillStyle="#173f50";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(String(order+1),x,y+4)}if(label){ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="left";ctx.fillText(label,x+28,y+4)}ctx.restore()};drawPort(ROPE_ANCHOR.x,ROPE_ANCHOR.y,anchorOrder>=0?anchorOrder:undefined);for(const part of placed){const kind=routeKindForPart(part.type);if(!kind)continue;drawPort(part.x,part.y,selectedParts.get(part.id),part.type==="pulley"?"FEST":part.type==="movingPulley"?"LOSE":"KUGEL")}}
      if(hasSystem("scissors")&&ropeMode&&!running){const drawPort=(x:number,y:number,label:string,active=false)=>{ctx.save();ctx.fillStyle=active?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.fillText(label,x+17,y+4);ctx.restore()};SCISSOR_LAYOUT.forEach((_,index)=>{if(!scissorRopes.some(rope=>rope.scissorIndex===index)){const port=scissorPullPoint(index);drawPort(port.x,port.y,`GRIFF ${index+1}`,pendingScissor===index)}});for(const part of placed){if(!["ball","tennisBall"].includes(part.type))continue;const body=bodyByPlacedId.get(part.id);if(body)drawPort(body.position.x,body.position.y,part.type==="tennisBall"?"TENNISBALL":"KUGEL")}}
      drawSceneHints(scenePresentation, sceneFrame);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);runtime.dispose();machine.destroy()};
  },[level,placed,ropePath,scissorRopes,pendingScissor,ropeMode,selectedTool,selectedId,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}
