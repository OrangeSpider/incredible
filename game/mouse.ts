export const MOUSE_RUN_FRAME_MS=110;

export function mouseSpriteFrame(now:number,running:boolean):number{
  return running?Math.floor(now/MOUSE_RUN_FRAME_MS)%3:1;
}
