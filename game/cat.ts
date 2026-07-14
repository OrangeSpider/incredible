export type CatAnimationState="idle"|"running"|"startled";

export const CAT_STARTLE_FRAME_MS=220;
export const CAT_STARTLE_DURATION_MS=CAT_STARTLE_FRAME_MS*3;
export const CAT_IDLE_FRAME_MS=350;
const CAT_IDLE_SEQUENCE=[0,0,0,1,2,0,0,0] as const;
const CAT_IDLE_SOURCE_OFFSETS_X=[0,15,34] as const;

export type CatSpritePose={state:CatAnimationState;row:number;frame:number};

export function catSpriteOffsetX(pose:CatSpritePose,size:number):number{
  return pose.state==="idle"?CAT_IDLE_SOURCE_OFFSETS_X[pose.frame]*size/256:0;
}

export function catIsRunning({motor,level,mouseFleeAt}:{motor:boolean;level:number;mouseFleeAt:number}):boolean{
  return motor||(level===6&&mouseFleeAt>0);
}

/**
 * The startled state deliberately owns three frames and then falls through to
 * running. Future explosions or impacts only need to provide `startledAt`.
 */
export function catSpritePose(now:number,{running,startledAt,holdStartled=false}:{running:boolean;startledAt:number|null;holdStartled?:boolean}):CatSpritePose{
  if(startledAt!==null){
    const elapsed=Math.max(0,now-startledAt);
    if(elapsed<CAT_STARTLE_DURATION_MS||holdStartled)return{state:"startled",row:2,frame:Math.min(2,Math.floor(elapsed/CAT_STARTLE_FRAME_MS))};
    return{state:"running",row:1,frame:Math.floor((elapsed-CAT_STARTLE_DURATION_MS)/100)%3};
  }
  if(running)return{state:"running",row:1,frame:Math.floor(now/100)%3};
  // Die lange Ruhephase zwischen den beiden Zwischenbildern verhindert das
  // frühere Wackeln; sichtbar animiert werden vor allem Blinzeln und Gesicht.
  const idlePhase=Math.floor(now/CAT_IDLE_FRAME_MS)%CAT_IDLE_SEQUENCE.length;
  return{state:"idle",row:0,frame:CAT_IDLE_SEQUENCE[idlePhase]};
}
