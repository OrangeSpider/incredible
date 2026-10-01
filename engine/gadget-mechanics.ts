import Matter from "matter-js";
import type { MachinePhysicsEngine } from "./physics-engine.ts";
import { GADGET_CATALOG } from "./gadget-catalog.ts";
import { machinePlugin } from "./body-factory.ts";
import { attachmentPoint, type Point } from "../game/control-ropes.ts";
import { gadgetPorts } from "../game/gadget-connections.ts";
import { airflowAt, AIRFLOW_ACCELERATION } from "../game/airflow.ts";
import { FuseNetwork } from "../game/fuse.ts";

export type LightField = Point & { id: string; radius: number; angle?: number; intensity: number };
export type Focus = { lensId: string; lens: Point; point: Point; intensity: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const local = (body: Matter.Body, point: Point) => attachmentPoint(body.position, body.angle, point);

/** Shared gadget behavior; all geometry is independent of scene names and level numbers. */
export class GadgetMechanics {
  readonly machine: MachinePhysicsEngine;
  lights: LightField[] = [];
  focuses: Focus[] = [];
  private readonly heat = new Map<string, number>();
  private readonly punches = new Map<string, Set<number>>();
  private readonly velocities = new Map<number, Point>();
  private network: FuseNetwork | null = null;
  private fuseIds = "";
  private readonly managedFuses: boolean;

  constructor(machine: MachinePhysicsEngine, legacyFuses = false) { this.machine = machine; this.managedFuses = !legacyFuses; }

  private obstacles() {
    return this.machine.entities().filter(entity => ["stoneWall", "woodWall", "steelBeam", "ramp"].includes(entity.type)).flatMap(entity => {
      const body = this.machine.body(entity.id); return body ? [body] : [];
    });
  }

  private strike(body: Matter.Body, velocity: Point) {
    const id = machinePlugin(body)?.instanceId, type = machinePlugin(body)?.type;
    if (type === "generator" && id && Math.hypot(velocity.x, velocity.y) >= 1) {
      this.machine.setState(id, "running"); this.machine.setSignal(`generator.started.${id}`);
    }
    if (!body.isStatic && !body.isSensor) Matter.Body.setVelocity(body, { x: body.velocity.x + velocity.x, y: body.velocity.y + velocity.y });
  }

  collision(a: Matter.Body, b: Matter.Body) {
    for (const [device, impact] of [[a, b], [b, a]]) {
      const plugin = machinePlugin(device); if (!plugin || impact.isStatic || impact.isSensor) continue;
      const state = this.machine.state(plugin.instanceId)!;
      const movement = this.velocities.get(impact.id) ?? impact.velocity;
      const speed = Math.max(impact.speed, Math.hypot(movement.x, movement.y));
      if (speed < .8) continue;
      if (plugin.type === "generator") this.strike(device, { x: speed, y: 0 });
      const button = GADGET_CATALOG[plugin.type].electrical?.switch;
      if (button && state.state === "off") {
        const point = local(device, button), normal = { x: -Math.sin(device.angle), y: Math.cos(device.angle) };
        const offset = { x: impact.position.x - point.x, y: impact.position.y - point.y };
        const radius = Math.max(impact.circleRadius || 0, (impact.bounds.max.x - impact.bounds.min.x) / 2);
        if (offset.x * normal.x + offset.y * normal.y < 0 && Math.abs(offset.x * normal.y - offset.y * normal.x) < radius + 9) {
          this.machine.setState(plugin.instanceId, "on"); this.machine.setSignal(`switch.pressed.${plugin.instanceId}`);
        }
      }
      if (plugin.type === "detonator" && state.state === "ready") {
        const point = local(device, { x: 0, y: -36 }), normal = { x: -Math.sin(device.angle), y: Math.cos(device.angle) };
        if ((impact.position.x - point.x) * normal.x + (impact.position.y - point.y) * normal.y < 0 && movement.x * normal.x + movement.y * normal.y > .4) {
          this.machine.setState(plugin.instanceId, "spent"); this.machine.setSignal(`detonator.spark.${plugin.instanceId}`);
        }
      }
      if (plugin.type === "boxingGlove" && state.state === "ready") {
        const c = Math.cos(device.angle), s = Math.sin(device.angle), dx = impact.position.x - device.position.x, dy = impact.position.y - device.position.y;
        if (dx * c + dy * s < -20 && Math.abs(-dx * s + dy * c) < 38) {
          this.machine.setState(plugin.instanceId, "spent"); this.machine.setSignal(`glove.punched.${plugin.instanceId}`);
          this.punches.set(plugin.instanceId, new Set());
        }
      }
    }
  }

  connectionPoints(id: string): Point[] {
    const connection = this.machine.connections.find(item => item.id === id); if (!connection) return [];
    const configs = this.machine.entities().map(entity => ({ ...this.machine.config(entity.id)!, x: entity.x, y: entity.y, rotation: this.machine.body(entity.id)?.angle ?? 0 }));
    const ports = gadgetPorts(configs).filter(port => connection.kind === "wire" ? port.kind !== "drive" : port.kind === "drive");
    const source = ports.find(port => port.gadgetId === connection.sourceId), target = ports.find(port => port.gadgetId === connection.targetId);
    return source && target ? [source, target] : [];
  }

  beforeStep(dt: number) {
    const machine = this.machine, entities = machine.entities(), obstacles = this.obstacles();
    for (const body of Matter.Composite.allBodies(machine.world)) this.velocities.set(body.id, { ...body.velocity });
    for (const entity of entities) {
      const supply = GADGET_CATALOG[entity.type].electrical?.supply;
      if (supply !== "socket") continue;
      const powered = machine.connections.some(connection => connection.kind === "wire" && connection.targetId === entity.id && machine.state(connection.sourceId)?.type === "generator" && machine.state(connection.sourceId)?.state === "running");
      machine.setState(entity.id, powered ? entity.type === "socketFan" ? "running" : "on" : "off");
    }
    const fans = entities.filter(entity => GADGET_CATALOG[entity.type].tags.includes("air-source") && machine.state(entity.id)?.state === "running");
    for (const entity of entities) {
      const body = machine.body(entity.id); if (!body) continue;
      const wind = fans.reduce((sum, fan) => sum + airflowAt(machine.body(fan.id)!, body.position, obstacles), 0);
      if (entity.type === "windmill") { machine.setState(entity.id, wind > .03 ? "running" : "idle"); Matter.Body.setAngularVelocity(body,wind*.12); machine.setSignal(`windmill.rotation.${entity.id}`, wind * .12); }
      if (!body.isStatic && !body.isSensor && GADGET_CATALOG[entity.type].tags.some(tag => tag === "buoyant" || tag === "lightweight")) {
        for (const fan of fans) {
          const source = machine.body(fan.id)!, strength = airflowAt(source, body.position, obstacles) * AIRFLOW_ACCELERATION * body.mass;
          Matter.Body.applyForce(body, body.position, { x: Math.cos(source.angle) * strength, y: Math.sin(source.angle) * strength });
        }
      }
    }
    // A wind drive stops as soon as wind or its connecting belt disappears.
    const driven = new Set<string>(), queue = entities.filter(entity => GADGET_CATALOG[entity.type].tags.includes("rotational-source") && machine.state(entity.id)?.state === "running").map(entity => entity.id);
    while (queue.length) {
      const source = queue.shift()!;
      for (const connection of machine.connections.filter(item => item.kind === "belt")) {
        const target = connection.sourceId === source ? connection.targetId : connection.targetId === source ? connection.sourceId : null;
        if (!target || driven.has(target) || target === source || !machine.state(target)) continue;
        driven.add(target); queue.push(target); machine.setState(target, "running");
        const targetBody=machine.body(target); if(targetBody)Matter.Body.setAngularVelocity(targetBody,machine.body(source)?.angularVelocity||.08);
        machine.setSignal(`drive.transferred.${target}`);
      }
    }
    for (const connection of machine.connections.filter(item => item.kind === "belt")) for (const id of [connection.sourceId, connection.targetId]) {
      const type = machine.state(id)?.type;
      if (type && !GADGET_CATALOG[type].tags.includes("rotational-source") && !driven.has(id)) { machine.setState(id, "idle"); const body=machine.body(id);if(body)Matter.Body.setAngularVelocity(body,0); }
    }
    for (const [id, hit] of this.punches) {
      const glove = machine.body(id)!, age = machine.stateAgeMs(id) ?? 0; if (age > 300) continue;
      const c = Math.cos(glove.angle), s = Math.sin(glove.angle), reach = 36 + Math.min(1, age / 110) * 82;
      for (const body of Matter.Composite.allBodies(machine.world)) {
        if (body === glove || body.isSensor || hit.has(body.id)) continue;
        const dx = body.position.x - glove.position.x, dy = body.position.y - glove.position.y, forward = dx * c + dy * s;
        if (forward > 30 && forward < reach + (body.circleRadius || 15) && Math.abs(-dx * s + dy * c) < 33) {
          hit.add(body.id); this.strike(body, { x: c * 9, y: s * 9 });
        }
      }
    }
    this.optics(dt, obstacles);
    this.fire();
  }

  private optics(dt: number, obstacles: Matter.Body[]) {
    const machine = this.machine;
    this.lights = machine.entities().flatMap(entity => {
      const body = machine.body(entity.id); if (!body) return [];
      if (GADGET_CATALOG[entity.type].tags.includes("light-source") && entity.state === "on") return [{
        ...local(body, entity.type === "flashlight" ? { x: 38, y: 0 } : { x: 0, y: -20 }), id: entity.id,
        radius: entity.type === "flashlight" ? 360 : 260, intensity: 1, angle: entity.type === "flashlight" ? body.angle : undefined,
      }];
      if (entity.type === "candle" && entity.state === "burning") return [{ ...local(body, { x: 0, y: -50 }), id: entity.id, radius: 110, intensity: .45 }];
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
        const target = entity.type === "candle" ? local(body, { x: 0, y: -50 }) : body.position;
        const touching = entity.type === "fuse" ? distanceToSegment(point, local(body, { x: -55, y: 0 }), local(body, { x: 55, y: 0 })) < 12 : distance(point, target) < 14;
        if (!touching || ["burning", "burned", "extinguished"].includes(entity.state ?? "")) continue;
        heated.add(entity.id); const heat = (this.heat.get(entity.id) ?? 0) + dt * intensity; this.heat.set(entity.id, heat);
        if (heat >= 450) { machine.setState(entity.id, "burning"); this.network?.igniteNear(point, 14, machine.timeMs); machine.setSignal(`heat.ignited.${entity.id}`); }
      }
    }
    for (const id of this.heat.keys()) if (!heated.has(id)) this.heat.delete(id);
  }

  fuseSnapshot(id: string) { return this.managedFuses ? this.network?.snapshot(id, this.machine.timeMs) : undefined; }

  private fire() {
    const machine = this.machine, fuses = machine.bodiesByType("fuse"), ids = fuses.map(body => machinePlugin(body)!.instanceId).join("|");
    if (this.managedFuses && ids !== this.fuseIds) {
      this.fuseIds = ids;
      this.network = new FuseNetwork(fuses.map(body => ({ id: machinePlugin(body)!.instanceId, start: local(body, { x: -55, y: 0 }), end: local(body, { x: 55, y: 0 }), burnDurationMs: 1200 })), 14, 105);
    }
    const flames: Point[] = machine.bodiesByType("candle").filter(body => machine.state(machinePlugin(body)!.instanceId)?.state === "burning").map(body => local(body, { x: 0, y: -50 }));
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
    for (const body of machine.bodiesByType("tnt")) {
      const id = machinePlugin(body)!.instanceId, state = machine.state(id)?.state;
      if (state === "idle" && flames.some(flame => distance(flame, local(body, { x: -18, y: -28 })) <= 15)) {
        machine.setState(id, "burning"); machine.setSignal(`tnt.ignited.${id}`);
      }
      if (state === "burning" && (machine.stateAgeMs(id) ?? 0) >= 650) this.explode(id, body);
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
      this.strike(body, { x: dx / (dist || 1) * strength, y: dy / (dist || 1) * strength });
    }
  }
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}
