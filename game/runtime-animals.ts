import Matter from "matter-js";
import { machinePlugin } from "../engine/body-factory.ts";
import { bodyPoint, inversePoint, bodyTransform, gadgetSize } from "../engine/gadget-geometry.ts";
import { catapultImpactMode, catapultLaunchVelocity, catapultReleasePosition } from "./catapult.ts";
import { catSeesFish, advanceCatTowardFish } from "./fish.ts";
import type { MachineRuntime } from "./machine-runtime.ts";
import type { RuntimeSystem } from "./runtime-systems.ts";

/** Each configured pair owns its progress. Bodies and destinations supply scene geometry. */
export function createAnimalFlows(runtime: MachineRuntime): RuntimeSystem[] {
  const machine = runtime.machine;
  const chase = (catId:string, mouseId:string, exitId:string, gateId?:string, enabled:()=>boolean=()=>true, standingPoint?:(x:number)=>{x:number;y:number}):RuntimeSystem => {
    let fleeing = false;
    return { afterStep() {
      const cat=machine.body(catId),mouse=machine.body(mouseId),exit=machine.body(exitId),gate=gateId?machine.body(gateId):null;
      if (!runtime.running || !enabled() || !cat || !mouse || !exit) return;
      if (Math.abs(mouse.position.y-cat.position.y)<35 && mouse.position.x>cat.position.x) fleeing=true;
      if (!fleeing) return;
      machine.setState(mouseId,"running"); machine.setState(catId,"running");
      const destination=exit.position.x-18;
      const closed=gate && !gate.isSensor;
      const mouseLimit=closed?Math.min(destination,gate.position.x-gadgetSize(machine.config(mouseId)!).width/2-12):destination;
      const catLimit=closed?Math.min(destination-75,gate.position.x-gadgetSize(machine.config(catId)!).width/2-62):destination-75;
      const mouseX=Math.min(mouseLimit,mouse.position.x+runtime.dt*.09),catX=Math.min(catLimit,cat.position.x+runtime.dt*.055);
      Matter.Body.setPosition(mouse,standingPoint?standingPoint(mouseX):{x:mouseX,y:mouse.position.y});
      Matter.Body.setPosition(cat,standingPoint?standingPoint(catX):{x:catX,y:cat.position.y});
      if (mouseX>=destination-25) { machine.setSignal(`mouse.entered.hole.${mouseId}`); machine.setSignal("mouse.entered.hole"); }
    } };
  };
  const systems:RuntimeSystem[]=(runtime.level.animalChases??[]).map(flow=>chase(flow.catId,flow.mouseId,flow.exitId,flow.gateId));
  for (const flow of runtime.level.catapults??[]) {
    let started=false, landed=false;
    const standingPoint=(x:number)=>{
      const platform=machine.body(flow.platformId)!;
      const size=gadgetSize(machine.config(flow.platformId)!),catSize=gadgetSize(machine.config(flow.catId)!);
      const local=inversePoint(bodyTransform(platform),{x,y:platform.position.y});
      return bodyPoint(platform,{x:local.x,y:-size.height/2-catSize.height/2-2});
    };
    systems.push({onCollision({bodyA,bodyB}) {
      const cat=machine.body(flow.catId),seesaw=machine.body(flow.seesawId),platform=machine.body(flow.platformId);
      if (!cat || !seesaw || !platform) return;
      const impact=bodyA===seesaw?bodyB:bodyB===seesaw?bodyA:null;
      if (!started && impact && !impact.isStatic && !impact.isSensor && machine.entities().find(entity=>entity.id===machinePlugin(impact)?.instanceId)?.tags.includes("falling-body")) {
        started=true;
        const mode=catapultImpactMode(impact.position.x,seesaw.position.x);
        machine.setState(flow.catId,"startled");
        if (mode==="launch") { Matter.Body.setPosition(cat,catapultReleasePosition(cat.position));Matter.Body.setVelocity(cat,catapultLaunchVelocity(impact.velocity.y)); }
      }
      if (started && !landed && ((bodyA===cat&&bodyB===platform)||(bodyB===cat&&bodyA===platform))) {
        landed=true;machine.setState(flow.catId,"idle");
        Matter.Body.setStatic(cat,true);Matter.Body.setPosition(cat,standingPoint(cat.position.x));Matter.Body.setAngle(cat,0);
      }
    }});
    systems.push(chase(flow.catId,flow.mouseId,flow.exitId,undefined,()=>landed,standingPoint));
  }
  for (const flow of runtime.level.fishChases??[]) systems.push({afterStep(){
    const cat=machine.body(flow.catId),fish=machine.body(flow.fishId);
    if (!runtime.running || !cat || !fish || !catSeesFish({catX:cat.position.x,catY:cat.position.y,fishX:fish.position.x,fishY:fish.position.y,fishVisible:machine.state(flow.fishId)?.state==="flopping"})) return;
    machine.setState(flow.catId,"running");
    Matter.Body.setPosition(cat,{x:advanceCatTowardFish(cat.position.x,fish.position.x,runtime.dt),y:cat.position.y});
    Matter.Body.setVelocity(cat,{x:0,y:cat.velocity.y});
    if (Math.abs(fish.position.x-cat.position.x)<=52) {machine.setSignal(`cat.reached.fish.${flow.catId}`);machine.setSignal("cat.reached.fish");}
  }});
  for (const flow of runtime.level.seesawLaunches??[]) {
    let launched=false;
    systems.push({onCollision({bodyA,bodyB}){
      const seesaw=[bodyA,bodyB].find(body=>machinePlugin(body)?.type==="seesaw"),impact=machine.body(flow.impactId),trigger=machine.body(flow.triggerId);
      if (launched || !seesaw || !impact || !trigger || ![bodyA,bodyB].includes(impact)) return;
      const transform=bodyTransform(seesaw),hit=inversePoint(transform,impact.position),payload=inversePoint(transform,trigger.position);
      if (hit.x>=0 || payload.x<=0) return;
      launched=true;
      Matter.Body.setVelocity(trigger,flow.velocity);
      machine.setSignal(`gate.trigger.launched.${flow.triggerId}`);machine.setSignal("gate.trigger.launched");
    }});
  }
  return systems;
}
