"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import "./modal.css";
import { INTERACTIONS } from "@/game/interactions";
import { FORCE_SOURCES,GOAL_MODES } from "@/game/rules";
import { createBucketAssembly,WATER_SHAPE_RULES } from "@/game/water";
import { applySeesawImpact,createSeesaw,limitSeesawRotation,SEESAW_WIDTH } from "@/game/seesaw";
import { analyzePulleyRoute,BOWLING_PULL_KG,dampPulleyVelocity,LEVEL_FIVE_INITIAL_WEIGHT_Y,LEVEL_FIVE_LOAD_KG,LEVEL_FIVE_TARGET_Y,PULLEY_GRAVITY_PX,pulleyTargetReached,PulleyRouteKind,ropeConstraintCorrection,ropeGeometry,RopePoint } from "@/game/pulley";

type Part = "ball" | "ramp" | "belt" | "fan" | "trampoline" | "pulley" | "movingPulley" | "rope" | "needle" | "mouse" | "gear" | "cannon" | "fuse" | "bucket" | "seesaw";
type Placed = { id: number; type: Part; x: number; y: number; rotation: number };
type RopeNode={kind:"anchor"}|{kind:"part";placedId:number};
const ROPE_ANCHOR={x:92,y:64};
const FAN_VISIBLE_RANGE=210;
const FAN_MAX_RANGE=FAN_VISIBLE_RANGE*2;
const ACTIVE_LEVEL_COUNT=11;

const LEVELS = [
  ["Der erste Anstoß", "Bring die Katze zum Ausgang", "Mausmotor und Laufband"],
  ["Plopp!", "Bring den Ballon zur Kerzenflamme", "Lenke seinen Auftrieb mit Holzplanken"],
  ["Rückenwind", "Treibe den Ballon durch den Zielring", "Richte den Ventilator aus und nutze den Auftrieb"],
  ["Sprungkraft", "Befördere die Bowlingkugel in den Korb", "Das Trampolin lenkt Fallbewegung nach oben um"],
  ["Flaschenzug", "Hebe das 50-kg-Gewicht bis zur roten Markierung", "Lege ein durchgehendes Seil über sichtbare Anschlusspunkte"],
  ["Nadelprobe", "Lass den Luftballon an der Nadel platzen", "Nur der Ballon reagiert auf die Spitze"],
  ["Mäuseflucht", "Lass die Maus ihr Loch erreichen", "Die Maus flieht nur, wenn die Katze auf gleicher Höhe ist"],
  ["Zahn um Zahn", "Übertrage die Drehung bis zum Zielrad", "Benachbarte Zahnräder greifen nur bei passendem Abstand"],
  ["Feuer frei!", "Zünde die Lunte und triff die Zielscheibe", "Die Kanone feuert erst, wenn die Lunte vollständig abgebrannt ist"],
  ["Wasser marsch!", "Lösche die Kerze mit dem Wasser aus dem Eimer", "Der Eimer kippt am Scharnier; Planken lenken den Wasserweg"],
  ["Hebelwirkung", "Katapultiere die rote Kugel in den Korb", "Ein Aufprall senkt eine Seite und beschleunigt die andere nach oben"],
  ["Freier Fall", "Fange drei Bälle im Eimer", "Timing schlägt Tempo"],
  ["Katzenkino", "Locke die Katze durch zwei Türen", "Die Maus muss sichtbar bleiben"],
  ["Dampfkraft", "Hebe das Gewicht an", "Wasser plus Hitze"],
  ["Seiltanz", "Läute die Glocke", "Verteile das Gewicht"],
  ["Rückenwind", "Schiebe das Segelboot ans Ziel", "Lenke den Luftstrom"],
  ["Überlauf", "Lösche beide Kerzen", "Ein Eimer reicht – gut gekippt"],
  ["Eiszeit", "Kühle die Lava ab", "Wasser verdampft, Stein bleibt"],
  ["Lavastrom", "Entzünde die Fackel", "Baue eine sichere Rinne"],
  ["Schmelzpunkt", "Befreie den Schlüssel aus dem Eis", "Wärme dosieren"],
  ["Auftrieb", "Hebe die Falltür an", "Mehr Ballons, mehr Kraft"],
  ["Domino-Doktor", "Drücke den grünen Schalter", "Jeder Stein zählt"],
  ["Doppeltes Spiel", "Rette Katze und Ballon", "Die Reihenfolge entscheidet"],
  ["Das Aquädukt", "Leite Wasser über drei Ebenen", "Nichts darf versickern"],
  ["Feuer und Wasser", "Starte die Dampfmaschine", "Gegensätze arbeiten zusammen"],
  ["Die große Maschine", "Aktiviere alle fünf Zielgeräte", "Alles, was du gelernt hast"],
] as const;
const BUILD_TIPS=[
  "Verbinde zuerst Hamsterrad und Laufband – und bring dann das Rad in Schwung.",
  "Platziere Holzplanken zwischen Ballon und Kerze. Planken lassen sich ziehen und drehen.",
  "Platziere den Ventilator, drehe ihn zum Zielring und korrigiere den Weg mit Planken.",
  "Setze das Trampolin unter den Fallweg der Kugel und richte den Sprung zum Korb aus.",
  "Platziere beliebig viele oder wenige Rollen. Für genügend Kraft und Hub helfen vier möglichst senkrechte tragende Seilabschnitte und ein langer Fallweg der Kugel.",
  "Setze die Nadel in den Weg des Ballons und lenke ihn mit dem Ventilator hinein.",
  "Platziere die Maus auf Höhe der Katze. Nur dann erkennt sie die Gefahr und flieht.",
  "Baue mit drei Zahnrädern eine lückenlose Verbindung zwischen Antrieb und Zielrad.",
  "Platziere Kanone und Luntenteile als Kette von der Kerze bis zur Kanone. Richte anschließend das Rohr aus.",
  "Platziere den Wassereimer links oberhalb der Kerze. Eine Planke über der Steinmauer – vier Schritte nach rechts gedreht – leitet den Schwall zum Ziel.",
  "Setze die Wippe unter die rote Kugel und lasse die Bowlingkugel auf das gegenüberliegende Ende fallen.",
] as const;
const WIN_TEXT=[
  "Die Katze wurde vom angetriebenen Laufband zum Ausgang gebracht.",
  "Der Ballon hat die Kerzenflamme erreicht – Plopp!",
  "Der Luftstrom hat den Ballon sauber durch den Zielring getragen.",
  "Das Trampolin hat die Bowlingkugel in den Korb umgelenkt.",
  "Die gekoppelte Seilkraft hat den unteren Rollenblock samt Gewicht angehoben.",
  "Die Nadel hat ausschließlich den Ballon zum Platzen gebracht.",
  "Die Maus war auf gleicher Höhe und erreichte flüchtend ihr Loch.",
  "Alle Zahnräder griffen ineinander und drehten das Zielrad.",
  "Die Lunte brannte vollständig ab und die Kanonenkugel traf das Ziel.",
  "Das Wasser floss um die Hindernisse, sammelte sich am Boden und löschte die Kerze.",
  "Die fallende Bowlingkugel drehte die Wippe und katapultierte die rote Kugel in den Korb.",
] as const;
const LEVEL_HINTS=[
  "Ohne sichtbaren Riemen überträgt das Hamsterrad keine Kraft.",
  "Ein aufsteigender Ballon gleitet an der Unterseite einer schrägen Planke entlang.",
  "Der Luftstrom reicht höchstens doppelt so weit wie der sichtbare Kegel.",
  "Die Neigung des Trampolins bestimmt die seitliche Komponente des Sprungs.",
  "Offene Enden und unvollständige Aufbauten sind erlaubt. Nur ein tatsächlich gespanntes Seil kann Zugkraft übertragen.",
  "Die Nadel übt auf andere Körper keine besondere Wirkung aus.",
  "Die Höhendifferenz zwischen Katze und Maus muss klein genug sein.",
  "Berührende Zahnräder drehen sich immer in entgegengesetzte Richtungen.",
  "Luntenteile müssen Feuer und Kanone als zusammenhängende Kette verbinden.",
  "Baue von der Steinmauer eine steile Rinne zur Kerze. Wasser kollidiert mit festen Außenformen; Seile werden ignoriert.",
  "Die Wippe ist 1,5-mal so breit wie eine Holzplanke. Ihr Anschlag am roten Bock verhindert eine vollständige Drehung.",
] as const;

