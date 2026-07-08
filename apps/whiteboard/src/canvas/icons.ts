// Architecture/dev icon set. Each icon draws line-art in a 24x24 unit box.
// drawIcon() scales that box to the element's world size. Stroke uses the
// element color; a couple of icons add a subtle fill.

type IconFn = (ctx: CanvasRenderingContext2D) => void;

// helpers operate in the 24x24 space
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.stroke();
}

export const ICONS: Record<string, IconFn> = {
  database: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(12, 5.5, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 5.5);
    ctx.lineTo(5, 18.5);
    ctx.moveTo(19, 5.5);
    ctx.lineTo(19, 18.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 18.5, 7, 2.6, 0, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 12, 7, 2.6, 0, 0, Math.PI);
    ctx.stroke();
  },
  server: (ctx) => {
    rr(ctx, 4, 4, 16, 6.5, 1.5);
    rr(ctx, 4, 13.5, 16, 6.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(7, 7.2);
    ctx.lineTo(7, 7.2);
    ctx.arc(7, 7.2, 0.4, 0, Math.PI * 2);
    ctx.moveTo(7, 16.7);
    ctx.arc(7, 16.7, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  },
  cloud: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(7, 17);
    ctx.arc(8.5, 13.5, 3.5, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(13, 10.5, 4, Math.PI, Math.PI * 1.9);
    ctx.arc(17, 14, 3, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.stroke();
  },
  user: (ctx) => {
    ctx.beginPath();
    ctx.arc(12, 8.5, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.arc(12, 20, 7, Math.PI, Math.PI * 2);
    ctx.stroke();
  },
  api: (ctx) => {
    ctx.beginPath();
    ctx.arc(12, 12, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 12, 3.4, 8, 0, 0, Math.PI * 2);
    ctx.moveTo(4, 12);
    ctx.lineTo(20, 12);
    ctx.moveTo(5.5, 7.5);
    ctx.lineTo(18.5, 7.5);
    ctx.moveTo(5.5, 16.5);
    ctx.lineTo(18.5, 16.5);
    ctx.stroke();
  },
  queue: (ctx) => {
    rr(ctx, 3.5, 8, 4.5, 8, 1);
    rr(ctx, 9.75, 8, 4.5, 8, 1);
    rr(ctx, 16, 8, 4.5, 8, 1);
  },
  cache: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(13, 3);
    ctx.lineTo(6, 13);
    ctx.lineTo(11, 13);
    ctx.lineTo(10, 21);
    ctx.lineTo(18, 10);
    ctx.lineTo(12.5, 10);
    ctx.closePath();
    ctx.stroke();
  },
  browser: (ctx) => {
    rr(ctx, 3.5, 4.5, 17, 15, 2);
    ctx.beginPath();
    ctx.moveTo(3.5, 9);
    ctx.lineTo(20.5, 9);
    ctx.moveTo(6.2, 6.8);
    ctx.arc(6.2, 6.8, 0.3, 0, Math.PI * 2);
    ctx.moveTo(8.2, 6.8);
    ctx.arc(8.2, 6.8, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  },
  mobile: (ctx) => {
    rr(ctx, 7, 3, 10, 18, 2.5);
    ctx.beginPath();
    ctx.moveTo(10.5, 18);
    ctx.lineTo(13.5, 18);
    ctx.stroke();
  },
  gear: (ctx) => {
    ctx.beginPath();
    ctx.arc(12, 12, 3.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.moveTo(12 + c * 5, 12 + s * 5);
      ctx.lineTo(12 + c * 7.5, 12 + s * 7.5);
    }
    ctx.stroke();
  },
  lambda: (ctx) => {
    rr(ctx, 3.5, 3.5, 17, 17, 3);
    ctx.beginPath();
    ctx.moveTo(8, 6.5);
    ctx.lineTo(11, 6.5);
    ctx.lineTo(16, 17.5);
    ctx.moveTo(13.5, 11.5);
    ctx.lineTo(8, 17.5);
    ctx.stroke();
  },
  folder: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(4, 7);
    ctx.lineTo(9, 7);
    ctx.lineTo(11, 9.5);
    ctx.lineTo(20, 9.5);
    ctx.lineTo(20, 18);
    ctx.lineTo(4, 18);
    ctx.closePath();
    ctx.stroke();
  },
};

export const ICON_IDS = Object.keys(ICONS);

export const ICON_LABELS: Record<string, string> = {
  database: "Database",
  server: "Server",
  cloud: "Cloud",
  user: "User",
  api: "API",
  queue: "Queue",
  cache: "Cache",
  browser: "Browser",
  mobile: "Mobile",
  gear: "Config",
  lambda: "Function",
  folder: "Folder",
};

/** Draw an icon element's art into its world-space box. */
export function drawIconArt(
  ctx: CanvasRenderingContext2D,
  iconId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opacity: number,
): void {
  const fn = ICONS[iconId];
  if (!fn) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.scale(w / 24, h / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  fn(ctx);
  ctx.restore();
}
