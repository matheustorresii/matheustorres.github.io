import type {
  ArrowElement,
  Element,
  FreehandElement,
  IconElement,
  ImageElement,
  LineElement,
  TextElement,
  StyleDefaults,
  Viewport,
} from "../types/model";
import { newId } from "../lib/id";
import type { CanvasRoot, TextEditRequest } from "./CanvasRoot";
import {
  addElement,
  addElements,
  deleteElement,
  deleteElements,
  updateElement,
  updateMany,
} from "../commands/commands";
import { screenToWorld } from "./viewport";
import {
  aabb,
  boxCenter,
  boxesIntersect,
  clamp,
  normalizeBox,
  pointInBox,
  pointsBounds,
  rotateAround,
  snap,
  snapPt,
  type Box,
  type Pt,
} from "./geometry";
import { hitTest } from "./hitTest";
import { cornerHandles, oppositeCorner, type HandleId } from "./selection";
import { measureTextEl } from "./shapes";
import { applyBindings, findBindTarget, makeBinding } from "./binding";

type State =
  | "idle"
  | "panning"
  | "drawing"
  | "dragging"
  | "resizing"
  | "rotating"
  | "marquee"
  | "gesture"; // two-finger pinch-zoom + pan (touch)
const PICK_TOL = 6; // screen px, converted to world by /scale
const HANDLE_HIT = 10; // screen px
const ROT_OFFSET = 22; // must match Renderer's ROTATE_OFFSET_SCREEN

interface RotateSession {
  before: Element;
  center: Pt;
  startAngle: number;
  startRotation: number;
}
interface MarqueeSession {
  start: Pt;
  additive: boolean;
  base: Set<string>;
}

