export const ANIMAL_FALL_SPEED=0.8;

export function isAnimalFalling(verticalVelocity:number):boolean{
  return verticalVelocity>ANIMAL_FALL_SPEED;
}
