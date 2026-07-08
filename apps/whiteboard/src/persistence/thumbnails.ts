import type { Element } from "../types/model";
import { aabb } from "../canvas/geometry";
import { drawElement } from "../canvas/shapes";

const THUMB_W = 240;
const THUMB_H = 160;

/**
 * Render the scene into a small offscreen canvas and return a PNG data URL.
 * Fits all elements into the thumbnail with padding. Empty → transparent PNG.
 */
export function makeThumbnail(elements: Element[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#0f120b";
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);

  if (elements.length === 0) return canvas.toDataURL("image/png");

  // content bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of elements) {
    const b = aabb(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const cw = Math.max(1, maxX - minX);
  const ch = Math.max(1, maxY - minY);
  const pad = 16;
  const scale = Math.min(
    (THUMB_W - pad * 2) / cw,
    (THUMB_H - pad * 2) / ch,
    2,
  );
  const offsetX = (THUMB_W - cw * scale) / 2 - minX * scale;
  const offsetY = (THUMB_H - ch * scale) / 2 - minY * scale;

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) drawElement(ctx, el);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas.toDataURL("image/png");
}
