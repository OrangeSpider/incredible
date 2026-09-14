export const FISHBOWL_BREAK_SPEED=4.5;
export const FISH_REVEAL_DELAY_MS=540;
export const CAT_FISH_SIGHT_HEIGHT=70;

export function fishbowlBreaks(verticalSpeed:number,isDynamic:boolean):boolean{
  return isDynamic&&verticalSpeed>=FISHBOWL_BREAK_SPEED;
}

export function catSeesFish({catX,catY,fishX,fishY,fishVisible}:{catX:number;catY:number;fishX:number;fishY:number;fishVisible:boolean}):boolean{
  return fishVisible&&fishX>catX&&Math.abs(fishY-catY)<=CAT_FISH_SIGHT_HEIGHT;
}

export function advanceCatTowardFish(catX:number,fishX:number,dt:number):number{
  return Math.min(fishX-48,catX+dt*.085);
}
