import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import { machinePlugin } from "../../engine/body-factory.ts";
import { rocketVisual } from "../../game/rocket.ts";

/** Local effects resolve only the current body's instance, never a scene summary. */
export function createFireGadgetRenderer(ctx: CanvasRenderingContext2D) {
    const fireSprites=new Image();fireSprites.src="/assets/fire-animation-sprites.png";
    const drawFireSprite=(row:number,frame:number,x:number,y:number,width:number,height:number,rotation=0)=>{
      if(!fireSprites.complete||!fireSprites.naturalWidth)return false;
      const cellWidth=fireSprites.naturalWidth/6,cellHeight=fireSprites.naturalHeight/3;
      ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(fireSprites,frame*cellWidth,row*cellHeight,cellWidth,cellHeight,-width/2,-height/2,width,height);ctx.restore();return true;
    };
    const rocketSprites=new Image();rocketSprites.src="/assets/rocket-launch-sprites.png";
    const drawRocketSprite=(row:number,frame:number,x:number,y:number,size:number)=>{
      if(!rocketSprites.complete||!rocketSprites.naturalWidth)return false;
      const column=((frame%4)+4)%4,cellWidth=rocketSprites.naturalWidth/4,cellHeight=rocketSprites.naturalHeight/2;
      ctx.drawImage(rocketSprites,column*cellWidth,row*cellHeight,cellWidth,cellHeight,x-size/2,y-size/2,size,size);return true;
    };
    const drawFallbackFlame=(x:number,y:number,now:number,scale=1)=>{const sway=Math.sin(now*.018)*3*scale;ctx.save();ctx.translate(x,y);ctx.fillStyle="#e94620";ctx.beginPath();ctx.moveTo(-9*scale,10*scale);ctx.quadraticCurveTo((-15+sway)*scale,-4*scale,sway,-18*scale);ctx.quadraticCurveTo((14+sway)*scale,-3*scale,9*scale,10*scale);ctx.fill();ctx.fillStyle="#ffd34f";ctx.beginPath();ctx.ellipse(sway*.35,3*scale,4*scale,8*scale,0,0,Math.PI*2);ctx.fill();ctx.restore()};
  return (b: Matter.Body, machine: MachinePhysicsEngine, now: number): boolean => {
    const gadgetId = machinePlugin(b)?.instanceId;
    const gadgetConfig = gadgetId ? machine.config(gadgetId) : null;
    if (!gadgetConfig || !["cannon", "fuse", "rocket"].includes(gadgetConfig.type)) return false;
if(gadgetConfig.type==="cannon"){ctx.fillStyle="#263d43";ctx.fillRect(-42,-16,82,32);ctx.fillStyle="#b26a29";ctx.beginPath();ctx.arc(-18,25,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#263d43";ctx.fillRect(32,-21,20,42);const fuse=machine.mechanics.fuseSnapshot(`${gadgetId}:fuse`),samples=fuse?.samples ?? [],point=(t:number)=>({x:-18+(-26+18)*t,y:-42+(-17+42)*t});ctx.lineWidth=5;ctx.lineCap="round";for(let index=0;index<samples.length-1;index++){const from=point(samples[index].t),to=point(samples[index+1].t);ctx.strokeStyle=samples[index].burned?"#a29a8d":"#49382a";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}for(const t of fuse?.flames ?? []){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y,34,34))drawFallbackFlame(flame.x,flame.y,now,.55)}if(gadgetId && machine.state(gadgetId)?.state==="firing" && (machine.stateAgeMs(gadgetId)??Infinity)<520){const flashFrame=Math.min(5,Math.floor((machine.stateAgeMs(gadgetId)??0)/87));if(!drawFireSprite(2,flashFrame,70,0,105,78))drawFallbackFlame(67,0,now,1.5)}}
if(gadgetConfig.type==="fuse"){const fuse=machine.mechanics.fuseSnapshot(gadgetId!),samples=fuse?.samples ?? [],point=(t:number)=>({x:-55+110*t,y:16*t*(1-t)});ctx.lineWidth=7;ctx.lineCap="round";for(let index=0;index<samples.length-1;index++){const from=point(samples[index].t),to=point(samples[index+1].t);ctx.strokeStyle=samples[index].burned?"#a29a8d":"#4f3d2b";ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}for(const t of fuse?.flames ?? []){const flame=point(t);if(!drawFireSprite(1,Math.floor(now/80)%6,flame.x,flame.y-3,34,34))drawFallbackFlame(flame.x,flame.y-3,now,.55)}if(gadgetId && machine.state(gadgetId)?.state==="extinguished"){ctx.strokeStyle="#2ca7d8";ctx.lineWidth=3;ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(50,4);ctx.stroke();ctx.setLineDash([])}}
if(gadgetConfig?.type==="rocket"){const id=machinePlugin(b)?.instanceId,state=id?(machine.state(id)?.state??"mounted"):"mounted",age=id?(machine.stateAgeMs(id)??0):0,started=state==="burning"?now-age:state==="launching"?now-age-520:state==="launched"?now-age-1780:undefined,visual=rocketVisual(state,started,now);if(visual.visible&&!drawRocketSprite(visual.row,visual.frame,0,visual.offsetY,visual.size)){ctx.fillStyle="#d94d32";ctx.beginPath();ctx.moveTo(0,-55+visual.offsetY);ctx.lineTo(-24,18+visual.offsetY);ctx.lineTo(24,18+visual.offsetY);ctx.closePath();ctx.fill()}if(visual.smokeOpacity>0){ctx.save();ctx.globalAlpha=visual.smokeOpacity;ctx.fillStyle="#d8d2c7";for(let puff=0;puff<7;puff++){const angle=puff/7*Math.PI*2,radius=9+(puff%3)*3;ctx.beginPath();ctx.arc(Math.cos(angle+now*.001)*22,55+Math.sin(angle)*10,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
    return true;
  };
}
