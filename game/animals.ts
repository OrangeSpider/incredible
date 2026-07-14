import Matter from "matter-js";

export const ANIMAL_FALL_SPEED=0.8;

export function animalHasSupport(animal:Matter.Body,bodies:Matter.Body[],gap=7):boolean{
  const width=animal.bounds.max.x-animal.bounds.min.x;
  const supports=bodies.filter(body=>body.id!==animal.id&&!body.isSensor&&body.label!=="water");
  return[-.28,0,.28].some(offset=>{
    const x=animal.position.x+width*offset;
    const start={x,y:animal.bounds.max.y-2},end={x,y:animal.bounds.max.y+gap};
    return Matter.Query.ray(supports,start,end,2).length>0;
  });
}

export function isAnimalFalling(verticalVelocity:number,hasSupport=false):boolean{
  return !hasSupport&&verticalVelocity>ANIMAL_FALL_SPEED;
}
