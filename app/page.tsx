"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import "./modal.css";
import { INTERACTIONS } from "@/game/interactions";

type Part = "ball" | "ramp" | "belt";
type Placed = { id: number; type: Part; x: number; y: number; rotation: number };

const LEVELS = [
  ["Der erste Anstoß", "Bring die Katze zum Ausgang", "Mausmotor und Laufband"],
  ["Plopp!", "Bring den Ballon zur Kerzenflamme", "Lenke seinen Auftrieb mit Holzplanken"],
  ["Licht ins Dunkel", "Zünde die Kerze an", "Wind kann Feuer tragen"],
  ["Kettenreaktion", "Wirf den roten Ball in den Korb", "Erst rollen, dann fallen"],
  ["Mäusearbeit", "Starte beide Laufbänder", "Eine Maus, zwei Riemen"],
  ["Wasser marsch", "Fülle den Messbecher", "Öffne den Hahn zur rechten Zeit"],
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

const partsForLevel = (level:number): { type: Part; icon: string; name: string; count: number }[] => level === 0 ? [
  { type: "ball", icon: "●", name: "Bowlingkugel", count: 2 },
  { type: "ramp", icon: "╱", name: "Holzplanke", count: 3 },
  { type: "belt", icon: "⛓", name: "Antriebsriemen", count: 1 },
] : [
  { type: "ramp", icon: "╱", name: "Holzplanke", count: 5 },
];

function GameCanvas({ level, placed, running, attempt, onWin }: { level:number; placed: Placed[]; running: boolean; attempt: number; onWin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
    const W = 900, H = 520;
    const floor = Matter.Bodies.rectangle(W / 2, 500, W, 40, { isStatic: true, label:"floor" });
    Matter.Composite.add(engine.world, floor);
    let cat:Matter.Body|null=null, wheel:Matter.Body|null=null, candle:Matter.Body|null=null, balloon:Matter.Body|null=null;
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
    }
    placed.forEach(p => {
      let b;
      if (p.type === "ball") b = Matter.Bodies.circle(p.x, p.y, 18, { restitution: .35, density: .006, label: "ball" });
      else if (p.type === "ramp") b = Matter.Bodies.rectangle(p.x, p.y, 155, 14, { isStatic: true, angle: p.rotation, label: "ramp" });
      if(b) Matter.Composite.add(engine.world,b);
    });
    const beltConnected=level===0&&placed.some(p=>p.type==="belt");
    let motor = false, motorStartedAt = 0, balloonPopped=false, won = false, raf = 0, last = performance.now();
    Matter.Events.on(engine, "collisionStart", e => e.pairs.forEach(({ bodyA, bodyB }) => {
      const labels = [bodyA.label, bodyB.label];
      if (labels.includes("wheel") && labels.includes("ball") && beltConnected && !motor) { motor = true; motorStartedAt = performance.now(); }
      if (labels.includes("exit") && labels.includes("cat") && !won) { won = true; onWin(); }
      if (labels.includes("candle") && labels.includes("levelBalloon") && !won) { balloonPopped=true; won=true; onWin(); }
    }));
    const drawGear = (x:number,y:number,r:number,turn:number) => { ctx.save(); ctx.translate(x,y); ctx.rotate(turn); ctx.fillStyle="#d39a28"; for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-5,-5,12,10)} ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#173d50";ctx.beginPath();ctx.arc(0,0,r*.28,0,Math.PI*2);ctx.fill();ctx.restore(); };
    const render = (now:number) => {
      const dt = Math.min(32, now-last); last=now; if (running) Matter.Engine.update(engine,dt);
      // Das Laufband gibt eine konstante Transportgeschwindigkeit vor. Keine
      // wiederholten Kräfte: Die Katze wird also nicht ungewollt beschleunigt.
      if (running && motor && cat) Matter.Body.setPosition(cat,{x:Math.min(850,555+(now-motorStartedAt)*.075),y:365});
      if(running&&balloon&&!balloonPopped) Matter.Body.applyForce(balloon,balloon.position,{x:0,y:-.00035});
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#f4e5c0";ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(66,94,96,.11)";ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()} for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
      ctx.fillStyle="#98612e";ctx.fillRect(0,480,W,40);
      if(level===0){
        ctx.fillStyle="#183f49";ctx.fillRect(780,345,105,135);ctx.fillStyle="#eac97a";ctx.font="bold 16px Georgia";ctx.fillText("AUSGANG",790,375);ctx.fillText("→",820,420);
        drawGear(365,345,42,motor?now/180:0);ctx.fillStyle="#93511f";ctx.fillRect(475,393,270,24);ctx.fillStyle="#d84a32";for(let x=490;x<730;x+=34){ctx.fillText("›",x,412)}
        if(beltConnected){ctx.save();ctx.strokeStyle="#51351f";ctx.lineWidth=7;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(400,325);ctx.lineTo(510,390);ctx.stroke();ctx.restore()}
      }else if(level===1){
        ctx.fillStyle="#7b4c24";ctx.fillRect(770,135,72,10);ctx.fillStyle="#f1cb62";ctx.fillRect(793,75,24,64);ctx.fillStyle="#ff7a22";ctx.beginPath();ctx.moveTo(805,76);ctx.quadraticCurveTo(785,57,805,40);ctx.quadraticCurveTo(826,58,805,76);ctx.fill();
      }
      for(const b of Matter.Composite.allBodies(engine.world)){
        const {x,y}=b.position;ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
        if(b.label==="ball"){ctx.fillStyle="#293c45";ctx.beginPath();ctx.arc(0,0,18,0,7);ctx.fill();ctx.fillStyle="#d9b256";ctx.beginPath();ctx.arc(-5,-6,3,0,7);ctx.fill()}
        if(b.label==="ramp"){ctx.fillStyle="#8d5426";ctx.fillRect(-75,-7,150,14);ctx.strokeStyle="#4e2a14";ctx.strokeRect(-75,-7,150,14)}
        if(b.label==="levelBalloon"&&!balloonPopped){ctx.fillStyle="#1976b9";ctx.beginPath();ctx.ellipse(0,0,22,28,0,0,7);ctx.fill();ctx.strokeStyle="#305468";ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(0,62);ctx.stroke()}
        if(b.label==="cat"){ctx.font="54px serif";ctx.fillText("🐈",-34,20)} ctx.restore();
      }
      ctx.fillStyle="#4b2b17";ctx.font="bold 15px system-ui";
      if(level===0)ctx.fillText(!beltConnected?"Es fehlt die Verbindung zum Laufband":motor?"Riemen überträgt den Antrieb":"Triff das Mausrad mit einer Kugel",330,260);
      if(level===1&&!balloonPopped)ctx.fillText("Lenke den Ballon mit den Planken zur Flamme",275,32);
      raf=requestAnimationFrame(render);
    }; raf=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(raf);Matter.Engine.clear(engine)};
  },[level,placed,running,attempt,onWin]);
  return <canvas ref={canvasRef} width={900} height={520} aria-label="Spielfeld der unglaublichen Maschine" />;
}