const partsForLevel = (level:number): { type: Part; icon: string; name: string; count: number }[] => {
  if(level===0)return [
    { type: "ball", icon: "●", name: "Bowlingkugel", count: 2 },
    { type: "ramp", icon: "╱", name: "Holzplanke", count: 3 },
    { type: "belt", icon: "⛓", name: "Antriebsriemen", count: 1 },
  ];
  if(level===1)return [{ type: "ramp", icon: "╱", name: "Holzplanke", count: 5 }];
  if(level===2)return [
    { type: "fan", icon: "✣", name: "Ventilator", count: 1 },
    { type: "ramp", icon: "╱", name: "Holzplanke", count: 2 },
  ];
  if(level===3)return [
    {type:"trampoline",icon:"⌁",name:"Trampolin",count:1},
    {type:"ramp",icon:"╱",name:"Holzplanke",count:2},
  ];
  if(level===4)return [
    {type:"ball",icon:"●",name:"Bowlingkugel",count:1},
    {type:"pulley",icon:"◉",name:"Festrolle",count:3},
    {type:"movingPulley",icon:"◎",name:"Lose Rolle",count:3},
    {type:"rope",icon:"∿",name:"Seil",count:1},
  ];
  if(level===5)return [{type:"needle",icon:"▲",name:"Nadel",count:1},{type:"fan",icon:"✣",name:"Ventilator",count:1}];
  if(level===6)return [{type:"mouse",icon:"●",name:"Maus",count:1}];
  if(level===7)return [{type:"gear",icon:"⚙",name:"Zahnrad",count:3}];
  if(level===8)return [{type:"cannon",icon:"◒",name:"Kanone",count:1},{type:"fuse",icon:"⌁",name:"Luntenstück",count:5}];
  if(level===9)return [{type:"bucket",icon:"▱",name:"Wassereimer",count:1},{type:"ramp",icon:"╱",name:"Holzplanke",count:2}];
  return [{type:"seesaw",icon:"⚖",name:"Wippe",count:1},{type:"ball",icon:"●",name:"Bowlingkugel",count:1}];
};

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

function routeKindForPart(type:Part):PulleyRouteKind|null{
  if(type==="movingPulley")return"moving";if(type==="pulley")return"fixed";if(type==="ball")return"pull";return null;
}

const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

