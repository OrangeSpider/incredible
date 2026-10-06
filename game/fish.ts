export const FISHBOWL_BREAK_SPEED=4.5;
export const FISH_REVEAL_DELAY_MS=540;
export const CAT_FISH_SIGHT_HEIGHT=70;

// The three intact-bowl drawings are not centered identically inside their
// 418 px source cells. Counter that source drift so the glass stays fixed while
// only Mr. Blue changes pose.
const FISHBOWL_SOURCE_CELL_WIDTH=418;
const FISHBOWL_SOURCE_CENTER_X=FISHBOWL_SOURCE_CELL_WIDTH/2;
const FISHBOWL_FRAME_CENTERS_X=[219,212,188.5] as const;

export function fishBowlSpriteOffsetX(frame:number,renderedWidth:number):number{
  const center=FISHBOWL_FRAME_CENTERS_X[frame]??FISHBOWL_SOURCE_CENTER_X;
  return (FISHBOWL_SOURCE_CENTER_X-center)*renderedWidth/FISHBOWL_SOURCE_CELL_WIDTH;
}

export function fishbowlBreaks(verticalSpeed:number,isDynamic:boolean):boolean{
  return isDynamic&&verticalSpeed>=FISHBOWL_BREAK_SPEED;
}

export function catSeesFish({catX,catY,fishX,fishY,fishVisible}:{catX:number;catY:number;fishX:number;fishY:number;fishVisible:boolean}):boolean{
  return fishVisible&&fishX>catX&&Math.abs(fishY-catY)<=CAT_FISH_SIGHT_HEIGHT;
}

export function advanceCatTowardFish(catX:number,fishX:number,dt:number):number{
  return Math.min(fishX-48,catX+dt*.085);
}
