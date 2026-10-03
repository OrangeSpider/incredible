import Matter from "matter-js";
import type { MachinePhysicsEngine } from "./physics-engine.ts";
import { GADGET_CATALOG } from "./gadget-catalog.ts";
import { machinePlugin } from "./body-factory.ts";
import { type Point } from "../game/control-ropes.ts";
import { gadgetPorts, connectionPorts, validateConnections } from "../game/gadget-connections.ts";
import { airflowAt, AIRFLOW_ACCELERATION } from "../game/airflow.ts";
import { applySeesawImpact, limitSeesawRotation } from "../game/seesaw.ts";
import { FuseNetwork } from "../game/fuse.ts";
import { bodyPoint, bodyVector, bodyTransform, inversePoint, candleFlameLocal, rocketNozzleLocal } from "./gadget-geometry.ts";
import { FISH_REVEAL_DELAY_MS } from "../game/fish.ts";
import { rocketVisual, ROCKET_IGNITION_MS, ROCKET_TOTAL_LAUNCH_MS } from "../game/rocket.ts";

export type LightField = Point & { id: string; radius: number; angle?: number; intensity: number };
export type Focus = { lensId: string; lens: Point; point: Point; intensity: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const local = bodyPoint;

/** Shared gadget behavior; all geometry is independent of scene names and level numbers. */
export class GadgetMechanics {
  readonly machine: MachinePhysicsEngine;
  lights: LightField[] = [];
  focuses: Focus[] = [];
  rocketFlames: Point[] = [];
  private readonly heat = new Map<string, number>();
  private readonly punches = new Map<string, Set<number>>();
  private readonly velocities = new Map<number, Point>();
  private network: FuseNetwork | null = null;
  private fuseIds = "";
  private readonly bowlFish = new Map<string, string>();
  private readonly rocketStarted = new Map<string, number>();
  private readonly fishFlop = new Map<string, number>();
  private readonly cannonShots = new Set<string>();
  private beltDriven = new Set<string>();

  private containers() {
    const machine = this.machine;
    for (const bowl of machine.bodiesByType("fishBowl")) {
      const id = machinePlugin(bowl)!.instanceId;
      if (!this.bowlFish.has(id)) {
        const config = machine.config(id)!;
        const specified = config.properties?.fishId;
        const existing = typeof specified === "string" ? machine.body(specified) : null;
        if (specified && (!existing || machine.state(String(specified))?.type !== "fish" || [...this.bowlFish.values()].includes(String(specified)))) throw new Error(`Invalid fish relation: ${id}`);
        const fishId = existing ? machinePlugin(existing)!.instanceId : `${id}:fish`;
        const fish = existing ?? machine.addGadget({ id: fishId, type: "fish", ...bowl.position, state: "hidden", properties: { bowlId: id } })!;
        if (machine.state(fishId)?.state === "hidden") { Matter.Body.setStatic(fish, true); fish.isSensor = true; fish.collisionFilter.mask = 0; }
        this.bowlFish.set(id, fishId);
      }
      const fishId = this.bowlFish.get(id)!, fish = machine.body(fishId)!;
      const bowlState = machine.state(id)?.state;
      if (bowlState === "breaking" || bowlState === "broken") { bowl.isSensor = true; bowl.collisionFilter.mask = 0; }
      if ((bowlState === "breaking" && (machine.stateAgeMs(id) ?? 0) >= FISH_REVEAL_DELAY_MS) || (bowlState === "broken" && machine.state(fishId)?.state === "hidden")) {
        machine.setState(id, "broken");
        Matter.Body.setPosition(fish, local(bowl, { x: 0, y: 12 }));
        Matter.Body.setStatic(fish, false); fish.isSensor = false; fish.collisionFilter.mask = 0xffffffff;
        machine.setState(fishId, "flopping"); Matter.Body.setVelocity(fish, { x: 0, y: 1.5 });
      }
      if (machine.state(fishId)?.state === "flopping" && fish.speed < 1.8 && machine.timeMs - (this.fishFlop.get(fishId) ?? 0) > 520) {
        this.fishFlop.set(fishId, machine.timeMs); Matter.Body.setVelocity(fish, { x: Math.sin(machine.timeMs * .011) * .38, y: -1.35 });
      }
    }
  }

  constructor(machine: MachinePhysicsEngine) { this.machine = machine; }

  private obstacles() {
    return this.machine.entities().filter(entity => ["stoneWall", "woodWall", "steelBeam", "ramp"].includes(entity.type)).flatMap(entity => {
      const body = this.machine.body(entity.id); return body ? [body] : [];
    });
  }

  private strike(body: Matter.Body, velocity: Point) {
    const id = machinePlugin(body)?.instanceId, type = machinePlugin(body)?.type;
    if (type === "generator" && id && Math.hypot(velocity.x, velocity.y) >= (this.machine.physical(id)?.impactThreshold ?? 1)) {
      this.machine.state(id)!.properties.switchedOn = true;
      this.machine.setState(id, "running"); this.machine.setSignal(`generator.started.${id}`);
    }
    if (!body.isStatic && !body.isSensor) Matter.Body.setVelocity(body, { x: body.velocity.x + velocity.x, y: body.velocity.y + velocity.y });
  }

  private breakBowl(body: Matter.Body) {
    const id = machinePlugin(body)!.instanceId;
    if (this.machine.state(id)?.state !== "intact") return;
    body.isSensor = true; body.collisionFilter.mask = 0;
    this.machine.setState(id, "breaking");
    this.machine.setSignal("fishBowl.broken");
    this.machine.setSignal(`fishBowl.broken.${id}`);
  }

  collision(a: Matter.Body, b: Matter.Body) {
    for (const [device, impact] of [[a, b], [b, a]]) {
      const plugin = machinePlugin(device); if (!plugin || impact.isStatic || impact.isSensor) continue;
      const state = this.machine.state(plugin.instanceId)!;
      const movement = this.velocities.get(impact.id) ?? impact.velocity;
      if (plugin.type === "seesaw" && GADGET_CATALOG[machinePlugin(impact)?.type ?? "water"].tags.includes("falling-body") && Math.hypot(movement.x, movement.y) >= 1) applySeesawImpact(this.machine.matter, device, impact);
      const speed = Math.max(impact.speed, Math.hypot(movement.x, movement.y));
      if (plugin.type === "fishBowl" && state.state === "intact" && impact.position.y < device.position.y && movement.y >= Number(this.machine.config(plugin.instanceId)?.physics?.impactThreshold ?? GADGET_CATALOG[plugin.type].physics.impactThreshold ?? 4.5)) {
        this.breakBowl(device);
      }
      if (plugin.type === "generator") this.strike(device, { x: speed, y: 0 });
      if (speed < .8) continue;
      const button = GADGET_CATALOG[plugin.type].electrical?.switch;
      if (button && state.state === "off") {
        const point = local(device, button), normal = bodyVector(device, { x: 0, y: 1 });
        const offset = { x: impact.position.x - point.x, y: impact.position.y - point.y };
        const radius = Math.max(impact.circleRadius || 0, (impact.bounds.max.x - impact.bounds.min.x) / 2);
        if (offset.x * normal.x + offset.y * normal.y < 0 && Math.abs(offset.x * normal.y - offset.y * normal.x) < radius + 9) {
          this.machine.setState(plugin.instanceId, GADGET_CATALOG[plugin.type].electrical!.activeState); this.machine.setSignal(`switch.pressed.${plugin.instanceId}`);
        }
      }
      if (plugin.type === "detonator" && state.state === "ready") {
        const point = local(device, { x: 0, y: -36 }), normal = bodyVector(device, { x: 0, y: 1 });
        if ((impact.position.x - point.x) * normal.x + (impact.position.y - point.y) * normal.y < 0 && movement.x * normal.x + movement.y * normal.y > .4) {
          this.machine.setState(plugin.instanceId, "spent"); this.machine.setSignal(`detonator.spark.${plugin.instanceId}`);
        }
      }
      if (plugin.type === "boxingGlove" && state.state === "ready") {
        const direction = bodyVector(device, { x: 1, y: 0 }), c = direction.x, s = direction.y, dx = impact.position.x - device.position.x, dy = impact.position.y - device.position.y;
        if (dx * c + dy * s < -20 && Math.abs(-dx * s + dy * c) < 38) {
          this.machine.setState(plugin.instanceId, "spent"); this.machine.setSignal(`glove.punched.${plugin.instanceId}`);
          this.punches.set(plugin.instanceId, new Set());
        }
      }
    }
  }

  connectionPoints(id: string) {
    const connection = this.machine.connections.find(item => item.id === id); if (!connection) return [];
    const configs = this.machine.entities().map(entity => ({ ...this.machine.config(entity.id)!, x: entity.x, y: entity.y, rotation: this.machine.body(entity.id)?.angle ?? 0 }));
    return connectionPorts(connection, gadgetPorts(configs));
  }

  beforeStep(dt: number) {
    this.containers();
    for (const plank of this.machine.bodiesByType("seesaw")) limitSeesawRotation(plank);
    const machine = this.machine, entities = machine.entities(), obstacles = this.obstacles();
    validateConnections(machine.connections,entities.map(entity=>machine.config(entity.id)!));
    for (const entity of entities.filter(entity => entity.type === "generator")) {
      const state = machine.state(entity.id)!;
      if (state.state === "running" && !this.beltDriven.has(entity.id)) state.properties.switchedOn = true;
    }
    for (const body of Matter.Composite.allBodies(machine.world)) this.velocities.set(body.id, { ...body.velocity });
    for (const entity of entities) {
      const supply = GADGET_CATALOG[entity.type].electrical?.supply;
      if (supply !== "socket") continue;
      const powered = machine.connections.some(connection => connection.kind === "wire" && connection.targetId === entity.id && machine.state(connection.sourceId)?.type === "generator" && machine.state(connection.sourceId)?.state === "running");
      machine.setState(entity.id, powered ? GADGET_CATALOG[entity.type].electrical!.activeState : "off");
    }
    const fans = entities.filter(entity => GADGET_CATALOG[entity.type].tags.includes("air-source") && machine.state(entity.id)?.state === GADGET_CATALOG[entity.type].electrical?.activeState);
    for (const entity of entities) {
      const body = machine.body(entity.id); if (!body) continue;
      const wind = fans.reduce((sum, fan) => sum + airflowAt(machine.body(fan.id)!, body.position, obstacles), 0);
      if (entity.type === "windmill") { machine.state(entity.id)!.properties.selfDriven=wind>.03;machine.setState(entity.id, wind > .03 ? "running" : "idle"); Matter.Body.setAngularVelocity(body,wind*.12); machine.setSignal(`windmill.rotation.${entity.id}`, wind * .12); }
      if (entity.type === "windmill" || GADGET_CATALOG[entity.type].tags.includes("air-source")) {
        const state = machine.state(entity.id)!;
        const speed = state.state === (GADGET_CATALOG[entity.type].electrical?.activeState ?? "running") ? entity.type === "windmill" ? wind * .0072 : .018 : 0;
        state.properties.rotorAngle = (Number(state.properties.rotorAngle ?? 0) + speed * dt) % (Math.PI * 2);
      }
      if (!body.isStatic && !body.isSensor && GADGET_CATALOG[entity.type].tags.some(tag => tag === "buoyant" || tag === "lightweight")) {
        for (const fan of fans) {
          const source = machine.body(fan.id)!, strength = airflowAt(source, body.position, obstacles) * AIRFLOW_ACCELERATION * body.mass, direction = bodyVector(source, { x: 1, y: 0 });
          Matter.Body.applyForce(body, body.position, { x: direction.x * strength, y: direction.y * strength });
        }
      }
    }
    // Recompute the connected drive network so disconnected receivers cannot stay powered.
    const driven = new Set<string>(), queue = entities.filter(entity => GADGET_CATALOG[entity.type].tags.includes("rotational-source") && machine.state(entity.id)?.state === "running" && (!this.beltDriven.has(entity.id) || machine.state(entity.id)?.properties.selfDriven===true)).map(entity => entity.id);
    const roots = new Set(queue);
    const visited = new Set(queue);
    const gears = entities.filter(entity => GADGET_CATALOG[entity.type].tags.includes("gear"));
    while (queue.length) {
      const source = queue.shift()!;
      const edges = machine.connections.filter(item => item.kind === "belt").flatMap(connection => {
        const target = connection.sourceId === source ? connection.targetId : connection.targetId === source ? connection.sourceId : null;
        return target ? [{target, mesh:false}] : [];
      });
      if (gears.some(gear => gear.id === source)) for (const gear of gears) {
        const distance = Math.hypot(machine.body(source)!.position.x - machine.body(gear.id)!.position.x, machine.body(source)!.position.y - machine.body(gear.id)!.position.y);
        if (gear.id !== source && distance >= 70 && distance <= 98) edges.push({target:gear.id,mesh:true});
      }
      for (const {target,mesh} of edges) {
        if (visited.has(target) || !machine.state(target)) continue;
        visited.add(target); driven.add(target); queue.push(target); machine.setState(target,"running");
        const targetBody = machine.body(target); if (targetBody) Matter.Body.setAngularVelocity(targetBody,(mesh ? -1 : 1)*(machine.body(source)?.angularVelocity || .08));
        machine.setSignal(`drive.transferred.${target}`);
        if (mesh) machine.setSignal("gear.connected");
      }
    }
    const receivers = new Set([...this.beltDriven, ...gears.map(gear=>gear.id), ...machine.connections.filter(item=>item.kind==="belt").flatMap(item=>[item.sourceId,item.targetId])]);
    for (const id of receivers) {
      const type = machine.state(id)?.type;
      if (type && !roots.has(id) && !driven.has(id) && !(type === "generator" && machine.state(id)?.properties.switchedOn)) {
        machine.setState(id,"idle"); const body = machine.body(id); if (body) Matter.Body.setAngularVelocity(body,0);
      }
    }
    for (const gear of gears) {
      const state=machine.state(gear.id)!;
      if (state.state==="running") state.properties.rotorAngle=Number(state.properties.rotorAngle??0)+(machine.body(gear.id)?.angularVelocity||.08)*dt/(1000/60);
    }
    this.beltDriven = driven;
    // Consumers see a belt-driven generator's updated power in this same step.
    for (const entity of entities.filter(entity => GADGET_CATALOG[entity.type].electrical?.supply === "socket")) {
      const powered = machine.connections.some(connection => connection.kind === "wire" && connection.targetId === entity.id && machine.state(connection.sourceId)?.type === "generator" && machine.state(connection.sourceId)?.state === "running");
      machine.setState(entity.id, powered ? GADGET_CATALOG[entity.type].electrical!.activeState : "off");
    }
    for (const [id, hit] of this.punches) {
      const glove = machine.body(id)!, age = machine.stateAgeMs(id) ?? 0; if (age > 300) continue;
      const direction = bodyVector(glove, { x: 1, y: 0 }), c = direction.x, s = direction.y, reach = 36 + Math.min(1, age / 110) * 82;
      for (const body of Matter.Composite.allBodies(machine.world)) {
        if (body === glove || body.isSensor || hit.has(body.id)) continue;
        const dx = body.position.x - glove.position.x, dy = body.position.y - glove.position.y, forward = dx * c + dy * s;
        if (forward > 30 && forward < reach + (body.circleRadius || 15) && Math.abs(-dx * s + dy * c) < 33) {
          hit.add(body.id); this.strike(body, { x: c * 9, y: s * 9 });
        }
      }
    }
    this.optics(dt, obstacles);
    this.fire(dt);
  }

  private optics(dt: number, obstacles: Matter.Body[]) {
    const machine = this.machine;
    this.lights = machine.entities().flatMap(entity => {
      const body = machine.body(entity.id); if (!body) return [];
      const light = GADGET_CATALOG[entity.type].light;
      if (light && entity.state === light.activeState) return [{
        ...local(body, light.local), id: entity.id, radius: light.radius, intensity: light.intensity,
        angle: light.directional ? Math.atan2(bodyVector(body,{x:1,y:0}).y,bodyVector(body,{x:1,y:0}).x) : undefined,
      }];
      if (entity.type === "candle" && entity.state === "burning") return [{ ...local(body, candleFlameLocal(machine.config(entity.id)!)), id: entity.id, radius: 110, intensity: .45 }];
      return [];
    });
    this.focuses = [];
    const heated = new Set<string>();
    for (const lens of machine.bodiesByType("magnifier")) {
      const id = machinePlugin(lens)!.instanceId, point = local(lens, { x: 90, y: 0 });
      const intensity = this.lights.reduce((sum, light) => {
        const dist = distance(light, lens.position);
        if (dist > light.radius || Matter.Query.ray(obstacles, light, lens.position).length) return sum;
        if (light.angle !== undefined) {
          const dx = lens.position.x - light.x, dy = lens.position.y - light.y;
          if (dx * Math.cos(light.angle) + dy * Math.sin(light.angle) < 0 || Math.abs(-dx * Math.sin(light.angle) + dy * Math.cos(light.angle)) > 20 + dist * .25) return sum;
        }
        return sum + light.intensity * (1 - dist / light.radius);
      }, 0);
      const focusing = intensity >= .25 && !Matter.Query.ray(obstacles, lens.position, point).length;
      machine.setState(id, focusing ? "focusing" : "idle");
      if (!focusing) continue;
      this.focuses.push({ lensId: id, lens: { ...lens.position }, point, intensity });
      for (const entity of machine.entities()) {
        if (entity.type !== "candle" && entity.type !== "fuse") continue;
        const body = machine.body(entity.id)!;
        const target = entity.type === "candle" ? local(body, candleFlameLocal(machine.config(entity.id)!)) : body.position;
        const touching = entity.type === "fuse" ? distanceToSegment(point, local(body, { x: -55, y: 0 }), local(body, { x: 55, y: 0 })) < 12 : distance(point, target) < 14;
        if (!touching || ["burning", "burned", "extinguished"].includes(entity.state ?? "")) continue;
        heated.add(entity.id); const heat = (this.heat.get(entity.id) ?? 0) + dt * intensity; this.heat.set(entity.id, heat);
        if (heat >= 450) { machine.setState(entity.id, "burning"); this.network?.igniteNear(point, 14, machine.timeMs); machine.setSignal(`heat.ignited.${entity.id}`); }
      }
    }
    for (const id of this.heat.keys()) if (!heated.has(id)) this.heat.delete(id);
  }

  fuseSnapshot(id: string) { this.prepareFuses(); return this.network!.snapshot(id, this.machine.timeMs); }

  private advanceRockets(dt: number) {
    const machine = this.machine;
    this.rocketFlames = [];
    for (const body of machine.bodiesByType("rocket")) {
      const id = machinePlugin(body)!.instanceId, state = machine.state(id)!.state;
      if (state !== "burning" && state !== "launching") continue;
      if (!this.rocketStarted.has(id)) this.rocketStarted.set(id, machine.timeMs - (machine.stateAgeMs(id) ?? 0) - (state === "launching" ? ROCKET_IGNITION_MS : 0));
      const started = this.rocketStarted.get(id)!;
      const age = machine.timeMs - started;
      if (age >= ROCKET_TOTAL_LAUNCH_MS) machine.setState(id, "launched");
      else if (age >= ROCKET_IGNITION_MS) machine.setState(id, "launching");
      const nozzle = rocketNozzleLocal(machine.config(id)!);
      const from = rocketVisual("launching", started, machine.timeMs - dt).offsetY;
      const to = rocketVisual("launching", started, machine.timeMs).offsetY;
      // Sample the swept exhaust so a passing rocket also ignites thin wicks at low frame rates.
      const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 8));
      for (let step = 0; step <= steps; step++) this.rocketFlames.push(local(body, { x: nozzle.x, y: nozzle.y + from + (to - from) * step / steps }));
    }
  }

  private prepareFuses() {
    const machine = this.machine, fuses = machine.bodiesByType("fuse"), cannons = machine.bodiesByType("cannon"), ids = [...fuses, ...cannons].map(body => machinePlugin(body)!.instanceId).join("|");
    if (!this.network || ids !== this.fuseIds) {
      this.fuseIds = ids;
      this.network = new FuseNetwork([...fuses.map(body => ({ id: machinePlugin(body)!.instanceId, start: local(body, { x: -55, y: 0 }), end: local(body, { x: 55, y: 0 }), burnDurationMs: 1200 })), ...cannons.map(body => ({ id: `${machinePlugin(body)!.instanceId}:fuse`, start: local(body, {x:-18,y:-42}), end: local(body, {x:-26,y:-17}), burnDurationMs:1300, samples:14 }))], 22, 105);
    }
  }

  private fire(dt: number) {
    this.advanceRockets(dt);
    this.prepareFuses();
    const machine = this.machine, fuses = machine.bodiesByType("fuse"), cannons = machine.bodiesByType("cannon");
    const flames: Point[] = [...this.rocketFlames, ...machine.bodiesByType("candle").filter(body => machine.state(machinePlugin(body)!.instanceId)?.state === "burning").map(body => local(body, candleFlameLocal(machine.config(machinePlugin(body)!.instanceId)!)))];
    for (const body of machine.bodiesByType("detonator")) {
      const id = machinePlugin(body)!.instanceId;
      if (machine.state(id)?.state === "spent" && (machine.stateAgeMs(id) ?? Infinity) < 160) flames.push(local(body, { x: 40, y: 20 }));
    }
    if (this.network) {
      for (const body of fuses) {
        const id = machinePlugin(body)!.instanceId, state = machine.state(id)?.state;
        if (state === "extinguished") this.network.extinguish(id, machine.timeMs);
        else if (state === "burning" && !this.network.snapshot(id, machine.timeMs).samples.some(sample => sample.burned)) this.network.igniteNear(body.position, 4, machine.timeMs);
      }
      for (const flame of flames) this.network.igniteNear(flame, 14, machine.timeMs);
      this.network.update(machine.timeMs);
      for (const body of fuses) {
        const id = machinePlugin(body)!.instanceId, snapshot = this.network.snapshot(id, machine.timeMs);
        if (snapshot.samples.some(sample => sample.burned) && machine.state(id)?.state !== "extinguished") machine.setState(id, snapshot.samples.every(sample => sample.burned) && snapshot.flames.length === 0 ? "burned" : "burning");
        for (const t of snapshot.flames) flames.push(local(body, { x: -55 + 110 * t, y: 0 }));
      }
    }
    if (this.network) for (const cannon of cannons) {
      const id = machinePlugin(cannon)!.instanceId, fuse = this.network.snapshot(`${id}:fuse`, machine.timeMs);
      machine.state(id)!.properties.fuseProgress = fuse.samples.filter(sample => sample.burned).length / fuse.samples.length;
      if (fuse.samples.some(sample => sample.burned) && !this.cannonShots.has(id)) machine.setState(id, "fuseBurning");
      if (this.network.hasBurnedEnd(`${id}:fuse`, machine.timeMs) && !this.cannonShots.has(id)) {
        this.cannonShots.add(id); machine.state(id)!.properties.firedAt = machine.timeMs; machine.setState(id, "firing"); machine.setSignal("cannon.fired"); machine.setSignal(`cannon.fired.${id}`);
        const direction = bodyVector(cannon, {x:1,y:0}), position = local(cannon, {x:58,y:0});
        const shot = machine.addGadget({ id:`${id}:shot`, type:"cannonball", ...position })!;
        Matter.Body.setVelocity(shot, {x:direction.x*14,y:direction.y*14});
      }
    }
    for (const candle of machine.bodiesByType("candle")) {
      const id = machinePlugin(candle)!.instanceId;
      if (machine.state(id)?.state === "unlit" && flames.some(flame => distance(flame, local(candle, candleFlameLocal(machine.config(id)!))) <= 15)) {
        machine.setState(id, "burning"); machine.setSignal(`candle.ignited.${id}`);
      }
    }
    for (const body of machine.bodiesByType("tnt")) {
      const id = machinePlugin(body)!.instanceId, state = machine.state(id)?.state;
      if (state === "idle" && flames.some(flame => distance(flame, local(body, { x: -18, y: -28 })) <= 15)) {
        machine.setState(id, "burning"); machine.setSignal(`tnt.ignited.${id}`);
      }
      if (state === "burning" && (machine.stateAgeMs(id) ?? 0) >= 650) this.explode(id, body);
    }
    for (const body of machine.bodiesByType("rocket")) {
      const id = machinePlugin(body)!.instanceId, state = machine.state(id)!.state;
      if (state === "mounted" && flames.some(flame => distance(flame, local(body, rocketNozzleLocal(machine.config(id)!))) <= 36)) {
        machine.setState(id, "burning"); machine.setSignal("rocket.ignited"); machine.setSignal(`rocket.ignited.${id}`);
      }
    }
    for (const body of machine.bodiesByType("balloon")) {
      const id = machinePlugin(body)!.instanceId;
      if (machine.state(id)?.state === "popped") continue;
      if (flames.some(flame => { const point = inversePoint(bodyTransform(body), flame); return Math.hypot(point.x, point.y) <= (body.circleRadius || 24) + 15; })) {
        machine.setState(id, "popped"); body.isSensor = true; body.collisionFilter.mask = 0; machine.setSignal("balloon.popped");
      }
    }
  }

  private explode(id: string, source: Matter.Body) {
    const machine = this.machine;
    machine.setState(id, "exploded"); source.isSensor = true; source.collisionFilter.mask = 0; machine.setSignal(`tnt.exploded.${id}`);
    const obstacles = this.obstacles();
    for (const body of Matter.Composite.allBodies(machine.world)) {
      if (body === source || body.isSensor) continue;
      const dx = body.position.x - source.position.x, dy = body.position.y - source.position.y, dist = Math.hypot(dx, dy);
      if (dist > 180 || Matter.Query.ray(obstacles.filter(wall => wall !== body), source.position, body.position).length) continue;
      const strength = 14 * (1 - dist / 180) / Math.max(1, Math.sqrt(Number(machinePlugin(body) ? GADGET_CATALOG[machinePlugin(body)!.type].physics.massKg : body.mass)));
      if (machinePlugin(body)?.type === "fishBowl" && dist < 180) this.breakBowl(body);
      this.strike(body, { x: dx / (dist || 1) * strength, y: dy / (dist || 1) * strength });
    }
  }
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}
