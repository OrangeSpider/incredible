export const SCISSOR_LAYOUT=[
  {x:420,y:340,balloonX:420},
  {x:620,y:340,balloonX:620},
  {x:800,y:340,balloonX:800},
] as const;

export const SCISSOR_PULL_OFFSET={x:27,y:27} as const;
export const SCISSOR_IMPACT_SPEED=2.4;
export const SCISSOR_TENSION_SPEED=.18;

export function scissorPullPoint(index:number){
  const scissor=SCISSOR_LAYOUT[index];
  return{x:scissor.x+SCISSOR_PULL_OFFSET.x,y:scissor.y+SCISSOR_PULL_OFFSET.y};
}

export function scissorClosesFromImpact(verticalSpeed:number,isDynamic:boolean){
  return isDynamic&&verticalSpeed>=SCISSOR_IMPACT_SPEED;
}

export function ropePullIsTaut(anchor:{x:number;y:number},pull:{x:number;y:number},velocity:{x:number;y:number},restLength:number){
  const dx=pull.x-anchor.x,dy=pull.y-anchor.y,distance=Math.max(.001,Math.hypot(dx,dy));
  const outwardSpeed=(velocity.x*dx+velocity.y*dy)/distance;
  return distance>=restLength*.985&&outwardSpeed>=SCISSOR_TENSION_SPEED;
}