export default function Home() {
  const [name,setName]=useState(""); const [draft,setDraft]=useState(""); const [level,setLevel]=useState(0);
  const [selected,setSelected]=useState<Part>("ball"); const [placed,setPlaced]=useState<Placed[]>([]); const [running,setRunning]=useState(false); const [attempt,setAttempt]=useState(0); const [won,setWon]=useState(false); const [score,setScore]=useState(0); const [showScores,setShowScores]=useState(false); const [showPhysics,setShowPhysics]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setName(localStorage.getItem("machine-user")||""),0);return()=>window.clearTimeout(timer)},[]);
  const login=()=>{const n=draft.trim();if(n){localStorage.setItem("machine-user",n);setName(n)}};
  const inventory=partsForLevel(level);
  const boardClick=(e:React.MouseEvent<HTMLDivElement>)=>{if(running)return;const allowed=inventory.find(i=>i.type===selected);if(!allowed)return;const used=placed.filter(p=>p.type===selected).length;if(used>=allowed.count)return;const r=e.currentTarget.getBoundingClientRect();setPlaced(p=>[...p,{id:Date.now(),type:selected,x:(e.clientX-r.left)/r.width*900,y:(e.clientY-r.top)/r.height*520,rotation:selected==="ramp"?-.28:0}])};
  const reset=()=>{setRunning(false);setPlaced([]);setWon(false);setAttempt(a=>a+1)};
  const changeLevel=(next:number)=>{setLevel(next);setSelected(next===0?"ball":"ramp");setRunning(false);setPlaced([]);setWon(false);setAttempt(0)};
  const rotateLast=()=>setPlaced(items=>{const index=items.findLastIndex(p=>p.type==="ramp");return index<0?items:items.map((p,i)=>i===index?{...p,rotation:p.rotation-Math.PI/12}:p)});
  const win=()=>{setWon(true);setRunning(false);setScore(s=>{const next=s+Math.max(500,1800-placed.length*120);const board=JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[];localStorage.setItem("machine-scores",JSON.stringify([...board,{name,score:next}].sort((a,b)=>b.score-a.score).slice(0,10)));return next})};
  const highScores=(()=>{if(typeof window==="undefined")return[] as {name:string;score:number}[];try{return JSON.parse(localStorage.getItem("machine-scores")||"[]") as {name:string;score:number}[]}catch{return[]}})();
  if(!name) return <main className="login"><section className="login-card"><div className="professor">⚙</div><p className="eyebrow">WERKSTATTZUGANG</p><h1>Die Unglaubliche<br/><span>Maschine</span></h1><p>Ein Name genügt. Kein Passwort, kein Papierkram – Professor Knallkopf vertraut dir.</p><label>Dein Spielername<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="z. B. Stefan"/></label><button onClick={login}>Werkstatt betreten <b>→</b></button></section></main>;
  return <main className="game-shell">
    <header><button className="score" onClick={()=>setShowScores(true)}><span>★</span><b>{score.toLocaleString("de-DE")}</b></button><div className="brand"><small>PROFESSOR KNALLKOPFS</small><strong>Die Unglaubliche Maschine</strong></div><div className="level-chip">LEVEL <b>{String(level+1).padStart(2,"0")}</b> / 25</div><button className="user" onClick={()=>{localStorage.removeItem("machine-user");setName("")}}>⚙ {name}⌄</button></header>
    <section className="mission"><span>ZIEL</span><b>{LEVELS[level][1]}</b><em>Hinweis: {LEVELS[level][2]}</em></section>
    <div className="workspace">
      <section className="board-wrap"><div className="board" onClick={boardClick}><GameCanvas level={level} placed={placed} running={running} attempt={attempt} onWin={win}/>{!running&&placed.length===0&&<div className="board-tip">{level===0?"Verbinde zuerst Mausrad und Laufband – und bring dann das Rad in Schwung.":"Platziere Holzplanken zwischen Ballon und Kerze. Die letzte Planke kannst du unten drehen."}</div>}{won&&<div className="win"><span>★</span><h2>Es funktioniert!</h2><p>{level===0?"Die Katze wurde vom angetriebenen Laufband zum Ausgang gebracht.":"Der Ballon hat die Kerzenflamme erreicht – Plopp!"}</p>{level===0?<button onClick={()=>changeLevel(1)}>Nächstes Level →</button>:<button onClick={()=>{setWon(false);reset()}}>Noch einmal bauen ↻</button>}</div>}</div><div className="motto">ERFINDEN · VERBESSERN · VERSTEHEN</div></section>
      <aside><h2>BAUTEILE</h2>{inventory.map(p=>{const remaining=p.count-placed.filter(x=>x.type===p.type).length;return <button key={p.type} className={selected===p.type?"selected":""} onClick={()=>setSelected(p.type)} disabled={running||remaining===0}><span className={`part ${p.type}`}>{p.icon}</span><label>{p.name}</label><b>{remaining}</b></button>})}<div className="tip"><b>💡 TIPP</b><p>{level===0?"Ohne sichtbaren Riemen überträgt das Mausrad keine Kraft.":"Ein aufsteigender Ballon gleitet an der Unterseite einer schrägen Planke entlang."}</p></div></aside>
    </div>
    <footer><div><span>VERSUCH</span><b>{attempt+1}</b></div><button className="reset" onClick={reset}>↻ <span>ZURÜCKSETZEN</span></button>{level===1&&<button className="reset" onClick={rotateLast} disabled={running||!placed.some(p=>p.type==="ramp")}>⟳ <span>LETZTE PLANKE</span></button>}<button className="start" onClick={()=>{setAttempt(a=>a+1);setRunning(true)}} disabled={running||placed.length===0}>{running?"MASCHINE LÄUFT …":"MASCHINE STARTEN"}<i>▶</i></button><button className="levels" onClick={()=>setShowPhysics(true)}>⚛ <span>PHYSIK</span></button><button className="levels" onClick={()=>changeLevel((level+1)%2)}>☷ <span>LEVEL {level+1}/2</span></button></footer>
    {showScores&&<div className="modal" onClick={()=>setShowScores(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowScores(false)}>×</button><p className="eyebrow">WERKSTATTHALLE</p><h2>Bestenliste</h2>{highScores.length?highScores.map((s,i)=><div className="rank" key={i}><b>{i+1}</b><span>{s.name}</span><strong>{s.score.toLocaleString("de-DE")}</strong></div>):<p className="empty">Noch ist die Tafel jungfräulich. Bring zuerst eine Maschine zum Laufen!</p>}</section></div>}
    {showPhysics&&<div className="modal physics-modal" onClick={()=>setShowPhysics(false)}><section onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowPhysics(false)}>×</button><p className="eyebrow">PROFESSOR KNALLKOPFS</p><h2>Physik-Handbuch</h2><p className="physics-intro">Die Engine bewegt Körper. Diese Regeln bestimmen, was ihre Begegnung im Spiel auslöst.</p><div className="interaction-table"><table><thead><tr><th>Auslöser</th><th>Ziel</th><th>Wann?</th><th>Wirkung</th><th>Stand</th></tr></thead><tbody>{INTERACTIONS.map((row,i)=><tr key={i}><td>{row.source}</td><td>{row.target}</td><td>{row.trigger}</td><td>{row.effect}</td><td><span className={`status ${row.status}`}>{row.status}</span></td></tr>)}</tbody></table></div></section></div>}
  </main>;
}
