/** Stable capability names accepted by level JSON. Some run in the engine, others in the game runtime. */
export const RUNTIME_SYSTEM_IDS = [
  "hamster-drive", "conveyor", "animal-support", "buoyancy", "fire", "fan-airflow",
  "trampoline", "pulley-rope", "rope-rendering", "sharp-objects", "cat-mouse",
  "gear-network", "fuse-network", "cannon", "bucket-water", "water-collisions",
  "seesaw", "catapult", "breakable-container", "fish-release", "cat-fish",
  "scissors", "tension-rope", "belt-drive", "rocket-launch", "fire-contact",
] as const;

export type RuntimeSystemId = typeof RUNTIME_SYSTEM_IDS[number];
export const KNOWN_RUNTIME_SYSTEM_IDS: ReadonlySet<string> = new Set(RUNTIME_SYSTEM_IDS);
