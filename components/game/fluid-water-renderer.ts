/** The physics still uses individual drops; this field only shapes their shared silhouette. */
export type WaterVisualParticle = { x: number; y: number; vx: number; vy: number };

const PIXEL_SIZE = 2;
const EDGE_START = .18;
const EDGE_END = .34;
const FILL_START = .30;
const FILL_END = .52;

const smoothstep = (start: number, end: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function buildWaterField(particles: readonly WaterVisualParticle[], width: number, height: number, pixelSize = PIXEL_SIZE) {
  const columns = Math.ceil(width / pixelSize);
  const rows = Math.ceil(height / pixelSize);
  const field = new Float32Array(columns * rows);

  for (const particle of particles) {
    const speed = Math.min(11, Math.hypot(particle.vx, particle.vy));
    const directionX = speed > .2 ? particle.vx / Math.hypot(particle.vx, particle.vy) : 0;
    const directionY = speed > .2 ? particle.vy / Math.hypot(particle.vx, particle.vy) : 1;
    const length = 7 + speed * .65;
    const breadth = 5.8;
    const reach = length;
    const left = Math.max(0, Math.floor((particle.x - reach) / pixelSize));
    const right = Math.min(columns - 1, Math.ceil((particle.x + reach) / pixelSize));
    const top = Math.max(0, Math.floor((particle.y - reach) / pixelSize));
    const bottom = Math.min(rows - 1, Math.ceil((particle.y + reach) / pixelSize));

    for (let row = top; row <= bottom; row++) {
      const dy = (row + .5) * pixelSize - particle.y;
      for (let column = left; column <= right; column++) {
        const dx = (column + .5) * pixelSize - particle.x;
        const along = dx * directionX + dy * directionY;
        const across = dx * directionY - dy * directionX;
        const distance = (along / length) ** 2 + (across / breadth) ** 2;
        if (distance < 1) field[row * columns + column] += (1 - distance) ** 2;
      }
    }
  }

  return { field, columns, rows };
}

export function createFluidWaterRenderer(width: number, height: number) {
  const surface = document.createElement("canvas");
  surface.width = Math.ceil(width / PIXEL_SIZE);
  surface.height = Math.ceil(height / PIXEL_SIZE);
  const surfaceContext = surface.getContext("2d");
  if (!surfaceContext) return { draw: () => {} };
  const image = surfaceContext.createImageData(surface.width, surface.height);

  return {
    draw(ctx: CanvasRenderingContext2D, particles: readonly WaterVisualParticle[]) {
      if (!particles.length) return;
      const { field, columns, rows } = buildWaterField(particles, width, height);
      const pixels = image.data;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const index = row * columns + column;
          const offset = index * 4;
          const density = field[index];
          const edge = smoothstep(EDGE_START, EDGE_END, density);
          if (edge === 0) {
            pixels[offset + 3] = 0;
            continue;
          }
          const fill = smoothstep(FILL_START, FILL_END, density);
          const upper = row ? field[index - columns] : 0;
          const crest = smoothstep(.04, .22, density - upper) * (1 - smoothstep(.55, 1.1, density));
          pixels[offset] = 43 + fill * 43 + crest * 49;
          pixels[offset + 1] = 145 + fill * 57 + crest * 36;
          pixels[offset + 2] = 189 + fill * 46 + crest * 18;
          pixels[offset + 3] = Math.round(edge * (95 + fill * 100));
        }
      }
      surfaceContext.putImageData(image, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(surface, 0, 0, width, height);
      ctx.restore();
    },
  };
}
