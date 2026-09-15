import {readFileSync} from "node:fs";
import Matter from "matter-js";
import {MachinePhysicsEngine} from "../../engine/physics-engine.ts";
import {MachineRuntime} from "../../game/machine-runtime.ts";
import {FuseNetwork} from "../../game/fuse.ts";
import {createBucketAssembly} from "../../game/water.ts";

export const loadLevel=number=>JSON.parse(readFileSync(new URL(`../../levels/level-${number}.json`,import.meta.url),"utf8"));
const worldPoint=(body,x,y)=>({x:body.position.x+x*Math.cos(body.angle)-y*Math.sin(body.angle),y:body.position.y+x*Math.sin(body.angle)+y*Math.cos(body.angle)});

export function createScenario(level,placed=[],controlRopes=[]){
  const machine=new MachinePhysicsEngine(level);
  Matter.Composite.add(machine.world,Matter.Bodies.rectangle(450,500,900,40,{isStatic:true,label:"floor"}));
  let bucket=null,seesaw=machine.bodiesByType("seesaw")[0]??null;
  const water=[];
  for(const [index,part] of placed.entries()){
    if(part.type==="bucket"){
      const assembly=createBucketAssembly(part.x,part.y,part.rotation??0);
      bucket=assembly.bucket;water.push(...assembly.water);
      Matter.Composite.add(machine.world,[bucket,...water]);
      continue;
    }
    const body=machine.addGadget({id:`placed-${index}`,collisionLabel:part.type,...part});
    if(part.type==="seesaw")seesaw=body;
  }
  const cannon=machine.bodiesByType("cannon")[0]??null;
  const fuses=machine.bodiesByType("fuse");
  const fuseId=body=>`fuse-${body.id}`;
  const cannonFuseId="cannon-fuse";
  const fuseNetwork=new FuseNetwork([
    ...fuses.map(body=>({id:fuseId(body),start:worldPoint(body,-55,0),end:worldPoint(body,55,0),burnDurationMs:1200})),
    ...(cannon?[{id:cannonFuseId,start:worldPoint(cannon,-18,-42),end:worldPoint(cannon,-26,-17),burnDurationMs:1300,samples:14}]:[]),
  ],22,105);
  const tethered=level.fixedGadgets.filter(gadget=>gadget.type==="balloon"&&gadget.state==="tethered");
  let won=false;
  const runtime=new MachineRuntime({
    level,machine,running:true,onWin:()=>{won=true},beltConnected:false,
    bodies:{
      cat:machine.bodiesByType("cat")[0]??null,
      balloon:machine.bodiesByType("balloon").find(body=>body.label==="levelBalloon")??null,
      levelBall:machine.body("falling-ball"),weight:null,bucket,seesaw,fishBowl:null,fish:null,
      mouse:machine.bodiesByType("mouse")[0]??null,cannon,
      candle:machine.bodiesByType("candle").find(body=>body.label==="candle")??null,
      hamsterWheel:null,conveyor:null,water,
      scissorBalloons:tethered.flatMap(gadget=>{const body=machine.body(gadget.id);return body?[body]:[]}),rockets:[],
    },
    controlRopes,scissorConnections:[],tetheredBalloonIds:tethered.map(gadget=>gadget.id),fuseNetwork,fuseId,cannonFuseId,gearsConnected:false,
    rope:{fixed:[],moving:[],placedBall:null,initialMovingPositions:[],initialBlockPosition:{x:760,y:390},initialWeightY:390,ready:false,restLength:0,physicsPoints:()=>[]},
  });
  return {machine,runtime,get won(){return won},step(frames=600,observe=()=>{}){for(let frame=0;frame<frames&&!won;frame++){runtime.tick((frame+1)*16.666,16.666);observe(frame)}return won}};
}

