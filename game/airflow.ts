import Matter from "matter-js";
import { bodyVector } from "../engine/gadget-geometry.ts";
export const AIRFLOW_RANGE = 320;
export const AIRFLOW_ACCELERATION = .0038;

export function airflowAt(fan: Matter.Body, point: { x: number; y: number }, obstacles: readonly Matter.Body[] = []): number {
  const dx = point.x - fan.position.x, dy = point.y - fan.position.y, direction = bodyVector(fan, { x: 1, y: 0 }), c = direction.x, s = direction.y;
  const forward = dx * c + dy * s, side = -dx * s + dy * c;
  if (forward < 30 || forward > AIRFLOW_RANGE || Math.abs(side) > 38 + forward * .19) return 0;
  if (Matter.Query.ray(obstacles.filter(body => body !== fan && !body.isSensor), fan.position, point).length) return 0;
  return (1 - forward / AIRFLOW_RANGE) * (1 - Math.abs(side) / (38 + forward * .19));
}
