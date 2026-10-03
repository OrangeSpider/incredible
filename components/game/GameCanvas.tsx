"use client";

import { localPort } from "@/engine/gadget-ports";
import { drawDriveWheel } from "@/game/drive";
import { bodyPoint } from "@/engine/gadget-geometry";
import { resolveGadgetAnimation } from "@/engine/animation";

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { SEESAW_WIDTH } from "@/game/seesaw";
import {catSpriteOffsetX,catSpritePose} from "@/game/cat";
import {CATAPULT_PLATFORM} from "@/game/catapult";
import {mouseSpriteFrame} from "@/game/mouse";
import {FISH_REVEAL_DELAY_MS} from "@/game/fish";
import type { PendingControlRope } from "@/game/control-ropes";
import { drawControlRopes } from "./control-rope-renderer";
import {rocketVisual} from "@/game/rocket";
import { machinePlugin } from "@/engine/body-factory";
import type { LevelDefinition, PlaceableGadgetType } from "@/engine/types";
import type { PlacedGadget, RopeNode, ScissorRope } from "./types";
import { placedConfigId } from "./types";
import { drawSceneHints, presentationForScene, type ScenePresentationFrame } from "./scene-presentation";
import { createCatalogSpriteRenderer } from "./catalog-sprite-renderer";
import { createFluidWaterRenderer } from "./fluid-water-renderer";
import { drawGadget, drawFields, drawConnections, drawConnectionPorts, drawMouseHole } from "./gadget-renderer";
import type { GadgetConnection } from "@/engine/types";

import { createSimulation, routeKindForPart } from "@/game/simulation-setup";

type GameCanvasProps = {
  level: LevelDefinition;
  placed: PlacedGadget[];
  ropePath: RopeNode[];
  scissorRopes: ScissorRope[];
  pendingScissor: PendingControlRope | null;
  ropeMode: boolean;
  selectedTool: PlaceableGadgetType | null;
  selectedId: number | null;
  connections: GadgetConnection[];
  selectedConnection: string | null;
  pendingConnection: string | null;
  selectedRope: string | null;
  running: boolean;
  attempt: number;
  onWin: () => void;
};

