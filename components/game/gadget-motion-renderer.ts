import { AIRFLOW_RANGE } from "../../game/airflow.ts";

function paint(ctx: CanvasRenderingContext2D, light: string, dark: string, radius: number) {
  const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
  gradient.addColorStop(0, light); gradient.addColorStop(1, dark);
  return gradient;
}

function hub(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.fillStyle = paint(ctx, "#ffe7a1", "#aa742e", radius);
  ctx.strokeStyle = "#5d492e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#fff2bd"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-1, -1, radius * .55, Math.PI, Math.PI * 1.8); ctx.stroke();
  ctx.fillStyle = "#5d492e"; ctx.fillRect(-2, -1, 4, 2);
}

export function drawFan(ctx: CanvasRenderingContext2D, angle: number, active: boolean, clock: number) {
  ctx.fillStyle = paint(ctx, "#9bb8b9", "#426373", 35); ctx.strokeStyle = "#274654"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-5, 22, 10, 24, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-25, 41, 50, 9, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = paint(ctx, "#f1f4df", "#8badb7", 30);
  ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#d4e3dc"; ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.rotate(angle);
  if (active) {
    ctx.strokeStyle = "rgba(70,138,155,.22)"; ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 21, i * Math.PI / 2 - .8, i * Math.PI / 2); ctx.stroke(); }
  }
  ctx.fillStyle = paint(ctx, "#78c6cf", "#357488", 25); ctx.strokeStyle = "#335d70"; ctx.lineWidth = 1.5;
  for (let blade = 0; blade < 4; blade++) {
    ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(3, -3);
    ctx.bezierCurveTo(16, -20, 31, -13, 25, -2); ctx.bezierCurveTo(21, 8, 12, 11, 3, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(61,91,103,.6)"; ctx.lineWidth = 1;
  for (const radius of [11, 20, 27]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); }
  for (let spoke = 0; spoke < 8; spoke++) {
    const a = spoke * Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.stroke();
  }
  hub(ctx, 6);
  // The direction stays visible in the editor and while a switched/socket fan is off.
  ctx.save(); ctx.strokeStyle = active ? "#27788e" : "#526e78"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(94, 0); ctx.moveTo(83, -8); ctx.lineTo(94, 0); ctx.lineTo(83, 8); ctx.stroke(); ctx.restore();
  if (!active) return;
  ctx.save(); ctx.strokeStyle = "rgba(62,147,173,.25)"; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -clock / 35;
  ctx.beginPath(); ctx.moveTo(35, -28); ctx.lineTo(AIRFLOW_RANGE, -38 - AIRFLOW_RANGE * .19);
  ctx.moveTo(35, 28); ctx.lineTo(AIRFLOW_RANGE, 38 + AIRFLOW_RANGE * .19); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 2; ctx.lineCap = "round";
  for (let trail = 0; trail < 9; trail++) {
    const progress = ((clock / 1300 + trail / 9) % 1 + 1) % 1;
    const x = 38 + progress * (AIRFLOW_RANGE - 65), lane = trail % 3 - 1;
    const y = lane * (13 + progress * 30) + Math.sin(progress * 8 + trail) * 3;
    ctx.strokeStyle = `rgba(69,148,166,${Math.sin(progress * Math.PI) * .45})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - lane * 3, x + 22, y); ctx.stroke();
  }
  ctx.restore();
}

export function drawWindmill(ctx: CanvasRenderingContext2D, angle: number, active: boolean) {
  ctx.fillStyle = paint(ctx, "#dcb076", "#80542d", 45); ctx.strokeStyle = "#674724"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(10, 66); ctx.lineTo(-10, 66); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-25, 63, 50, 8, 3); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(angle);
  if (active) {
    ctx.strokeStyle = "rgba(176,123,45,.3)"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.arc(0, 0, 42, a - .35, a + .2); ctx.stroke(); }
  }
  for (let blade = 0; blade < 4; blade++) {
    ctx.rotate(Math.PI / 2); ctx.fillStyle = paint(ctx, "#fff0ab", "#d59d47", 40); ctx.strokeStyle = "#795329"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(7, -4); ctx.lineTo(39, -13); ctx.lineTo(36, 11); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#bd873f"; ctx.lineWidth = 1;
    for (const x of [17, 25, 33]) { ctx.beginPath(); ctx.moveTo(x, -4 - (x - 7) * .28); ctx.lineTo(x, 5 + (x - 8) * .21); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(38, -1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,250,207,.8)"; ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(36, -10); ctx.stroke();
  }
  ctx.restore(); hub(ctx, 8);
}

export function drawMagnifier(ctx: CanvasRenderingContext2D, focusing: boolean, clock: number) {
  const pulse = focusing ? .5 + .5 * Math.sin(clock / 160) : 0;
  ctx.strokeStyle = "#493b2d"; ctx.lineWidth = 10; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 29); ctx.lineTo(0, 57); ctx.stroke();
  ctx.strokeStyle = paint(ctx, "#cf975c", "#704424", 30); ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = "#e8bd77"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, 34); ctx.lineTo(-2, 52); ctx.stroke();
  ctx.fillStyle = paint(ctx, "rgba(226,252,249,.8)", "rgba(75,158,185,.5)", 30);
  ctx.strokeStyle = "#506e7a"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  if (focusing) { ctx.fillStyle = `rgba(255,224,125,${.15 + pulse * .3})`; ctx.fillRect(-11, -30, 22, 60); }
  const glint = focusing ? Math.sin(clock / 550) * 3 : 0;
  ctx.strokeStyle = "rgba(255,255,239,.9)"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(-4 + glint, -6, 4, 17, -.08, Math.PI * .7, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
  if (focusing) {
    ctx.strokeStyle = `rgba(248,189,67,${.35 + pulse * .3})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 33, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
