import type { Element, LinePoint } from "../types/model";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** World units between grid dots. Shared by the dot grid and snap-to-grid. */
export const GRID = 24;

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid;
}

export function snapPt(p: Pt, grid = GRID): Pt {
  return { x: snap(p.x, grid), y: snap(p.y, grid) };
}

/** Axis-aligned bounding box of an element in world space. */
export function aabb(el: Element): Box {
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

/** Normalize a box so w and h are non-negative. */
export function normalizeBox(x0: number, y0: number, x1: number, y1: number): Box {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

export function pointInBox(p: Pt, b: Box, pad = 0): boolean {
  return (
    p.x >= b.x - pad &&
    p.x <= b.x + b.w + pad &&
    p.y >= b.y - pad &&
    p.y <= b.y + b.h + pad
  );
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

/** Distance from point p to segment ab. */
export function distPointToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** AABB of a list of points (relative), returned in relative coords. */
export function pointsBounds(points: LinePoint[]): Box {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Center of a box. */
export function boxCenter(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Absolute endpoints + quadratic control point of a line/arrow (null when straight). */
export function curveControl(el: {
  x: number;
  y: number;
  points: Pt[];
  bend?: number;
}): { a: Pt; b: Pt; c: Pt | null } {
  const p0 = el.points[0];
  const p1 = el.points[el.points.length - 1];
  const a = { x: el.x + p0.x, y: el.y + p0.y };
  const b = { x: el.x + p1.x, y: el.y + p1.y };
  const bend = el.bend ?? 0;
  if (!bend) return { a, b, c: null };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len; // perpendicular unit
  return {
    a,
    b,
    c: { x: (a.x + b.x) / 2 + px * bend, y: (a.y + b.y) / 2 + py * bend },
  };
}

/** Point on a quadratic bezier (or the segment when c is null) at parameter t. */
export function curvePointAt(a: Pt, b: Pt, c: Pt | null, t: number): Pt {
  if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Rotate point p around center c by angle (radians). */
export function rotateAround(p: Pt, c: Pt, angle: number): Pt {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}
