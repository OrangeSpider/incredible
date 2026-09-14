export const ROCKET_IGNITION_MS = 520;
export const ROCKET_TOTAL_LAUNCH_MS = 1780;

export type RocketVisual = {
  row: 0 | 1;
  frame: number;
  offsetY: number;
  size: number;
  visible: boolean;
  smokeOpacity: number;
};

export function nextRocketState(state: string, ignitedAt: number | undefined, now: number) {
  if (!ignitedAt) return state;
  const age = now - ignitedAt;
  if (state === "burning" && age >= ROCKET_IGNITION_MS) return "launching";
  if (state === "launching" && age >= ROCKET_TOTAL_LAUNCH_MS) return "launched";
  return state;
}

export function rocketVisual(state: string, ignitedAt: number | undefined, now: number): RocketVisual {
  if (!ignitedAt || state === "mounted") return { row: 0, frame: 0, offsetY: 0, size: 160, visible: true, smokeOpacity: 0 };
  const age = Math.max(0, now - ignitedAt);
  if (state === "burning") {
    return { row: 0, frame: Math.min(3, 1 + Math.floor(age / 170)), offsetY: 0, size: 160, visible: true, smokeOpacity: 0 };
  }
  if (state === "launching") {
    const progress = Math.max(0, Math.min(1, (age - ROCKET_IGNITION_MS) / (ROCKET_TOTAL_LAUNCH_MS - ROCKET_IGNITION_MS)));
    return {
      row: 1,
      frame: Math.min(3, Math.floor(progress * 4)),
      offsetY: -progress * 250,
      size: 190,
      visible: true,
      smokeOpacity: 1 - progress * .35,
    };
  }
  const fade = Math.max(0, 1 - (age - ROCKET_TOTAL_LAUNCH_MS) / 850);
  return { row: 1, frame: 3, offsetY: -270, size: 190, visible: false, smokeOpacity: fade };
}
