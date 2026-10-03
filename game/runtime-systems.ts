import Matter from "matter-js";
import { animalHasSupport, isAnimalFalling } from "./animals.ts";
import { createAnimalFlows } from "./runtime-animals.ts";
import { GADGET_CATALOG } from "../engine/gadget-catalog.ts";
import { bodyVector, bodyPoint, gadgetSize } from "../engine/gadget-geometry.ts";
import { machinePlugin } from "../engine/body-factory.ts";
import type { PhysicsEvent } from "../engine/physics-engine.ts";
import type { MachineRuntime, RuntimeCollision } from "./machine-runtime.ts";
import { createPulleySystem } from "./runtime-pulley.ts";
import { advanceWaterFlow } from "./water.ts";

export type RuntimeSystem = {
  onCollision?: (collision: RuntimeCollision) => void;
  onState?: (event: PhysicsEvent) => void;
  beforeStep?: () => void;
  afterStep?: () => void;
};

type SystemFactory = (runtime: MachineRuntime) => RuntimeSystem;
const bodyWithType = ({ bodyA, bodyB }: RuntimeCollision, label: string) => machinePlugin(bodyA)?.type === label ? bodyA : machinePlugin(bodyB)?.type === label ? bodyB : null;
function targetContactSystem(runtime:MachineRuntime,targetType:string,sourceType:string,signal:string):RuntimeSystem {
  const hits=new Map<string,number>();
  return {
    onCollision(collision) {
      const target=bodyWithType(collision,targetType);
      const source=target===collision.bodyA?collision.bodyB:collision.bodyA;
      if (!target || machinePlugin(source)?.type!==sourceType) return;
      const id=machinePlugin(target)!.instanceId;
      if (!hits.has(id))hits.set(id,runtime.machine.timeMs);
    },
    afterStep() {
      if (!runtime.running) return;
      for (const [id,at] of hits)if(runtime.machine.timeMs-at>520){runtime.machine.setSignal(`${signal}.${id}`);runtime.machine.setSignal(signal);}
    },
  };
}