interface DragSession {
  startWorld: Pt;
  before: Map<string, Element>; // deep clones captured on pointerdown
  primaryId: string;
}
interface ResizeSession {
  handle: HandleId;
  fixed: Pt; // opposite corner (world), stays put
  before: Element;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class InputController {
  private root: CanvasRoot;
  private state: State = "idle";
  private spaceDown = false;
  private panLast: Pt | null = null;
  private drag: DragSession | null = null;
  private resizeS: ResizeSession | null = null;
  private rotateS: RotateSession | null = null;
  private marqueeS: MarqueeSession | null = null;
  private drawStart: Pt | null = null;
  private editingText = false;
  private clipboard: Element[] = []; // in-app copy/paste buffer
  // touch / multi-touch
  private pointers = new Map<number, Pt>(); // active pointers (screen coords)
  private pinch: { startDist: number; startMid: Pt; startVp: Viewport } | null = null;
  private touch = false; // last input came from touch → use fatter hit targets

  constructor(root: CanvasRoot) {
    this.root = root;
    const c = root.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("paste", this.onPaste);
    c.addEventListener("dblclick", this.onDblClick);
    c.addEventListener("dragover", this.onDragOver);
    c.addEventListener("drop", this.onDrop);
  }

  destroy(): void {
    const c = this.root.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    c.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("paste", this.onPaste);
    c.removeEventListener("dblclick", this.onDblClick);
    c.removeEventListener("dragover", this.onDragOver);
    c.removeEventListener("drop", this.onDrop);
  }

  // ---- paste images ----
  private onPaste = (e: ClipboardEvent): void => {
    if (this.root.readonly || this.editingText) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => this.placeImage(String(reader.result));
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // ---- drag & drop images ----
  private onDragOver = (e: DragEvent): void => {
    if (this.root.readonly) return;
    e.preventDefault(); // required so the drop event fires
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  private onDrop = (e: DragEvent): void => {
    if (this.root.readonly) return;
    e.preventDefault();
    const at = this.worldPt(e as unknown as MouseEvent);
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = () => this.placeImage(String(reader.result), at);
          reader.readAsDataURL(file);
          return;
        }
      }
    }
    // dragged from another tab: an image URL
    const url = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain");
    if (url && /^https?:\/\//.test(url)) this.placeImage(url, at);
  };

  private placeImage(src: string, at?: Pt): void {
    const probe = new Image();
    probe.onload = () => {
      const scene = this.root.scene;
      const nw = probe.naturalWidth || 1;
      const nh = probe.naturalHeight || 1;
      // fit to ~half the viewport in world units, keeping aspect ratio
      const maxW = (this.root.size.w * 0.5) / this.scale;
      const maxH = (this.root.size.h * 0.5) / this.scale;
      let w = nw;
      let h = nh;
      const k = Math.min(maxW / nw, maxH / nh, 1);
      w = nw * k;
      h = nh * k;
      const center =
        at ??
        screenToWorld(scene.viewport, {
          x: this.root.size.w / 2,
          y: this.root.size.h / 2,
        });
      const el: ImageElement = {
        id: newId(),
        type: "image",
        x: center.x - w / 2,
        y: center.y - h / 2,
        w,
        h,
        rotation: 0,
        strokeColor: "transparent",
        fillColor: "transparent",
        strokeWidth: 0,
        opacity: 1,
        zIndex: scene.nextZIndex(),
        seed: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        src,
        naturalW: nw,
        naturalH: nh,
      };
      this.root.history.execute(scene, addElement(el));
      this.root.setTool("select");
    };
    probe.src = src;
  }

  // ---- helpers ----
  private screenPt(e: PointerEvent | WheelEvent | MouseEvent): Pt {
    const r = this.root.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private worldPt(e: PointerEvent | WheelEvent | MouseEvent): Pt {
    return screenToWorld(this.root.scene.viewport, this.screenPt(e));
  }
  private get scale(): number {
    return this.root.scene.viewport.scale;
  }

  private handleAt(screen: Pt): HandleId | "rotate" | null {
    const scene = this.root.scene;
    const single = scene.singleSelection;
    if (!single) return null; // handles only when exactly one is selected
    const el = scene.get(single);
    if (!el) return null;
    const scale = this.scale;
    const pad = 4 / scale;
    const padded = { ...el, x: el.x - pad, y: el.y - pad, w: el.w + pad * 2, h: el.h + pad * 2 };
    const center = boxCenter(aabb(el));
    const r = el.rotation || 0;
    const toScreen = (pt: Pt): Pt => {
      const wp = r ? rotateAround(pt, center, r) : pt;
      return {
        x: wp.x * scale + scene.viewport.offsetX,
        y: wp.y * scale + scene.viewport.offsetY,
      };
    };
    const hit = this.touch ? HANDLE_HIT + 12 : HANDLE_HIT; // fatter for fingers
    for (const h of cornerHandles(padded)) {
      const s = toScreen({ x: h.x, y: h.y });
      if (Math.abs(s.x - screen.x) <= hit && Math.abs(s.y - screen.y) <= hit)
        return h.id;
    }
    const rot = toScreen({ x: center.x, y: padded.y - ROT_OFFSET / scale });
    if (Math.hypot(rot.x - screen.x, rot.y - screen.y) <= hit + 2) return "rotate";
    return null;
  }

  // ---- pointer down ----
  private onPointerDown = (e: PointerEvent): void => {
    this.touch = e.pointerType === "touch";
    this.pointers.set(e.pointerId, this.screenPt(e));
    // second finger down → enter two-finger pinch/pan, aborting any single-
    // pointer op in progress (mouse never reaches 2 pointers, so desktop is
    // unaffected).
    if (this.pointers.size === 2) {
      this.abortSingle();
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        startDist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startVp: { ...this.root.scene.viewport },
      };
      this.state = "gesture";
      return;
    }
    if (this.pointers.size > 2) return;

    // an open text editor commits itself on blur; swallow this click so it
    // doesn't immediately place a second text box / start another gesture.
    if (this.editingText) return;
    if (this.root.readonly) {
      if (e.button === 1 || this.spaceDown) this.startPan(e);
      return;
    }
    if (e.button === 1 || this.spaceDown) {
      this.startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const world = this.worldPt(e);
    const screen = this.screenPt(e);

    if (this.root.tool === "select") {
      const scene = this.root.scene;
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const handle = this.handleAt(screen);
      if (handle === "rotate") {
        const el = scene.get(scene.singleSelection!)!;
        const center = boxCenter(aabb(el));
        this.rotateS = {
          before: clone(el),
          center,
          startAngle: Math.atan2(world.y - center.y, world.x - center.x),
          startRotation: el.rotation || 0,
        };
        this.state = "rotating";
        return;
      }
      if (handle) {
        const el = scene.get(scene.singleSelection!)!;
        this.resizeS = { handle, fixed: oppositeCorner(el, handle), before: clone(el) };
        this.state = "resizing";
        return;
      }
      const hit = hitTest(scene.all(), world, (this.touch ? 14 : PICK_TOL) / this.scale);
      if (hit) {
        if (additive) {
          scene.toggleSelection(hit.id); // Cmd/Shift+click add/remove
          if (scene.isSelected(hit.id)) this.beginDrag(world);
          return;
        }
        if (!scene.isSelected(hit.id)) scene.select(hit.id);
        this.beginDrag(world); // drag the whole current selection
        return;
      }
      // no precise hit, but inside a selected element's box → grab it. Lets you
      // move a selected line/arrow/freehand from anywhere in its box, not just
      // by hitting the thin geometry again.
      if (!additive && this.insideSelection(world)) {
        this.beginDrag(world);
        return;
      }
      // empty space: start a marquee (Windows-style drag-select)
      this.marqueeS = { start: world, additive, base: new Set(scene.selectedIds) };
      this.state = "marquee";
      return;
    }

    if (this.root.tool === "text") {
      this.openTextEditor(null, world);
      return;
    }

    if (this.root.tool === "icon") {
      this.placeIcon(world);
      return;
    }

    // drawing tools
    this.drawStart = world;
    this.state = "drawing";
    this.root.preview = this.makeDrawElement(this.root.tool, world, world);
    this.root.scene.markDirty();
  };

  private startPan(e: PointerEvent): void {
    this.state = "panning";
    this.panLast = this.screenPt(e);
  }

  /** True when world is inside any selected element's (padded, rotation-aware) box. */
  private insideSelection(world: Pt): boolean {
    const scene = this.root.scene;
    for (const id of scene.selectedIds) {
      const el = scene.get(id);
      if (!el) continue;
      const pad = (8 + el.strokeWidth) / this.scale;
      const b = aabb(el);
      const p = el.rotation ? rotateAround(world, boxCenter(b), -el.rotation) : world;
      if (pointInBox(p, b, pad)) return true;
    }
    return false;
  }

  private beginDrag(world: Pt): void {
    const scene = this.root.scene;
    const before = new Map<string, Element>();
    for (const el of scene.selectedElements()) before.set(el.id, clone(el));
    // include arrows bound to any selected shape so they follow atomically
    for (const el of scene.all()) {
      if (el.type === "arrow" && !before.has(el.id)) {
        const s = el.boundStart?.elementId;
        const e2 = el.boundEnd?.elementId;
        if ((s && before.has(s)) || (e2 && before.has(e2))) before.set(el.id, clone(el));
      }
    }
    this.drag = { startWorld: world, before, primaryId: scene.singleSelection ?? [...before.keys()][0] ?? "" };
    this.state = "dragging";
  }

  private applyPinch(): void {
    if (!this.pinch || this.pointers.size < 2) return;
    const [a, b] = [...this.pointers.values()];
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const { startDist, startMid, startVp } = this.pinch;
    const worldAtStartMid = screenToWorld(startVp, startMid);
    const newScale = clamp(startVp.scale * (dist / startDist), 0.05, 64);
    // keep the content under the initial finger-center under the new center
    this.root.scene.setViewport({
      scale: newScale,
      offsetX: mid.x - worldAtStartMid.x * newScale,
      offsetY: mid.y - worldAtStartMid.y * newScale,
    });
    this.root.onUiSync?.();
  }

  // ---- pointer move ----
  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, this.screenPt(e));
    if (this.state === "gesture") {
      this.applyPinch();
      return;
    }
    // hover highlight of a bindable shape while the arrow tool is armed
    if (this.state === "idle") {
      if (this.root.tool === "arrow" && !this.root.readonly) {
        const t = findBindTarget(this.root.scene.all(), this.worldPt(e), "");
        this.root.scene.setBindHighlight(t?.id ?? null);
      } else {
        this.root.scene.setBindHighlight(null);
      }
      return;
    }
    switch (this.state) {
      case "panning": {
        if (!this.panLast) return;
        const p = this.screenPt(e);
        const v = this.root.scene.viewport;
        this.root.scene.setViewport({
          ...v,
          offsetX: v.offsetX + (p.x - this.panLast.x),
          offsetY: v.offsetY + (p.y - this.panLast.y),
        });
        this.panLast = p;
        this.root.onUiSync?.();
        break;
      }
      case "drawing": {
        if (!this.drawStart) return;
        const world = this.worldPt(e);
        this.root.preview = this.makeDrawElement(this.root.tool, this.drawStart, world, this.root.preview);
        // show which shape the arrow's end will snap to
        if (this.root.tool === "arrow") {
          const t = findBindTarget(this.root.scene.all(), world, this.root.preview?.id ?? "");
          this.root.scene.setBindHighlight(t?.id ?? null);
        }
        this.root.scene.markDirty();
        break;
      }
      case "dragging": {
        if (!this.drag) return;
        const world = this.worldPt(e);
        const dx = world.x - this.drag.startWorld.x;
        const dy = world.y - this.drag.startWorld.y;
        this.applyDrag(dx, dy);
        break;
      }
      case "resizing": {
        if (!this.resizeS) return;
        this.applyResize(this.worldPt(e));
        break;
      }
      case "rotating": {
        if (!this.rotateS) return;
        this.applyRotate(this.worldPt(e), e.shiftKey);
        break;
      }
      case "marquee": {
        if (!this.marqueeS) return;
        this.applyMarquee(this.worldPt(e));
        break;
      }
    }
  };

