import Matter from "matter-js";
import { localPort } from "../engine/gadget-ports.ts";
import type { RopePoint } from "./pulley.ts";
import type { LevelDefinition } from "../engine/types.ts";
import type { MachinePhysicsEngine, PhysicsEvent } from "../engine/physics-engine.ts";
import { createRuntimeSystems, type RuntimeSystem } from "./runtime-systems.ts";
import { ControlRopeMechanism, type ControlRope } from "./control-ropes.ts";

export type RuntimeCollision = { bodyA: Matter.Body; bodyB: Matter.Body; normal: { x: number; y: number } };

export type MachineRuntimeOptions = {
  level: LevelDefinition;
  machine: MachinePhysicsEngine;
  running: boolean;
  onWin: () => void;
  bodies: {
    cat: Matter.Body | null;
    balloon: Matter.Body | null;
    levelBall: Matter.Body | null;
    weight: Matter.Body | null;
    bucket: Matter.Body | null;
    seesaw: Matter.Body | null;
    fishBowl: Matter.Body | null;
    fish: Matter.Body | null;
    mouse: Matter.Body | null;
    cannon: Matter.Body | null;
    candle: Matter.Body | null;
    hamsterWheel: Matter.Body | null;
    conveyor: Matter.Body | null;
    water: readonly Matter.Body[];
    scissorBalloons: readonly Matter.Body[];
    rockets: readonly Matter.Body[];
  };
  controlRopes?: readonly ControlRope[];
  gearsConnected: boolean;
  rope: {
    fixed: readonly Matter.Body[];
    moving: readonly Matter.Body[];
    placedBall: Matter.Body | null;
    initialMovingPositions: readonly { x: number; y: number }[];
    initialBlockPosition: { x: number; y: number };
    initialWeightY: number;
    ready: boolean;
    restLength: number;
    physicsPoints: () => RopePoint[];
  };
};

export type RuntimeState = {
  motor: boolean;
  motorStartedAt: number;
  driveTransferred: boolean;
  balloonPopped: boolean;
  mouseFleeAt: number;
  catStartledAt: number;
  catImpactMode: "none" | "launch" | "drop";
  catFallStartedAt: number;
  catOnPlatformAt: number;
  fishBowlBrokenAt: number;
  fishReleased: boolean;
  fishFlopAt: number;
  fishChaseAt: number;
  gearTurnAt: number;
  cannonHitAt: number;
  candleWetHits: number;
  candleExtinguished: boolean;
  candleExtinguishedAt: number;
  bucketTipAt: number;
  seesawHitAt: number;
  blockPosition: { x: number; y: number };
  pulleyTurn: number;
  won: boolean;
};

/** Owns gameplay state, intrinsic gadget hooks, collision delivery and goal checks. */
export class MachineRuntime {
  readonly state: RuntimeState;
  readonly waterSplashAt = new Map<number, number>();
  readonly wetFuseIds = new Set<number>();
  readonly scissorClosedById = new Map<string,number>();
  get scissorClosedAt(){return this.level.fixedGadgets.filter(gadget=>gadget.type==="scissor").map(gadget=>this.scissorClosedById.get(gadget.id)??0)}
  readonly rocketIgnitedAt = new Map<string, number>();
  readonly ballVelocity = { x: 0, y: 0 };
  readonly blockVelocity = { x: 0, y: 0 };
  readonly systems: readonly RuntimeSystem[];
  readonly controlRopes: ControlRopeMechanism;
  now = 0;
  dt = 0;
  private readonly unsubscribe: () => void;
  readonly options: MachineRuntimeOptions;

  constructor(options: MachineRuntimeOptions) {
    this.options = options;
    this.controlRopes = new ControlRopeMechanism(options.machine, options.controlRopes ?? []);
    this.state = {
      motor: false, motorStartedAt: 0, driveTransferred: false, balloonPopped: false,
      mouseFleeAt: 0, catStartledAt: 0, catImpactMode: "none", catFallStartedAt: 0,
      catOnPlatformAt: 0, fishBowlBrokenAt: 0, fishReleased: false, fishFlopAt: 0,
      fishChaseAt: 0, gearTurnAt: 0,
      cannonHitAt: 0,
      candleWetHits: 0, candleExtinguished: false, candleExtinguishedAt: 0,
      bucketTipAt: 0, seesawHitAt: 0, blockPosition: { ...options.rope.initialBlockPosition },
      pulleyTurn: 0, won: false,
    };
    this.systems = createRuntimeSystems(this);
    this.unsubscribe = options.machine.subscribe(event => this.onEngineEvent(event));
  }

  get machine() { return this.options.machine; }
  get matter() { return this.options.machine.matter; }
  get bodies() { return this.options.bodies; }
  get running() { return this.options.running; }
  get level() { return this.options.level; }

  private onEngineEvent(event: PhysicsEvent) {
    if (event.type === "collision") {
      const collision: RuntimeCollision = { bodyA: event.bodyA, bodyB: event.bodyB, normal: event.normal };
      this.onCollision(collision);
    } else if (event.type === "state") {
      for (const system of this.systems) system.onState?.(event);
    }
  }

  private onCollision(collision: RuntimeCollision) {
    for (const system of this.systems) system.onCollision?.(collision);
  }

  closeScissorById(id: string) {
    const config = this.machine.config(id);
    if (config?.type !== "scissor" || this.scissorClosedById.has(id)) return;
    this.scissorClosedById.set(id,this.now || 1);
    this.machine.setState(id,"closed");
    const balloonId = config.properties?.balloon;
    if (typeof balloonId !== "string") return;
    const released = this.machine.body(balloonId);
    if (!released || this.machine.state(balloonId)?.type !== "balloon") throw new Error(`Invalid scissor balloon: ${id}`);
    this.machine.setState(balloonId,"free");
    Matter.Body.setStatic(released,false);
    Matter.Body.setVelocity(released,{x:0,y:-1.2});
  }

  tick(now: number, dt: number) {
    this.now = now; this.dt = dt;
    for (const system of this.systems) system.beforeStep?.();
    if (this.running) this.machine.step(dt);
    for (const system of this.systems) system.afterStep?.();
    if (this.running) this.controlRopes.step((targetId,targetPortId) => {
      const config=this.machine.config(targetId)!;
      const action=localPort(config,targetPortId,"target")?.action;
      if (action === "close") this.closeScissorById(targetId);
      else if (action === "open") this.machine.setState(targetId, "open");
    });
    if (this.running && this.machine.goalReached(this.level.goal)) this.complete();
  }

  complete() {
    if (this.state.won) return;
    this.state.won = true;
    this.options.onWin();
  }

  dispose() { this.unsubscribe(); }
}
