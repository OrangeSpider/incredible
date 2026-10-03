import type Matter from "matter-js";
import type { MachinePhysicsEngine } from "../../engine/physics-engine.ts";
import { gadgetSize, candleFlameLocal } from "../../engine/gadget-geometry.ts";

let atlas: HTMLImageElement | undefined;
function loadAtlas() {
  if (!atlas) { atlas = new Image(); atlas.src = "/assets/gadget-cartoon-atlas.png"; }
  return atlas;
}
function sprite(ctx: CanvasRenderingContext2D, row: number, frame: number, x: number, y: number, width: number, height: number) {
  const atlas = loadAtlas();
  if (!atlas.complete || !atlas.naturalWidth) return false;
  const w = atlas.naturalWidth / 6, h = atlas.naturalHeight / 4;
  const trim = row === 1 ? h * .05 : 0;
  ctx.drawImage(atlas, frame * w, row * h + trim, w, h - trim, x, y + height * trim / h, width, height * (1 - trim / h)); return true;
}
function gradient(ctx: CanvasRenderingContext2D, y: number, height: number, light: string, dark: string) {
  const paint = ctx.createLinearGradient(0, y, 0, y + height); paint.addColorStop(0, light); paint.addColorStop(1, dark); return paint;
}
function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, light: string, dark: string, radius = 5) {
  ctx.fillStyle = gradient(ctx,y,h,light,dark); ctx.strokeStyle="#233b42";ctx.lineWidth=2.5;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();ctx.stroke();
  ctx.strokeStyle="rgba(255,240,184,.55)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+4,y+4);ctx.lineTo(x+w-4,y+4);ctx.stroke();
}
function rivet(ctx: CanvasRenderingContext2D, x:number,y:number) {
  ctx.fillStyle="#d8a744";ctx.strokeStyle="#674921";ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#fff1b0";ctx.fillRect(x-1,y-1,1.5,1.5);
}
function smoke(ctx:CanvasRenderingContext2D,x:number,y:number,age:number,lifetime=1200) {
  if(age>=lifetime)return;
  for(let i=0;i<6;i++){ctx.fillStyle=`rgba(110,115,111,${Math.max(0,(1-age/lifetime)*(.3-i*.025))})`;ctx.beginPath();ctx.arc(x+Math.sin(i*2.1+age*.002)*(5+age*.018),y-age*.045-i*5,4+i*2+age*.012,0,Math.PI*2);ctx.fill();}
}
/** Detailed artwork shared by every scene and by editor previews. */
export function drawCartoonArtwork(ctx:CanvasRenderingContext2D,body:Matter.Body,machine:MachinePhysicsEngine,now:number,running:boolean):boolean {
  const id=body.plugin?.machine?.instanceId,config=id?machine.config(id):null;if(!config)return false;
  const {type}=config,state=machine.state(id)?.state,age=machine.stateAgeMs(id)??0,size=gadgetSize(config),clock=running?age:now;
  if(["ramp","woodWall","steelBeam","stoneWall"].includes(type)) {
    const {width:w,height:h}=size,x=-w/2,y=-h/2;
    plate(ctx,x,y,w,h,type==="steelBeam"?"#a9bdc1":type==="stoneWall"?"#a3a796":"#d8a258",type==="steelBeam"?"#405b68":type==="stoneWall"?"#626b63":"#815020",3);
    ctx.save();ctx.beginPath();ctx.rect(x+2,y+2,w-4,h-4);ctx.clip();ctx.lineWidth=1.3;
    if(type==="stoneWall") {ctx.strokeStyle="#485249";for(let row=0;row<h/25;row++){const top=y+row*25;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(-x,top);ctx.stroke();for(let col=0;col<w/35+1;col++){const at=x+col*35+(row%2?17:0);ctx.beginPath();ctx.moveTo(at,top);ctx.lineTo(at,top+25);ctx.stroke();}}}
    else if(type==="steelBeam") {ctx.fillStyle="rgba(25,49,60,.45)";ctx.fillRect(x+6,y+h*.35,w-12,h*.35);for(let at=x+10;at<-x;at+=45)rivet(ctx,at,0);}
    else {ctx.strokeStyle="rgba(91,51,24,.5)";for(let line=0;line<Math.min(20,h/5);line++){ctx.beginPath();ctx.moveTo(x,y+4+line*6);for(let at=x;at<=-x;at+=12)ctx.lineTo(at,y+4+line*6+Math.sin(at*.05+line)*2);ctx.stroke();}for(const at of [x+7,-x-7])rivet(ctx,at,0);}
    ctx.restore();return true;
  }
  if(["ball","tennisBall","cannonball","weight","gear","gearSource","gearTarget","needle","magnet","snapGate"].includes(type)) {
    if(type==="weight"){plate(ctx,-size.width/2,-size.height/2,size.width,size.height,"#84939b","#354752");ctx.strokeStyle="#263c43";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-size.height/2-6,8,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#ead29b";ctx.font="bold 13px Georgia";ctx.fillText("50 kg",-19,5);}
    else if(type.startsWith("gear")){const r=size.width/2;ctx.save();ctx.rotate(Number(machine.state(id)?.properties.rotorAngle??0));ctx.fillStyle=gradient(ctx,-r,r*2,"#f8d07a","#a66c20");ctx.strokeStyle="#25454c";ctx.lineWidth=2;for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.fillRect(r-6,-5,12,10);ctx.strokeRect(r-6,-5,12,10);}ctx.beginPath();ctx.arc(0,0,r-3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#355863";ctx.beginPath();ctx.arc(0,0,r*.32,0,Math.PI*2);ctx.fill();rivet(ctx,0,0);ctx.restore();}
    else if(type==="needle"){ctx.fillStyle=gradient(ctx,-35,70,"#dae5de","#516975");ctx.strokeStyle="#243d45";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(8,35);ctx.lineTo(-8,35);ctx.closePath();ctx.fill();ctx.stroke();plate(ctx,-14,30,28,8,"#e4b35e","#916226");}
    else if(type==="magnet"){ctx.strokeStyle="#25444d";ctx.lineWidth=19;ctx.beginPath();ctx.arc(0,-3,20,0,Math.PI);ctx.stroke();ctx.strokeStyle="#c95140";ctx.lineWidth=13;ctx.stroke();plate(ctx,-29,-18,18,20,"#becfc8","#687f87");plate(ctx,11,-18,18,20,"#becfc8","#687f87");if(running){ctx.strokeStyle=`rgba(80,150,165,${.2+.15*Math.sin(now*.004)})`;ctx.lineWidth=1.5;for(const r of [35,45,55]){ctx.beginPath();ctx.arc(0,0,r,.1,Math.PI-.1);ctx.stroke();}}}
    else if(type==="snapGate"){
      ctx.fillStyle="#334a53";ctx.beginPath();ctx.arc(0,-size.height/2,12,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(0,-size.height/2);if(state==="open")ctx.rotate(-Math.min(1,age/520)*1.18);
      plate(ctx,-size.width/2,0,size.width,size.height,"#74a9ad","#285566");for(let y=18;y<size.height-12;y+=22){ctx.strokeStyle="#a0c9c6";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-size.width/2+3,y);ctx.lineTo(size.width/2-3,y-7);ctx.stroke();}
      rivet(ctx,0,10);rivet(ctx,0,size.height-10);ctx.fillStyle=state==="open"?"#7ec985":"#d96f46";ctx.strokeStyle="#374c50";ctx.lineWidth=2;ctx.beginPath();ctx.arc(16,size.height/2,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    }
    else{const r=body.circleRadius||size.width/2;ctx.fillStyle=gradient(ctx,-r,r*2,type==="tennisBall"?"#eef48a":"#738795",type==="tennisBall"?"#a4b934":"#1f3545");ctx.strokeStyle="#243e49";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="rgba(255,245,204,.5)";ctx.beginPath();ctx.ellipse(-r*.28,-r*.35,r*.25,r*.1,-.6,0,Math.PI*2);ctx.fill();if(type==="ball"){ctx.fillStyle="#172834";for(const [x,y] of [[-4,-4],[2,-7],[3,0]]){ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();}}if(type==="tennisBall"){ctx.strokeStyle="#fff8d2";ctx.lineWidth=2;for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*r,0,r*.8,side<0?-1.3:1.9,side<0?1.3:4.4);ctx.stroke();}}}
    return true;
  }
  if(type==="candle") {
    const flame=candleFlameLocal(config),w=Math.min(size.width*.7,35),h=size.height,bodyHeight=Math.max(20,h/2-flame.y-12),image=loadAtlas();
    // The generated wax and holder stay anchored; the geometric flame below is
    // centered on exactly the point used by ignition and light calculations.
    if(image.complete && image.naturalWidth){const scale=image.naturalWidth/1536;ctx.drawImage(image,73*scale,115*scale,143*scale,150*scale,-bodyHeight*.48,flame.y+12,bodyHeight*.96,bodyHeight);}
    else {plate(ctx,-w/2,flame.y+12,w,bodyHeight-6,"#fff0b6","#cda956",5);plate(ctx,-w/2-6,h/2-4,w+12,8,"#eed08a","#a47a28",3);}
    ctx.strokeStyle="#493825";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,flame.y+12);ctx.lineTo(0,flame.y+4);ctx.stroke();
    if(state==="burning"){
      const sway=Math.sin(clock*.014)*3,pulse=1+Math.sin(clock*.029)*.08;
      ctx.fillStyle="#ee7424";ctx.strokeStyle="#b74e1e";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-7,flame.y+9);ctx.quadraticCurveTo(-13,flame.y-1,sway,flame.y-18*pulse);ctx.quadraticCurveTo(14+sway,flame.y-1,7,flame.y+9);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#ffe785";ctx.beginPath();ctx.ellipse(sway*.3,flame.y+3,4,9,0,0,Math.PI*2);ctx.fill();
      const drip=(clock%2300)/2300;ctx.fillStyle="#ffe5a5";ctx.strokeStyle="#ba8c47";ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(w*.43,flame.y+21+drip*bodyHeight*.55,2.5,3+Math.sin(drip*Math.PI)*2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    }else if(state==="extinguished")smoke(ctx,0,flame.y,age);
    return true;
  }
  if(type==="pulley" || type==="movingPulley") {
    const r=body.circleRadius||30;
    ctx.fillStyle=gradient(ctx,-r,r*2,type==="pulley"?"#f5cf72":"#8dd0cb",type==="pulley"?"#9e6822":"#376877");ctx.strokeStyle="#243e49";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle="#566971";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r-7,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#fff0b0";ctx.lineWidth=2;
    for(let spoke=0;spoke<5;spoke++){const a=spoke*Math.PI*2/5;ctx.beginPath();ctx.moveTo(Math.cos(a)*9,Math.sin(a)*9);ctx.lineTo(Math.cos(a)*(r-11),Math.sin(a)*(r-11));ctx.stroke();}
    plate(ctx,-7,-7,14,14,"#b4c9c8","#5c747f",7);rivet(ctx,0,0);return true;
  }
  if(type==="seesaw") {
    plate(ctx,-size.width/2,-size.height/2,size.width,size.height,"#e5b568","#885025",3);
    ctx.strokeStyle="#aa6d31";ctx.lineWidth=1;for(let line=0;line<3;line++){ctx.beginPath();ctx.moveTo(-size.width/2+6,-4+line*4);ctx.quadraticCurveTo(0,5+line*2,size.width/2-6,-4+line*4);ctx.stroke();}
    for(const side of [-1,1])rivet(ctx,side*(size.width/2-10),0);
    ctx.save();ctx.rotate(-body.angle);ctx.fillStyle=gradient(ctx,8,38,"#d56f46","#883926");ctx.strokeStyle="#59362a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-27,46);ctx.lineTo(27,46);ctx.lineTo(0,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();rivet(ctx,0,0);return true;
  }
  if(type==="bucket") {
    ctx.fillStyle=gradient(ctx,-28,60,"rgba(154,202,209,.42)","rgba(50,95,119,.62)");ctx.strokeStyle="#27424c";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-38,-28);ctx.lineTo(-29,32);ctx.quadraticCurveTo(0,39,29,32);ctx.lineTo(38,-28);ctx.fill();ctx.stroke();
    ctx.strokeStyle="#d5e4d9";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-30,-18);ctx.lineTo(-24,24);ctx.stroke();ctx.strokeStyle="#42606b";ctx.lineWidth=2;for(const x of [-16,0,16]){ctx.beginPath();ctx.moveTo(x,-16);ctx.lineTo(x*.8,29);ctx.stroke();}
    ctx.strokeStyle="#547381";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-25,38,Math.PI,0);ctx.stroke();ctx.strokeStyle="#c7dcd8";ctx.lineWidth=2;ctx.stroke();for(const x of [-34,34])rivet(ctx,x,-23);return true;
  }
  if(type==="generator") {
    const frame=state==="running"?Math.floor(clock/80)%6:0;
    if(state==="running" && running)ctx.translate(Math.sin(clock*.055)*.7,Math.cos(clock*.06)*.5);
    if(!sprite(ctx,1,frame,-size.width*.65,-size.height*.7,size.width*1.3,size.height*1.4))return false;
    ctx.fillStyle=state==="running"?"#8ee676":"#c34e3c";ctx.strokeStyle="#355057";ctx.lineWidth=1;ctx.beginPath();ctx.arc(30,-2,4.3,0,Math.PI*2);ctx.fill();ctx.stroke();
    plate(ctx,28,12,16,16,"#f6e8ad","#c49d52",4);ctx.fillStyle="#273e48";for(const x of [33,39]){ctx.beginPath();ctx.arc(x,20,2,0,Math.PI*2);ctx.fill();}return true;
  }
  if(type==="cannon") {
    const frame=state==="firing"&&age<520?Math.min(5,2+Math.floor(age/130)):0;
    const recoil=state==="firing"&&age<300?Math.sin(age/300*Math.PI)*8:0;
    if(!sprite(ctx,2,frame,-62-recoil,-57,124,114)){
      // Keep the carriage anchored while the barrel recoils, even before the atlas loads.
      plate(ctx,-48,14,78,14,"#d59b53","#80512c",4);
      ctx.save();ctx.translate(-recoil,0);
      plate(ctx,-39,-16,80,32,"#7398a3","#233e50",12);
      for(const x of [-27,9])plate(ctx,x,-18,7,36,"#ffe098","#b88230",3);
      plate(ctx,33,-21,15,42,"#ffe098","#b88230",5);
      ctx.fillStyle="#1c303a";ctx.strokeStyle="#6d552d";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(45,0,5,15,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
      ctx.fillStyle=gradient(ctx,6,40,"#dfad68","#8b552a");ctx.strokeStyle="#493725";ctx.lineWidth=3;ctx.beginPath();ctx.arc(-18,26,20,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle="#714725";ctx.lineWidth=3;for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(-18,26);ctx.lineTo(-18+Math.cos(a)*16,26+Math.sin(a)*16);ctx.stroke();}rivet(ctx,-18,26);
    }
    // The fire renderer adds the sampled fuse and its flames at their physical positions.
    if(state==="firing")smoke(ctx,52,-10,age);return true;
  }
  if(type==="fishBowl" && state==="broken") {ctx.fillStyle="rgba(133,195,205,.55)";ctx.strokeStyle="#678f9c";ctx.lineWidth=1;for(let i=0;i<9;i++){const x=Math.sin(i*2.3)*50,y=40+(i%3)*4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+6,y-9);ctx.lineTo(x+12,y+1);ctx.closePath();ctx.fill();ctx.stroke();}return true;}
  if(type==="tnt") {
    if(state==="exploded"){
      if(age<520){const t=age/520,r=18+Math.sin(t*Math.PI*.8)*75;ctx.fillStyle=`rgba(244,120,29,${1-t})`;ctx.strokeStyle=`rgba(255,220,91,${1-t})`;ctx.lineWidth=6;ctx.beginPath();for(let i=0;i<24;i++){const a=i/24*Math.PI*2,rad=r*(i%2?.65:1);ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fill();ctx.stroke();for(let i=0;i<12;i++){ctx.fillStyle=`rgba(190,73,32,${1-t})`;ctx.fillRect(Math.cos(i*2.3)*age*.16,Math.sin(i*2.3)*age*.16,5,3);}}smoke(ctx,0,0,age,1500);return true;
    }
    loadAtlas();
    if(atlas?.complete && atlas.naturalWidth) {
      const w=atlas.naturalWidth/6,h=atlas.naturalHeight/4;
      ctx.drawImage(atlas,0,h*3+h*.32,w,h*.68,-66,-19,106,65);
      const progress=state==="burning"?Math.min(1,age/650):0,x=-18+16*progress,y=-28+8*progress;
      ctx.strokeStyle=state==="extinguished"?"#65969f":"#614c2b";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-2,-20);ctx.quadraticCurveTo(-9,-33,x,y);ctx.stroke();
      if(state==="burning"){ctx.fillStyle="#ffdf63";ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#f48724";ctx.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4+age*.025,r=8+(i%3);ctx.beginPath();ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.stroke();}smoke(ctx,x,y,age,950);}
      if(state==="extinguished"){ctx.fillStyle="rgba(75,170,206,.5)";ctx.beginPath();ctx.ellipse(0,5,32,12,0,0,Math.PI*2);ctx.fill();}return true;
    }
  }
  return false;
}
