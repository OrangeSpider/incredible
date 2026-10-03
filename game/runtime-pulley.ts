import Matter from "matter-js";
import { gadgetSize } from "../engine/gadget-geometry.ts";
import { dampPulleyVelocity, PULLEY_GRAVITY_PX, ropeConstraintCorrection, ropeGeometry } from "./pulley.ts";
import type { MachineRuntime } from "./machine-runtime.ts";
import type { RuntimeSystem } from "./runtime-systems.ts";

/** The rope is a tension-only constraint; it never pushes a loose assembly. */
export function createPulleySystem(runtime: MachineRuntime): RuntimeSystem {
  return { afterStep() {
    const { fixed, moving, placedBall, initialMovingPositions, initialBlockPosition, initialWeightY, ready, restLength, physicsPoints } = runtime.options.rope;
    const weight = runtime.level.loadRope ? runtime.machine.body(runtime.level.loadRope.weightId) : null;
    if (!runtime.running || !placedBall || !weight) return;

    const pullMass = runtime.machine.physical(placedBall.plugin.machine.instanceId)!.massKg, loadMass = runtime.machine.physical(runtime.level.loadRope!.weightId)!.massKg;
    const floor=Matter.Composite.allBodies(runtime.matter.world).find(body=>body.label==="floor");
    const pullRadius=gadgetSize(runtime.machine.config(placedBall.plugin.machine.instanceId)!).width/2;
    const floorY=floor?floor.bounds.min.y-pullRadius:Infinity;
    const seconds = runtime.dt / 1000, previousBall = { ...placedBall.position };
    const ballVelocity = runtime.ballVelocity, blockVelocity = runtime.blockVelocity, state = runtime.state;
    ballVelocity.y += PULLEY_GRAVITY_PX * seconds;
    blockVelocity.y += PULLEY_GRAVITY_PX * seconds;
    Matter.Body.setPosition(placedBall, {
      x: placedBall.position.x + ballVelocity.x * seconds,
      y: Math.min(floorY, placedBall.position.y + ballVelocity.y * seconds),
    });
    if (placedBall.position.y >= floorY && ballVelocity.y > 0) ballVelocity.y = 0;

    const positionBlock = () => {
      const dx = state.blockPosition.x - initialBlockPosition.x, dy = state.blockPosition.y - initialBlockPosition.y;
      Matter.Body.setPosition(weight, state.blockPosition);
      moving.forEach((body, index) => Matter.Body.setPosition(body, { x: initialMovingPositions[index].x + dx, y: initialMovingPositions[index].y + dy }));
    };
    if (moving.length) {
      state.blockPosition = {
        x: state.blockPosition.x + blockVelocity.x * seconds,
        y: Math.min(initialWeightY, state.blockPosition.y + blockVelocity.y * seconds),
      };
      if (state.blockPosition.y >= initialWeightY && blockVelocity.y > 0) blockVelocity.y = 0;
      positionBlock();
    }

    if (ready) {
      for (let iteration = 0; iteration < 6; iteration++) {
        const correction = ropeConstraintCorrection(physicsPoints(), restLength, pullMass, loadMass);
        if (correction.stretch < .01) break;
        Matter.Body.setPosition(placedBall, { x: placedBall.position.x + correction.ball.x, y: placedBall.position.y + correction.ball.y });
        state.blockPosition = { x: state.blockPosition.x + correction.block.x, y: Math.min(initialWeightY, state.blockPosition.y + correction.block.y) };
        positionBlock();
      }
      const geometry = ropeGeometry(physicsPoints());
      const rate = geometry.ballGradient.x * ballVelocity.x + geometry.ballGradient.y * ballVelocity.y + geometry.blockGradient.x * blockVelocity.x + geometry.blockGradient.y * blockVelocity.y;
      const denominator = (geometry.ballGradient.x ** 2 + geometry.ballGradient.y ** 2) / pullMass + (geometry.blockGradient.x ** 2 + geometry.blockGradient.y ** 2) / loadMass;
      if (rate > 0 && denominator > 1e-9) {
        const impulse = rate / denominator;
        ballVelocity.x -= geometry.ballGradient.x * impulse / pullMass;
        ballVelocity.y -= geometry.ballGradient.y * impulse / pullMass;
        blockVelocity.x -= geometry.blockGradient.x * impulse / loadMass;
        blockVelocity.y -= geometry.blockGradient.y * impulse / loadMass;
      }
    }

    const dampedBall = dampPulleyVelocity(ballVelocity, seconds), dampedBlock = dampPulleyVelocity(blockVelocity, seconds);
    ballVelocity.x = dampedBall.x; ballVelocity.y = dampedBall.y;
    blockVelocity.x = dampedBlock.x; blockVelocity.y = dampedBlock.y;
    state.pulleyTurn += Math.hypot(placedBall.position.x - previousBall.x, placedBall.position.y - previousBall.y) / 30;
    fixed.forEach(body => Matter.Body.setAngle(body, state.pulleyTurn));
    moving.forEach(body => Matter.Body.setAngle(body, -state.pulleyTurn));
  } };
}