const SYSTEM_FACTORIES: Readonly<Record<string, SystemFactory>> = {
  scissors:runtime=>({
    onState(event) {if(event.type==="state"&&event.state==="closed"&&runtime.machine.state(event.instanceId)?.type==="scissor")runtime.closeScissorById(event.instanceId);},
    afterStep() {if(runtime.running)for(const body of runtime.machine.bodiesByType("scissor")){const id=machinePlugin(body)!.instanceId;if(runtime.machine.state(id)?.state==="closed")runtime.closeScissorById(id);}},
  }),
  "gear-network":runtime=>({afterStep(){
    if(!runtime.running)return;
    for(const body of runtime.machine.bodiesByType("gearTarget")){const id=machinePlugin(body)!.instanceId;if(runtime.machine.state(id)?.state==="running"){runtime.machine.setSignal(`gear.network.complete.${id}`);runtime.machine.setSignal("gear.network.complete");}}
  }}),
  "animal-support":runtime=>({afterStep(){
    if(!runtime.running)return;
    for(const body of runtime.machine.bodiesByType("cat")){
      const state=runtime.machine.state(machinePlugin(body)!.instanceId)!;
      const falling=!body.isStatic&&isAnimalFalling(body.velocity.y,animalHasSupport(body,Matter.Composite.allBodies(runtime.matter.world)));
      if(falling&&!state.properties.fallStartedAt)state.properties.fallStartedAt=runtime.now;
      if(!falling)state.properties.fallStartedAt=0;
    }
  }}),
  cannon:runtime=>targetContactSystem(runtime,"cannonTarget","cannonball","cannonball.hit.target"),
  seesaw:runtime=>targetContactSystem(runtime,"basket","payloadBall","seesaw_payload.entered.basket"),
  fire:runtime=>({afterStep(){
    runtime.state.balloonPopped=runtime.machine.entities().some(entity=>entity.type==="balloon"&&entity.state==="popped");
    runtime.state.candleExtinguished=runtime.machine.entities().some(entity=>entity.type==="candle"&&entity.state==="extinguished");
  }}),

  "bucket-water": runtime => {
    const buckets = runtime.machine.bodiesByType("bucket").map(bucket => {
      const startAngle = bucket.angle;
      const size=gadgetSize(runtime.machine.config(machinePlugin(bucket)!.instanceId)!);
      const handle={x:34*size.width/76,y:-23*size.height/64};
      return { bucket, startAngle, handle, pivot: bodyPoint(bucket, handle) };
    });
    let startedAt:number|null=null;
    return { afterStep() {
      if (!runtime.running || !buckets.length) return;
      startedAt ??= runtime.machine.timeMs;
      runtime.state.bucketTipAt = startedAt;
      const tip = Math.max(0, Math.min(1, (runtime.machine.timeMs - startedAt) / 1900)), eased = tip * tip * (3 - 2 * tip);
      for (const { bucket, startAngle, pivot, handle } of buckets) {
        const plugin=machinePlugin(bucket),angle = startAngle + eased * 2.1 * (!!plugin?.flipX !== !!plugin?.flipY ? -1 : 1);
        Matter.Body.setAngle(bucket, angle); const offset=bodyVector(bucket,handle);
        Matter.Body.setPosition(bucket, { x: pivot.x - offset.x, y: pivot.y - offset.y });
        const id = machinePlugin(bucket)?.instanceId; if (id) runtime.machine.setState(id, tip >= 1 ? "empty" : "pouring");
      }
    } };
  },
  "water-collisions": runtime => ({
    onCollision(collision) {
      const water = bodyWithType(collision, "water");
      if (!water) return;
      if ([collision.bodyA,collision.bodyB].some(body=>body.label==="floor") && !runtime.waterSplashAt.has(water.id)) runtime.waterSplashAt.set(water.id, runtime.now || performance.now());
      const fuse = bodyWithType(collision, "fuse");
      if (fuse) {
        runtime.wetFuseIds.add(fuse.id);
      }
    },
    afterStep() {
      if (!runtime.running) return;
      if (runtime.machine.entities().some(entity=>entity.type==="candle"&&entity.state==="extinguished"&&(runtime.machine.stateAgeMs(entity.id)??0)>700)) {
        runtime.machine.setSignal("candle.extinguish.animation.complete");
      }
      advanceWaterFlow(runtime.bodies.water);
      for (const animal of [...runtime.machine.bodiesByType("cat"), ...runtime.machine.bodiesByType("mouse")]) {
        if (!animal) continue;
        let nearest: Matter.Body | null = null, distance = Infinity;
        for (const drop of runtime.bodies.water) { const candidate = Math.hypot(animal.position.x - drop.position.x, animal.position.y - drop.position.y); if (candidate < distance) { nearest = drop; distance = candidate; } }
        if (nearest && distance < 62) { const direction = animal.position.x < nearest.position.x ? -1 : 1; Matter.Body.setPosition(animal, { x: animal.position.x + direction * runtime.dt * .13, y: animal.position.y }); }
      }
    },
  }),
  "magnetic-field": runtime => ({
    beforeStep(){
      if(!runtime.running)return;
      const magnets=runtime.machine.bodiesByType("magnet");
      const shots=Matter.Composite.allBodies(runtime.matter.world).filter(body=>machinePlugin(body)?.type==="cannonball");
      for(const magnet of magnets)for(const shot of shots){
        const dx=magnet.position.x-shot.position.x,dy=magnet.position.y-shot.position.y,distance=Math.hypot(dx,dy);
        if(distance<12||distance>270||shot.position.x>magnet.position.x+35)continue;
        const strength=.003*(1-distance/270)*shot.mass;
        Matter.Body.applyForce(shot,shot.position,{x:dx/distance*strength,y:dy/distance*strength});
        const id=machinePlugin(magnet)?.instanceId;if(id)runtime.machine.setState(id,"running");
      }
    },
    afterStep(){
      for(const shot of Matter.Composite.allBodies(runtime.matter.world).filter(body=>machinePlugin(body)?.type==="cannonball")){
        const speed=Math.hypot(shot.velocity.x,shot.velocity.y);
        if(speed>19)Matter.Body.setVelocity(shot,{x:shot.velocity.x/speed*19,y:shot.velocity.y/speed*19});
      }
    },
  }),
  "snap-gate": runtime => ({
    onCollision(collision){
      const gate=[collision.bodyA,collision.bodyB].find(body=>machinePlugin(body)?.type==="snapGate");
      if(!gate)return;
      const projectile=gate===collision.bodyA?collision.bodyB:collision.bodyA;
      if(!["tennisBall","cannonball"].includes(machinePlugin(projectile)?.type ?? "")||projectile.speed<1.2)return;
      const id=machinePlugin(gate)?.instanceId;
      if(!id||runtime.machine.state(id)?.state==="open")return;
      runtime.machine.setState(id,"open");
      runtime.machine.setSignal("snapGate.opened");
    },
    afterStep(){
      for(const gate of runtime.machine.bodiesByType("snapGate")){
        const id=machinePlugin(gate)?.instanceId;
        if(id&&runtime.machine.state(id)?.state==="open"&&(runtime.machine.stateAgeMs(id)??0)>430&&!gate.isSensor){
          for(const part of gate.parts){part.isSensor=true;part.collisionFilter.mask=0}
          gate.isSensor=true;gate.collisionFilter.mask=0;
          for(const body of Matter.Composite.allBodies(runtime.matter.world)){
            if(body.isStatic||body===gate)continue;
            const closeToGate=Math.hypot(body.position.x-gate.position.x,body.position.y-gate.position.y)<100;
            if(closeToGate){Matter.Sleeping.set(body,false);Matter.Body.setVelocity(body,{x:body.velocity.x,y:Math.max(.8,body.velocity.y)})}
          }
        }
      }
    },
  }),
  "rocket-launch": runtime => ({
    onState(event) {
      if (event.type !== "state" || event.state !== "burning" || !event.instanceId || runtime.rocketIgnitedAt.has(event.instanceId)) return;
      if (runtime.bodies.rockets.some(body => machinePlugin(body)?.instanceId === event.instanceId)) runtime.rocketIgnitedAt.set(event.instanceId, runtime.now || performance.now());
    },

  }),
};

/** Intrinsic hooks are derived from definitions; only scene choreography uses level data. */
export function createRuntimeSystems(runtime: MachineRuntime): RuntimeSystem[] {
  const required = new Set(runtime.machine.entities().flatMap(entity=>GADGET_CATALOG[entity.type].mechanics ?? []));
  const systems = [...required].flatMap(id=>SYSTEM_FACTORIES[id] ? [SYSTEM_FACTORIES[id](runtime)] : []);
  if (runtime.level.loadRope) systems.push(createPulleySystem(runtime));
  systems.push(...createAnimalFlows(runtime));
  // Presentation summaries never drive a mechanism.
  systems.push({afterStep(){
    runtime.state.motor=runtime.machine.entities().some(entity=>entity.type==="conveyor"&&entity.state==="running");
    runtime.state.fishReleased=runtime.machine.entities().some(entity=>entity.type==="fish"&&entity.state==="flopping");
  }});
  return systems;
}
