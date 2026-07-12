"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import "./modal.css";
import { INTERACTIONS } from "@/game/interactions";
import { FORCE_SOURCES,GOAL_MODES } from "@/game/rules";

type Part = "ball" | "ramp" | "belt" | "fan" | "trampoline" | "pulley" | "rope";
type Placed = { id: number; type: Part; x: number; y: number; rotation: number };
const FAN_VISIBLE_RANGE=210;
const FAN_MAX_RANGE=FAN_VISIBLE_RANGE*2;

const LEVELS = [
  ["Der erste Anstoß", "Bring die Katze zum Ausgang", "Mausmotor und Laufband"],
  ["Plopp!", "Bring den Ballon zur Kerzenflamme", "Lenke seinen Auftrieb mit Holzplanken"],
  ["Rückenwind", "Treibe den Ballon durch den Zielring", "Richte den Ventilator aus und nutze den Auftrieb"],
  ["Sprungkraft", "Befördere die Bowlingkugel in den Korb", "Das Trampolin lenkt Fallbewegung nach oben um"],
  ["Flaschenzug", "Hebe das Gewicht bis zur roten Markierung", "Kugel, Seil und Rolle übertragen die Kraft"],
  ["Bananenblick", "Ziehe die Jalousie und bring die Affe zur Banane", "Die Affe fährt erst, wenn sie die Banane sehen kann"],
  ["Nasse Füße", "Lass das Boot am Ausgang anlegen", "Wasser trägt, wenn es tief genug ist"],
  ["Gegen den Strom", "Bring den Korken nach oben", "Verdrängung ist dein Freund"],
  ["Heißer Draht", "Lass die Rakete starten", "Die Lunte braucht Feuer"],
  ["Zahn um Zahn", "Drehe das goldene Zahnrad", "Achte auf die Drehrichtung"],
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
  "Verbinde zuerst Mausrad und Laufband – und bring dann das Rad in Schwung.",
  "Platziere Holzplanken zwischen Ballon und Kerze. Planken lassen sich ziehen und drehen.",
  "Platziere den Ventilator, drehe ihn zum Zielring und korrigiere den Weg mit Planken.",
  "Setze das Trampolin unter den Fallweg der Kugel und richte den Sprung zum Korb aus.",
  "Platziere Kugel und Rolle und füge das Seil hinzu. Die Kugel muss möglichst weit fallen können.",
  "Leite die Kugel mit einer Planke nach unten. Das Zugseil öffnet dabei die Sicht auf die Banane.",
] as const;
const WIN_TEXT=[
  "Die Katze wurde vom angetriebenen Laufband zum Ausgang gebracht.",
  "Der Ballon hat die Kerzenflamme erreicht – Plopp!",
  "Der Luftstrom hat den Ballon sauber durch den Zielring getragen.",
  "Das Trampolin hat die Bowlingkugel in den Korb umgelenkt.",
  "Der Seilzug hat das Gewicht bis zur Markierung gehoben.",
  "Die Affe hat die Banane gesehen und ist zu ihr gefahren.",
] as const;
const LEVEL_HINTS=[
  "Ohne sichtbaren Riemen überträgt das Mausrad keine Kraft.",
  "Ein aufsteigender Ballon gleitet an der Unterseite einer schrägen Planke entlang.",
  "Der Luftstrom reicht höchstens doppelt so weit wie der sichtbare Kegel.",
  "Die Neigung des Trampolins bestimmt die seitliche Komponente des Sprungs.",
  "Ein Seil überträgt Zug, aber keinen Druck. Die Fallstrecke der Kugel wird zur Hubstrecke.",
  "Erst die sichtbare Banane aktiviert die Affe – vorher bleibt das Fahrrad stehen.",
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
    {type:"pulley",icon:"◉",name:"Seilrolle",count:1},
    {type:"rope",icon:"∿",name:"Seil",count:1},
  ];
  return [
    {type:"ball",icon:"●",name:"Bowlingkugel",count:1},
    {type:"rope",icon:"∿",name:"Zugseil",count:1},
    {type:"ramp",icon:"╱",name:"Holzplanke",count:2},
  ];
};

