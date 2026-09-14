import { GADGET_CATALOG } from "@/engine/gadget-catalog";
import type { ResolvedAnimation } from "@/engine/animation";

const rowsByAsset = new Map<string, number>();
for (const gadget of Object.values(GADGET_CATALOG)) {
  for (const animation of Object.values(gadget.animations)) {
    if (animation.kind !== "sprite") continue;
    const rows = animation.row + Math.ceil(animation.frames / animation.columns);
    rowsByAsset.set(animation.asset, Math.max(rowsByAsset.get(animation.asset) ?? 0, rows));
  }
}

/** Shared sprite-sheet rendering. Canvas-only artwork can still use a custom renderer. */
export function createCatalogSpriteRenderer() {
  const images = new Map<string, HTMLImageElement>();

  return (ctx: CanvasRenderingContext2D, animation: ResolvedAnimation | null,
    x: number, y: number, rotation = 0): boolean => {
    if (!animation || animation.definition.kind !== "sprite") return false;
    const definition = animation.definition;
    let image = images.get(definition.asset);
    if (!image) {
      image = new Image();
      image.src = definition.asset;
      images.set(definition.asset, image);
    }
    if (!image.complete || !image.naturalWidth) return false;
    const cellWidth = image.naturalWidth / definition.columns;
    const cellHeight = image.naturalHeight / (rowsByAsset.get(definition.asset) ?? 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(
      image,
      animation.column * cellWidth, animation.row * cellHeight, cellWidth, cellHeight,
      -definition.width / 2 + (definition.anchorX ?? 0),
      -definition.height / 2 + (definition.anchorY ?? 0),
      definition.width, definition.height,
    );
    ctx.restore();
    return true;
  };
}
