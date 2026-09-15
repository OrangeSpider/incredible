import Matter from "matter-js";

export const WATER_PARTICLE_COUNT=48;
export const WATER_PARTICLE_RADIUS=3.2;
const WATER_NEIGHBOR_RADIUS=16;
const WATER_REST_DISTANCE=8.5;
const WATER_MAX_SPEED=14;

export type BucketAssembly={
  bucket:Matter.Body;
  water:Matter.Body[];
};

const rotate=(x:number,y:number,angle:number)=>({
  x:x*Math.cos(angle)-y*Math.sin(angle),
  y:x*Math.sin(angle)+y*Math.cos(angle),
});

/**
 * Ein offener, dreiteiliger Kollisionskörper. Die Wassertropfen starten im
 * Innenraum. Die Levelsteuerung kippt den statischen Körper kontrolliert um
 * seinen gezeichneten Henkelpunkt; Wasser und Eimerwände reagieren in Matter.js.
 */
export function createBucketAssembly(x:number,y:number,angle:number):BucketAssembly{
  const bottom=Matter.Bodies.rectangle(x,y+26,70,10,{label:"bucketWall",friction:.45});
  const left=Matter.Bodies.rectangle(x-33,y,10,58,{label:"bucketWall",friction:.35,angle:-.1});
  const right=Matter.Bodies.rectangle(x+33,y,10,58,{label:"bucketWall",friction:.35,angle:.1});
  const bucket=Matter.Body.create({parts:[bottom,left,right],label:"bucket",isStatic:true,friction:.55,restitution:.05});
  Matter.Body.setPosition(bucket,{x,y});
  Matter.Body.setAngle(bucket,angle);

  const water:Matter.Body[]=[];
  for(let row=0;row<6;row++)for(let column=0;column<8;column++){
    const local=rotate(-24.5+column*7,-18+row*6.2,angle);
    water.push(Matter.Bodies.circle(x+local.x,y+local.y,WATER_PARTICLE_RADIUS,{
      label:"water",
      density:.00016,
      friction:.015,
      frictionStatic:0,
      frictionAir:.004,
      restitution:.015,
      slop:.01,
      collisionFilter:{group:-1},
    }));
  }
  return{bucket,water};
}

/** A small pressure/viscosity pass keeps the drops from behaving like unrelated marbles. */
export function advanceWaterFlow(water:readonly Matter.Body[]){
  const velocity=water.map(drop=>({x:drop.velocity.x,y:drop.velocity.y}));
  for(let i=0;i<water.length;i++)for(let j=i+1;j<water.length;j++){
    const dx=water[j].position.x-water[i].position.x;
    const dy=water[j].position.y-water[i].position.y;
    const distance=Math.hypot(dx,dy);
    if(distance<.001||distance>=WATER_NEIGHBOR_RADIUS)continue;
    const nx=dx/distance,ny=dy/distance;
    const pressure=distance<WATER_REST_DISTANCE
      ? (WATER_REST_DISTANCE-distance)*.035
      : -(distance-WATER_REST_DISTANCE)*.0025;
    velocity[i].x-=nx*pressure;velocity[i].y-=ny*pressure;
    velocity[j].x+=nx*pressure;velocity[j].y+=ny*pressure;
    const viscosity=.012*(1-distance/WATER_NEIGHBOR_RADIUS);
    const blendX=(velocity[j].x-velocity[i].x)*viscosity;
    const blendY=(velocity[j].y-velocity[i].y)*viscosity;
    velocity[i].x+=blendX;velocity[i].y+=blendY;
    velocity[j].x-=blendX;velocity[j].y-=blendY;
  }
  for(let i=0;i<water.length;i++){
    const drop=water[i],next=velocity[i];
    if(drop.position.y< -15){Matter.Body.setPosition(drop,{x:drop.position.x,y:-15});next.y=Math.abs(next.y)*.25}
    if(drop.position.x<4||drop.position.x>896){
      Matter.Body.setPosition(drop,{x:Math.max(4,Math.min(896,drop.position.x)),y:drop.position.y});
      next.x=-next.x*.25;
    }
    const speed=Math.hypot(next.x,next.y);
    if(speed>WATER_MAX_SPEED){next.x=next.x/speed*WATER_MAX_SPEED;next.y=next.y/speed*WATER_MAX_SPEED}
    Matter.Body.setVelocity(drop,next);
  }
}

export const WATER_SHAPE_RULES=[
  {objects:"Hamsterrad, Ventilator, Trampolin, Wippe, Kanone, Bowlingkugel, Laufband, Rampe",shape:"Feste Außenkontur",response:"Wasser kollidiert und fließt außen herum"},
  {objects:"Luftballon",shape:"Beweglicher Kreis",response:"Wasser teilt sich an der Hülle; der Ballon bleibt beweglich"},
  {objects:"Seil",shape:"Keine Wasserkollision",response:"Wasser ignoriert das Seil"},
  {objects:"Katze, Maus",shape:"Bewegliche Fluchtzone",response:"Tier flieht vom nächsten Wasserkontakt weg"},
  {objects:"Lunte, Kerze",shape:"Löschsensor",response:"Kontakt stoppt Abbrand oder löscht die Flamme"},
  {objects:"Boden, Eimer, Behälter",shape:"Feste Begrenzung",response:"Wasser verteilt sich oder sammelt sich im Innenraum"},
  {objects:"Stahlträger, Holzwand, Steinmauer",shape:"Feste Levelgeometrie",response:"Wasser wird umgelenkt und kann davor aufstauen"},
] as const;