  private applyRotate(world: Pt, snap15: boolean): void {
    if (!this.rotateS) return;
    const { center, startAngle, startRotation, before } = this.rotateS;
    const a = Math.atan2(world.y - center.y, world.x - center.x);
    let rot = startRotation + (a - startAngle);
    if (snap15) {
      const step = Math.PI / 12; // 15°
      rot = Math.round(rot / step) * step;
    }
    const el = this.root.scene.get(before.id);
    if (el) {
      el.rotation = rot;
      this.root.scene.markDirty();
    }
  }

  private applyMarquee(world: Pt): void {
    if (!this.marqueeS) return;
    const rect: Box = normalizeBox(
      this.marqueeS.start.x,
      this.marqueeS.start.y,
      world.x,
      world.y,
    );
    this.root.scene.marqueeRect = rect;
    const hit = this.root.scene
      .all()
      .filter((el) => boxesIntersect(aabb(el), rect))
      .map((el) => el.id);
    const next = this.marqueeS.additive ? new Set(this.marqueeS.base) : new Set<string>();
    for (const id of hit) next.add(id);
    this.root.scene.selectedIds = next;
    this.root.scene.markDirty();
  }

  private applyDrag(dx: number, dy: number): void {
    if (!this.drag) return;
    const scene = this.root.scene;

    // snap the whole group by its anchor so relative layout is preserved
    let adx = dx;
    let ady = dy;
    const anchor = this.drag.before.get(this.drag.primaryId);
    if (this.root.snapEnabled && anchor && anchor.type !== "freehand") {
      adx = snap(anchor.x + dx) - anchor.x;
      ady = snap(anchor.y + dy) - anchor.y;
    }

    // translate every selected element
    for (const [id, beforeEl] of this.drag.before) {
      if (!scene.isSelected(id)) continue;
      const el = scene.get(id);
      if (!el) continue;
      el.x = beforeEl.x + adx;
      el.y = beforeEl.y + ady;
    }

    // recompute arrows bound to a moved (selected) shape
    for (const [id, beforeEl] of this.drag.before) {
      if (beforeEl.type !== "arrow") continue;
      const boundToMoved =
        (beforeEl.boundStart && scene.isSelected(beforeEl.boundStart.elementId)) ||
        (beforeEl.boundEnd && scene.isSelected(beforeEl.boundEnd.elementId));
      if (!boundToMoved) continue; // an unbound selected arrow just translates
      const arrow = scene.get(id) as ArrowElement | undefined;
      if (!arrow) continue;
      const fresh = applyBindings(clone(beforeEl) as ArrowElement, (x) => scene.get(x));
      Object.assign(arrow, fresh);
    }
    scene.markDirty();
  }