export default function GameCanvas({ level, placed, ropePath, scissorRopes, pendingScissor, ropeMode, selectedTool, selectedId, connections, selectedConnection, pendingConnection, selectedRope, running, attempt, onWin }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scenePresentation = presentationForScene(level.scene);
    const ROPE_ANCHOR = level.loadRope?.anchor ?? {x:0,y:0};
    const hasSystem = (system: string) => level.systems.includes(system);
    const standaloneMouseChase = hasSystem("cat-mouse") && !hasSystem("catapult") && !hasSystem("cat-fish");
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const drawCatalogSprite = createCatalogSpriteRenderer();
    const drawFluidWater = createFluidWaterRenderer(canvas.width, canvas.height);
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
    const {machine, runtime, gearDepth, placedById, bodyByPlacedId, routeAnalysis} = createSimulation({
      level, placed, connections, controlRopes: scissorRopes, ropePath, running, onWin,
    });
    const engine = machine.matter;
    const W = 900, H = 520;
    const {bucket: bucketBody, seesaw: seesawBody,
      conveyor: conveyorBody, water: waterBodies, rockets: rocketBodies, weight, scissorBalloons} = runtime.options.bodies;
    const {gearsConnected} = runtime.options;
    const beltConnected = machine.connections.some(connection=>connection.kind==="belt");
    const {moving: routeMoving, physicsPoints} = runtime.options.rope;
    const fallingCandle = machine.body("falling-candle");
    let raf=0,last=performance.now();
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now;
      runtime.tick(now, dt);
      const {
        motor, balloonPopped, mouseFleeAt, catStartledAt, catImpactMode,
        catFallStartedAt, catOnPlatformAt, fishBowlBrokenAt, fishChaseAt,
        candleExtinguished,
      } = runtime.state;
      const states = machine.allStates();
      const fuseIgnited = states.some(state => state.type === "fuse" && ["burning", "burned"].includes(state.state));
      const fuseReady = states.some(state => state.type === "cannon" && state.state === "fuseBurning");
      const fuseExtinguished = states.some(state => state.type === "fuse" && state.state === "extinguished");
      const cannonFired = states.some(state => state.type === "cannon" && state.state === "firing");
      const fishVisible = runtime.state.fishReleased;
      const {scissorClosedAt, rocketIgnitedAt} = runtime;
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      if (level.floor !== false) { ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40); }
      const sceneFrame: ScenePresentationFrame = {
        ctx, now, running, level,
        sprites: { fire: drawFireSprite, water: drawWaterSprite, fallbackFlame: drawFallbackFlame },
        status: {
          beltConnected, motor, balloonPopped,
          mouseFleeing: !!mouseFleeAt,
          gearsConnected,
          fuseIgnited, fuseExtinguished, fuseReady,
          candleExtinguished, bucketPlaced: !!bucketBody, seesawPlaced: !!seesawBody,
          catStartled: !!catStartledAt, catImpactMode, catOnPlatform: !!catOnPlatformAt,
          fishBowlBroken: !!fishBowlBrokenAt, fishVisible, fishChasing: !!fishChaseAt,
          rocketLaunched: rocketBodies.filter(body => { const id = machinePlugin(body)?.instanceId; return id && machine.state(id)?.state === "launched"; }).length,
          rocketIgnited: rocketIgnitedAt.size,
          candleFallen: !!fallingCandle && fallingCandle.position.y > 510,
          singleScissorClosed: machine.state("cutter")?.state === "closed",
          gateOpen: machine.state("snap-gate")?.state === "open",
          magnetRunning: machine.allStates().some(state => state.type === "magnet" && state.state === "running"),
          cannonFired,
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
          connections: [],
        },
      };
      scenePresentation?.decorate?.(sceneFrame);
      drawFields(ctx, machine);
      drawFluidWater.draw(ctx, waterBodies.map(body => ({ x: body.position.x, y: body.position.y, vx: body.velocity.x, vy: body.velocity.y })));
      drawConnections(ctx,machine,selectedConnection,now,running);
      for(const b of Matter.Composite.allBodies(engine.world)){
        if(b.label==="water")continue;
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);ctx.scale(b.plugin?.machine?.flipX?-1:1,b.plugin?.machine?.flipY?-1:1);
        const gadgetId=machinePlugin(b)?.instanceId;
        const gadgetConfig=gadgetId?machine.config(gadgetId):null;
        let catalogAnimation=gadgetId?machine.animation(gadgetId):null;
        if(!running && catalogAnimation?.definition.loop && gadgetId)catalogAnimation=resolveGadgetAnimation(machine.config(gadgetId)!.type,machine.state(gadgetId)!.state,now);
        const customSprite=!!gadgetConfig && (["candle","rocket","cannon","fuse","bucket"].includes(gadgetConfig.type) || (["cat","mouse"].includes(gadgetConfig.type) && !gadgetConfig.properties?.standalone));
        const genericSprite=!customSprite&&drawCatalogSprite(ctx,catalogAnimation,0,0);
        const drawnGadget=!genericSprite&&drawGadget(ctx,b,machine,now,running);
        if(!genericSprite&&!drawnGadget){
        if(b.label==="ball"||b.label==="mainBall"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.fillStyle=b.label==="mainBall"?"#e7a849":"#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="tennisBall"){ctx.fillStyle="#d7eb4c";ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff8c5";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-8,0,9,-1.15,1.15);ctx.stroke();ctx.beginPath();ctx.arc(8,0,9,2,4.3);ctx.stroke()}
        if(b.label==="scissorBalloon"){const colors=["#e84d52","#3f9bd2","#efb630"],index=scissorBalloons.indexOf(b);ctx.fillStyle=colors[Math.max(0,index)];ctx.beginPath();ctx.ellipse(0,0,21,27,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,.55)";ctx.beginPath();ctx.ellipse(-7,-9,5,9,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=colors[Math.max(0,index)];ctx.beginPath();ctx.moveTo(-5,25);ctx.lineTo(5,25);ctx.lineTo(0,34);ctx.closePath();ctx.fill()}
        if(b.label==="ramp"){ctx.fillStyle="#8d5426";ctx.fillRect(-75,-7,150,14);ctx.strokeStyle="#4e2a14";ctx.strokeRect(-75,-7,150,14)}

        if(b.label==="levelBalloon"&&!balloonPopped){ctx.fillStyle="#1976b9";ctx.beginPath();ctx.ellipse(0,0,22,28,0,0,7);ctx.fill();ctx.strokeStyle="#305468";ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(0,62);ctx.stroke()}
        if(b.label==="levelBall"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="seesaw"){const half=SEESAW_WIDTH/2;ctx.fillStyle="#ad6a2d";ctx.fillRect(-half,-9,SEESAW_WIDTH,18);ctx.fillStyle="#e3aa54";ctx.fillRect(-half,-9,SEESAW_WIDTH,5);ctx.strokeStyle="#51301a";ctx.lineWidth=3;ctx.strokeRect(-half,-9,SEESAW_WIDTH,18);ctx.fillStyle="#173f50";for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*(half-10),0,6,0,Math.PI*2);ctx.fill()}ctx.save();ctx.rotate(-b.angle);ctx.fillStyle="#a43a27";ctx.beginPath();ctx.moveTo(-27,46);ctx.lineTo(27,46);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.strokeStyle="#65251b";ctx.stroke();ctx.restore()}
        if(b.label==="pulley"){ctx.fillStyle="#d39a28";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,0);ctx.stroke()}
        if(b.label==="movingPulley"){ctx.fillStyle="#4f9da8";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,0);ctx.stroke();ctx.save();ctx.rotate(-b.angle);ctx.fillStyle="#f4e5c0";ctx.font="bold 10px system-ui";ctx.fillText("LOSE",-15,4);ctx.restore()}
        if(b.label==="weight"){ctx.strokeStyle="#303b40";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-39,9,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#555d60";ctx.fillRect(-32,-32,64,64);ctx.fillStyle="#f0d59a";ctx.font="bold 14px system-ui";ctx.fillText("50 kg",-21,5)}
        if(b.label==="steelBeam"){ctx.fillStyle="#6e858d";ctx.fillRect(-118,-9,236,18);ctx.fillStyle="#c3d0d2";ctx.fillRect(-118,-9,236,4);ctx.fillStyle="#3e5963";for(let rivet=-100;rivet<=100;rivet+=40){ctx.beginPath();ctx.arc(rivet,0,3,0,Math.PI*2);ctx.fill()}}
        if(b.label==="woodWall"){ctx.fillStyle="#9b5e2a";ctx.fillRect(-12,-90,24,180);ctx.strokeStyle="#5a321a";for(let plank=-80;plank<90;plank+=28){ctx.strokeRect(-12,plank,24,28);ctx.beginPath();ctx.moveTo(-8,plank+7);ctx.lineTo(8,plank+20);ctx.stroke()}}
        if(b.label==="stoneWall"){const halfHeight=(b.bounds.max.y-b.bounds.min.y)/2;ctx.fillStyle="#7d817e";ctx.fillRect(-21,-halfHeight,42,halfHeight*2);ctx.strokeStyle="#4e5554";ctx.lineWidth=2;for(let row=-halfHeight;row<halfHeight;row+=24){ctx.beginPath();ctx.moveTo(-21,row);ctx.lineTo(21,row);ctx.stroke();const seam=(Math.floor((row+halfHeight)/24)%2===0)?0:-10;ctx.beginPath();ctx.moveTo(seam,row);ctx.lineTo(seam,Math.min(row+24,halfHeight));ctx.stroke()}}
        if(b.label==="cat"){const airborneStartle=hasSystem("catapult")&&catImpactMode==="launch"&&catStartledAt>0&&!catOnPlatformAt,fallingStartle=catFallStartedAt>0,startledAt=airborneStartle?catStartledAt:fallingStartle?catFallStartedAt:null,catRunning=motor||(standaloneMouseChase&&mouseFleeAt>0)||(hasSystem("catapult")&&catOnPlatformAt>0)||(hasSystem("cat-fish")&&fishChaseAt>0),pose=catSpritePose(now,{running:catRunning,startledAt,holdStartled:airborneStartle||fallingStartle}),size=pose.state==="idle"?90:pose.state==="running"?106:112,offsetX=catSpriteOffsetX(pose,size),offsetY=pose.state==="idle"?-12:pose.state==="startled"?-16:0;if(!drawCatSprite(pose.row,pose.frame,offsetX,offsetY,size)){ctx.font="54px serif";ctx.fillText("🐈",-34,20)}}
        if(b.label==="needle"){ctx.fillStyle="#737c80";ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(-9,35);ctx.lineTo(9,35);ctx.closePath();ctx.fill();ctx.fillStyle="#a96c2d";ctx.fillRect(-14,28,28,12)}
        if(b.label==="mouse"){const mouseRunning=(standaloneMouseChase&&mouseFleeAt>0)||(hasSystem("catapult")&&catOnPlatformAt>0),id=machinePlugin(b)?.instanceId,frame=mouseSpriteFrame(now,mouseRunning);if(!drawCatalogSprite(ctx,id?machine.animation(id):null,0,-5)&&!drawMouseSprite(frame,0,-5,60)){ctx.font="36px serif";ctx.fillText("🐁",-20,14)}}
        if(b.label==="fishbowl"){const breakAge=fishBowlBrokenAt?now-fishBowlBrokenAt:-1;if(!fishBowlBrokenAt){if(!drawMrBlueSprite(0,Math.floor(now/460)%3,0,-4,150)){ctx.font="70px serif";ctx.fillText("🐠",-38,22)}}else if(breakAge<FISH_REVEAL_DELAY_MS){drawMrBlueSprite(1,Math.min(2,Math.floor(breakAge/(FISH_REVEAL_DELAY_MS/3))),0,-4,150)}}
        if(b.label==="fish"&&fishVisible){const id=machinePlugin(b)?.instanceId,animation=id?machine.animation(id):null,frame=animation?.frame??Math.floor((now-fishBowlBrokenAt)/150)%3,offset=mrBlueFlopOffsets[frame%3];if(!drawCatalogSprite(ctx,animation,offset.x,offset.y)&&!drawMrBlueSprite(2,frame,offset.x,offset.y,86)){ctx.font="44px serif";ctx.fillText("🐟",-24,15)}}
        if(b.label==="catapultPlatform"){ctx.fillStyle="#6e858d";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,18);ctx.fillStyle="#c3d0d2";ctx.fillRect(-CATAPULT_PLATFORM.width/2,-9,CATAPULT_PLATFORM.width,4);ctx.fillStyle="#3e5963";for(let rivet=-170;rivet<=170;rivet+=40){ctx.beginPath();ctx.arc(rivet,0,3,0,Math.PI*2);ctx.fill()}}
        if(b.label==="catapultMouseHole")drawMouseHole(ctx,0,55,52,58);
        if(["gear","gearSource","gearTarget"].includes(b.label)){const depth=gearDepth.get(b.id);ctx.rotate(running&&(depth!==undefined||machine.state(gadgetId??"")?.state==="running")?(now/170)*((depth??0)%2?-1:1):0);ctx.fillStyle=b.label==="gearTarget"?"#bf432d":"#d39a28";for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(34,-6,15,12)}ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="magnet"){
          ctx.save();ctx.strokeStyle="rgba(38,139,166,.24)";ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.lineDashOffset=running?-now/35:0;
          for(const radius of [68,112,158,208]){ctx.beginPath();ctx.arc(0,0,radius,-2.55,-.6);ctx.arc(0,0,radius,.6,2.55);ctx.stroke()}
          ctx.restore();
          ctx.fillStyle="#c74437";ctx.fillRect(-25,-24,20,48);ctx.fillStyle="#347ca7";ctx.fillRect(5,-24,20,48);
          ctx.fillStyle="#364951";ctx.fillRect(-25,10,50,17);
          ctx.fillStyle="#f6dfb0";ctx.fillRect(-24,-24,18,9);ctx.fillRect(6,-24,18,9);
          if(gadgetId&&machine.state(gadgetId)?.state==="running"){
            const pulse=25+Math.sin(now/110)*3;ctx.strokeStyle="rgba(111,218,240,.8)";ctx.lineWidth=3;
            ctx.beginPath();ctx.arc(0,-10,pulse,Math.PI*.08,Math.PI*.92);ctx.stroke();
          }
        }
        if(b.label==="snapGate"){
          const gateLength=Number(level.fixedGadgets.find(gadget=>gadget.id===gadgetId)?.physics?.height??120);
          const opened=gadgetId&&machine.state(gadgetId)?.state==="open";
          const progress=opened&&gadgetId?Math.min(1,(machine.stateAgeMs(gadgetId)??0)/430):0;
          ctx.fillStyle="#33434a";ctx.beginPath();ctx.arc(0,-gateLength/2,14,0,Math.PI*2);ctx.fill();
          ctx.save();ctx.translate(0,-gateLength/2);ctx.rotate(-progress*1.18);
          ctx.fillStyle="#367e8e";ctx.strokeStyle="#173f50";ctx.lineWidth=4;
          ctx.fillRect(-10,0,20,gateLength);ctx.strokeRect(-10,0,20,gateLength);
          ctx.strokeStyle="#9bd4d8";ctx.lineWidth=2;for(let mark=22;mark<gateLength-16;mark+=22){ctx.beginPath();ctx.moveTo(-7,mark);ctx.lineTo(7,mark-8);ctx.stroke()}
          ctx.fillStyle=opened?"#55c782":"#e6523e";ctx.beginPath();ctx.arc(0,gateLength-17,7+(!opened?Math.sin(now/150)*1.2:0),0,Math.PI*2);ctx.fill();
          ctx.restore();
          if(opened&&progress<1){ctx.strokeStyle="rgba(241,190,68,.85)";ctx.lineWidth=3;for(let spark=0;spark<4;spark++){const angle=now/110+spark*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(angle)*18,-gateLength/2+Math.sin(angle)*18);ctx.lineTo(Math.cos(angle)*28,-gateLength/2+Math.sin(angle)*28);ctx.stroke()}}
        }
        if(b.label==="singleScissor"){
          const closed=gadgetId&&machine.state(gadgetId)?.state==="closed",spread=closed ? .12 : .5;
          ctx.strokeStyle="#536a72";ctx.lineWidth=7;ctx.lineCap="round";ctx.beginPath();
          ctx.moveTo(0,0);ctx.lineTo(-Math.sin(spread)*31,-Math.cos(spread)*31);ctx.moveTo(0,0);ctx.lineTo(Math.sin(spread)*31,-Math.cos(spread)*31);ctx.stroke();
          ctx.strokeStyle="#a86a32";ctx.lineWidth=5;ctx.beginPath();ctx.arc(-19,20,10,0,Math.PI*2);ctx.arc(19,20,10,0,Math.PI*2);ctx.stroke();
          ctx.fillStyle="#e1b84d";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();
        }
        if(b.label==="cannon"){ctx.fillStyle="#263d43";ctx.fillRect(-42,-16,82,32);ctx.fillStyle="#b26a29";ctx.beginPath();ctx.arc(-18,25,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#263d43";ctx.fillRect(32,-21,20,42);const fuse=machine.mechanics.fuseSnapshot(`${gadgetId}:fuse`),samples=fuse?.samples ?? [],point=(t:number)=>({x:-18+(-26+18)*t,y:-42+(-17+42)*t});ctx.lineWidth=5;ctx.lineCap="round";for(let index=0;index<samples.length-1;index++){const from=point(samples[index].t),to=point(samples[index+1].t);ctx.strokeStyle=samples[index].burned?"#a29a8d":"#49382a";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}for(const t of fuse?.flames ?? []){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y,34,34))drawFallbackFlame(flame.x,flame.y,now,.55)}if(gadgetId && machine.state(gadgetId)?.state==="firing" && (machine.stateAgeMs(gadgetId)??Infinity)<520){const flashFrame=Math.min(5,Math.floor((machine.stateAgeMs(gadgetId)??0)/87));if(!drawFireSprite(2,flashFrame,70,0,105,78))drawFallbackFlame(67,0,now,1.5)}}
        if(b.label==="fuse"){const fuse=machine.mechanics.fuseSnapshot(gadgetId!),samples=fuse?.samples ?? [],point=(t:number)=>({x:-55+110*t,y:16*t*(1-t)});ctx.lineWidth=7;ctx.lineCap="round";for(let index=0;index<samples.length-1;index++){const from=point(samples[index].t),to=point(samples[index+1].t);ctx.strokeStyle=samples[index].burned?"#a29a8d":"#4f3d2b";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}for(const t of fuse?.flames ?? []){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y-3,34,34))drawFallbackFlame(flame.x,flame.y-3,now,.55)}if(gadgetId && machine.state(gadgetId)?.state==="extinguished"){ctx.strokeStyle="#2ca7d8";ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(50,4);ctx.stroke();ctx.setLineDash([])}}
        if(b.label==="bucket"){
          ctx.fillStyle="rgba(76,141,168,.14)";
          ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(38,-28);ctx.lineTo(29,32);ctx.lineTo(-29,32);ctx.closePath();ctx.fill();
          ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.lineCap="round";
          ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(-29,32);ctx.lineTo(29,32);ctx.lineTo(38,-28);ctx.stroke();
          ctx.strokeStyle="#b7dbe4";ctx.lineWidth=4;
          ctx.beginPath();ctx.arc(0,-25,38,Math.PI,0);ctx.stroke();
          ctx.beginPath();ctx.moveTo(-41,-28);ctx.lineTo(-32,-28);ctx.moveTo(32,-28);ctx.lineTo(41,-28);ctx.stroke();
        }
        if(b.label==="cannonball"){ctx.fillStyle="#333f43";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(gadgetConfig?.type==="rocket"){const id=machinePlugin(b)?.instanceId,state=id?(machine.state(id)?.state??"mounted"):"mounted",age=id?(machine.stateAgeMs(id)??0):0,started=state==="burning"?now-age:state==="launching"?now-age-520:state==="launched"?now-age-1780:undefined,visual=rocketVisual(state,started,now);if(visual.visible&&!drawRocketSprite(visual.row,visual.frame,0,visual.offsetY,visual.size)){ctx.fillStyle="#d94d32";ctx.beginPath();ctx.moveTo(0,-55+visual.offsetY);ctx.lineTo(-24,18+visual.offsetY);ctx.lineTo(24,18+visual.offsetY);ctx.closePath();ctx.fill()}if(visual.smokeOpacity>0){ctx.save();ctx.globalAlpha=visual.smokeOpacity;ctx.fillStyle="#d8d2c7";for(let puff=0;puff<7;puff++){const angle=puff/7*Math.PI*2,radius=9+(puff%3)*3;ctx.beginPath();ctx.arc(Math.cos(angle+now*.001)*22,55+Math.sin(angle)*10,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
        if(b.label==="seesawPayload"){ctx.fillStyle="#c73b2e";ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4c64e";ctx.beginPath();ctx.arc(-5,-5,4,0,Math.PI*2);ctx.fill()}
        }
        if(gadgetConfig?.type === "hamsterWheel"){const port=localPort(gadgetConfig,"drive","drive");if(port)drawDriveWheel(ctx,port.local,14,running&&machine.state(gadgetId!)?.state==="running"?now*.008:0);}
        ctx.restore();
      }
      if (!level.loadRope) drawControlRopes(ctx, runtime, [
        ...level.fixedGadgets,
        ...placed.map(part => ({ ...part, id: placedConfigId(part) })),
      ], pendingScissor, ropeMode, selectedRope);
      drawConnectionPorts(ctx,machine,pendingConnection,selectedTool,running);
      if (selectedRope === "pulley-rope" && !running) {
        const points = physicsPoints(); ctx.save(); ctx.strokeStyle = "#e5392c"; ctx.lineWidth = 5; ctx.setLineDash([7,5]); ctx.beginPath();
        points.forEach((point,index) => { if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y); }); ctx.stroke(); ctx.restore();
      }
      if(!!level.loadRope&&ropeMode&&!running){const selectedParts=new Map<number,number>();ropePath.forEach((node,index)=>{if(node.kind==="part")selectedParts.set(node.placedId,index)});const anchorOrder=ropePath.findIndex(node=>node.kind==="anchor"),drawPort=(x:number,y:number,order?:number,label?:string)=>{ctx.save();ctx.fillStyle=order!==undefined&&order>=0?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();if(order!==undefined&&order>=0){ctx.fillStyle="#173f50";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(String(order+1),x,y+4)}if(label){ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="left";ctx.fillText(label,x+28,y+4)}ctx.restore()};drawPort(ROPE_ANCHOR.x,ROPE_ANCHOR.y,anchorOrder>=0?anchorOrder:undefined);for(const part of placed){const kind=routeKindForPart(part.type);if(!kind)continue;drawPort(part.x,part.y,selectedParts.get(part.id),part.type==="pulley"?"FEST":part.type==="movingPulley"?"LOSE":"KUGEL")}}
      drawSceneHints(scenePresentation, sceneFrame);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);runtime.dispose();machine.destroy()};
  },[level,placed,ropePath,scissorRopes,pendingScissor,ropeMode,selectedTool,selectedId,connections,selectedConnection,pendingConnection,selectedRope,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}
