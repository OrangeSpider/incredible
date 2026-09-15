import Matter from "matter-js";
import { animalHasSupport, isAnimalFalling } from "./animals.ts";
import { advanceCatAndMouse, CATAPULT_MOUSE_HOLE_X, CATAPULT_PLATFORM, catapultImpactMode, catapultLaunchVelocity, catapultReleasePosition } from "./catapult.ts";
import { advanceCatTowardFish, catSeesFish, FISH_REVEAL_DELAY_MS, fishbowlBreaks } from "./fish.ts";
import { nextRocketState } from "./rocket.ts";
import { applySeesawImpact, limitSeesawRotation } from "./seesaw.ts";
import { ropePullIsTaut, scissorClosesFromImpact } from "./scissors.ts";
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
      if (runtime.running && state.motor && cat) Matter.Body.setPosition(cat, { x: Math.min(850, 555 + (runtime.now - state.motorStartedAt) * .075), y: 365 });
    },
  }),
  "fan-airflow": runtime => ({
    afterStep() {
      const balloon = runtime.bodies.balloon;
      if (!runtime.running || !balloon || runtime.state.balloonPopped) return;
      for (const fan of Matter.Composite.allBodies(runtime.matter.world).filter(body => body.label === "fan")) {
        const dx = balloon.position.x - fan.position.x, dy = balloon.position.y - fan.position.y, c = Math.cos(fan.angle), s = Math.sin(fan.angle);
        const forward = dx * c + dy * s, side = -dx * s + dy * c;
        if (forward > 0 && forward < 420 && Math.abs(side) < 100 + forward * .3) {
          const force = .00035 * (1 - forward / 420);
          Matter.Body.applyForce(balloon, balloon.position, { x: c * force, y: s * force });
        }
      }
    },
  }),
  fire: runtime => ({
    onCollision(collision) {
      if (!hasPair(collision, "candle", "levelBalloon") || runtime.state.candleExtinguished) return;
      runtime.state.balloonPopped = true;
      const id = runtime.bodies.balloon && machinePlugin(runtime.bodies.balloon)?.instanceId;
      if (id) runtime.machine.setState(id, "popped");
    },
  }),
  "sharp-objects": runtime => ({
    onCollision(collision) {
      if (!hasPair(collision, "needle", "levelBalloon")) return;
      runtime.state.balloonPopped = true;
      const id = runtime.bodies.balloon && machinePlugin(runtime.bodies.balloon)?.instanceId;
      if (id) runtime.machine.setState(id, "popped");
    },
  }),
  trampoline: runtime => ({
    onCollision(collision) {
      const trampoline = bodyWithLabel(collision, "trampoline");
      const ball = [collision.bodyA,collision.bodyB].find(body => ["levelBall","ball","tennisBall"].includes(body.label));
      if (ball && trampoline && !ball.isStatic && ball.position.y < trampoline.position.y) {
        const strength = ball.label === "tennisBall" ? 11 : 20;
        Matter.Body.setVelocity(ball, { x: Math.sin(trampoline.angle) * strength, y: -Math.abs(Math.cos(trampoline.angle)) * strength });
      }
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
      const seesaw = runtime.bodies.seesaw, impact = movingImpact(collision);
      if (runtime.level.systems.includes("catapult") || !seesaw || !impact || !bodyWithLabel(collision, "seesaw")) return;
      applySeesawImpact(runtime.matter, seesaw, impact);
    },
    afterStep() {
      if (runtime.running && runtime.bodies.seesaw) limitSeesawRotation(runtime.bodies.seesaw);
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
        applySeesawImpact(runtime.matter, seesaw, impact);
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
    onCollision(collision) {
      const bowl = runtime.bodies.fishBowl, fish = runtime.bodies.fish;
      if (!bowl || !fish || runtime.state.fishBowlBrokenAt || !bodyWithLabel(collision, "fishbowl")) return;
      const impact = collision.bodyA.label === "fishbowl" ? collision.bodyB : collision.bodyA;
      if (fishbowlBreaks(impact.velocity.y, !impact.isStatic)) {
        runtime.state.fishBowlBrokenAt = runtime.now || performance.now(); bowl.isSensor = true; runtime.machine.setState("fish-bowl", "breaking");
      }
    },
  }),
  "fish-release": runtime => ({
    afterStep() {
      const state = runtime.state, bowl = runtime.bodies.fishBowl, fish = runtime.bodies.fish;
      if (!runtime.running || !bowl || !fish) return;
      if (state.fishBowlBrokenAt && !state.fishReleased && runtime.now - state.fishBowlBrokenAt >= FISH_REVEAL_DELAY_MS) {
        state.fishReleased = true; runtime.machine.setState("fish-bowl", "broken"); runtime.machine.setState("mr-blue", "flopping");
        Matter.Body.setPosition(fish, { x: bowl.position.x, y: bowl.position.y + 12 }); Matter.Body.setStatic(fish, false); fish.isSensor = false;
        Matter.Body.setVelocity(fish, { x: 0, y: 1.5 });
      }
      if (state.fishReleased && fish.position.y > 455 && runtime.now - state.fishFlopAt > 520) {
        state.fishFlopAt = runtime.now; Matter.Body.setVelocity(fish, { x: Math.sin(runtime.now * .011) * .38, y: -1.35 });
      }
    },
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
    onCollision(collision) {
      const scissor = [collision.bodyA, collision.bodyB].find(body => machinePlugin(body)?.type === "scissor");
      if (!scissor) return;
      const impact = scissor === collision.bodyA ? collision.bodyB : collision.bodyA;
      const id = machinePlugin(scissor)?.instanceId;
      if (id && ["ball", "tennisBall"].includes(impact.label) && impact.position.y < scissor.position.y && scissorClosesFromImpact(Math.max(impact.velocity.y, impact.speed), !impact.isStatic)) runtime.closeScissorById(id);
    },
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
    const bucket = runtime.bodies.bucket, startAngle = bucket?.angle ?? 0;
    const start = bucket ? { ...bucket.position } : null;
    const pivot = start ? { x: start.x + Math.cos(startAngle) * 34 - Math.sin(startAngle) * -23, y: start.y + Math.sin(startAngle) * 34 + Math.cos(startAngle) * -23 } : null;
    return { afterStep() {
      if (!runtime.running || !bucket || !pivot) return;
      if (!runtime.state.bucketTipAt) runtime.state.bucketTipAt = runtime.now;
      const tip = Math.max(0, Math.min(1, (runtime.now - runtime.state.bucketTipAt) / 1900)), eased = tip * tip * (3 - 2 * tip), angle = startAngle + eased * 2.1;
      const rotatedX = Math.cos(angle) * 34 - Math.sin(angle) * -23, rotatedY = Math.sin(angle) * 34 + Math.cos(angle) * -23;
      Matter.Body.setPosition(bucket, { x: pivot.x - rotatedX, y: pivot.y - rotatedY }); Matter.Body.setAngle(bucket, angle);
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
        runtime.wetFuseIds.add(fuse.id); const id = machinePlugin(fuse)?.instanceId;
        if (id) runtime.machine.setState(id, "extinguished");
        if (runtime.state.fuseIgnited && !runtime.state.fuseExtinguishedAt) runtime.state.fuseExtinguishedAt = runtime.now || performance.now();
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
  "fuse-network": runtime => ({
    afterStep() {
      const state = runtime.state, network = runtime.options.fuseNetwork;
      if (!runtime.running || state.fuseExtinguishedAt) return;
      state.fuseClock += runtime.dt; network.igniteNear({ x: 102, y: 366 }, 30, state.fuseClock); network.update(state.fuseClock);
      state.fuseIgnited = network.hasAnyBurned(state.fuseClock); state.fuseReady = network.burnTimeAt(runtime.options.cannonFuseId, 0) < Infinity;
      const cannon = runtime.bodies.cannon;
      if (!cannon || state.cannonFired || !network.hasBurnedEnd(runtime.options.cannonFuseId, state.fuseClock)) return;
      state.cannonFired = true; state.cannonFiredAt = runtime.now;
      const id = machinePlugin(cannon)?.instanceId; if (id) runtime.machine.setState(id, "firing");
      const direction = { x: Math.cos(cannon.angle), y: Math.sin(cannon.angle) };
      const shot = Matter.Bodies.circle(cannon.position.x + direction.x * 58, cannon.position.y + direction.y * 58, 11, { density: .0025, restitution: .3, label: "cannonball" });
      Matter.Body.setVelocity(shot, { x: direction.x * 14, y: direction.y * 14 }); Matter.Composite.add(runtime.matter.world, shot);
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
  "single-scissor": runtime => {
    const scissorConfig=runtime.level.fixedGadgets.find(gadget=>gadget.type==="scissor");
    const balloonId=String(scissorConfig?.properties?.balloon??"");
    return {onCollision(collision){
      const scissor=[collision.bodyA,collision.bodyB].find(body=>machinePlugin(body)?.type==="scissor");
      const impact=scissor==collision.bodyA?collision.bodyB:collision.bodyA;
      if(!scissor||!["ball","tennisBall"].includes(impact.label)||impact.isStatic||impact.position.y>=scissor.position.y||impact.velocity.y<1.5)return;
      const scissorId=machinePlugin(scissor)?.instanceId;
      if(!scissorId||runtime.machine.state(scissorId)?.state==="closed")return;
      runtime.machine.setState(scissorId,"closed");
      runtime.machine.setState(balloonId,"free");
      runtime.machine.release(balloonId,{x:0,y:-1.2});
    }};
  },
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
        applySeesawImpact(runtime.matter,seesaw,impact);
        Matter.Body.setVelocity(trigger,{x:8,y:-11});
        runtime.machine.setSignal("gate.trigger.launched");
      },
      afterStep(){if(runtime.running&&runtime.bodies.seesaw)limitSeesawRotation(runtime.bodies.seesaw)},
    };
  },
  "rocket-launch": runtime => ({
    onState(event) {
      if (event.type !== "state" || event.state !== "burning" || !event.instanceId || runtime.rocketIgnitedAt.has(event.instanceId)) return;
      if (runtime.bodies.rockets.some(body => machinePlugin(body)?.instanceId === event.instanceId)) runtime.rocketIgnitedAt.set(event.instanceId, runtime.now || performance.now());
    },
    afterStep() {
      if (!runtime.running) return;
      for (const rocket of runtime.bodies.rockets) {
        const id = machinePlugin(rocket)?.instanceId; if (!id) continue;
        const state = runtime.machine.state(id)?.state ?? "mounted", next = nextRocketState(state, runtime.rocketIgnitedAt.get(id), runtime.now);
        if (next !== state) runtime.machine.setState(id, next);
      }
    },
  }),
};

export function createRuntimeSystems(capabilities: readonly string[], runtime: MachineRuntime): RuntimeSystem[] {
  return capabilities.flatMap(capability => {
    const factory = SYSTEM_FACTORIES[capability];
    return factory ? [factory(runtime)] : [];
  });
}