function GameCanvas({ level, placed, ropePath, ropeMode, selectedId, running, attempt, onWin }: { level:number; placed: Placed[]; ropePath:RopeNode[]; ropeMode:boolean; selectedId:number|null; running: boolean; attempt: number; onWin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
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
    const drawFallbackFlame=(x:number,y:number,now:number,scale=1)=>{const sway=Math.sin(now*.018)*3*scale;ctx.save();ctx.translate(x,y);ctx.fillStyle="#e94620";ctx.beginPath();ctx.moveTo(-9*scale,10*scale);ctx.quadraticCurveTo((-15+sway)*scale,-4*scale,sway,-18*scale);ctx.quadraticCurveTo((14+sway)*scale,-3*scale,9*scale,10*scale);ctx.fill();ctx.fillStyle="#ffd34f";ctx.beginPath();ctx.ellipse(sway*.35,3*scale,4*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.restore()};
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    const W = 900, H = 520;
    const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label:"floor" });
    Matter.Composite.add(engine.world, floor);
    const waterBodies:Matter.Body[]=[],waterSplashAt=new Map<number,number>();
    let cat:Matter.Body|null=null,wheel:Matter.Body|null=null,candle:Matter.Body|null=null,balloon:Matter.Body|null=null,levelBall:Matter.Body|null=null,weight:Matter.Body|null=null,bucketBody:Matter.Body|null=null,seesawPayload:Matter.Body|null=null;
    if(level===0){
      wheel=Matter.Bodies.rectangle(365,345,104,104,{isStatic:true,label:"wheel"});
      const conveyor=Matter.Bodies.rectangle(610,405,270,24,{isStatic:true,label:"conveyor"});
      const exit=Matter.Bodies.rectangle(835,410,55,130,{isStatic:true,isSensor:true,label:"exit"});
      cat=Matter.Bodies.rectangle(555,365,64,52,{friction:.8,frictionAir:.2,label:"cat"});
      Matter.Composite.add(engine.world,[wheel,conveyor,exit,cat]);
    }else if(level===1){
      balloon=Matter.Bodies.circle(115,430,24,{density:.00012,frictionAir:.018,restitution:.15,label:"levelBalloon"});
      candle=Matter.Bodies.rectangle(805,95,38,80,{isStatic:true,isSensor:true,label:"candle"});
      Matter.Composite.add(engine.world,[balloon,candle]);
    }else if(level===2){
      balloon=Matter.Bodies.circle(210,420,24,{density:.00012,frictionAir:.025,restitution:.15,label:"levelBalloon"});
      const ring=Matter.Bodies.circle(780,150,45,{isStatic:true,isSensor:true,label:"targetRing"});
      Matter.Composite.add(engine.world,[balloon,ring]);
    }else if(level===3){
      levelBall=Matter.Bodies.circle(215,85,19,{restitution:.2,density:.006,label:"levelBall"});
      const basket=Matter.Bodies.rectangle(760,175,90,80,{isStatic:true,isSensor:true,label:"basket"});
      Matter.Composite.add(engine.world,[levelBall,basket]);
    }else if(level===4){
      weight=Matter.Bodies.rectangle(760,430,64,64,{isStatic:true,label:"weight"});
      Matter.Composite.add(engine.world,weight);
    }else if(level===5){
      balloon=Matter.Bodies.circle(180,420,24,{density:.00012,frictionAir:.025,label:"levelBalloon"});Matter.Composite.add(engine.world,balloon);
    }else if(level===6){
      cat=Matter.Bodies.rectangle(135,370,60,48,{isStatic:true,label:"cat"});Matter.Composite.add(engine.world,cat);
    }else if(level===7){
      const source=Matter.Bodies.circle(250,300,42,{isStatic:true,label:"gearSource"});const target=Matter.Bodies.circle(590,300,42,{isStatic:true,label:"gearTarget"});Matter.Composite.add(engine.world,[source,target]);
    }else if(level===8){
      const target=Matter.Bodies.circle(825,230,48,{isStatic:true,isSensor:true,label:"cannonTarget"});Matter.Composite.add(engine.world,target);
    }else if(level===9){
      candle=Matter.Bodies.rectangle(805,430,50,100,{isStatic:true,isSensor:true,label:"candle"});
      const steelBeam=Matter.Bodies.rectangle(500,285,235,18,{isStatic:true,angle:.08,label:"steelBeam",friction:.12});
      const woodWall=Matter.Bodies.rectangle(335,390,24,180,{isStatic:true,label:"woodWall",friction:.32});
      const stoneWall=Matter.Bodies.rectangle(675,395,42,170,{isStatic:true,label:"stoneWall",friction:.5});
      Matter.Composite.add(engine.world,[candle,steelBeam,woodWall,stoneWall]);
    }else if(level===10){
      seesawPayload=Matter.Bodies.circle(650,385,16,{density:.0018,restitution:.35,label:"seesawPayload"});
      const basket=Matter.Bodies.rectangle(680,150,110,100,{isStatic:true,isSensor:true,label:"seesawBasket"});
      Matter.Composite.add(engine.world,[seesawPayload,basket]);
    }
    let seesawBody:Matter.Body|null=null;
    placed.forEach(p => {
      let b;
      if (p.type === "ball") b = Matter.Bodies.circle(p.x, p.y, 18, { isStatic:level===4,restitution: .35, density: .006, label: "ball" });
      else if (p.type === "ramp") b = Matter.Bodies.rectangle(p.x, p.y, 155, 14, { isStatic: true, angle: p.rotation, label: "ramp" });
      else if (p.type === "fan") b = Matter.Bodies.circle(p.x,p.y,30,{isStatic:true,angle:p.rotation,label:"fan"});
      else if(p.type==="trampoline")b=Matter.Bodies.rectangle(p.x,p.y,135,18,{isStatic:true,angle:p.rotation,label:"trampoline"});
      else if(p.type==="pulley")b=Matter.Bodies.circle(p.x,p.y,30,{isStatic:true,label:"pulley"});
      else if(p.type==="movingPulley")b=Matter.Bodies.circle(p.x,p.y,30,{isStatic:true,label:"movingPulley"});
      else if(p.type==="needle")b=Matter.Bodies.rectangle(p.x,p.y,16,70,{isStatic:true,angle:p.rotation,label:"needle"});
      else if(p.type==="mouse")b=Matter.Bodies.circle(p.x,p.y,22,{isStatic:true,label:"mouse"});
      else if(p.type==="gear")b=Matter.Bodies.circle(p.x,p.y,42,{isStatic:true,label:"gear"});
      else if(p.type==="cannon")b=Matter.Bodies.rectangle(p.x,p.y,90,44,{isStatic:true,angle:p.rotation,label:"cannon"});
      else if(p.type==="fuse")b=Matter.Bodies.rectangle(p.x,p.y,110,8,{isStatic:true,isSensor:true,angle:p.rotation,label:"fuse"});
      else if(p.type==="seesaw"){
        const assembly=createSeesaw(p.x,p.y,p.rotation);b=assembly.plank;seesawBody=b;Matter.Composite.add(engine.world,assembly.pivot);
      }
      else if(p.type==="bucket"){
        const assembly=createBucketAssembly(p.x,p.y,p.rotation);b=assembly.bucket;bucketBody=b;waterBodies.push(...assembly.water);Matter.Composite.add(engine.world,assembly.water);
      }
      if(b){b.plugin={...b.plugin,placedId:p.id,fuseIndex:p.type==="fuse"?placed.filter(x=>x.type==="fuse").findIndex(x=>x.id===p.id):-1};Matter.Composite.add(engine.world,b)}
    });
    const beltConnected=placed.some(p=>p.type==="belt"),allBodies=Matter.Composite.allBodies(engine.world),bodyByPlacedId=new Map<number,Matter.Body>();
    allBodies.forEach(body=>{const placedId=body.plugin?.placedId;if(typeof placedId==="number")bodyByPlacedId.set(placedId,body)});
    const placedById=new Map(placed.map(part=>[part.id,part])),routeKinds=ropePath.map(node=>node.kind==="anchor"?"anchor":routeKindForPart(placedById.get(node.placedId)?.type??"rope")).filter((kind):kind is PulleyRouteKind=>kind!==null),routeAnalysis=analyzePulleyRoute(routeKinds);
    const routeFixed=ropePath.flatMap(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="pulley"?[bodyByPlacedId.get(node.placedId)].filter((body):body is Matter.Body=>!!body):[]),routeMoving=ropePath.flatMap(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="movingPulley"?[bodyByPlacedId.get(node.placedId)].filter((body):body is Matter.Body=>!!body):[]),ballNode=ropePath.find(node=>node.kind==="part"&&placedById.get(node.placedId)?.type==="ball"),placedBall=ballNode?.kind==="part"?(bodyByPlacedId.get(ballNode.placedId)??null):null;
    const initialWeightY=LEVEL_FIVE_INITIAL_WEIGHT_Y,initialMovingPositions=routeMoving.map(body=>({...body.position}));if(level===4&&weight&&routeMoving.length){const lowerCenterX=routeMoving.reduce((sum,body)=>sum+body.position.x,0)/routeMoving.length;Matter.Body.setPosition(weight,{x:lowerCenterX,y:initialWeightY})}
    const physicsPoints=():RopePoint[]=>ropePath.flatMap(node=>{if(node.kind==="anchor")return[{...ROPE_ANCHOR,group:"static" as const}];const part=placedById.get(node.placedId),body=bodyByPlacedId.get(node.placedId);if(!part||!body)return[];return[{x:body.position.x,y:body.position.y,group:part.type==="ball"?"ball" as const:part.type==="movingPulley"?"block" as const:"static" as const}]});
    const ropeReady=routeAnalysis.tensioned&&!!placedBall,restRopeLength=ropeGeometry(physicsPoints()).length,initialBlockPosition=weight?{...weight.position}:{x:760,y:initialWeightY};
    const mouseBody=Matter.Composite.allBodies(engine.world).find(body=>body.label==="mouse")??null;
    const gearBodies=Matter.Composite.allBodies(engine.world).filter(body=>["gearSource","gear","gearTarget"].includes(body.label));const gearDepth=new Map<number,number>();const gearSource=gearBodies.find(body=>body.label==="gearSource");if(gearSource){gearDepth.set(gearSource.id,0);const queue=[gearSource];while(queue.length){const current=queue.shift()!;for(const candidate of gearBodies){if(gearDepth.has(candidate.id))continue;const distance=Math.hypot(current.position.x-candidate.position.x,current.position.y-candidate.position.y);if(Math.abs(distance-84)<14){gearDepth.set(candidate.id,(gearDepth.get(current.id)??0)+1);queue.push(candidate)}}}}const gearsConnected=gearBodies.some(body=>body.label==="gearTarget"&&gearDepth.has(body.id));
    const cannonBody=Matter.Composite.allBodies(engine.world).find(body=>body.label==="cannon")??null,fuseBodies=Matter.Composite.allBodies(engine.world).filter(body=>body.label==="fuse");const fuseReachable=new Set<number>(),fuseQueue=fuseBodies.filter(body=>Math.hypot(body.position.x-100,body.position.y-420)<120);fuseQueue.forEach(body=>fuseReachable.add(body.id));while(fuseQueue.length){const current=fuseQueue.shift()!;for(const candidate of fuseBodies){if(!fuseReachable.has(candidate.id)&&Math.hypot(current.position.x-candidate.position.x,current.position.y-candidate.position.y)<120){fuseReachable.add(candidate.id);fuseQueue.push(candidate)}}}const fuseIgnited=fuseReachable.size>0,fuseReady=!!cannonBody&&fuseBodies.some(body=>fuseReachable.has(body.id)&&Math.hypot(body.position.x-cannonBody.position.x,body.position.y-cannonBody.position.y)<125);
    const fuseDuration=2*(1600+fuseBodies.length*280),wetFuseIds=new Set<number>(),bucketStartAngle=bucketBody?.angle??0,bucketStartPosition=bucketBody?{...bucketBody.position}:null,bucketPivot=bucketStartPosition?{x:bucketStartPosition.x+Math.cos(bucketStartAngle)*34-Math.sin(bucketStartAngle)*-23,y:bucketStartPosition.y+Math.sin(bucketStartAngle)*34+Math.cos(bucketStartAngle)*-23}:null;
    const ballVelocity={x:0,y:0},blockVelocity={x:0,y:0};let motor=false,motorStartedAt=0,balloonPopped=false,mouseFleeAt=0,gearTurnAt=0,fuseLitAt=0,fuseExtinguishedAt=0,fuseStoppedProgress=0,cannonFired=false,cannonFiredAt=0,cannonHitAt=0,candleWetHits=0,candleExtinguished=false,candleExtinguishedAt=0,bucketTipAt=0,seesawHitAt=0,blockPosition={...initialBlockPosition},pulleyTurn=0,won=false,raf=0,last=performance.now();
    Matter.Events.on(engine, "collisionStart", e => e.pairs.forEach(({ bodyA, bodyB }) => {
      const labels = [bodyA.label, bodyB.label];
      const water=bodyA.label==="water"?bodyA:bodyB.label==="water"?bodyB:null;
      if (labels.includes("wheel") && labels.includes("ball") && beltConnected && !motor) { motor = true; motorStartedAt = performance.now(); }
      if (labels.includes("exit") && labels.includes("cat") && !won) { won = true; onWin(); }
      if (labels.includes("candle") && labels.includes("levelBalloon") && !won) { balloonPopped=true; won=true; onWin(); }
      if (labels.includes("targetRing") && labels.includes("levelBalloon") && !won) { won=true; onWin(); }
      if(labels.includes("needle")&&labels.includes("levelBalloon")&&!won){balloonPopped=true;won=true;onWin()}
      if(labels.includes("cannonball")&&labels.includes("cannonTarget")&&!won&&!cannonHitAt)cannonHitAt=performance.now();
      if(labels.includes("trampoline")&&labels.includes("levelBall")&&levelBall){
        const trampoline=bodyA.label==="trampoline"?bodyA:bodyB;
        Matter.Body.setVelocity(levelBall,{x:Math.sin(trampoline.angle)*20,y:-Math.abs(Math.cos(trampoline.angle))*20});
      }
      if(labels.includes("basket")&&labels.includes("levelBall")&&!won){won=true;onWin()}
      if(labels.includes("seesaw")&&labels.includes("ball")&&seesawBody)applySeesawImpact(engine,seesawBody,bodyA.label==="ball"?bodyA:bodyB)
      if(labels.includes("seesawBasket")&&labels.includes("seesawPayload")&&!won&&!seesawHitAt)seesawHitAt=performance.now();
      if(water&&labels.includes("floor")&&!waterSplashAt.has(water.id))waterSplashAt.set(water.id,performance.now());
      if(water&&labels.includes("candle")&&!candleExtinguished){candleWetHits++;if(candleWetHits>=1){candleExtinguished=true;candleExtinguishedAt=performance.now()}}
      if(water&&labels.includes("fuse")){const fuse=bodyA.label==="fuse"?bodyA:bodyB;wetFuseIds.add(fuse.id);if(fuseLitAt&&!fuseExtinguishedAt){fuseStoppedProgress=clamp01((performance.now()-fuseLitAt)/fuseDuration);fuseExtinguishedAt=performance.now()}}
    }));
    const drawGear = (x:number,y:number,r:number,turn:number) => { ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle="#d39a28"; for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-5,-5,12,10)} ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173d50";ctx.beginPath();ctx.arc(0,0,r*.28,0,Math.PI*2);ctx.fill();ctx.restore(); };
    const stabilizeWater=()=>waterBodies.forEach(drop=>{const speed=Math.hypot(drop.velocity.x,drop.velocity.y);if(speed>11)Matter.Body.setVelocity(drop,{x:drop.velocity.x/speed*11,y:drop.velocity.y/speed*11});if(drop.position.y>476.5){Matter.Body.setPosition(drop,{x:drop.position.x,y:476.5});Matter.Body.setVelocity(drop,{x:drop.velocity.x*.76,y:0})}if(drop.position.y<-15){Matter.Body.setPosition(drop,{x:drop.position.x,y:-15});Matter.Body.setVelocity(drop,{x:drop.velocity.x,y:Math.abs(drop.velocity.y)*.25})}if(drop.position.x<4||drop.position.x>896){const x=Math.max(4,Math.min(896,drop.position.x));Matter.Body.setPosition(drop,{x,y:drop.position.y});Matter.Body.setVelocity(drop,{x:-drop.velocity.x*.25,y:drop.velocity.y})}});
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now; if(running){stabilizeWater();Matter.Engine.update(engine,dt);stabilizeWater()}
      if(running&&bucketBody&&bucketPivot){if(!bucketTipAt)bucketTipAt=now;const tip=clamp01((now-bucketTipAt)/1900),eased=tip*tip*(3-2*tip),angle=bucketStartAngle+eased*2.1,pivotLocal={x:34,y:-23},rotatedX=Math.cos(angle)*pivotLocal.x-Math.sin(angle)*pivotLocal.y,rotatedY=Math.sin(angle)*pivotLocal.x+Math.cos(angle)*pivotLocal.y;Matter.Body.setPosition(bucketBody,{x:bucketPivot.x-rotatedX,y:bucketPivot.y-rotatedY});Matter.Body.setAngle(bucketBody,angle)}
      // Das Laufband gibt eine konstante Transportgeschwindigkeit vor. Keine
      // wiederholten Kräfte: Die Katze wird also nicht ungewollt beschleunigt.
      if (running && motor && cat) Matter.Body.setPosition(cat,{x:Math.min(850,555+(now-motorStartedAt)*.075),y:365});
      if(running&&balloon&&!balloonPopped){
        Matter.Body.applyForce(balloon,balloon.position,{x:0,y:level===1?-.00035:-.00023});
        if(level===2||level===5)Matter.Composite.allBodies(engine.world).filter(body=>body.label==="fan").forEach(fan=>{
          const dx=balloon!.position.x-fan.position.x,dy=balloon!.position.y-fan.position.y,c=Math.cos(fan.angle),s=Math.sin(fan.angle);
          const forward=dx*c+dy*s,side=-dx*s+dy*c;
          if(forward>0&&forward<FAN_MAX_RANGE&&Math.abs(side)<100+forward*.3){const force=.00035*(1-forward/FAN_MAX_RANGE);Matter.Body.applyForce(balloon!,balloon!.position,{x:c*force,y:s*force})}
        });
      }
      if(running&&level===4&&placedBall&&weight){
        const seconds=dt/1000,previousBall={...placedBall.position};ballVelocity.y+=PULLEY_GRAVITY_PX*seconds;blockVelocity.y+=PULLEY_GRAVITY_PX*seconds;Matter.Body.setPosition(placedBall,{x:Math.max(18,Math.min(882,placedBall.position.x+ballVelocity.x*seconds)),y:Math.min(462,placedBall.position.y+ballVelocity.y*seconds)});if(placedBall.position.y>=462&&ballVelocity.y>0)ballVelocity.y=0;
        if(routeMoving.length){blockPosition={x:Math.max(45,Math.min(855,blockPosition.x+blockVelocity.x*seconds)),y:Math.min(initialWeightY,blockPosition.y+blockVelocity.y*seconds)};if(blockPosition.y>=initialWeightY&&blockVelocity.y>0)blockVelocity.y=0;const dx=blockPosition.x-initialBlockPosition.x,dy=blockPosition.y-initialBlockPosition.y;Matter.Body.setPosition(weight,blockPosition);routeMoving.forEach((body,index)=>Matter.Body.setPosition(body,{x:initialMovingPositions[index].x+dx,y:initialMovingPositions[index].y+dy}))}
        if(ropeReady){for(let iteration=0;iteration<6;iteration++){const correction=ropeConstraintCorrection(physicsPoints(),restRopeLength,BOWLING_PULL_KG,LEVEL_FIVE_LOAD_KG);if(correction.stretch<.01)break;Matter.Body.setPosition(placedBall,{x:placedBall.position.x+correction.ball.x,y:placedBall.position.y+correction.ball.y});blockPosition={x:blockPosition.x+correction.block.x,y:Math.min(initialWeightY,blockPosition.y+correction.block.y)};const dx=blockPosition.x-initialBlockPosition.x,dy=blockPosition.y-initialBlockPosition.y;Matter.Body.setPosition(weight,blockPosition);routeMoving.forEach((body,index)=>Matter.Body.setPosition(body,{x:initialMovingPositions[index].x+dx,y:initialMovingPositions[index].y+dy}))}const geometry=ropeGeometry(physicsPoints()),rate=geometry.ballGradient.x*ballVelocity.x+geometry.ballGradient.y*ballVelocity.y+geometry.blockGradient.x*blockVelocity.x+geometry.blockGradient.y*blockVelocity.y,denominator=(geometry.ballGradient.x**2+geometry.ballGradient.y**2)/BOWLING_PULL_KG+(geometry.blockGradient.x**2+geometry.blockGradient.y**2)/LEVEL_FIVE_LOAD_KG;if(rate>0&&denominator>1e-9){const impulse=rate/denominator;ballVelocity.x-=geometry.ballGradient.x*impulse/BOWLING_PULL_KG;ballVelocity.y-=geometry.ballGradient.y*impulse/BOWLING_PULL_KG;blockVelocity.x-=geometry.blockGradient.x*impulse/LEVEL_FIVE_LOAD_KG;blockVelocity.y-=geometry.blockGradient.y*impulse/LEVEL_FIVE_LOAD_KG}}
        const dampedBall=dampPulleyVelocity(ballVelocity,seconds),dampedBlock=dampPulleyVelocity(blockVelocity,seconds);ballVelocity.x=dampedBall.x;ballVelocity.y=dampedBall.y;blockVelocity.x=dampedBlock.x;blockVelocity.y=dampedBlock.y;
        pulleyTurn+=Math.hypot(placedBall.position.x-previousBall.x,placedBall.position.y-previousBall.y)/30;routeFixed.forEach(body=>Matter.Body.setAngle(body,pulleyTurn));routeMoving.forEach(body=>Matter.Body.setAngle(body,-pulleyTurn));if(routeMoving.length&&pulleyTargetReached(weight.position.y)&&!won){won=true;onWin()}
      }
      if(running&&level===6&&mouseBody&&cat){if(!mouseFleeAt&&Math.abs(mouseBody.position.y-cat.position.y)<35&&mouseBody.position.x>cat.position.x)mouseFleeAt=now;if(mouseFleeAt){Matter.Body.setPosition(mouseBody,{x:Math.min(835,mouseBody.position.x+dt*.09),y:mouseBody.position.y});Matter.Body.setPosition(cat,{x:Math.min(760,cat.position.x+dt*.055),y:cat.position.y});if(mouseBody.position.x>=810&&!won){won=true;onWin()}}}
      if(running&&waterBodies.length){for(const animal of [cat,mouseBody]){if(!animal)continue;let nearest:Matter.Body|null=null,distance=Infinity;for(const drop of waterBodies){const d=Math.hypot(animal.position.x-drop.position.x,animal.position.y-drop.position.y);if(d<distance){nearest=drop;distance=d}}if(nearest&&distance<62){const direction=animal.position.x<nearest.position.x?-1:1;Matter.Body.setPosition(animal,{x:Math.max(30,Math.min(870,animal.position.x+direction*dt*.13)),y:animal.position.y})}}}
      if(running&&level===7&&gearsConnected){if(!gearTurnAt)gearTurnAt=now;if(now-gearTurnAt>1100&&!won){won=true;onWin()}}
      if(running&&level===8&&fuseIgnited){if(!fuseLitAt)fuseLitAt=now;if(!fuseExtinguishedAt&&fuseReady&&cannonBody&&!cannonFired&&now-fuseLitAt>fuseDuration){cannonFired=true;cannonFiredAt=now;const direction={x:Math.cos(cannonBody.angle),y:Math.sin(cannonBody.angle)};const shot=Matter.Bodies.circle(cannonBody.position.x+direction.x*58,cannonBody.position.y+direction.y*58,11,{density:.0025,restitution:.3,label:"cannonball"});Matter.Body.setVelocity(shot,{x:direction.x*14,y:direction.y*14});Matter.Composite.add(engine.world,shot)}}
      if(running&&seesawBody)limitSeesawRotation(seesawBody)
      if(cannonHitAt&&!won&&now-cannonHitAt>520){won=true;onWin()}
      if(candleExtinguishedAt&&!won&&now-candleExtinguishedAt>700){won=true;onWin()}
      if(seesawHitAt&&!won&&now-seesawHitAt>450){won=true;onWin()}
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40);
      if(level===0){
        ctx.fillStyle="#183f49";ctx.fillRect(780,345,105,135);ctx.fillStyle="#eac97a";ctx.font="bold 16px Georgia";ctx.fillText("AUSGANG",790,375);ctx.fillText("→",820,420);
        ctx.fillStyle="#93511f";ctx.fillRect(475,393,270,24);ctx.fillStyle="#d84a32";for(let x=490;x<730;x+=34){ctx.fillText("›",x,412)}
        if(beltConnected){ctx.save();ctx.strokeStyle="#51351f";ctx.lineWidth=7;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(407,345);ctx.lineTo(510,390);ctx.stroke();ctx.restore()}
        const hamsterFrame=motor?Math.floor(now/90)%6:0;if(!drawHamsterSprite(hamsterFrame,365,345,116,116))drawGear(365,345,42,motor?now/180:0);
      }else if(level===1){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,135,72,10);ctx.fillStyle="#f1cb62";ctx.fillRect(793,75,24,64);if(!drawFireSprite(0,Math.floor(now/105)%6,805,51,82,90))drawFallbackFlame(805,58,now,1.05);
      }else if(level===2){
        ctx.strokeStyle="#c73b2e";ctx.lineWidth=12;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#f1c351";ctx.lineWidth=4;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#5d371e";ctx.font="bold 14px system-ui";ctx.fillText("ZIELRING",744,218);
      }else if(level===3){
        ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(715,145);ctx.lineTo(720,210);ctx.quadraticCurveTo(760,235,805,210);ctx.lineTo(808,145);ctx.stroke();ctx.fillStyle="#a52d24";ctx.font="bold 14px system-ui";ctx.fillText("KORB",742,250);
      }else if(level===4){
        ctx.strokeStyle="#bd3428";ctx.lineWidth=4;ctx.setLineDash([10,7]);ctx.beginPath();ctx.moveTo(50,LEVEL_FIVE_TARGET_Y);ctx.lineTo(850,LEVEL_FIVE_TARGET_Y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("OBERKANTE BIS HIER",654,LEVEL_FIVE_TARGET_Y-15);
        ctx.fillStyle="#4c5960";ctx.fillRect(67,22,50,12);ctx.strokeStyle="#303b40";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(92,34);ctx.lineTo(ROPE_ANCHOR.x,ROPE_ANCHOR.y);ctx.stroke();ctx.fillStyle="#d39a28";ctx.beginPath();ctx.arc(ROPE_ANCHOR.x,ROPE_ANCHOR.y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#6b391e";ctx.font="bold 11px system-ui";ctx.fillText("FESTPUNKT",116,67);
        const visualPoints=ropePath.flatMap(node=>{if(node.kind==="anchor")return[{...ROPE_ANCHOR,kind:"anchor" as const}];const part=placedById.get(node.placedId),body=bodyByPlacedId.get(node.placedId),kind=part?routeKindForPart(part.type):null;return body&&kind?[{x:body.position.x,y:body.position.y,kind}]:[]});drawFreeRope(ctx,visualPoints,now,running);
        if(routeMoving.length&&weight){ctx.save();ctx.strokeStyle="#4c5960";ctx.lineWidth=3;for(const pulley of routeMoving){const start={x:pulley.position.x,y:pulley.position.y+32},end={x:weight.position.x,y:weight.position.y-39},distance=Math.max(1,Math.hypot(end.x-start.x,end.y-start.y)),links=Math.max(2,Math.floor(distance/13));for(let link=1;link<links;link++){const t=link/links,x=start.x+(end.x-start.x)*t,y=start.y+(end.y-start.y)*t;ctx.beginPath();ctx.ellipse(x,y,4,7,Math.atan2(end.y-start.y,end.x-start.x),0,Math.PI*2);ctx.stroke()}}ctx.restore()}
        if(routeAnalysis.supportingStrands>0){ctx.fillStyle="#173f50";ctx.font="bold 13px system-ui";ctx.fillText(`${routeAnalysis.supportingStrands} mögliche tragende Seilabschnitte`,36,95)}
      }else if(level===5){
        ctx.fillStyle="#6b391e";ctx.font="bold 14px system-ui";ctx.fillText("Die Nadel reagiert ausschließlich auf den Ballon.",285,32);
      }else if(level===6){
        ctx.fillStyle="#173f50";ctx.fillRect(820,330,65,120);ctx.fillStyle="#f1d28d";ctx.font="bold 13px system-ui";ctx.fillText("MAUS-",830,365);ctx.fillText("LOCH",834,382);
      }else if(level===7){
        ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("ANTRIEB",220,230);ctx.fillText("ZIELRAD",565,230);
      }else if(level===8){
        ctx.fillStyle="#7b4c24";ctx.fillRect(70,440,65,10);ctx.fillStyle="#f1cb62";ctx.fillRect(91,390,22,52);if(!drawFireSprite(0,Math.floor(now/105)%6,102,366,82,90))drawFallbackFlame(102,374,now);ctx.strokeStyle="#c73b2e";ctx.lineWidth=9;ctx.beginPath();ctx.arc(825,230,48,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("ZIEL",808,300);
      }else if(level===9){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,470,70,10);ctx.fillStyle="#f1cb62";ctx.fillRect(794,390,22,80);if(!candleExtinguished){if(!drawFireSprite(0,Math.floor(now/105)%6,805,371,82,90))drawFallbackFlame(805,380,now)}else{ctx.fillStyle="#8b9ba0";for(let puff=0;puff<4;puff++){ctx.globalAlpha=.55-puff*.1;ctx.beginPath();ctx.arc(802+Math.sin(now*.004+puff)*8,374-puff*9,8+puff*2,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;drawWaterSprite(1,5,805,450,76,38)}ctx.fillStyle="#6b391e";ctx.font="bold 12px system-ui";ctx.fillText("KERZE",785,505);
      }else if(level===10){
        ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(635,105);ctx.lineTo(640,165);ctx.quadraticCurveTo(680,190,725,165);ctx.lineTo(728,105);ctx.stroke();ctx.fillStyle="#a52d24";ctx.font="bold 14px system-ui";ctx.fillText("ZIELKORB",646,210);
      }
      if(waterBodies.length){ctx.strokeStyle="rgba(33,158,211,.34)";ctx.lineWidth=7;ctx.lineCap="round";for(let i=0;i<waterBodies.length;i++)for(let j=i+1;j<waterBodies.length;j++){const a=waterBodies[i].position,b=waterBodies[j].position;if(Math.hypot(a.x-b.x,a.y-b.y)<10){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}}
      for(const b of Matter.Composite.allBodies(engine.world)){
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
        if(b.label==="ball"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="ramp"){ctx.fillStyle="#8d5426";ctx.fillRect(-75,-7,150,14);ctx.strokeStyle="#4e2a14";ctx.strokeRect(-75,-7,150,14)}
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
        if(b.label==="cat"){ctx.font="54px serif";ctx.fillText("🐈",-34,20)}
        if(b.label==="needle"){ctx.fillStyle="#737c80";ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(-9,35);ctx.lineTo(9,35);ctx.closePath();ctx.fill();ctx.fillStyle="#a96c2d";ctx.fillRect(-14,28,28,12)}
        if(b.label==="mouse"){ctx.font="36px serif";ctx.fillText("🐁",-20,14)}
        if(["gear","gearSource","gearTarget"].includes(b.label)){const depth=gearDepth.get(b.id);ctx.rotate(running&&depth!==undefined?(now/170)*(depth%2?-1:1):0);ctx.fillStyle=b.label==="gearTarget"?"#bf432d":"#d39a28";for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(34,-6,15,12)}ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173f50";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="cannon"){ctx.fillStyle="#263d43";ctx.fillRect(-42,-16,82,32);ctx.fillStyle="#b26a29";ctx.beginPath();ctx.arc(-18,25,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#263d43";ctx.fillRect(32,-21,20,42);const cannonFuseElapsed=fuseExtinguishedAt?fuseStoppedProgress*fuseDuration:Math.max(0,now-fuseLitAt),cannonFuseProgress=fuseLitAt&&fuseReady?clamp01((cannonFuseElapsed-(fuseDuration-1300))/1300):0;ctx.lineWidth=5;ctx.lineCap="round";ctx.strokeStyle="#9a9284";ctx.beginPath();ctx.moveTo(-26,-17);ctx.quadraticCurveTo(-35,-34,-18,-42);ctx.stroke();ctx.strokeStyle="#49382a";ctx.beginPath();ctx.moveTo(-26+(8*cannonFuseProgress),-17-(25*cannonFuseProgress));ctx.quadraticCurveTo(-34,-34,-18,-42);ctx.stroke();if(cannonFuseProgress>0&&cannonFuseProgress<1&&!fuseExtinguishedAt){const fx=-26+8*cannonFuseProgress,fy=-17-25*cannonFuseProgress;if(!drawFireSprite(1,Math.floor(now/80)%6,fx,fy,34,34))drawFallbackFlame(fx,fy,now,.55)}if(cannonFiredAt&&now-cannonFiredAt<520){const flashFrame=Math.min(5,Math.floor((now-cannonFiredAt)/87));if(!drawFireSprite(2,flashFrame,70,0,105,78))drawFallbackFlame(67,0,now,1.5)}}
        if(b.label==="fuse"){const progress=fuseExtinguishedAt?fuseStoppedProgress:fuseLitAt?clamp01((now-fuseLitAt)/fuseDuration):0,index=b.plugin?.fuseIndex??0,count=Math.max(1,fuseBodies.length),localBurn=clamp01(progress*count-index),reached=fuseReachable.has(b.id);ctx.lineWidth=7;ctx.lineCap="round";if(reached&&localBurn>0&&localBurn<1&&!fuseExtinguishedAt&&drawFireSprite(1,Math.min(5,Math.floor(localBurn*6)),0,-2,132,58)){/* Das Sprite zeigt Seil, Aschespur, wandernde Flamme und Funken. */}else{ctx.strokeStyle=reached&&localBurn>=1?"#a29a8d":"#4f3d2b";ctx.beginPath();ctx.moveTo(-55,0);ctx.quadraticCurveTo(0,8,55,0);ctx.stroke()}if(wetFuseIds.has(b.id)){ctx.strokeStyle="#2ca7d8";ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(50,4);ctx.stroke();ctx.setLineDash([])}}
        if(b.label==="bucket"){ctx.fillStyle="rgba(76,141,168,.38)";ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(38,-28);ctx.lineTo(29,32);ctx.lineTo(-29,32);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle="#b7dbe4";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-25,38,Math.PI,0);ctx.stroke();ctx.fillStyle="#d8edf0";ctx.fillRect(-38,-31,76,7);if(running&&Math.abs(b.angle)>.18){if(!bucketTipAt)bucketTipAt=now;const streamFrame=Math.min(5,Math.floor((now-bucketTipAt)/230));drawWaterSprite(2,streamFrame,43,-22,105,78,0)}}
        if(b.label==="water"){const splashAt=waterSplashAt.get(b.id),splashAge=splashAt?now-splashAt:Infinity;if(splashAge<420){drawWaterSprite(1,Math.min(5,Math.floor(splashAge/70)),0,-2,34,24)}else{const speed=Math.hypot(b.velocity.x,b.velocity.y);if(speed>2){ctx.strokeStyle="rgba(80,190,232,.48)";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-b.velocity.x*1.8,-b.velocity.y*1.8);ctx.lineTo(0,0);ctx.stroke()}if(!drawWaterSprite(0,(b.id+Math.floor(now/120))%6,0,0,24,20)){ctx.fillStyle="#42b9e9";ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill()}}}
        if(b.label==="cannonball"){ctx.fillStyle="#333f43";ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill()}
        if(b.label==="seesawPayload"){ctx.fillStyle="#c73b2e";ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f4c64e";ctx.beginPath();ctx.arc(-5,-5,4,0,Math.PI*2);ctx.fill()}
        if(b.plugin?.placedId===selectedId&&!running){ctx.strokeStyle="#e5392c";ctx.lineWidth=3;ctx.setLineDash([7,5]);if(b.label==="seesaw")ctx.strokeRect(-126,-48,252,96);else if(["ramp","trampoline","fuse","cannon","bucket"].includes(b.label))ctx.strokeRect(-64,-38,128,76);else{ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([])}ctx.restore();
      }
      if(level===4&&ropeMode&&!running){const selectedParts=new Map<number,number>();ropePath.forEach((node,index)=>{if(node.kind==="part")selectedParts.set(node.placedId,index)});const anchorOrder=ropePath.findIndex(node=>node.kind==="anchor"),drawPort=(x:number,y:number,order?:number,label?:string)=>{ctx.save();ctx.fillStyle=order!==undefined&&order>=0?"#d39a28":"#2f9b67";ctx.strokeStyle="#fff4cf";ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();if(order!==undefined&&order>=0){ctx.fillStyle="#173f50";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText(String(order+1),x,y+4)}if(label){ctx.fillStyle="#4b2b17";ctx.font="bold 11px system-ui";ctx.textAlign="left";ctx.fillText(label,x+28,y+4)}ctx.restore()};drawPort(ROPE_ANCHOR.x,ROPE_ANCHOR.y,anchorOrder>=0?anchorOrder:undefined);for(const part of placed){const kind=routeKindForPart(part.type);if(!kind)continue;drawPort(part.x,part.y,selectedParts.get(part.id),part.type==="pulley"?"FEST":part.type==="movingPulley"?"LOSE":"KUGEL")}}
      ctx.fillStyle="#4b2b17";ctx.font="bold 15px system-ui";
      if(level===0)ctx.fillText(!beltConnected?"Es fehlt die Verbindung zum Laufband":motor?"Riemen überträgt den Antrieb":"Triff das Hamsterrad mit einer Kugel",330,260);
      if(level===1&&!balloonPopped)ctx.fillText("Lenke den Ballon mit den Planken zur Flamme",275,32);
      if(level===2)ctx.fillText("Richte den Ventilator aus und triff den Zielring",275,32);
      if(level===3)ctx.fillText("Lenke den Fall mit dem Trampolin in den Korb",270,32);
      if(level===4)ctx.fillText(!ropePath.length?"Wähle das Seil und klicke beliebige Anschlusspunkte":routeAnalysis.tensioned?"Seil gespannt – Verlauf, Massen und Schwerkraft bestimmen die Bewegung":"Offenes Seil – der Aufbau darf trotzdem gestartet werden",220,32);
      if(level===5&&!balloonPopped)ctx.fillText("Lenke den Ballon in die platzierte Nadel",300,32);
      if(level===6)ctx.fillText(!mouseFleeAt?"Katze und Maus müssen auf gleicher Höhe sein":"Die Maus flieht – die Katze ist langsamer",275,32);
      if(level===7)ctx.fillText(gearsConnected?"Die Zahnradkette greift vollständig ineinander":"Zwischen den Zahnrädern sind noch Lücken",285,32);
      if(level===8)ctx.fillText(!fuseIgnited?"Kein Luntenteil berührt die Flamme":fuseExtinguishedAt?"Die nasse Lunte ist erloschen":!fuseReady?"Die Lunte brennt, erreicht aber die Kanone nicht":!fuseLitAt?"Bereit zum Zünden":"Die Lunte brennt langsam zur Kanone …",270,32);
      if(level===9)ctx.fillText(candleExtinguished?"Die Kerze ist gelöscht!":!bucketBody?"Platziere den Wassereimer":"Leite den Schwall um Stahl, Holz und Stein zur Kerze",250,32);
      if(level===10)ctx.fillText(!seesawBody?"Platziere die Wippe unter der roten Kugel":"Lass die Bowlingkugel auf das andere Ende fallen",270,32);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);Matter.Engine.clear(engine)};
  },[level,placed,ropePath,ropeMode,selectedId,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}

export default function Home() {
  const [name,setName]=useState(""); const [draft,setDraft]=useState(""); const [level,setLevel]=useState(0);
  const [selected,setSelected]=useState<Part>("ball"); const [placed,setPlaced]=useState<Placed[]>([]); const [ropePath,setRopePath]=useState<RopeNode[]>([]); const [selectedId,setSelectedId]=useState<number|null>(null); const [running,setRunning]=useState(false); const [attempt,setAttempt]=useState(0); const [won,setWon]=useState(false); const [score,setScore]=useState(0); const [showScores,setShowScores]=useState(false); const [showPhysics,setShowPhysics]=useState(false); const [showLevels,setShowLevels]=useState(false); const [drag,setDrag]=useState<{id:number;dx:number;dy:number}|null>(null);
  useEffect(()=>{const timer=window.setTimeout(()=>setName(localStorage.getItem("machine-user")||""),0);return()=>window.clearTimeout(timer)},[]);
  const login=()=>{const n=draft.trim();if(n){localStorage.setItem("machine-user",n);setName(n)}};
  const inventory=partsForLevel(level);
  const boardPoint=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*900,y:(e.clientY-r.top)/r.height*520}};
  const boardPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(running)return;const point=boardPoint(e);if(selected==="rope"&&level===4){const candidates:[number,RopeNode][]=[];if(!ropePath.some(node=>node.kind==="anchor"))candidates.push([Math.hypot(point.x-ROPE_ANCHOR.x,point.y-ROPE_ANCHOR.y),{kind:"anchor"}]);for(const part of placed){if(!routeKindForPart(part.type)||ropePath.some(node=>node.kind==="part"&&node.placedId===part.id))continue;candidates.push([Math.hypot(part.x-point.x,part.y-point.y),{kind:"part",placedId:part.id}])}candidates.sort((a,b)=>a[0]-b[0]);if(candidates[0]?.[0]<48)setRopePath(nodes=>[...nodes,candidates[0][1]]);return}const movable=placed.filter(p=>p.type!=="belt").map(p=>({...p,d:Math.hypot(p.x-point.x,p.y-point.y)})).sort((a,b)=>a.d-b.d)[0];if(movable&&movable.d<52){e.currentTarget.setPointerCapture(e.pointerId);setSelectedId(movable.id);setDrag({id:movable.id,dx:movable.x-point.x,dy:movable.y-point.y});return}const allowed=inventory.find(i=>i.type===selected);if(!allowed||selected==="rope")return;const used=placed.filter(p=>p.type===selected).length;if(used>=allowed.count)return;const id=Date.now();setSelectedId(id);const initialRotation=["ramp","trampoline","cannon"].includes(selected)?-.28:selected==="bucket"?-.08:0;setPlaced(p=>[...p,{id,type:selected,x:point.x,y:point.y,rotation:initialRotation}])};
  const boardPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(!drag||running)return;const point=boardPoint(e);setPlaced(items=>items.map(p=>p.id===drag.id?{...p,x:Math.max(25,Math.min(875,point.x+drag.dx)),y:Math.max(25,Math.min(475,point.y+drag.dy))}:p))};
  const reset=()=>{setRunning(false);setPlaced([]);setRopePath([]);setSelectedId(null);setWon(false);setAttempt(a=>a+1)};
  const changeLevel=(next:number)=>{const defaults:Part[]=["ball","ramp","fan","trampoline","ball","needle","mouse","gear","cannon","bucket","seesaw"];setLevel(next);setSelected(defaults[next]);setRunning(false);setPlaced([]);setRopePath([]);setSelectedId(null);setWon(false);setAttempt(0);setShowLevels(false)};
  const rotateSelected=(direction:-1|1)=>setPlaced(items=>items.map(p=>p.id===selectedId?{...p,rotation:p.rotation+direction*Math.PI/12}:p));
  const selectedPlaced=placed.find(p=>p.id===selectedId),canRotate=selectedPlaced&&["ramp","fan","trampoline","needle","cannon","fuse","bucket","seesaw"].includes(selectedPlaced.type);
  const removeSelected=()=>{if(selectedId===null)return;setPlaced(items=>items.filter(part=>part.id!==selectedId));setRopePath(nodes=>{const index=nodes.findIndex(node=>node.kind==="part"&&node.placedId===selectedId);return index<0?nodes:nodes.slice(0,index)});setSelectedId(null)};
  const ropeAnalysis=analyzePulleyRoute(ropePath.map(node=>node.kind==="anchor"?"anchor":routeKindForPart(placed.find(part=>part.id===node.placedId)?.type??"rope")).filter((kind):kind is PulleyRouteKind=>kind!==null));
  const win=()=>{setWon(true);setRunning(false);setScore(s=>{const next=s+Math.max(500,1800-placed.length*120);const board=JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[];localStorage.setItem("machine-scores",JSON.stringify([...board,{name,score:next}].sort((a,b)=>b.score-a.score).slice(0,10)));return next})};
  const highScores=(()=>{if(typeof window==="undefined")return[] as {name:string;score:number}[];try{return JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[]}catch{return[]}})();
  if(!name) return <main className="login"><section className="login-card"><div className="professor">⚙</div><p className="eyebrow">WERKSTATTZUGANG</p><h1>Die Unglaubliche<br/><span>Maschine</span></h1><p>Ein Name genügt. Kein Passwort, kein Papierkram – Professor Knallkopf vertraut dir.</p><label>Dein Spielername<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="z. B. Stefan"/></label><button onClick={login}>Werkstatt betreten <b>→</b></button></section></main>;
  return <main className="game-shell">
    <header><button className="score" onClick={()=>setShowScores(true)}><span>★</span><b>{score.toLocaleString("de-DE")}</b></button><div className="brand"><small>PROFESSOR KNALLKOPFS</small><strong>Die Unglaubliche Maschine</strong></div><button className="level-chip" onClick={()=>setShowLevels(true)}>LEVEL <b>{String(level+1).padStart(2,"0")}</b> / {ACTIVE_LEVEL_COUNT}⌄</button><button className="user" onClick={()=>{localStorage.removeItem("machine-user");setName("")}}>⚙ {name}⌄</button></header>
    <section className="mission"><span>ZIEL</span><b>{LEVELS[level][1]}</b><em>Hinweis: {LEVELS[level][2]}</em></section>
    <div className="workspace">
      <section className="board-wrap"><div className="board" onPointerDown={boardPointerDown} onPointerMove={boardPointerMove} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}><GameCanvas level={level} placed={placed} ropePath={ropePath} ropeMode={selected==="rope"} selectedId={selectedId} running={running} attempt={attempt} onWin={win}/>{!running&&placed.length===0&&<div className="board-tip">{BUILD_TIPS[level]}</div>}{won&&<div className="win"><span>★</span><h2>Es funktioniert!</h2><p>{WIN_TEXT[level]}</p>{level<ACTIVE_LEVEL_COUNT-1?<button onClick={()=>changeLevel(level+1)}>Nächstes Level →</button>:<button onClick={()=>{setWon(false);reset()}}>Noch einmal bauen ↻</button>}</div>}</div><div className="motto">ERFINDEN · VERBESSERN · VERSTEHEN</div></section>
      <aside><h2>BAUTEILE</h2>{inventory.map(p=>{const remaining=p.type==="rope"?(ropePath.length?0:1):p.count-placed.filter(x=>x.type===p.type).length;return <button key={p.type} className={selected===p.type?"selected":""} onClick={()=>setSelected(p.type)} disabled={running||(remaining===0&&!(p.type==="rope"&&selected==="rope"))}><span className={`part ${p.type}`}>{p.icon}</span><label>{p.name}</label><b>{remaining}</b></button>})}<div className="tip"><b>💡 TIPP</b><p>{selected==="rope"&&level===4?ropePath.length?ropeAnalysis.tensioned?"Festpunkt und Kugel bilden die beiden gespannten Enden. Weitere Punkte würden den Verlauf wieder öffnen.":"Klicke beliebige weitere Anschlüsse oder starte die Maschine mit offenen Enden.":"Beginne an einem beliebigen grünen Anschluss – auch der Festpunkt ist optional.":LEVEL_HINTS[level]}</p></div></aside>
    </div>
    <footer><div><span>VERSUCH</span><b>{attempt+1}</b></div><button className="reset" onClick={reset}><i>↻</i><span>ZURÜCKSETZEN</span></button><button className="delete" onClick={removeSelected} disabled={running||selectedId===null}><i>×</i><span>GADGET ENTFERNEN</span></button>{level===4&&selected==="rope"&&<button className="reset" onClick={()=>setRopePath(nodes=>nodes.slice(0,-1))} disabled={running||ropePath.length===0}><i>↩</i><span>SEILPUNKT ZURÜCK</span></button>}{level>0&&<><button className="reset" onClick={()=>rotateSelected(-1)} disabled={running||!canRotate}><i>↶</i><span>LINKS DREHEN</span></button><button className="reset" onClick={()=>rotateSelected(1)} disabled={running||!canRotate}><i>↷</i><span>RECHTS DREHEN</span></button></>}{running?<button className="stop" onClick={()=>setRunning(false)}><i>■</i><span>MASCHINE ABBRECHEN</span></button>:<button className="start" onClick={()=>{setAttempt(a=>a+1);setRunning(true)}} disabled={placed.length===0}><span>MASCHINE STARTEN</span><i>▶</i></button>}<button className="levels" onClick={()=>setShowPhysics(true)}><i>⚙</i><span>PHYSIK</span></button><button className="levels" onClick={()=>setShowLevels(true)}><i>☷</i><span>LEVEL {level+1}/{ACTIVE_LEVEL_COUNT}</span></button></footer>
    {showScores&&<div className="modal" onClick={()=>setShowScores(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowScores(false)}>×</button><p className="eyebrow">WERKSTATTHALLE</p><h2>Bestenliste</h2>{highScores.length?highScores.map((s,i)=><div className="rank" key={i}><b>{i+1}</b><span>{s.name}</span><strong>{s.score.toLocaleString("de-DE")}</strong></div>):<p className="empty">Noch ist die Tafel jungfräulich. Bring zuerst eine Maschine zum Laufen!</p>}</section></div>}
    {showLevels&&<div className="modal" onClick={()=>setShowLevels(false)}><section className="level-dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowLevels(false)}>×</button><p className="eyebrow">ENTWICKLER-DIREKTZUGRIFF</p><h2>Level wählen</h2><div className="level-grid">{LEVELS.slice(0,ACTIVE_LEVEL_COUNT).map((item,i)=><button key={i} className={i===level?"current":""} onClick={()=>changeLevel(i)}><b>{String(i+1).padStart(2,"0")}</b><span>{item[0]}</span><small>{item[1]}</small></button>)}</div></section></div>}
    {showPhysics&&<div className="modal physics-modal" onClick={()=>setShowPhysics(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowPhysics(false)}>×</button><p className="eyebrow">PROFESSOR KNALLKOPFS</p><h2>Physik-Handbuch</h2><div className="handbook-scroll"><h3>Kraftquellen</h3><p className="physics-intro">Diese Gadgets bringen Energie oder gerichtete Bewegung in die Maschine.</p><div className="interaction-table"><table><thead><tr><th>Gadget</th><th>Kraftart</th><th>Richtung</th><th>Regel</th></tr></thead><tbody>{FORCE_SOURCES.map((row,i)=><tr key={i}><td>{row.gadget}</td><td>{row.kind}</td><td>{row.direction}</td><td>{row.rule}</td></tr>)}</tbody></table></div><h3>Wasser-Kollisionsformen</h3><p className="physics-intro">Wasser besteht aus kollidierenden Partikeln. Jede feste Außenkontur lenkt sie um; Löschsensoren reagieren auf Kontakt.</p><div className="interaction-table"><table><thead><tr><th>Objekte</th><th>Physikform</th><th>Wasserreaktion</th></tr></thead><tbody>{WATER_SHAPE_RULES.map((row,i)=><tr key={i}><td>{row.objects}</td><td>{row.shape}</td><td>{row.response}</td></tr>)}</tbody></table></div><h3>Abstrakte Zielprüfung</h3><p className="physics-intro">Gadgets erzeugen nur Signale und Zustände. Eine getrennte GoalSpec kombiniert sie zum jeweiligen Levelziel.</p><div className="interaction-table"><table><thead><tr><th>Modus</th><th>Bedeutung</th><th>Beispiel</th></tr></thead><tbody>{GOAL_MODES.map((row,i)=><tr key={i}><td><b>{row.mode}</b></td><td>{row.meaning}</td><td>{row.example}</td></tr>)}</tbody></table></div><h3>Objektinteraktionen</h3><div className="interaction-table"><table><thead><tr><th>Auslöser</th><th>Ziel</th><th>Wann?</th><th>Wirkung</th><th>Stand</th></tr></thead><tbody>{INTERACTIONS.map((row,i)=><tr key={i}><td>{row.source}</td><td>{row.target}</td><td>{row.trigger}</td><td>{row.effect}</td><td><span className={`status ${row.status}`}>{row.status}</span></td></tr>)}</tbody></table></div></div></section></div>}
  </main>;
}
