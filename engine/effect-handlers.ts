import Matter from "matter-js";
import type { InteractionEffect, ResolvedInteraction } from "./interaction-rules.ts";
import type { GadgetInstanceConfig, GadgetRuntimeState } from "./types.ts";

export type EffectEndpoint = {
  config: GadgetInstanceConfig;
  state: GadgetRuntimeState;
  body: Matter.Body | null;
};

export type EffectContext = {
  interaction: ResolvedInteraction;
  source: EffectEndpoint;
  target: EffectEndpoint;
  setState(id: string, state: string): void;
  release(id: string, velocity?: { x: number; y: number }): void;
};

export type EffectHandler = (context: EffectContext) => void;

export class EffectRegistry {
  private readonly handlers = new Map<InteractionEffect, EffectHandler>();

  register(effect: InteractionEffect, handler: EffectHandler): this {
    this.handlers.set(effect, handler);
    return this;
  }

  apply(effect: InteractionEffect, context: EffectContext): void {
    const handler = this.handlers.get(effect);
    if (!handler) throw new Error(`No handler registered for interaction effect: ${effect}`);
    handler(context);
  }
}

const stateTarget = ({ interaction, source, target }: EffectContext) =>
  interaction.rule.stateTarget === "source" ? source : target;

function setTargetState(state: string): EffectHandler {
  return (context) => context.setState(stateTarget(context).config.id, state);
}

export function createDefaultEffectRegistry(): EffectRegistry {
  const registry = new EffectRegistry();

  // Matter handles the contact response; a rule may only expose a signal.
  for (const effect of ["goal-signal", "redirect", "transfer-tension"] as const) {
    registry.register(effect, () => {});
  }

  registry.register("start", setTargetState("running"));
  registry.register("pop", setTargetState("popped"));
  registry.register("close", setTargetState("closed"));
  registry.register("break", setTargetState("broken"));
  registry.register("ignite", setTargetState("burning"));
  registry.register("extinguish", setTargetState("extinguished"));
  registry.register("fire", ({ target, setState }) => setState(target.config.id, "firing"));
  registry.register("cut", ({ target, setState, release }) => {
    setState(target.config.id, "free");
    release(target.config.id, { x: 0, y: -1.2 });
  });
  registry.register("collect", ({ source, setState }) => setState(source.config.id, "collected"));

  registry.register("transport", ({ source, target }) => {
    const sourceBody = source.body, targetBody = target.body;
    if (source.state.state !== "running" || !sourceBody || !targetBody || targetBody.isStatic) return;
    const speed = Number(source.state.properties.speed ?? 3.4);
    const direction = Number(source.state.properties.direction ?? 1);
    Matter.Body.setVelocity(targetBody, {
      x: Math.cos(sourceBody.angle) * speed * direction,
      y: targetBody.velocity.y,
    });
  });

  registry.register("push", ({ interaction, source, target }) => {
    const sourceBody = source.body, targetBody = target.body;
    if (!sourceBody || !targetBody || targetBody.isStatic) return;
    const dx = targetBody.position.x - sourceBody.position.x;
    const dy = targetBody.position.y - sourceBody.position.y;
    const c = Math.cos(sourceBody.angle), s = Math.sin(sourceBody.angle);
    const forward = dx * c + dy * s, side = -dx * s + dy * c;
    const maxDistance = interaction.rule.maxDistance ?? 420;
    if (forward <= 0 || forward > maxDistance || Math.abs(side) >= 100 + forward * .3) return;
    const force = (interaction.rule.impulseScale ?? .00035) *
      (1 - forward / maxDistance) * targetBody.mass / .2;
    Matter.Body.applyForce(targetBody, targetBody.position, { x: c * force, y: s * force });
  });

  registry.register("flee", ({ source, target }) => {
    const sourceBody = source.body, targetBody = target.body;
    if (!sourceBody || !targetBody || targetBody.isStatic) return;
    const direction = Math.sign(targetBody.position.x - sourceBody.position.x) || 1;
    Matter.Body.setVelocity(targetBody, { x: direction * 2.8, y: targetBody.velocity.y });
  });

  registry.register("chase", ({ source, target }) => {
    const sourceBody = source.body, targetBody = target.body;
    if (!sourceBody || !targetBody || targetBody.isStatic) return;
    const direction = Math.sign(sourceBody.position.x - targetBody.position.x) || 1;
    Matter.Body.setVelocity(targetBody, { x: direction * 2.2, y: targetBody.velocity.y });
  });

  registry.register("transfer-rotation", ({ source, target, setState }) => {
    if (!target.body) return;
    Matter.Body.setAngularVelocity(target.body, -(source.body?.angularVelocity || .08));
    setState(target.config.id, "running");
  });

  registry.register("bounce", ({ source, target }) => {
    if (!source.body || !target.body) return;
    const angle = target.body.angle;
    Matter.Body.setVelocity(source.body, {
      x: Math.sin(angle) * 20,
      y: -Math.abs(Math.cos(angle)) * 20,
    });
  });

  registry.register("transfer-impulse", ({ source, target }) => {
    if (!source.body || !target.body) return;
    const side = Math.sign(source.body.position.x - target.body.position.x) || 1;
    const speed = Math.abs(source.body.velocity.y);
    Matter.Body.setAngularVelocity(target.body, side * Math.min(.24, Math.max(.08, speed * .018)));
  });

  return registry;
}
