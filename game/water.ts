import Matter from "matter-js";

export const WATER_PARTICLE_COUNT=48;
export const WATER_PARTICLE_RADIUS=3.2;

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

export const WATER_SHAPE_RULES=[
  {objects:"Hamsterrad, Ventilator, Trampolin, Wippe, Kanone, Bowlingkugel, Laufband, Rampe",shape:"Feste Außenkontur",response:"Wasser kollidiert und fließt außen herum"},
  {objects:"Luftballon",shape:"Beweglicher Kreis",response:"Wasser teilt sich an der Hülle; der Ballon bleibt beweglich"},
  {objects:"Seil",shape:"Keine Wasserkollision",response:"Wasser ignoriert das Seil"},
  {objects:"Katze, Maus",shape:"Bewegliche Fluchtzone",response:"Tier flieht vom nächsten Wasserkontakt weg"},
  {objects:"Lunte, Kerze",shape:"Löschsensor",response:"Kontakt stoppt Abbrand oder löscht die Flamme"},
  {objects:"Boden, Eimer, Behälter",shape:"Feste Begrenzung",response:"Wasser verteilt sich oder sammelt sich im Innenraum"},
  {objects:"Stahlträger, Holzwand, Steinmauer",shape:"Feste Levelgeometrie",response:"Wasser wird umgelenkt und kann davor aufstauen"},
] as const;