  private applyResize(world: Pt): void {
    if (!this.resizeS) return;
    const scene = this.root.scene;
    const el = scene.get(this.resizeS.before.id);
    if (!el) return;
    const before = this.resizeS.before;
    const fixed = this.resizeS.fixed;
    const r = before.rotation || 0;
    const O0 = boxCenter(aabb(before));
    // pointer in the element's local (unrotated) frame, for the box math below
    const localPtr = r ? rotateAround(world, O0, -r) : world;

    if (el.type === "text") {
      // Text resize controls the WRAP WIDTH only. Font stays fixed.
      const t = el as TextElement;
      t.autoWidth = false;
      t.x = Math.min(fixed.x, localPtr.x);
      t.y = (before as TextElement).y;
      t.w = Math.max(Math.abs(localPtr.x - fixed.x), t.fontSize * 2);
      const size = measureTextEl(this.measureCtx(), t);
      t.w = size.w;
      t.h = size.h;
      scene.markDirty();
      return;
    }

    if (el.type === "line" || el.type === "arrow" || el.type === "freehand") {
      const corner = this.root.snapEnabled && !r ? snapPt(localPtr) : localPtr;
      const box = normalizeBox(fixed.x, fixed.y, corner.x, corner.y);
      const sx = before.w === 0 ? 1 : box.w / before.w;
      const sy = before.h === 0 ? 1 : box.h / before.h;
      const pts = (before as LineElement | ArrowElement | FreehandElement).points;
      (el as LineElement | ArrowElement | FreehandElement).points = pts.map((p) => ({
        x: p.x * sx,
        y: p.y * sy,
      }));
      el.x = box.x;
      el.y = box.y;
      el.w = box.w;
      el.h = box.h;
      scene.markDirty();
      return;
    }

    // rectangle / ellipse / image / icon: axis-projection keeps the opposite
    // corner pinned in world space even when the element is rotated.
    const ax = { x: Math.cos(r), y: Math.sin(r) };
    const ay = { x: -Math.sin(r), y: Math.cos(r) };
    const Fw = r ? rotateAround(fixed, O0, r) : fixed; // fixed corner in world
    const Pw = this.root.snapEnabled && !r ? snapPt(world) : world;
    const d = { x: Pw.x - Fw.x, y: Pw.y - Fw.y };
    const projW = d.x * ax.x + d.y * ax.y;
    const projH = d.x * ay.x + d.y * ay.y;
    const sgnx = projW < 0 ? -1 : 1;
    const sgny = projH < 0 ? -1 : 1;
    const w = Math.max(Math.abs(projW), 2);
    const h = Math.max(Math.abs(projH), 2);
    const ncx = Fw.x + (ax.x * sgnx * w) / 2 + (ay.x * sgny * h) / 2;
    const ncy = Fw.y + (ax.y * sgnx * w) / 2 + (ay.y * sgny * h) / 2;
    el.w = w;
    el.h = h;
    el.x = ncx - w / 2;
    el.y = ncy - h / 2;
    scene.markDirty();
  }

