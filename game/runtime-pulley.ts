import Matter from "matter-js";
import { BOWLING_PULL_KG, dampPulleyVelocity, LEVEL_FIVE_LOAD_KG, PULLEY_GRAVITY_PX, ropeConstraintCorrection, ropeGeometry } from "./pulley";
import type { MachineRuntime } from "./machine-runtime";
import type { RuntimeSystem } from "./runtime-systems";

/** The rope is a tension-only constraint; it never pushes a loose assembly. */
export function createPulleySystem(runtime: MachineRuntime): RuntimeSystem {
  return { afterStep() {
    const { fixed, moving, placedBall, initialMovingPositions, initialBlockPosition, initialWeightY, ready, restLength, physicsPoints } = runtime.options.rope;
    const weight = runtime.bodies.weight;
    if (!runtime.running || !placedBall || !weight) return;

    const seconds = runtime.dt / 1000, previousBall = { ...placedBall.position };
    const ballVelocity = runtime.ballVelocity, blockVelocity = runtime.blockVelocity, state = runtime.state;
    ballVelocity.y += PULLEY_GRAVITY_PX * seconds;
    blockVelocity.y += PULLEY_GRAVITY_PX * seconds;
    Matter.Body.setPosition(placedBall, {
      x: Math.max(18, Math.min(882, placedBall.position.x + ballVelocity.x * seconds)),
      y: Math.min(462, placedBall.position.y + ballVelocity.y * seconds),
    });
    if (placedBall.position.y >= 462 && ballVelocity.y > 0) ballVelocity.y = 0;

    const positionBlock = () => {
      const dx = state.blockPosition.x - initialBlockPosition.x, dy = state.blockPosition.y - initialBlockPosition.y;
      Matter.Body.setPosition(weight, state.blockPosition);
      moving.forEach((body, index) => Matter.Body.setPosition(body, { x: initialMovingPositions[index].x + dx, y: initialMovingPositions[index].y + dy }));
    };
    if (moving.length) {
      state.blockPosition = {
        x: Math.max(45, Math.min(855, state.blockPosition.x + blockVelocity.x * seconds)),
        y: Math.min(initialWeightY, state.blockPosition.y + blockVelocity.y * seconds),
      };
      if (state.blockPosition.y >= initialWeightY && blockVelocity.y > 0) blockVelocity.y = 0;
      positionBlock();
    }

    if (ready) {
      for (let iteration = 0; iteration < 6; iteration++) {
        const correction = ropeConstraintCorrection(physicsPoints(), restLength, BOWLING_PULL_KG, LEVEL_FIVE_LOAD_KG);
        if (correction.stretch < .01) break;
        Matter.Body.setPosition(placedBall, { x: placedBall.position.x + correction.ball.x, y: placedBall.position.y + correction.ball.y });
        state.blockPosition = { x: state.blockPosition.x + correction.block.x, y: Math.min(initialWeightY, state.blockPosition.y + correction.block.y) };
        positionBlock();
      }
      const geometry = ropeGeometry(physicsPoints());
      const rate = geometry.ballGradient.x * ballVelocity.x + geometry.ballGradient.y * ballVelocity.y + geometry.blockGradient.x * blockVelocity.x + geometry.blockGradient.y * blockVelocity.y;
      const denominator = (geometry.ballGradient.x ** 2 + geometry.ballGradient.y ** 2) / BOWLING_PULL_KG + (geometry.blockGradient.x ** 2 + geometry.blockGradient.y ** 2) / LEVEL_FIVE_LOAD_KG;
      if (rate > 0 && denominator > 1e-9) {
        const impulse = rate / denominator;
        ballVelocity.x -= geometry.ballGradient.x * impulse / BOWLING_PULL_KG;
        ballVelocity.y -= geometry.ballGradient.y * impulse / BOWLING_PULL_KG;
        blockVelocity.x -= geometry.blockGradient.x * impulse / LEVEL_FIVE_LOAD_KG;
        blockVelocity.y -= geometry.blockGradient.y * impulse / LEVEL_FIVE_LOAD_KG;
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
