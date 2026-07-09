import type { Board, Element } from "../types/model";
import { aabb } from "../canvas/geometry";
import { drawElement } from "../canvas/shapes";

interface Rendered {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

/** Render all elements to an offscreen canvas fitted to their bounds. */
function renderBoardToCanvas(elements: Element[], scale = 2): Rendered | null {
  if (elements.length === 0) return null;
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
  const pad = 32;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const light = document.documentElement.dataset.theme === "light";
  ctx.fillStyle = light ? "#fbfcf6" : "#0f120b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, (-minX + pad) * scale, (-minY + pad) * scale);
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) drawElement(ctx, el);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, w, h };
}

function download(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

export function exportPNG(board: Board): boolean {
  const r = renderBoardToCanvas(board.elements);
  if (!r) return false;
  r.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    download(url, `${board.name || "board"}.png`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
  return true;
}

export async function exportPDF(board: Board): Promise<boolean> {
  const r = renderBoardToCanvas(board.elements);
  if (!r) return false;
  const { jsPDF } = await import("jspdf");
  const img = r.canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: r.w >= r.h ? "landscape" : "portrait",
    unit: "pt",
    format: [r.w, r.h],
  });
  pdf.addImage(img, "PNG", 0, 0, r.w, r.h);
  pdf.save(`${board.name || "board"}.pdf`);
  return true;
}