  // ---- pointer up ----
  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.state === "gesture") {
      // leaving the pinch: don't resume a single-pointer op until a fresh touch
      if (this.pointers.size < 2) {
        this.pinch = null;
        this.state = "idle";
      }
      return;
    }
    switch (this.state) {
      case "drawing":
        this.commitDraw();
        break;
      case "dragging":
        this.commitDrag();
        break;
      case "resizing":
        this.commitResize();
        break;
      case "rotating":
        this.commitRotate();
        break;
      case "marquee":
        this.commitMarquee();
        break;
    }
    this.state = "idle";
    this.panLast = null;
    this.drawStart = null;
  };

  /** Discard an in-progress single-pointer op without committing (2nd finger landed). */
  private abortSingle(): void {
    this.root.preview = null;
    this.drag = null;
    this.resizeS = null;
    this.rotateS = null;
    this.marqueeS = null;
    this.root.scene.marqueeRect = null;
    this.root.scene.setBindHighlight(null);
    this.drawStart = null;
    this.root.scene.markDirty();
  }

  private commitRotate(): void {
    if (!this.rotateS) return;
    const before = this.rotateS.before;
    const cur = this.root.scene.get(before.id);
    this.rotateS = null;
    if (!cur) return;
    if ((cur.rotation || 0) === (before.rotation || 0)) return;
    this.root.history.execute(this.root.scene, updateElement(before, clone(cur)));
  }

  private commitMarquee(): void {
    const hadDrag = this.root.scene.marqueeRect !== null;
    this.root.scene.marqueeRect = null;
    if (!hadDrag && this.marqueeS && !this.marqueeS.additive) {
      this.root.scene.clearSelection();
    }
    this.marqueeS = null;
    this.root.scene.markDirty();
    this.root.onUiSync?.();
  }

  private commitDraw(): void {
    this.root.scene.setBindHighlight(null);
    const el = this.root.preview;
    this.root.preview = null;
    if (!el) return;
    // discard degenerate shapes (a click with no drag)
    const tiny = el.w < 2 && el.h < 2;
    if ((el.type === "rectangle" || el.type === "ellipse") && tiny) {
      this.root.scene.markDirty();
      return;
    }
    if (el.type === "freehand" && (el as FreehandElement).points.length < 2) {
      this.root.scene.markDirty();
      return;
    }
    const final = el.type === "arrow" ? this.bindArrow(el as ArrowElement) : el;
    this.root.history.execute(this.root.scene, addElement(final));
    if (el.type === "freehand") {
      // pen-like: stay on the freehand tool and keep drawing; don't select.
      this.root.scene.select(null);
    } else {
      // Excalidraw feel: after drawing, switch to select with the shape
      // selected (addElement already selected it; setTool keeps it).
      this.root.setTool("select");
    }
  }

  private commitDrag(): void {
    if (!this.drag) return;
    const scene = this.root.scene;
    const changes: { before: Element; after: Element }[] = [];
    for (const [id, before] of this.drag.before) {
      const cur = scene.get(id);
      if (cur) changes.push({ before, after: clone(cur) });
    }
    this.drag = null;
    if (changes.length === 0) return;
    const moved = changes.some(
      (c) => c.before.x !== c.after.x || c.before.y !== c.after.y,
    );
    if (!moved) return;
    this.root.history.execute(scene, updateMany(changes));
  }

  private commitResize(): void {
    if (!this.resizeS) return;
    const scene = this.root.scene;
    const cur = scene.get(this.resizeS.before.id);
    const before = this.resizeS.before;
    this.resizeS = null;
    if (!cur) return;
    if (cur.w === before.w && cur.h === before.h && cur.x === before.x && cur.y === before.y)
      return;
    this.root.history.execute(scene, updateElement(before, clone(cur)));
  }

  // ---- drawing element factory ----
  private makeDrawElement(
    tool: string,
    start: Pt,
    end: Pt,
    prev?: Element | null,
  ): Element {
    // snap geometric shapes to the grid; freehand stays organic
    if (this.root.snapEnabled && tool !== "freehand") {
      start = snapPt(start);
      end = snapPt(end);
    }
    const s = this.root.style;
    const base = {
      id: prev?.id ?? newId(),
      rotation: 0,
      strokeColor: s.strokeColor,
      fillColor: s.fillColor,
      strokeWidth: s.strokeWidth,
      opacity: s.opacity,
      zIndex: prev?.zIndex ?? this.root.scene.nextZIndex(),
      seed: 1,
      createdAt: prev?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    if (tool === "rectangle" || tool === "ellipse" || tool === "diamond") {
      const b = normalizeBox(start.x, start.y, end.x, end.y);
      const rounded = tool !== "ellipse" ? this.root.style.rounded : undefined;
      return { ...base, type: tool, x: b.x, y: b.y, w: b.w, h: b.h, rounded } as Element;
    }
    if (tool === "line" || tool === "arrow") {
      const b = normalizeBox(start.x, start.y, end.x, end.y);
      const el = {
        ...base,
        type: tool,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        points: [
          { x: start.x - b.x, y: start.y - b.y },
          { x: end.x - b.x, y: end.y - b.y },
        ],
      } as LineElement | ArrowElement;
      return el;
    }
    // freehand: accumulate points
    const prevPts = (prev as FreehandElement | undefined)?.points;
    const absPts = prevPts
      ? prevPts.map((p) => ({ x: p.x + (prev as FreehandElement).x, y: p.y + (prev as FreehandElement).y }))
      : [start];
    absPts.push(end);
    const bounds = pointsBounds(absPts);
    return {
      ...base,
      type: "freehand",
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      points: absPts.map((p) => ({ x: p.x - bounds.x, y: p.y - bounds.y })),
    } as FreehandElement;
  }

  // ---- arrow binding on commit ----
  private bindArrow(arrow: ArrowElement): ArrowElement {
    const scene = this.root.scene;
    const startAbs = { x: arrow.x + arrow.points[0].x, y: arrow.y + arrow.points[0].y };
    const endAbs = {
      x: arrow.x + arrow.points[1].x,
      y: arrow.y + arrow.points[1].y,
    };
    const startTarget = findBindTarget(scene.all(), startAbs, arrow.id);
    const endTarget = findBindTarget(scene.all(), endAbs, arrow.id);
    const bound: ArrowElement = { ...arrow };
    if (startTarget) bound.boundStart = makeBinding(startTarget, startAbs);
    if (endTarget) bound.boundEnd = makeBinding(endTarget, endAbs);
    return applyBindings(bound, (id) => scene.get(id));
  }

  // ---- text editing ----
  private openTextEditor(id: string | null, world: Pt): void {
    let initial = "";
    let fontSize = this.root.style.fontSize;
    let color = this.root.style.strokeColor;
    let mono = this.root.style.mono;
    let autoWidth = true;
    let boxWidth = 0;
    let wx = world.x;
    let wy = world.y;
    if (id) {
      const el = this.root.scene.get(id) as TextElement | undefined;
      if (el) {
        initial = el.text;
        fontSize = el.fontSize;
        color = el.strokeColor;
        mono = !!el.mono;
        autoWidth = el.autoWidth !== false;
        boxWidth = el.w;
        wx = el.x;
        wy = el.y;
      }
    }
    const req: TextEditRequest = {
      id,
      worldX: wx,
      worldY: wy,
      initial,
      fontSize,
      color,
      mono,
      autoWidth,
      boxWidth,
    };
    this.editingText = true;
    // hide the on-canvas copy while editing an existing element (no doubling)
    this.root.scene.editingId = id;
    if (id) this.root.scene.markDirty();
    this.root.onTextEdit?.(req);
  }

  commitText(req: TextEditRequest, text: string): void {
    this.editingText = false;
    this.root.scene.editingId = null;
    this.root.scene.editingLabelId = null;
    this.root.scene.markDirty();
    this.root.onTextEdit?.(null);
    const scene = this.root.scene;
    // after finishing a text, drop back to the select tool (Excalidraw feel)
    const backToSelect = () => this.root.setTool("select");

    // arrow label: update the arrow's `label`, not a text element
    if (req.targetKind === "arrowLabel" && req.id) {
      const before = scene.get(req.id) as ArrowElement | undefined;
      if (before) {
        const after = clone(before);
        after.label = text.trim() || undefined;
        after.updatedAt = Date.now();
        this.root.history.execute(scene, updateElement(before, after));
      }
      backToSelect();
      return;
    }
    if (req.id) {
      const before = scene.get(req.id) as TextElement | undefined;
      if (!before) {
        backToSelect();
        return;
      }
      if (text.trim() === "") {
        const idx = scene.elements.findIndex((e) => e.id === req.id);
        this.root.history.execute(scene, deleteElement(clone(before), idx));
        backToSelect();
        return;
      }
      const after: TextElement = { ...clone(before), text, updatedAt: Date.now() };
      const size = measureTextEl(this.measureCtx(), after);
      after.w = size.w;
      after.h = size.h;
      this.root.history.execute(scene, updateElement(clone(before), after));
      backToSelect();
      return;
    }
    if (text.trim() === "") {
      backToSelect();
      return;
    }
    const el: TextElement = {
      id: newId(),
      type: "text",
      x: req.worldX,
      y: req.worldY,
      w: req.boxWidth,
      h: 0,
      rotation: 0,
      strokeColor: req.color,
      fillColor: "transparent",
      strokeWidth: 1,
      opacity: this.root.style.opacity,
      zIndex: scene.nextZIndex(),
      seed: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      text,
      fontSize: req.fontSize,
      fontFamily: "Inter",
      mono: req.mono,
      lang: this.root.style.lang,
      autoWidth: req.autoWidth,
    };
    const size = measureTextEl(this.measureCtx(), el);
    el.w = size.w;
    el.h = size.h;
    this.root.history.execute(scene, addElement(el));
    backToSelect();
  }

  /** Convert the selected text element into/out of a monospace code block. */
  setSelectionMono(on: boolean): void {
    const scene = this.root.scene;
    const texts = scene.selectedElements().filter((e) => e.type === "text");
    if (texts.length === 0) return;
    const changes: { before: Element; after: Element }[] = [];
    for (const el of texts) {
      const before = clone(el);
      const after = clone(el) as TextElement;
      after.mono = on;
      const size = measureTextEl(this.measureCtx(), after);
      after.w = size.w;
      after.h = size.h;
      after.updatedAt = Date.now();
      changes.push({ before, after });
    }
    this.root.history.execute(scene, updateMany(changes));
  }

  private measureCtx(): CanvasRenderingContext2D {
    return this.root.canvas.getContext("2d")!;
  }

  // ---- style application ----
  applyStyleToSelection(patch: Partial<StyleDefaults>): void {
    const scene = this.root.scene;
    const sel = scene.selectedElements();
    if (sel.length === 0) return;
    const changes: { before: Element; after: Element }[] = [];
    for (const el of sel) {
      const before = clone(el);
      const after = clone(el);
      if (patch.strokeColor !== undefined) after.strokeColor = patch.strokeColor;
      if (patch.fillColor !== undefined) after.fillColor = patch.fillColor;
      if (patch.strokeWidth !== undefined) after.strokeWidth = patch.strokeWidth;
      if (patch.opacity !== undefined) after.opacity = patch.opacity;
      if (patch.fontSize !== undefined && after.type === "text") {
        (after as TextElement).fontSize = patch.fontSize;
        const size = measureTextEl(this.measureCtx(), after as TextElement);
        after.w = size.w;
        after.h = size.h;
      }
      if (
        patch.rounded !== undefined &&
        (after.type === "rectangle" || after.type === "diamond")
      ) {
        after.rounded = patch.rounded;
      }
      if (patch.lang !== undefined && after.type === "text") {
        (after as TextElement).lang = patch.lang;
      }
      after.updatedAt = Date.now();
      changes.push({ before, after });
    }
    this.root.history.execute(scene, updateMany(changes));
  }

  // ---- wheel ----
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const scene = this.root.scene;
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      const cursor = this.screenPt(e);
      scene.setViewport(
        this.zoomAtCursor(cursor, factor),
      );
    } else {
      const v = scene.viewport;
      scene.setViewport({
        ...v,
        offsetX: v.offsetX - e.deltaX,
        offsetY: v.offsetY - e.deltaY,
      });
    }
    this.root.onUiSync?.();
  };

  private zoomAtCursor(cursor: Pt, factor: number) {
    const v = this.root.scene.viewport;
    const newScale = clamp(v.scale * factor, 0.05, 64);
    const worldX = (cursor.x - v.offsetX) / v.scale;
    const worldY = (cursor.y - v.offsetY) / v.scale;
    return {
      scale: newScale,
      offsetX: cursor.x - worldX * newScale,
      offsetY: cursor.y - worldY * newScale,
    };
  }

  // ---- keyboard ----
  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.root.redo();
      else this.root.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.root.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault(); // don't let the browser select the page
      if (!this.root.readonly) this.root.scene.selectAll();
      return;
    }
    if (mod && e.key.toLowerCase() === "c") {
      this.copySelection();
      return;
    }
    if (mod && e.key.toLowerCase() === "v") {
      if (!this.root.readonly) this.pasteClipboard();
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault(); // browser bookmark
      if (!this.root.readonly) this.duplicateSelection();
      return;
    }
    if (e.key === " ") {
      this.spaceDown = true;
      return;
    }
    if (this.root.readonly) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      this.deleteSelection();
      return;
    }
    if (e.key === "Escape") {
      this.cancelGesture();
      this.root.scene.select(null);
      return;
    }
    // tool shortcuts are UNMODIFIED keys only — don't hijack Ctrl+2 (switch
    // browser tab), Alt+…, etc.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map: Record<string, string> = {
      // letters
      v: "select",
      r: "rectangle",
      d: "diamond",
      o: "ellipse",
      l: "line",
      a: "arrow",
      p: "freehand",
      t: "text",
      // numbers (Excalidraw-style), matching the toolbar order
      "1": "select",
      "2": "rectangle",
      "3": "diamond",
      "4": "ellipse",
      "5": "line",
      "6": "arrow",
      "7": "freehand",
      "8": "text",
    };
    const tool = map[e.key.toLowerCase()];
    if (tool) this.root.setTool(tool as never);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === " ") this.spaceDown = false;
  };

  deleteSelection(): void {
    const scene = this.root.scene;
    const sel = scene.selectedElements();
    if (sel.length === 0) return;
    if (sel.length === 1) {
      const el = sel[0];
      const idx = scene.elements.findIndex((x) => x.id === el.id);
      this.root.history.execute(scene, deleteElement(clone(el), idx));
      return;
    }
    const entries = sel.map((el) => ({
      el: clone(el),
      index: scene.elements.findIndex((x) => x.id === el.id),
    }));
    this.root.history.execute(scene, deleteElements(entries));
  }

  private placeIcon(world: Pt): void {
    const scene = this.root.scene;
    const size = 64;
    let x = world.x - size / 2;
    let y = world.y - size / 2;
    if (this.root.snapEnabled) {
      x = snap(x);
      y = snap(y);
    }
    const el: IconElement = {
      id: newId(),
      type: "icon",
      x,
      y,
      w: size,
      h: size,
      rotation: 0,
      strokeColor: this.root.style.strokeColor,
      fillColor: "transparent",
      strokeWidth: 2,
      opacity: this.root.style.opacity,
      zIndex: scene.nextZIndex(),
      seed: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      iconId: this.root.iconId,
    };
    this.root.history.execute(scene, addElement(el));
    this.root.setTool("select");
  }

  private copySelection(): void {
    const sel = this.root.scene.selectedElements();
    if (sel.length) this.clipboard = sel.map((e) => clone(e));
  }

  private pasteClipboard(): void {
    if (this.clipboard.length === 0) return;
    const els = this.cloneForPaste(this.clipboard, 16);
    this.root.history.execute(this.root.scene, addElements(els));
    this.root.setTool("select");
  }

  private duplicateSelection(): void {
    const sel = this.root.scene.selectedElements();
    if (sel.length === 0) return;
    const els = this.cloneForPaste(sel, 16);
    this.root.history.execute(this.root.scene, addElements(els));
  }

  /** Clone elements with fresh ids, offset, and remapped arrow bindings. */
  private cloneForPaste(source: Element[], offset: number): Element[] {
    const scene = this.root.scene;
    const idMap = new Map<string, string>();
    const now = Date.now();
    let z = scene.nextZIndex();
    const out: Element[] = source.map((el) => {
      const nid = newId();
      idMap.set(el.id, nid);
      return {
        ...clone(el),
        id: nid,
        x: el.x + offset,
        y: el.y + offset,
        zIndex: z++,
        createdAt: now,
        updatedAt: now,
      };
    });
    for (const el of out) {
      if (el.type !== "arrow") continue;
      const a = el as ArrowElement;
      a.boundStart =
        a.boundStart && idMap.has(a.boundStart.elementId)
          ? { ...a.boundStart, elementId: idMap.get(a.boundStart.elementId)! }
          : undefined;
      a.boundEnd =
        a.boundEnd && idMap.has(a.boundEnd.elementId)
          ? { ...a.boundEnd, elementId: idMap.get(a.boundEnd.elementId)! }
          : undefined;
    }
    return out;
  }

  private cancelGesture(): void {
    this.root.preview = null;
    this.drag = null;
    this.resizeS = null;
    this.rotateS = null;
    this.marqueeS = null;
    this.root.scene.marqueeRect = null;
    this.drawStart = null;
    this.state = "idle";
    this.root.scene.markDirty();
  }

  // ---- double click to edit text ----
  private onDblClick = (e: MouseEvent): void => {
    if (this.root.readonly) return;
    const world = this.worldPt(e);
    const hit = hitTest(this.root.scene.all(), world, (this.touch ? 14 : PICK_TOL) / this.scale);
    if (!hit) return;
    if (hit.type === "text") this.openTextEditor(hit.id, world);
    else if (hit.type === "arrow") this.openArrowLabel(hit.id);
  };

  private openArrowLabel(arrowId: string): void {
    const arrow = this.root.scene.get(arrowId) as ArrowElement | undefined;
    if (!arrow) return;
    const mid = {
      x: (arrow.x + arrow.points[0].x + arrow.x + arrow.points[arrow.points.length - 1].x) / 2,
      y: (arrow.y + arrow.points[0].y + arrow.y + arrow.points[arrow.points.length - 1].y) / 2,
    };
    const req: TextEditRequest = {
      id: arrowId,
      worldX: mid.x,
      worldY: mid.y,
      initial: arrow.label ?? "",
      fontSize: 14,
      color: arrow.strokeColor,
      mono: false,
      autoWidth: true,
      boxWidth: 0,
      targetKind: "arrowLabel",
    };
    this.editingText = true;
    this.root.scene.editingLabelId = arrowId; // hide the on-canvas label meanwhile
    this.root.scene.markDirty();
    this.root.onTextEdit?.(req);
  }
}