function GameCanvas({ level, placed, running, attempt, onWin }: { level:number; placed: Placed[]; running: boolean; attempt: number; onWin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    const W = 900, H = 520;
    const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label:"floor" });
    Matter.Composite.add(engine.world, floor);
    let cat:Matter.Body|null=null,wheel:Matter.Body|null=null,candle:Matter.Body|null=null,balloon:Matter.Body|null=null,levelBall:Matter.Body|null=null,weight:Matter.Body|null=null;
    if(level===0){
      wheel=Matter.Bodies.circle(365,345,42,{isStatic:true,isSensor:true,label:"wheel"});
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
    }
    placed.forEach(p => {
      let b;
      if (p.type === "ball") b = Matter.Bodies.circle(p.x, p.y, 18, { restitution: .35, density: .006, label: "ball" });
      else if (p.type === "ramp") b = Matter.Bodies.rectangle(p.x, p.y, 155, 14, { isStatic: true, angle: p.rotation, label: "ramp" });
      else if (p.type === "fan") b = Matter.Bodies.circle(p.x,p.y,30,{isStatic:true,isSensor:true,angle:p.rotation,label:"fan"});
      else if(p.type==="trampoline")b=Matter.Bodies.rectangle(p.x,p.y,135,18,{isStatic:true,isSensor:true,angle:p.rotation,label:"trampoline"});
      else if(p.type==="pulley")b=Matter.Bodies.circle(p.x,p.y,30,{isStatic:true,isSensor:true,label:"pulley"});
      if(b) Matter.Composite.add(engine.world,b);
    });
    const beltConnected=level===0&&placed.some(p=>p.type==="belt");
    const ropeInstalled=placed.some(p=>p.type==="rope"),placedBall=Matter.Composite.allBodies(engine.world).find(body=>body.label==="ball")??null;
    const pulleyBody=Matter.Composite.allBodies(engine.world).find(body=>body.label==="pulley")??null,initialBallY=placedBall?.position.y??0;
    let motor=false,motorStartedAt=0,balloonPopped=false,blindOpen=false,monkeyStartedAt=0,monkeyX=130,won=false,raf=0,last=performance.now();
    Matter.Events.on(engine, "collisionStart", e => e.pairs.forEach(({ bodyA, bodyB }) => {
      const labels = [bodyA.label, bodyB.label];
      if (labels.includes("wheel") && labels.includes("ball") && beltConnected && !motor) { motor = true; motorStartedAt = performance.now(); }
      if (labels.includes("exit") && labels.includes("cat") && !won) { won = true; onWin(); }
      if (labels.includes("candle") && labels.includes("levelBalloon") && !won) { balloonPopped=true; won=true; onWin(); }
      if (labels.includes("targetRing") && labels.includes("levelBalloon") && !won) { won=true; onWin(); }
      if(labels.includes("trampoline")&&labels.includes("levelBall")&&levelBall){
        const trampoline=bodyA.label==="trampoline"?bodyA:bodyB;
        Matter.Body.setVelocity(levelBall,{x:-Math.sin(trampoline.angle)*20,y:-Math.abs(Math.cos(trampoline.angle))*20});
      }
      if(labels.includes("basket")&&labels.includes("levelBall")&&!won){won=true;onWin()}
    }));
    const drawGear = (x:number,y:number,r:number,turn:number) => { ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle="#d39a28"; for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-5,-5,12,10)} ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173d50";ctx.beginPath();ctx.arc(0,0,r*.28,0,Math.PI*2);ctx.fill();ctx.restore(); };
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now; if (running) Matter.Engine.update(engine,dt);
      // Das Laufband gibt eine konstante Transportgeschwindigkeit vor. Keine
      // wiederholten Kräfte: Die Katze wird also nicht ungewollt beschleunigt.
      if (running && motor && cat) Matter.Body.setPosition(cat,{x:Math.min(850,555+(now-motorStartedAt)*.075),y:365});
      if(running&&balloon&&!balloonPopped){
        Matter.Body.applyForce(balloon,balloon.position,{x:0,y:level===1?-.00035:-.00023});
        if(level===2)Matter.Composite.allBodies(engine.world).filter(body=>body.label==="fan").forEach(fan=>{
          const dx=balloon!.position.x-fan.position.x,dy=balloon!.position.y-fan.position.y,c=Math.cos(fan.angle),s=Math.sin(fan.angle);
          const forward=dx*c+dy*s,side=-dx*s+dy*c;
          if(forward>0&&forward<FAN_MAX_RANGE&&Math.abs(side)<100+forward*.3){const force=.00035*(1-forward/FAN_MAX_RANGE);Matter.Body.applyForce(balloon!,balloon!.position,{x:c*force,y:s*force})}
        });
      }
      if(running&&level===4&&ropeInstalled&&pulleyBody&&placedBall&&weight){
        const fall=Math.max(0,placedBall.position.y-initialBallY);Matter.Body.setPosition(weight,{x:760,y:Math.max(175,430-fall)});
        if(weight.position.y<=230&&!won){won=true;onWin()}
      }
      if(running&&level===5&&ropeInstalled&&placedBall){
        if(!blindOpen&&placedBall.position.y>400){blindOpen=true;monkeyStartedAt=now}
        if(blindOpen){monkeyX=Math.min(780,130+(now-monkeyStartedAt)*.07);if(monkeyX>=750&&!won){won=true;onWin()}}
      }
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40);
      if(level===0){
        ctx.fillStyle="#183f49";ctx.fillRect(780,345,105,135);ctx.fillStyle="#eac97a";ctx.font="bold 16px Georgia";ctx.fillText("AUSGANG",790,375);ctx.fillText("→",820,420);
        drawGear(365,345,42,motor?now/180:0);ctx.fillStyle="#93511f";ctx.fillRect(475,393,270,24);ctx.fillStyle="#d84a32";for(let x=490;x<730;x+=34){ctx.fillText("›",x,412)}
        if(beltConnected){ctx.save();ctx.strokeStyle="#51351f";ctx.lineWidth=7;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(400,325);ctx.lineTo(510,390);ctx.stroke();ctx.restore()}
      }else if(level===1){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,135,72,10);ctx.fillStyle="#f1cb62";ctx.fillRect(793,75,24,64);ctx.fillStyle="#ff7a22";ctx.beginPath();ctx.moveTo(805,76);ctx.quadraticCurveTo(785,57,805,40);ctx.quadraticCurveTo(826,58,805,76);ctx.fill();
      }else if(level===2){
        ctx.strokeStyle="#c73b2e";ctx.lineWidth=12;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#f1c351";ctx.lineWidth=4;ctx.beginPath();ctx.arc(780,150,45,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#5d371e";ctx.font="bold 14px system-ui";ctx.fillText("ZIELRING",744,218);
      }else if(level===3){
        ctx.strokeStyle="#7a421e";ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(715,145);ctx.lineTo(720,210);ctx.quadraticCurveTo(760,235,805,210);ctx.lineTo(808,145);ctx.stroke();ctx.fillStyle="#a52d24";ctx.font="bold 14px system-ui";ctx.fillText("KORB",742,250);
      }else if(level===4){
        ctx.strokeStyle="#bd3428";ctx.lineWidth=4;ctx.setLineDash([10,7]);ctx.beginPath();ctx.moveTo(700,230);ctx.lineTo(825,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#6b391e";ctx.font="bold 13px system-ui";ctx.fillText("ZIELHÖHE",704,215);
        if(ropeInstalled&&pulleyBody&&placedBall&&weight){ctx.strokeStyle="#6b4930";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(placedBall.position.x,placedBall.position.y);ctx.lineTo(pulleyBody.position.x,pulleyBody.position.y);ctx.lineTo(weight.position.x,weight.position.y);ctx.stroke()}
      }else if(level===5){
        ctx.fillStyle="#f0c52f";ctx.font="48px serif";ctx.fillText("🍌",760,405);
        ctx.fillStyle="#5d371e";ctx.fillRect(520,70,12,340);ctx.fillStyle="#d8b16a";const blindHeight=blindOpen?35:260;ctx.fillRect(532,85,150,blindHeight);ctx.strokeStyle="#9a713d";for(let y=100;y<85+blindHeight;y+=16){ctx.beginPath();ctx.moveTo(532,y);ctx.lineTo(682,y);ctx.stroke()}
        ctx.font="50px serif";ctx.fillText("🐒",monkeyX-25,385);ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(monkeyX-18,410,17,0,7);ctx.arc(monkeyX+25,410,17,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(monkeyX-18,410);ctx.lineTo(monkeyX+2,380);ctx.lineTo(monkeyX+25,410);ctx.moveTo(monkeyX+2,380);ctx.lineTo(monkeyX+32,380);ctx.stroke();
        if(ropeInstalled&&placedBall){ctx.strokeStyle="#6b4930";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(placedBall.position.x,placedBall.position.y);ctx.lineTo(500,90);ctx.lineTo(500,390);ctx.stroke()}
      }
      for(const b of Matter.Composite.allBodies(engine.world)){
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
        if(b.label==="ball"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="ramp"){ctx.fillStyle="#8d5426";ctx.fillRect(-75,-7,150,14);ctx.strokeStyle="#4e2a14";ctx.strokeRect(-75,-7,150,14)}
        if(b.label==="levelBalloon"&&!balloonPopped){ctx.fillStyle="#1976b9";ctx.beginPath();ctx.ellipse(0,0,22,28,0,0,7);ctx.fill();ctx.strokeStyle="#305468";ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(0,62);ctx.stroke()}
        if(b.label==="fan"){ctx.fillStyle="#18475a";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.fillStyle="#d6a12c";ctx.font="35px serif";ctx.fillText("✣",-18,12);ctx.strokeStyle="#54a8c2";ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(35,-20);ctx.lineTo(FAN_VISIBLE_RANGE,-65);ctx.moveTo(35,20);ctx.lineTo(FAN_VISIBLE_RANGE,65);ctx.stroke();ctx.setLineDash([])}
        if(b.label==="levelBall"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="trampoline"){ctx.fillStyle="#c33a2c";ctx.fillRect(-68,-9,136,18);ctx.strokeStyle="#173f50";ctx.lineWidth=4;ctx.strokeRect(-68,-9,136,18)}
        if(b.label==="pulley"){ctx.fillStyle="#d39a28";ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle="#173f50";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,19,0,7);ctx.stroke()}
        if(b.label==="weight"){ctx.fillStyle="#555d60";ctx.fillRect(-32,-32,64,64);ctx.fillStyle="#f0d59a";ctx.font="bold 14px system-ui";ctx.fillText("50 kg",-21,5)}
        if(b.label==="cat"){ctx.font="54px serif";ctx.fillText("🐈",-34,20)} ctx.restore();
      }
      ctx.fillStyle="#4b2b17";ctx.font="bold 15px system-ui";
      if(level===0)ctx.fillText(!beltConnected?"Es fehlt die Verbindung zum Laufband":motor?"Riemen überträgt den Antrieb":"Triff das Mausrad mit einer Kugel",330,260);
      if(level===1&&!balloonPopped)ctx.fillText("Lenke den Ballon mit den Planken zur Flamme",275,32);
      if(level===2)ctx.fillText("Richte den Ventilator aus und triff den Zielring",275,32);
      if(level===3)ctx.fillText("Lenke den Fall mit dem Trampolin in den Korb",270,32);
      if(level===4)ctx.fillText(!ropeInstalled?"Seil, Rolle und Kugel bilden den Flaschenzug":"Die fallende Kugel hebt das Gegengewicht",270,32);
      if(level===5)ctx.fillText(!blindOpen?"Ziehe am Seil, damit die Banane sichtbar wird":"Die Affe hat die Banane entdeckt!",270,32);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);Matter.Engine.clear(engine)};
  },[level,placed,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}

