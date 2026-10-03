/** Punch velocity in Matter.js units; existing levels use the original strength. */
export const BOXING_GLOVE_DEFAULT_STRENGTH = 9;

export function boxingGloveStrength(properties?: Record<string, string | number | boolean>): number {
  const strength = properties?.punchStrength;
  return typeof strength === "number" && Number.isFinite(strength) && strength > 0
    ? strength : BOXING_GLOVE_DEFAULT_STRENGTH;
}
