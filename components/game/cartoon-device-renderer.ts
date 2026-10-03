const OUTLINE="#273d45";
function shade(ctx:CanvasRenderingContext2D,y:number,h:number,light:string,dark:string){
  const fill=ctx.createLinearGradient(0,y,0,y+h);fill.addColorStop(0,light);fill.addColorStop(.35,light);fill.addColorStop(1,dark);return fill;
}
function plate(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,light:string,dark:string,r=4){
  ctx.fillStyle=shade(ctx,y,h,light,dark);ctx.strokeStyle=OUTLINE;ctx.lineWidth=2.3;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();
  ctx.strokeStyle="rgba(255,244,193,.65)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+4,y+3);ctx.lineTo(x+w-4,y+3);ctx.stroke();
}
function screw(ctx:CanvasRenderingContext2D,x:number,y:number){
  ctx.fillStyle="#f5d18b";ctx.strokeStyle="#785634";ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-1,y+1);ctx.lineTo(x+1,y-1);ctx.stroke();
}

/** The front lens remains at the light emitter's local x=38. */
export function drawCartoonFlashlight(ctx:CanvasRenderingContext2D,on:boolean,clock:number){
  ctx.save();ctx.lineCap="round";
  ctx.strokeStyle="#675138";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-37,7);ctx.bezierCurveTo(-58,4,-52,31,-34,23);ctx.stroke();
  plate(ctx,-39,-14,61,28,"#7295a3","#254352",7);
  plate(ctx,-41,-13,9,26,"#e8c274","#a87731",4);
  plate(ctx,-25,-11,36,22,"#d8744f","#963e30",4);
  ctx.strokeStyle="#7d3c2d";ctx.lineWidth=1.2;for(let x=-21;x<10;x+=5){ctx.beginPath();ctx.moveTo(x,-7);ctx.lineTo(x-3,7);ctx.stroke();}
  ctx.fillStyle=shade(ctx,-22,44,"#ffe6a2","#b88030");ctx.strokeStyle=OUTLINE;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(16,-13);ctx.quadraticCurveTo(26,-16,33,-22);ctx.lineTo(38,-22);ctx.lineTo(38,22);ctx.lineTo(33,22);ctx.quadraticCurveTo(26,16,16,13);ctx.closePath();ctx.fill();ctx.stroke();
  plate(ctx,14,-15,8,30,"#f7d689","#b07e33",3);
  ctx.fillStyle=shade(ctx,-19,38,on?"#fff9cf":"#e6f0e6",on?"#f4cd65":"#7dabb7");ctx.strokeStyle=OUTLINE;ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(37,0,5,20,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle="rgba(255,255,227,.8)";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(37,-4,2,10,0,Math.PI,Math.PI*1.8);ctx.stroke();
  screw(ctx,-35,-7);screw(ctx,18,9);
  if(on){ctx.strokeStyle=`rgba(255,218,102,${.5+.2*Math.sin(clock/130)})`;ctx.lineWidth=1.8;for(const y of [-15,0,15]){ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(51,y*1.2);ctx.stroke();}}
  ctx.restore();
}

/** Glass, filament and brass socket surround the actual local light point (0,-20). */
export function drawCartoonLamp(ctx:CanvasRenderingContext2D,on:boolean,clock:number){
  ctx.save();ctx.lineCap="round";
  plate(ctx,-29,23,58,9,"#71939d","#304c5b",5);
  plate(ctx,-19,20,38,6,"#ffe3a0","#a97833",3);
  plate(ctx,-5,5,10,17,"#a9c3c5","#4c6d7b",3);
  ctx.fillStyle=shade(ctx,-41,38,on?"#fff8bb":"#e5eee0",on?"#f6c25b":"#8fb7bb");ctx.strokeStyle=OUTLINE;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-9,-7);ctx.bezierCurveTo(-12,-12,-21,-14,-20,-25);ctx.bezierCurveTo(-19,-46,19,-46,20,-25);ctx.bezierCurveTo(21,-14,12,-12,9,-7);ctx.lineTo(8,-3);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle=on?"#ed8c2c":"#728d89";ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-5,-4);ctx.lineTo(-7,-22);ctx.lineTo(-3,-19);ctx.lineTo(0,-24);ctx.lineTo(3,-19);ctx.lineTo(7,-22);ctx.lineTo(5,-4);ctx.stroke();
  ctx.strokeStyle="rgba(255,255,235,.86)";ctx.lineWidth=3;ctx.beginPath();ctx.bezierCurveTo(-12,-16,-17,-28,-8,-34);ctx.stroke();
  plate(ctx,-10,-4,20,11,"#ffe6a2","#ac7b32",3);
  ctx.strokeStyle="#8b652f";ctx.lineWidth=1;for(const y of [-1,3]){ctx.beginPath();ctx.moveTo(-8,y);ctx.lineTo(8,y+1);ctx.stroke();}
  screw(ctx,-21,28);screw(ctx,21,28);
  if(on){ctx.strokeStyle=`rgba(246,185,61,${.6+.2*Math.sin(clock/150)})`;ctx.lineWidth=2;for(const a of [-2.7,-2.15,-1.57,-1,-.45]){ctx.beginPath();ctx.moveTo(Math.cos(a)*25,-20+Math.sin(a)*25);ctx.lineTo(Math.cos(a)*30,-20+Math.sin(a)*30);ctx.stroke();}}
  ctx.restore();
}

/** The handle moves from y=-33 to -13; the ignition terminal stays at (40,20). */
export function drawCartoonDetonator(ctx:CanvasRenderingContext2D,pressed:boolean,age:number){
  ctx.save();ctx.lineCap="round";
  plate(ctx,-25,-5,50,41,"#dda461","#86512b",5);
  ctx.save();ctx.beginPath();ctx.roundRect(-23,-3,46,37,4);ctx.clip();ctx.strokeStyle="#a66a34";ctx.lineWidth=1;
  for(let y=0;y<35;y+=7){ctx.beginPath();ctx.moveTo(-24,y);ctx.bezierCurveTo(-10,y-3,7,y+4,24,y);ctx.stroke();}ctx.restore();
  for(const x of [-25,17]){plate(ctx,x,-5,8,41,"#8dabb0","#3b5965",2);screw(ctx,x+4,1);screw(ctx,x+4,30);}
  const handleY=-33+(pressed?Math.min(1,age/140)*20:0);
  plate(ctx,-4,handleY,8,-handleY+1,"#c9d8cf","#65838c",2);
  plate(ctx,-9,-7,18,8,"#ffdfa0","#a57530",3);
  plate(ctx,-24,handleY-3,48,7,"#dc7851","#91382b",4);
  for(const x of [-22,14])plate(ctx,x,handleY-4,8,9,"#ffe19b","#b78437",3);
  plate(ctx,-13,9,26,17,"#fff0c3","#d3b371",3);
  ctx.fillStyle="#88402b";ctx.font="bold 11px Georgia";ctx.textAlign="center";ctx.fillText("TNT",0,21);
  plate(ctx,25,16,7,8,"#f4d389","#a57531",2);
  ctx.strokeStyle="#654a32";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(32,20);ctx.lineTo(40,20);ctx.stroke();
  if(pressed&&age<160){
    ctx.fillStyle="#ffe9a0";ctx.beginPath();ctx.arc(40,20,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#ed992d";ctx.lineWidth=2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4+age*.025,r=7+age/40;ctx.beginPath();ctx.moveTo(40+Math.cos(a)*5,20+Math.sin(a)*5);ctx.lineTo(40+Math.cos(a)*r,20+Math.sin(a)*r);ctx.stroke();}
  }
  ctx.restore();
}
