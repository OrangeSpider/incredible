export type CatAnimationState="idle"|"running"|"startled";

export const CAT_STARTLE_FRAME_MS=220;
export const CAT_STARTLE_DURATION_MS=CAT_STARTLE_FRAME_MS*3;

export type CatSpritePose={state:CatAnimationState;row:number;frame:number};

export function catIsRunning({motor,level,mouseFleeAt}:{motor:boolean;level:number;mouseFleeAt:number}):boolean{
  return motor||(level===6&&mouseFleeAt>0);
}

/**
 * The startled state deliberately owns three frames and then falls through to
 * running. Future explosions or impacts only need to provide `startledAt`.
 */
export function catSpritePose(now:number,{running,startledAt}:{running:boolean;startledAt:number|null}):CatSpritePose{
  if(startledAt!==null){
    const elapsed=Math.max(0,now-startledAt);
    if(elapsed<CAT_STARTLE_DURATION_MS)return{state:"startled",row:2,frame:Math.min(2,Math.floor(elapsed/CAT_STARTLE_FRAME_MS))};
    return{state:"running",row:1,frame:Math.floor((elapsed-CAT_STARTLE_DURATION_MS)/100)%3};
  }
  if(running)return{state:"running",row:1,frame:Math.floor(now/100)%3};
  // Ruhig bedeutet wirklich ruhig: kein Wechsel zwischen leicht verschieden
  // ausgerichteten Ganzkörperbildern, solange die Katze nur sitzt.
  return{state:"idle",row:0,frame:0};
}
