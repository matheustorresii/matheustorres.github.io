import type { Element } from "../types/model";
import {
  aabb,
  boxCenter,
  distPointToSegment,
  pointInBox,
  rotateAround,
  type Pt,
} from "./geometry";

/**
 * Return the topmost element (highest zIndex) hit by world point p.
 * `tol` is the pick tolerance in WORLD units (scaled by caller for thin shapes).
 */
export function hitTest(
  elements: Element[],
  p: Pt,
  tol: number,
): Element | null {
  // iterate topmost first
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  for (const el of sorted) {
    if (hitOne(el, p, tol)) return el;
  }
  return null;
}

function hitOne(el: Element, p: Pt, tol: number): boolean {
  // undo the element's rotation so we can test against its axis-aligned box
  if (el.rotation) p = rotateAround(p, boxCenter(aabb(el)), -el.rotation);
  switch (el.type) {
    case "rectangle":
    case "text":
    case "image":
    case "icon":
      return pointInBox(p, aabb(el), tol);
    case "ellipse": {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const rx = Math.abs(el.w / 2) + tol;
      const ry = Math.abs(el.h / 2) + tol;
      if (rx === 0 || ry === 0) return false;
      const dx = (p.x - cx) / rx;
      const dy = (p.y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case "diamond": {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const rx = Math.abs(el.w / 2) + tol;
      const ry = Math.abs(el.h / 2) + tol;
      if (rx === 0 || ry === 0) return false;
      return Math.abs(p.x - cx) / rx + Math.abs(p.y - cy) / ry <= 1;
    }
    case "line":
    case "arrow": {
      const a = { x: el.x + el.points[0].x, y: el.y + el.points[0].y };
      const b = {
        x: el.x + el.points[el.points.length - 1].x,
        y: el.y + el.points[el.points.length - 1].y,
      };
      return distPointToSegment(p, a, b) <= tol + el.strokeWidth;
    }
    case "freehand": {
      // pad the AABB, then check proximity to any segment of the path
      if (!pointInBox(p, aabb(el), tol + el.strokeWidth * 2)) return false;
      for (let i = 1; i < el.points.length; i++) {
        const a = { x: el.x + el.points[i - 1].x, y: el.y + el.points[i - 1].y };
        const b = { x: el.x + el.points[i].x, y: el.y + el.points[i].y };
        if (distPointToSegment(p, a, b) <= tol + el.strokeWidth * 2) return true;
      }
      return false;
    }
  }
}
