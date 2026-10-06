import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import type { ResolvedAnimation } from "../../engine/animation.ts";
import { resolveGadgetAnimation } from "../../engine/animation.ts";
import { machinePlugin } from "../../engine/body-factory.ts";
import { catSpritePose, catSpriteOffsetX, CAT_STARTLE_DURATION_MS } from "../../game/cat.ts";
import { fishBowlSpriteOffsetX } from "../../game/fish.ts";
import { localPort } from "../../engine/gadget-ports.ts";
import { drawDriveWheel } from "../../game/drive.ts";
import { drawGadget } from "./gadget-renderer.ts";

type SpriteDrawer = (ctx:CanvasRenderingContext2D, animation:ResolvedAnimation|null, x:number, y:number)=>boolean;

const TAU=Math.PI*2;

function drawWheelInterior(ctx:CanvasRenderingContext2D,angle:number) {
  ctx.save();
  ctx.beginPath();ctx.arc(0,0,46,0,TAU);ctx.clip();
  // Erase the wheel and hamster baked into the idle artwork. Only the static
  // housing outside this circle remains from the generated source image.
  ctx.fillStyle="#fff0c9";ctx.fill();
  ctx.save();ctx.rotate(angle);ctx.lineCap="round";
  ctx.strokeStyle="#82501f";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,42,0,TAU);ctx.stroke();
  ctx.strokeStyle="#dba43b";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,39.5,0,TAU);ctx.stroke();
  for(let spoke=0;spoke<8;spoke++){
    const direction=spoke*TAU/8,c=Math.cos(direction),s=Math.sin(direction);
    ctx.strokeStyle="#8b561f";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(c*8,s*8);ctx.lineTo(c*38,s*38);ctx.stroke();
    ctx.strokeStyle="#e0ab43";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(c*9-1,s*9-1);ctx.lineTo(c*37-1,s*37-1);ctx.stroke();
  }
  ctx.fillStyle="#d2932c";ctx.strokeStyle="#74451e";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,9,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle="#59666a";ctx.beginPath();ctx.arc(0,0,4.5,0,TAU);ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawHamsterWheel(ctx:CanvasRenderingContext2D,animation:ResolvedAnimation|null,ageMs:number,sprite:SpriteDrawer) {
  const housing=sprite(ctx,resolveGadgetAnimation("hamsterWheel","idle",0),0,0);
  if(!housing||animation?.state!=="running")return housing;
  drawWheelInterior(ctx,ageMs*TAU/900);
  // Louis is a separate registered sprite: his baseline never follows the
  // wheel frames, while his six poses still form a lively running cycle.
  ctx.save();ctx.beginPath();ctx.arc(0,0,42,0,TAU);ctx.clip();sprite(ctx,animation,1,7);ctx.restore();
  // A fixed foreground rim keeps Louis visually inside the rotating wheel.
  ctx.strokeStyle="#71431b";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,43,0,TAU);ctx.stroke();
  ctx.strokeStyle="#e0aa3e";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,40,0,TAU);ctx.stroke();
  return true;
}

export function bodyAnimation(machine:MachinePhysicsEngine,id:string,now:number,running:boolean) {
  const state=machine.state(id)!;
  const blastAge=state.type==="cat"&&typeof state.properties.blastStartledAt==="number"?machine.timeMs-state.properties.blastStartledAt:null;
  const blastStartle=blastAge!==null&&blastAge<CAT_STARTLE_DURATION_MS;
  const visualState=blastStartle?"startled":state.type==="cat" && Number(state.properties.fallStartedAt)>0 ? "falling" : state.state;
  const age=blastStartle?blastAge!:!running ? now : visualState!==state.state ? now-Number(state.properties.fallStartedAt) : machine.stateAgeMs(id)??0;
  const animation=resolveGadgetAnimation(state.type,visualState,age);
  if (state.type==="cat") {
    const pose=catSpritePose(age,{running:visualState==="running",startledAt:["startled","falling"].includes(visualState)?0:null,holdStartled:true});
    animation.frame=pose.frame;animation.column=pose.frame;animation.row=pose.row;
  }
  return animation;
}
/** Every body uses its complete instance identity; water has a separate fluid renderer. */
export function drawGadgetBody(ctx:CanvasRenderingContext2D,body:Matter.Body,machine:MachinePhysicsEngine,now:number,running:boolean,sprite:SpriteDrawer,fire:(body:Matter.Body,machine:MachinePhysicsEngine,now:number)=>boolean) {
  const plugin=machinePlugin(body);if(!plugin || plugin.type==="water")return;
  const config=machine.config(plugin.instanceId)!;
  const animation=bodyAnimation(machine,plugin.instanceId,now,running);
  const facing=machine.state(plugin.instanceId)?.properties.facingDirection;
  const flipX=config.type==="cat"&&typeof facing==="number"?facing<0:plugin.flipX;
  ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(body.angle);ctx.scale(flipX?-1:1,plugin.flipY?-1:1);
  // Effects on compound artwork are drawn locally rather than as a full-body sprite.
  const artwork=["candle","bucket"].includes(config.type);
  if (config.type==="fish" && machine.state(plugin.instanceId)?.state==="hidden") {ctx.restore();return;}
  let spriteDrawn=false;
  if(config.type==="hamsterWheel"){
    const age=!running?now:machine.stateAgeMs(plugin.instanceId)??0;
    spriteDrawn=drawHamsterWheel(ctx,animation,age,sprite);
  }
  const spriteWidth=animation?.definition.kind==="sprite"?animation.definition.width:0;
  const spriteOffsetX=config.type==="cat"
    ? catSpriteOffsetX({state:animation?.state==="idle"?"idle":"running",row:animation?.row??0,frame:animation?.frame??0},spriteWidth||90)
    : config.type==="fishBowl"&&animation?.state==="intact"
      ? fishBowlSpriteOffsetX(animation.frame,spriteWidth)
      : 0;
  if(!fire(body,machine,now) && !(artwork && drawGadget(ctx,body,machine,now,running)) && !spriteDrawn && !sprite(ctx,animation,spriteOffsetX,0))drawGadget(ctx,body,machine,now,running);
  if(config.type==="hamsterWheel") {const port=localPort(config,"drive","drive");if(port)drawDriveWheel(ctx,port.local,14,running&&machine.state(plugin.instanceId)?.state==="running"?now*.008:0);}
  ctx.restore();
}
