export type DrivePoint = { x: number; y: number };

export type DriveBeltGeometry = {
  source: DrivePoint;
  target: DrivePoint;
  sourceRadius: number;
  targetRadius: number;
  tangents: Array<{ source: DrivePoint; target: DrivePoint }>;
};

export const CONVEYOR_SPEED = 3.4;

export function conveyorWheelCenters(centerX: number, centerY: number, width: number): [DrivePoint, DrivePoint] {
  const inset = Math.min(27, Math.max(18, width * .08));
  return [
    { x: centerX - width / 2 + inset, y: centerY },
    { x: centerX + width / 2 - inset, y: centerY },
  ];
}

export function driveBeltGeometry(source: DrivePoint, target: DrivePoint, sourceRadius = 18, targetRadius = 22): DriveBeltGeometry {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), Math.abs(sourceRadius - targetRadius) + .001);
  const baseAngle = Math.atan2(dy, dx);
  const tangentOffset = Math.acos(Math.max(-1, Math.min(1, (sourceRadius - targetRadius) / distance)));
  const normals = [baseAngle + tangentOffset, baseAngle - tangentOffset];
  return {
    source,
    target,
    sourceRadius,
    targetRadius,
    tangents: normals.map((angle) => ({
      source: { x: source.x + Math.cos(angle) * sourceRadius, y: source.y + Math.sin(angle) * sourceRadius },
      target: { x: target.x + Math.cos(angle) * targetRadius, y: target.y + Math.sin(angle) * targetRadius },
    })),
  };
}

function drawWheel(ctx: CanvasRenderingContext2D, center: DrivePoint, radius: number, turn: number) {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(turn);
  ctx.fillStyle = "#d69b29";
  ctx.strokeStyle = "#173f50";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let spoke = 0; spoke < 6; spoke++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius - 5, 0);
    ctx.stroke();
  }
  ctx.fillStyle = "#173f50";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawConveyor(
  ctx: CanvasRenderingContext2D,
  options: { centerX: number; centerY: number; width: number; now: number; running: boolean; direction?: -1 | 1 },
) {
  const { centerX, centerY, width, now, running, direction = 1 } = options;
  const [leftWheel, rightWheel] = conveyorWheelCenters(centerX, centerY, width);
  const wheelRadius = 22;
  const turn = running ? now * .008 * direction : 0;

  ctx.save();
  ctx.strokeStyle = "#4c2f1d";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(leftWheel.x, centerY - 16);
  ctx.lineTo(rightWheel.x, centerY - 16);
  ctx.arc(rightWheel.x, centerY, 16, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(leftWheel.x, centerY + 16);
  ctx.arc(leftWheel.x, centerY, 16, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = "#b96b2b";
  ctx.lineWidth = 11;
  ctx.setLineDash([20, 9]);
  ctx.lineDashOffset = running ? -now * .09 * direction : 0;
  ctx.stroke();
  ctx.setLineDash([]);
  drawWheel(ctx, leftWheel, wheelRadius, turn);
  drawWheel(ctx, rightWheel, wheelRadius, turn);
  ctx.restore();

  return { leftWheel, rightWheel, wheelRadius };
}

export function drawDriveBelt(
  ctx: CanvasRenderingContext2D,
  geometry: DriveBeltGeometry,
  now: number,
  running: boolean,
) {
  const drawLayer = (color: string, width: number, dashed: boolean) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dashed) {
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = running ? -now * .08 : 0;
    }
    ctx.beginPath();
    for (const tangent of geometry.tangents) {
      ctx.moveTo(tangent.source.x, tangent.source.y);
      ctx.lineTo(tangent.target.x, tangent.target.y);
    }
    ctx.moveTo(geometry.source.x + geometry.sourceRadius, geometry.source.y);
    ctx.arc(geometry.source.x, geometry.source.y, geometry.sourceRadius, 0, Math.PI * 2);
    ctx.moveTo(geometry.target.x + geometry.targetRadius, geometry.target.y);
    ctx.arc(geometry.target.x, geometry.target.y, geometry.targetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawLayer("#3b281c", 9, false);
  drawLayer("#b9854d", 2.5, true);
}
