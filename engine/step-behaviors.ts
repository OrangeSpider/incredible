import Matter from "matter-js";
import { GADGET_CATALOG } from "./gadget-catalog.ts";
import { matchesGadget, type GadgetSelector } from "./interaction-rules.ts";
import type { EffectEndpoint } from "./effect-handlers.ts";

export type StepBehavior = (source: EffectEndpoint, active: readonly EffectEndpoint[], deltaMs: number) => void;

type Registration = {
  id: string;
  selector: GadgetSelector;
  state?: string;
  step: StepBehavior;
};

export class StepBehaviorRegistry {
  private readonly registrations: Registration[] = [];

  register(registration: Registration): this {
    if (this.registrations.some(item => item.id === registration.id)) {
      throw new Error(`Duplicate step behavior: ${registration.id}`);
    }
    this.registrations.push(registration);
    return this;
  }

  step(active: readonly EffectEndpoint[], deltaMs: number): void {
    for (const registration of this.registrations) {
      for (const source of active) {
        if ((!registration.state || source.state.state === registration.state) &&
            matchesGadget(GADGET_CATALOG[source.config.type], registration.selector)) {
          registration.step(source, active, deltaMs);
        }
      }
    }
  }
}

export function createDefaultStepBehaviors(): StepBehaviorRegistry {
  const registry = new StepBehaviorRegistry();

  registry.register({
    id: "conveyor-contact",
    selector: { tags: ["conveyor"] },
    state: "running",
    step(source, active) {
      const beltBody = source.body;
      if (!beltBody) return;
      const speed = Number(source.state.properties.speed ?? 3.4);
      const direction = Number(source.state.properties.direction ?? 1);
      for (const target of active) {
        const targetBody = target.body;
        if (target === source || !targetBody || targetBody.isStatic) continue;
        const overlapsX = targetBody.bounds.max.x >= beltBody.bounds.min.x &&
          targetBody.bounds.min.x <= beltBody.bounds.max.x;
        const bottom = targetBody.bounds.max.y, top = beltBody.bounds.min.y;
        if (overlapsX && bottom >= top - 9 && bottom <= top + 18 && targetBody.bounds.min.y < top) {
          Matter.Body.setVelocity(targetBody, {
            x: Math.cos(beltBody.angle) * speed * direction,
            y: Math.min(targetBody.velocity.y, .35),
          });
        }
      }
    },
  });

  return registry;
}
