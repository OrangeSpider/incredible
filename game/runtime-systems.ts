import Matter from "matter-js";
import { animalHasSupport, isAnimalFalling } from "./animals.ts";
import { advanceCatAndMouse, CATAPULT_MOUSE_HOLE_X, CATAPULT_PLATFORM, catapultImpactMode, catapultLaunchVelocity, catapultReleasePosition } from "./catapult.ts";
import { advanceCatTowardFish, catSeesFish } from "./fish.ts";
import { bodyVector, bodyPoint } from "../engine/gadget-geometry.ts";
import { ropePullIsTaut } from "./scissors.ts";
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
const hasPair = ({ bodyA, bodyB }: RuntimeCollision, left: string, right: string) =>
  (bodyA.label === left && bodyB.label === right) || (bodyA.label === right && bodyB.label === left);
const bodyWithLabel = ({ bodyA, bodyB }: RuntimeCollision, label: string) => bodyA.label === label ? bodyA : bodyB.label === label ? bodyB : null;
const movingImpact = ({ bodyA, bodyB }: RuntimeCollision) => [bodyA, bodyB].find(body => body.label === "ball" || body.label === "tennisBall") ?? null;

const SYSTEM_FACTORIES: Readonly<Record<string, SystemFactory>> = {
  "hamster-drive": runtime => ({
    onCollision(collision) {
      if (!runtime.options.beltConnected || runtime.state.motor || !bodyWithLabel(collision, "wheel")) return;
      if (!["ball", "tennisBall", "candle"].some(label => bodyWithLabel(collision, label))) return;
      runtime.state.motor = true; runtime.state.motorStartedAt = runtime.now || performance.now();
      const id = machinePlugin(bodyWithLabel(collision, "wheel")!)?.instanceId;
      if (id) runtime.machine.setState(id, "running");
    },
    onState(event) {
      if (event.type === "state" && event.instanceId === runtime.wheelInstanceId && event.state === "running" && !runtime.state.motor) {
        runtime.state.motor = true; runtime.state.motorStartedAt = runtime.now || performance.now();
      }
    },
    beforeStep() {
      const state = runtime.state;
      if (runtime.running && state.motor && runtime.options.beltConnected && !state.driveTransferred && runtime.wheelInstanceId && runtime.conveyorInstanceId) {
        runtime.machine.resolve(runtime.wheelInstanceId, runtime.conveyorInstanceId, "connection"); state.driveTransferred = true;
      }
    },
    afterStep() {
      const cat = runtime.bodies.cat, state = runtime.state;
      if (runtime.running && state.motor && cat) { const direction=runtime.bodies.conveyor?bodyVector(runtime.bodies.conveyor,{x:1,y:0}):{x:1,y:0},travel=(runtime.now-state.motorStartedAt)*.075; Matter.Body.setPosition(cat, { x: Math.max(30,Math.min(850,555+travel*direction.x)), y: 365+travel*direction.y }); }
    },
  }),
  fire: runtime => ({ afterStep() { runtime.state.balloonPopped = !!runtime.bodies.balloon && runtime.machine.state(machinePlugin(runtime.bodies.balloon)!.instanceId)?.state === "popped"; } }),
  "sharp-objects": runtime => ({
    onCollision(collision) {
      if (!hasPair(collision, "needle", "levelBalloon")) return;
      runtime.state.balloonPopped = true;
      const id = runtime.bodies.balloon && machinePlugin(runtime.bodies.balloon)?.instanceId;
      if (id) runtime.machine.setState(id, "popped");
    },
  }),
  "pulley-rope": createPulleySystem,
  "cat-mouse": runtime => ({
    afterStep() {
      if (!runtime.running || runtime.level.systems.includes("catapult") || runtime.level.systems.includes("cat-fish")) return;
      const cat = runtime.bodies.cat, mouse = runtime.bodies.mouse, state = runtime.state;
      if (!cat || !mouse) return;
      if (!state.mouseFleeAt && Math.abs(mouse.position.y - cat.position.y) < 35 && mouse.position.x > cat.position.x) state.mouseFleeAt = runtime.now;
      if (state.mouseFleeAt) {
        const mouseId = machinePlugin(mouse)?.instanceId;
        if (mouseId) runtime.machine.setState(mouseId, "running");
        const gate = runtime.machine.bodiesByType("snapGate")[0];
        const gateId = gate && machinePlugin(gate)?.instanceId;
        const gateClosed = !!gate && !!gateId && !gate.isSensor;
        const mouseLimit = gateClosed ? Math.min(835, gate.position.x - 34) : 835;
        const catLimit = gateClosed ? Math.min(760, gate.position.x - 92) : 760;
        Matter.Body.setPosition(mouse, { x: Math.min(mouseLimit, mouse.position.x + runtime.dt * .09), y: mouse.position.y });
        Matter.Body.setPosition(cat, { x: Math.min(catLimit, cat.position.x + runtime.dt * .055), y: cat.position.y });
        if (mouse.position.x >= 810) runtime.machine.setSignal("mouse.entered.hole");
      }
    },
  }),
  "animal-support": runtime => ({
    afterStep() {
      const cat = runtime.bodies.cat;
      const hasSupport = !!cat && animalHasSupport(cat, Matter.Composite.allBodies(runtime.matter.world));
      const falling = !!cat && runtime.running && !cat.isStatic && isAnimalFalling(cat.velocity.y, hasSupport);
      if (falling && !runtime.state.catFallStartedAt) runtime.state.catFallStartedAt = runtime.now;
      else if (!falling) runtime.state.catFallStartedAt = 0;
    },
  }),
  "gear-network": runtime => ({
    afterStep() {
      if (!runtime.running || !runtime.options.gearsConnected) return;
      if (!runtime.state.gearTurnAt) runtime.state.gearTurnAt = runtime.now;
      if (runtime.now - runtime.state.gearTurnAt > 1100) {
        runtime.machine.setState("target-gear", "running");
        runtime.machine.setSignal("gear.network.complete");
      }
    },
  }),
  seesaw: runtime => ({
    onCollision(collision) {
      if (hasPair(collision, "seesawBasket", "seesawPayload") && !runtime.state.seesawHitAt) {
        runtime.state.seesawHitAt = runtime.now || performance.now();
      }
    },
    afterStep() {
      if (runtime.state.seesawHitAt && runtime.now - runtime.state.seesawHitAt > 450) {
        runtime.machine.setSignal("seesaw_payload.entered.basket");
      }
    },
  }),
  catapult: runtime => ({
    onCollision(collision) {
      const cat = runtime.bodies.cat, seesaw = runtime.bodies.seesaw, impact = movingImpact(collision), state = runtime.state;
      if (cat && seesaw && impact && bodyWithLabel(collision, "seesaw") && !state.catStartledAt) {
        state.catStartledAt = runtime.now || performance.now(); state.catImpactMode = catapultImpactMode(impact.position.x, seesaw.position.x);
        if (state.catImpactMode === "launch") { Matter.Body.setPosition(cat, catapultReleasePosition(cat.position)); Matter.Body.setVelocity(cat, catapultLaunchVelocity(impact.velocity.y)); }
      }
      if (cat && hasPair(collision, "cat", "catapultPlatform") && state.catStartledAt && !state.catOnPlatformAt) {
        state.catOnPlatformAt = runtime.now || performance.now(); Matter.Body.setStatic(cat, true);
        Matter.Body.setPosition(cat, { x: Math.max(540, Math.min(680, cat.position.x)), y: CATAPULT_PLATFORM.animalY }); Matter.Body.setAngle(cat, 0);
      }
    },
    afterStep() {
      const cat = runtime.bodies.cat, mouse = runtime.bodies.mouse;
      if (!runtime.running || !runtime.state.catOnPlatformAt || !cat || !mouse) return;
      const next = advanceCatAndMouse(cat.position.x, mouse.position.x, runtime.dt);
      const mouseId = machinePlugin(mouse)?.instanceId;
      if (mouseId) runtime.machine.setState(mouseId, "running");
      Matter.Body.setPosition(cat, { x: next.catX, y: CATAPULT_PLATFORM.animalY });
      Matter.Body.setPosition(mouse, { x: next.mouseX, y: CATAPULT_PLATFORM.animalY });
      if (next.mouseX >= CATAPULT_MOUSE_HOLE_X) runtime.machine.setSignal("mouse.entered.hole");
    },
  }),
  "breakable-container": runtime => ({
    afterStep() {
      const state = runtime.machine.state("fish-bowl")?.state;
      if (["breaking", "broken"].includes(state ?? "") && !runtime.state.fishBowlBrokenAt) runtime.state.fishBowlBrokenAt = runtime.now || 1;
    },
  }),
  "fish-release": runtime => ({
    afterStep() { runtime.state.fishReleased = runtime.machine.state("mr-blue")?.state === "flopping"; },
  }),
  "cat-fish": runtime => ({
    afterStep() {
      const cat = runtime.bodies.cat, fish = runtime.bodies.fish;
      if (!runtime.running || !cat || !fish || !catSeesFish({ catX: cat.position.x, catY: cat.position.y, fishX: fish.position.x, fishY: fish.position.y, fishVisible: runtime.state.fishReleased })) return;
      if (!runtime.state.fishChaseAt) runtime.state.fishChaseAt = runtime.now;
      Matter.Body.setPosition(cat, { x: advanceCatTowardFish(cat.position.x, fish.position.x, runtime.dt), y: cat.position.y });
      Matter.Body.setVelocity(cat, { x: 0, y: cat.velocity.y });
      if (Math.abs(fish.position.x - cat.position.x) <= 52) runtime.machine.setSignal("cat.reached.fish");
    },
  }),
  scissors: runtime => ({
    onState(event) {
      if (event.type === "state" && event.state === "closed" && runtime.machine.state(event.instanceId)?.type === "scissor") runtime.closeScissorById(event.instanceId);
    },
    beforeStep() {
      if (!runtime.running) return;
      for (const connection of runtime.options.scissorConnections) {
        if (!runtime.scissorClosedAt[connection.scissorIndex] && ropePullIsTaut(connection.anchor, connection.pullBody.position, connection.pullBody.velocity, connection.restLength)) runtime.closeScissor(connection.scissorIndex);
      }
    },
    afterStep() {
      if (!runtime.running) return;
      runtime.bodies.scissorBalloons.forEach((balloon, index) => { if (runtime.scissorClosedAt[index]) Matter.Body.applyForce(balloon, balloon.position, { x: 0, y: -.00032 }); });
    },
  }),
  "bucket-water": runtime => {
    const buckets = [...new Set([...(runtime.bodies.bucket ? [runtime.bodies.bucket] : []), ...runtime.machine.bodiesByType("bucket")])].map(bucket => {
      const startAngle = bucket.angle;
      return { bucket, startAngle, pivot: bodyPoint(bucket, {x:34,y:-23}) };
    });
    return { afterStep() {
      if (!runtime.running || !buckets.length) return;
      if (!runtime.state.bucketTipAt) runtime.state.bucketTipAt = runtime.now;
      const tip = Math.max(0, Math.min(1, (runtime.now - runtime.state.bucketTipAt) / 1900)), eased = tip * tip * (3 - 2 * tip);
      for (const { bucket, startAngle, pivot } of buckets) {
        const plugin=machinePlugin(bucket),angle = startAngle + eased * 2.1 * (!!plugin?.flipX !== !!plugin?.flipY ? -1 : 1);
        Matter.Body.setAngle(bucket, angle); const offset=bodyVector(bucket,{x:34,y:-23});
        Matter.Body.setPosition(bucket, { x: pivot.x - offset.x, y: pivot.y - offset.y });
        const id = machinePlugin(bucket)?.instanceId; if (id) runtime.machine.setState(id, tip >= 1 ? "empty" : "pouring");
      }
    } };
  },
  "water-collisions": runtime => ({
    onCollision(collision) {
      const water = bodyWithLabel(collision, "water");
      if (!water) return;
      if (bodyWithLabel(collision, "floor") && !runtime.waterSplashAt.has(water.id)) runtime.waterSplashAt.set(water.id, runtime.now || performance.now());
      const candle = bodyWithLabel(collision, "candle");
      if (candle && !runtime.state.candleExtinguished) {
        runtime.state.candleWetHits++;
        if (runtime.state.candleWetHits >= 1) {
          runtime.state.candleExtinguished = true; runtime.state.candleExtinguishedAt = runtime.now || performance.now();
          const id = machinePlugin(candle)?.instanceId; if (id) runtime.machine.setState(id, "extinguished");
        }
      }
      const fuse = bodyWithLabel(collision, "fuse");
      if (fuse) {
        runtime.wetFuseIds.add(fuse.id);
      }
    },
    afterStep() {
      if (!runtime.running) return;
      if (runtime.state.candleExtinguishedAt && runtime.now - runtime.state.candleExtinguishedAt > 700) {
        runtime.machine.setSignal("candle.extinguish.animation.complete");
      }
      advanceWaterFlow(runtime.bodies.water);
      for (const animal of [runtime.bodies.cat, runtime.bodies.mouse]) {
        if (!animal) continue;
        let nearest: Matter.Body | null = null, distance = Infinity;
        for (const drop of runtime.bodies.water) { const candidate = Math.hypot(animal.position.x - drop.position.x, animal.position.y - drop.position.y); if (candidate < distance) { nearest = drop; distance = candidate; } }
        if (nearest && distance < 62) { const direction = animal.position.x < nearest.position.x ? -1 : 1; Matter.Body.setPosition(animal, { x: Math.max(30, Math.min(870, animal.position.x + direction * runtime.dt * .13)), y: animal.position.y }); }
      }
    },
  }),
  cannon: runtime => ({
    onCollision(collision) {
      if (hasPair(collision, "cannonball", "cannonTarget") && !runtime.state.cannonHitAt) {
        runtime.state.cannonHitAt = runtime.now || performance.now();
      }
    },
    afterStep() {
      if (runtime.state.cannonHitAt && runtime.now - runtime.state.cannonHitAt > 520) {
        runtime.machine.setSignal("cannonball.hit.target");
      }
    },
  }),
  "magnetic-field": runtime => ({
    beforeStep(){
      if(!runtime.running)return;
      const magnets=runtime.machine.bodiesByType("magnet");
      const shots=Matter.Composite.allBodies(runtime.matter.world).filter(body=>body.label==="cannonball");
      for(const magnet of magnets)for(const shot of shots){
        const dx=magnet.position.x-shot.position.x,dy=magnet.position.y-shot.position.y,distance=Math.hypot(dx,dy);
        if(distance<12||distance>270||shot.position.x>magnet.position.x+35)continue;
        const strength=.003*(1-distance/270)*shot.mass;
        Matter.Body.applyForce(shot,shot.position,{x:dx/distance*strength,y:dy/distance*strength});
        const id=machinePlugin(magnet)?.instanceId;if(id)runtime.machine.setState(id,"running");
      }
    },
    afterStep(){
      for(const shot of Matter.Composite.allBodies(runtime.matter.world).filter(body=>body.label==="cannonball")){
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
      if(!["tennisBall","cannonball"].includes(projectile.label)||projectile.speed<1.2)return;
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
  "seesaw-launch": runtime => {
    let launched=false;
    const trigger=runtime.machine.body("gate-trigger");
    return {
      onCollision(collision){
        if(launched||!trigger)return;
        const seesaw=bodyWithLabel(collision,"seesaw");
        const impact=[collision.bodyA,collision.bodyB].find(body=>body.label==="ball");
        if(!seesaw||!impact||impact.position.x>=seesaw.position.x||trigger.position.x<=seesaw.position.x)return;
        launched=true;
        Matter.Body.setVelocity(trigger,{x:8,y:-11});
        runtime.machine.setSignal("gate.trigger.launched");
      },
    };
  },
  "rocket-launch": runtime => ({
    onState(event) {
      if (event.type !== "state" || event.state !== "burning" || !event.instanceId || runtime.rocketIgnitedAt.has(event.instanceId)) return;
      if (runtime.bodies.rockets.some(body => machinePlugin(body)?.instanceId === event.instanceId)) runtime.rocketIgnitedAt.set(event.instanceId, runtime.now || performance.now());
    },

  }),
};

export function createRuntimeSystems(capabilities: readonly string[], runtime: MachineRuntime): RuntimeSystem[] {
  return capabilities.flatMap(capability => {
    const factory = SYSTEM_FACTORIES[capability];
    return factory ? [factory(runtime)] : [];
  });
}
