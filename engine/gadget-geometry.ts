import type Matter from "matter-js";
import { GADGET_CATALOG } from "./gadget-catalog.ts";
import type { GadgetInstanceConfig } from "./types.ts";

export type Point = { x: number; y: number };
export type Transform = Point & { rotation?: number; flipX?: boolean; flipY?: boolean };
export function localVector(transform: Transform, point: Point): Point {
  const x = point.x * (transform.flipX ? -1 : 1), y = point.y * (transform.flipY ? -1 : 1), angle = transform.rotation ?? 0;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
}
export function localPoint(transform: Transform, point: Point): Point {
  const offset = localVector(transform, point);
  return { x: transform.x + offset.x, y: transform.y + offset.y };
}
export function inversePoint(transform: Transform, point: Point): Point {
  const angle = transform.rotation ?? 0, x = point.x - transform.x, y = point.y - transform.y;
  return { x: (x * Math.cos(angle) + y * Math.sin(angle)) * (transform.flipX ? -1 : 1), y: (-x * Math.sin(angle) + y * Math.cos(angle)) * (transform.flipY ? -1 : 1) };
}
export function bodyTransform(body: Matter.Body): Transform {
  const flags = body.plugin?.machine ?? {};
  return { ...body.position, rotation: body.angle, flipX: flags.flipX, flipY: flags.flipY };
}
export const bodyPoint = (body: Matter.Body, point: Point) => localPoint(bodyTransform(body), point);
export const bodyVector = (body: Matter.Body, point: Point) => localVector(bodyTransform(body), point);
export function gadgetSize(config: GadgetInstanceConfig) {
  const physics = { ...GADGET_CATALOG[config.type].physics, ...config.physics };
  if (physics.radius !== undefined) return { width: physics.radius * 2, height: physics.radius * 2 };
  return { width: physics.width ?? (physics.radius ?? 25) * 2, height: physics.height ?? (physics.radius ?? 25) * 2 };
}
export const candleFlameLocal = (config: GadgetInstanceConfig): Point => ({ x: 0, y: Number(config.properties?.flameOffsetY ?? -gadgetSize(config).height / 2) });
export const rocketNozzleLocal = (config: GadgetInstanceConfig): Point => ({ x: 0, y: gadgetSize(config).height / 2 - 25 });
export function resizeHandles(config: GadgetInstanceConfig): Point[] {
  const axis = GADGET_CATALOG[config.type].resizeAxis, size = gadgetSize(config);
  return axis ? [-1, 1].map(side => localPoint(config, { x: axis === "x" ? side * size.width / 2 : 0, y: axis === "y" ? side * size.height / 2 : 0 })) : [];
}
export function resizeGadget(config: GadgetInstanceConfig, end: 0 | 1, point: Point): GadgetInstanceConfig {
  const axis = GADGET_CATALOG[config.type].resizeAxis;
  if (!axis) return config;
  const size = gadgetSize(config), oldLength = axis === "x" ? size.width : size.height, sign = end === 0 ? -1 : 1;
  const at = inversePoint(config, point), length = Math.max(40, Math.min(900, sign * at[axis] + oldLength / 2));
  const offset = localVector(config, { x: axis === "x" ? sign * (length - oldLength) / 2 : 0, y: axis === "y" ? sign * (length - oldLength) / 2 : 0 });
  return { ...config, x: config.x + offset.x, y: config.y + offset.y, physics: { ...config.physics, [axis === "x" ? "width" : "height"]: length } };
}
