import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import type { ResolvedAnimation } from "../../engine/animation.ts";
import { resolveGadgetAnimation } from "../../engine/animation.ts";
import { machinePlugin } from "../../engine/body-factory.ts";
import { catSpritePose, catSpriteOffsetX } from "../../game/cat.ts";
import { localPort } from "../../engine/gadget-ports.ts";
import { drawDriveWheel } from "../../game/drive.ts";
import { drawGadget } from "./gadget-renderer.ts";

type SpriteDrawer = (ctx:CanvasRenderingContext2D, animation:ResolvedAnimation|null, x:number, y:number)=>boolean;
export function bodyAnimation(machine:MachinePhysicsEngine,id:string,now:number,running:boolean) {
  const state=machine.state(id)!;
  const visualState=state.type==="cat" && Number(state.properties.fallStartedAt)>0 ? "falling" : state.state;
  const age=!running ? now : visualState!==state.state ? now-Number(state.properties.fallStartedAt) : machine.stateAgeMs(id)??0;
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
  ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(body.angle);ctx.scale(plugin.flipX?-1:1,plugin.flipY?-1:1);
  // Effects on compound artwork are drawn locally rather than as a full-body sprite.
  const artwork=["candle","bucket"].includes(config.type);
  if (config.type==="fish" && machine.state(plugin.instanceId)?.state==="hidden") {ctx.restore();return;}
  if(!fire(body,machine,now) && !(artwork && drawGadget(ctx,body,machine,now,running)) && !sprite(ctx,animation,config.type==="cat"?catSpriteOffsetX({state:animation?.state==="idle"?"idle":"running",row:animation?.row??0,frame:animation?.frame??0},animation?.definition.kind==="sprite"?animation.definition.width:90):0,0))drawGadget(ctx,body,machine,now,running);
  if(config.type==="hamsterWheel") {const port=localPort(config,"drive","drive");if(port)drawDriveWheel(ctx,port.local,14,running&&machine.state(plugin.instanceId)?.state==="running"?now*.008:0);}
  ctx.restore();
}
