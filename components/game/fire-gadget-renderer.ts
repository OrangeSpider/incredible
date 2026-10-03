import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import { machinePlugin } from "../../engine/body-factory.ts";
import { rocketVisual } from "../../game/rocket.ts";
import { drawCartoonArtwork } from "./cartoon-artwork.ts";
import type { FuseSample } from "../../game/fuse.ts";

/** Braided rope, ash and damp fibers all follow the same sampled burn front. */
function drawFuseCord(ctx:CanvasRenderingContext2D,samples:FuseSample[],point:(t:number)=>{x:number;y:number},wet:boolean,width:number) {
  ctx.lineCap="round";
  for(let index=0;index<samples.length-1;index++){
    const from=point(samples[index].t),to=point(samples[index+1].t),burned=samples[index].burned;
    ctx.strokeStyle=burned?"#6d6860":"#493725";ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    ctx.strokeStyle=burned?"#b1a798":wet?"#75a0a5":"#d5aa68";ctx.lineWidth=width-2.5;ctx.stroke();
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
    ctx.strokeStyle=burned?"#817970":wet?"#456f7d":"#86572c";ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(from.x+nx*(width/2-1),from.y+ny*(width/2-1));ctx.lineTo(to.x-nx*(width/2-1),to.y-ny*(width/2-1));ctx.stroke();
  }
}

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
    if(gadgetConfig.type==="cannon" || gadgetConfig.type==="fuse"){
      const cannon=gadgetConfig.type==="cannon",state=machine.state(gadgetId!)?.state,age=machine.stateAgeMs(gadgetId!)??0;
      if(cannon)drawCartoonArtwork(ctx,b,machine,now,true);
      const fuse=machine.mechanics.fuseSnapshot(cannon?`${gadgetId}:fuse`:gadgetId!);
      const point=cannon?(t:number)=>({x:-18-8*t,y:-42+25*t}):(t:number)=>({x:-55+110*t,y:0});
      drawFuseCord(ctx,fuse.samples,point,state==="extinguished",cannon?5:7);
      for(const t of fuse.flames){
        const flame=point(t),clock=machine.timeMs;
        if(!drawFireSprite(1,Math.floor(clock/80)%6,flame.x,flame.y,34,34))drawFallbackFlame(flame.x,flame.y,clock,.55);
        ctx.strokeStyle="#f4b943";ctx.lineWidth=1.3;
        for(let spark=0;spark<5;spark++){
          const angle=spark*Math.PI*2/5+clock*.014,radius=7+(clock/22+spark*3)%9;
          ctx.beginPath();ctx.moveTo(flame.x+Math.cos(angle)*radius,flame.y+Math.sin(angle)*radius);ctx.lineTo(flame.x+Math.cos(angle)*(radius+3),flame.y+Math.sin(angle)*(radius+3));ctx.stroke();
        }
      }
      if(cannon && state==="firing" && age<300){
        // The atlas carries the flash; this also supplies it while the atlas is loading.
        const frame=Math.min(5,Math.floor(age/50));
        if(!drawFireSprite(2,frame,70,0,86,62))drawFallbackFlame(67,0,machine.timeMs,1.3);
      }
      if(state==="extinguished"){
        ctx.fillStyle="rgba(93,165,193,.65)";
        for(const t of [.2,.55,.85]){const drop=point(t);ctx.beginPath();ctx.ellipse(drop.x,drop.y+4,1.6,2.5,0,0,Math.PI*2);ctx.fill();}
      }
    }
if(gadgetConfig?.type==="rocket"){const id=machinePlugin(b)?.instanceId,state=id?(machine.state(id)?.state??"mounted"):"mounted",age=id?(machine.stateAgeMs(id)??0):0,started=state==="burning"?now-age:state==="launching"?now-age-520:state==="launched"?now-age-1780:undefined,visual=rocketVisual(state,started,now);if(visual.visible&&!drawRocketSprite(visual.row,visual.frame,0,visual.offsetY,visual.size)){ctx.fillStyle="#d94d32";ctx.beginPath();ctx.moveTo(0,-55+visual.offsetY);ctx.lineTo(-24,18+visual.offsetY);ctx.lineTo(24,18+visual.offsetY);ctx.closePath();ctx.fill()}if(visual.smokeOpacity>0){ctx.save();ctx.globalAlpha=visual.smokeOpacity;ctx.fillStyle="#d8d2c7";for(let puff=0;puff<7;puff++){const angle=puff/7*Math.PI*2,radius=9+(puff%3)*3;ctx.beginPath();ctx.arc(Math.cos(angle+now*.001)*22,55+Math.sin(angle)*10,radius,0,Math.PI*2);ctx.fill()}ctx.restore()}}
    return true;
  };
}