export default function Home() {
  const [name,setName]=useState(""); const [draft,setDraft]=useState(""); const [level,setLevel]=useState(0);
  const [selected,setSelected]=useState<Part>("ball"); const [placed,setPlaced]=useState<Placed[]>([]); const [running,setRunning]=useState(false); const [attempt,setAttempt]=useState(0); const [won,setWon]=useState(false); const [score,setScore]=useState(0); const [showScores,setShowScores]=useState(false); const [showPhysics,setShowPhysics]=useState(false); const [showLevels,setShowLevels]=useState(false); const [drag,setDrag]=useState<{id:number;dx:number;dy:number}|null>(null);
  useEffect(()=>{const timer=window.setTimeout(()=>setName(localStorage.getItem("machine-user")||""),0);return()=>window.clearTimeout(timer)},[]);
  const login=()=>{const n=draft.trim();if(n){localStorage.setItem("machine-user",n);setName(n)}};
  const inventory=partsForLevel(level);
  const boardPoint=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*900,y:(e.clientY-r.top)/r.height*520}};
  const boardPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(running)return;const point=boardPoint(e);const movable=placed.filter(p=>p.type!=="belt"&&p.type!=="rope").map(p=>({...p,d:Math.hypot(p.x-point.x,p.y-point.y)})).sort((a,b)=>a.d-b.d)[0];if(movable&&movable.d<48){e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:movable.id,dx:movable.x-point.x,dy:movable.y-point.y});return}const allowed=inventory.find(i=>i.type===selected);if(!allowed)return;const used=placed.filter(p=>p.type===selected).length;if(used>=allowed.count)return;setPlaced(p=>[...p,{id:Date.now(),type:selected,x:point.x,y:point.y,rotation:selected==="ramp"||selected==="trampoline"?-.28:0}])};
  const boardPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(!drag||running)return;const point=boardPoint(e);setPlaced(items=>items.map(p=>p.id===drag.id?{...p,x:Math.max(25,Math.min(875,point.x+drag.dx)),y:Math.max(25,Math.min(475,point.y+drag.dy))}:p))};
  const reset=()=>{setRunning(false);setPlaced([]);setWon(false);setAttempt(a=>a+1)};
  const changeLevel=(next:number)=>{const defaults:Part[]=["ball","ramp","fan","trampoline","ball","ball"];setLevel(next);setSelected(defaults[next]);setRunning(false);setPlaced([]);setWon(false);setAttempt(0);setShowLevels(false)};
  const rotateLast=()=>setPlaced(items=>{const index=items.findLastIndex(p=>p.type==="ramp"||p.type==="fan"||p.type==="trampoline");return index<0?items:items.map((p,i)=>i===index?{...p,rotation:p.rotation-Math.PI/12}:p)});
  const win=()=>{setWon(true);setRunning(false);setScore(s=>{const next=s+Math.max(500,1800-placed.length*120);const board=JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[];localStorage.setItem("machine-scores",JSON.stringify([...board,{name,score:next}].sort((a,b)=>b.score-a.score).slice(0,10)));return next})};
  const highScores=(()=>{if(typeof window==="undefined")return[] as {name:string;score:number}[];try{return JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[]}catch{return[]}})();
  if(!name) return <main className="login"><section className="login-card"><div className="professor">⚙</div><p className="eyebrow">WERKSTATTZUGANG</p><h1>Die Unglaubliche<br/><span>Maschine</span></h1><p>Ein Name genügt. Kein Passwort, kein Papierkram – Professor Knallkopf vertraut dir.</p><label>Dein Spielername<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="z. B. Stefan"/></label><button onClick={login}>Werkstatt betreten <b>→</b></button></section></main>;
  return <main className="game-shell">
    <header><button className="score" onClick={()=>setShowScores(true)}><span>★</span><b>{score.toLocaleString("de-DE")}</b></button><div className="brand"><small>PROFESSOR KNALLKOPFS</small><strong>Die Unglaubliche Maschine</strong></div><button className="level-chip" onClick={()=>setShowLevels(true)}>LEVEL <b>{String(level+1).padStart(2,"0")}</b> / 06⌄</button><button className="user" onClick={()=>{localStorage.removeItem("machine-user");setName("")}}>⚙ {name}⌄</button></header>
    <section className="mission"><span>ZIEL</span><b>{LEVELS[level][1]}</b><em>Hinweis: {LEVELS[level][2]}</em></section>
    <div className="workspace">
      <section className="board-wrap"><div className="board" onPointerDown={boardPointerDown} onPointerMove={boardPointerMove} onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}><GameCanvas level={level} placed={placed} running={running} attempt={attempt} onWin={win}/>{!running&&placed.length===0&&<div className="board-tip">{BUILD_TIPS[level]}</div>}{won&&<div className="win"><span>★</span><h2>Es funktioniert!</h2><p>{WIN_TEXT[level]}</p>{level<5?<button onClick={()=>changeLevel(level+1)}>Nächstes Level →</button>:<button onClick={()=>{setWon(false);reset()}}>Noch einmal bauen ↻</button>}</div>}</div><div className="motto">ERFINDEN · VERBESSERN · VERSTEHEN</div></section>
      <aside><h2>BAUTEILE</h2>{inventory.map(p=>{const remaining=p.count-placed.filter(x=>x.type===p.type).length;return <button key={p.type} className={selected===p.type?"selected":""} onClick={()=>setSelected(p.type)} disabled={running||remaining===0}><span className={`part ${p.type}`}>{p.icon}</span><label>{p.name}</label><b>{remaining}</b></button>})}<div className="tip"><b>💡 TIPP</b><p>{LEVEL_HINTS[level]}</p></div></aside>
    </div>
    <footer><div><span>VERSUCH</span><b>{attempt+1}</b></div><button className="reset" onClick={reset}>↻ <span>ZURÜCKSETZEN</span></button>{level>0&&<button className="reset" onClick={rotateLast} disabled={running||!placed.some(p=>p.type==="ramp"||p.type==="fan"||p.type==="trampoline")}>⟳ <span>LETZTES TEIL</span></button>}{running?<button className="stop" onClick={()=>setRunning(false)}>■ MASCHINE ABBRECHEN</button>:<button className="start" onClick={()=>{setAttempt(a=>a+1);setRunning(true)}} disabled={placed.length===0}>MASCHINE STARTEN<i>▶</i></button>}<button className="levels" onClick={()=>setShowPhysics(true)}>⚛ <span>PHYSIK</span></button><button className="levels" onClick={()=>setShowLevels(true)}>☷ <span>LEVEL {level+1}/6</span></button></footer>
    {showScores&&<div className="modal" onClick={()=>setShowScores(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowScores(false)}>×</button><p className="eyebrow">WERKSTATTHALLE</p><h2>Bestenliste</h2>{highScores.length?highScores.map((s,i)=><div className="rank" key={i}><b>{i+1}</b><span>{s.name}</span><strong>{s.score.toLocaleString("de-DE")}</strong></div>):<p className="empty">Noch ist die Tafel jungfräulich. Bring zuerst eine Maschine zum Laufen!</p>}</section></div>}
    {showLevels&&<div className="modal" onClick={()=>setShowLevels(false)}><section className="level-dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowLevels(false)}>×</button><p className="eyebrow">ENTWICKLER-DIREKTZUGRIFF</p><h2>Level wählen</h2><div className="level-grid">{LEVELS.slice(0,6).map((item,i)=><button key={i} className={i===level?"current":""} onClick={()=>changeLevel(i)}><b>{String(i+1).padStart(2,"0")}</b><span>{item[0]}</span><small>{item[1]}</small></button>)}</div></section></div>}
    {showPhysics&&<div className="modal physics-modal" onClick={()=>setShowPhysics(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowPhysics(false)}>×</button><p className="eyebrow">PROFESSOR KNALLKOPFS</p><h2>Physik-Handbuch</h2><div className="handbook-scroll"><h3>Kraftquellen</h3><p className="physics-intro">Diese Gadgets bringen Energie oder gerichtete Bewegung in die Maschine.</p><div className="interaction-table"><table><thead><tr><th>Gadget</th><th>Kraftart</th><th>Richtung</th><th>Regel</th></tr></thead><tbody>{FORCE_SOURCES.map((row,i)=><tr key={i}><td>{row.gadget}</td><td>{row.kind}</td><td>{row.direction}</td><td>{row.rule}</td></tr>)}</tbody></table></div><h3>Abstrakte Zielprüfung</h3><p className="physics-intro">Gadgets erzeugen nur Signale und Zustände. Eine getrennte GoalSpec kombiniert sie zum jeweiligen Levelziel.</p><div className="interaction-table"><table><thead><tr><th>Modus</th><th>Bedeutung</th><th>Beispiel</th></tr></thead><tbody>{GOAL_MODES.map((row,i)=><tr key={i}><td><b>{row.mode}</b></td><td>{row.meaning}</td><td>{row.example}</td></tr>)}</tbody></table></div><h3>Objektinteraktionen</h3><div className="interaction-table"><table><thead><tr><th>Auslöser</th><th>Ziel</th><th>Wann?</th><th>Wirkung</th><th>Stand</th></tr></thead><tbody>{INTERACTIONS.map((row,i)=><tr key={i}><td>{row.source}</td><td>{row.target}</td><td>{row.trigger}</td><td>{row.effect}</td><td><span className={`status ${row.status}`}>{row.status}</span></td></tr>)}</tbody></table></div></div></section></div>}
  </main>;
}
