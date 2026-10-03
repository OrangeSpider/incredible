import {readFileSync} from "node:fs";
import {createSimulation} from "../../game/simulation-setup.ts";

export const loadLevel=number=>JSON.parse(readFileSync(new URL(`../../levels/level-${number}.json`,import.meta.url),"utf8"));

export function createScenario(level,placed=[],controlRopes=[],options={}){
  let won=false;
  const {machine,runtime}=createSimulation({
    level,
    placed:placed.map((part,index)=>({id:index,rotation:0,...part})),
    controlRopes,...options,running:true,onWin:()=>{won=true},
  });
  return {machine,runtime,get won(){return won},step(frames=600,observe=()=>{}){for(let frame=0;frame<frames&&!won;frame++){runtime.tick((frame+1)*16.666,16.666);observe(frame)}return won}};
}

