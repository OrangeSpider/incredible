export const CATAPULT_SEESAW={x:320,y:430} as const;
export const CATAPULT_CAT_START={x:390,y:390} as const;
export const CATAPULT_PLATFORM={x:710,y:290,width:380,height:18,animalY:255} as const;
export const CATAPULT_MOUSE_START={x:700,y:255} as const;
export const CATAPULT_MOUSE_HOLE_X=850;

export type CatapultImpactMode="launch"|"drop";

export function catapultImpactMode(impactX:number,pivotX:number):CatapultImpactMode{
  return impactX<pivotX?"launch":"drop";
}

export function catapultLaunchVelocity(impactVelocityY:number){
  return{x:6,y:-Math.min(12,10+Math.abs(impactVelocityY)*.12)};
}

export function advanceCatAndMouse(catX:number,mouseX:number,dt:number){
  return{catX:Math.min(800,catX+dt*.055),mouseX:Math.min(CATAPULT_MOUSE_HOLE_X,mouseX+dt*.09)};
}
