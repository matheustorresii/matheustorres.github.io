import { useEffect, useRef, useState, type JSX, type Ref } from "react";
import type { Tool } from "../types/model";
import { ICON_IDS, ICON_LABELS, drawIconArt } from "../canvas/icons";
import { AwsPicker } from "./AwsPicker";

function IconThumb({ id, size = 24, color }: { id: string; size?: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    drawIconArt(ctx, id, 2, 2, size - 4, size - 4, color, 1);
  }, [id, size, color]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

function IconPicker({
  onPick,
  onOpenAws,
  iconColor,
  rootRef,
}: {
  onPick: (id: string) => void;
  onOpenAws: () => void;
  iconColor: string;
  rootRef: Ref<HTMLDivElement>;
}) {
  const cell = (id: string) => (
    <button
      key={id}
      className="icon-cell"
      title={ICON_LABELS[id] ?? id}
      onClick={() => onPick(id)}
    >
      <IconThumb id={id} color={iconColor} />
    </button>
  );
  return (
    <div className="icon-picker" ref={rootRef}>
      <div className="icon-group-label">Genéricos</div>
      <div className="icon-grid">{ICON_IDS.map(cell)}</div>
      <button className="aws-open-btn" onClick={onOpenAws}>
        <span className="aws-badge">aws</span>
        Ícones AWS oficiais
        <span className="aws-chevron">›</span>
      </button>
    </div>
  );
}

const S = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<string, JSX.Element> = {
  select: (
    <svg {...S}>
      <path d="M5 3l6.5 15.5 2.2-6.3 6.3-2.2z" fill="currentColor" stroke="none" />
    </svg>
  ),
  rectangle: (
    <svg {...S}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  ),
  diamond: (
    <svg {...S}>
      <path d="M12 3l9 9-9 9-9-9z" />
    </svg>
  ),
  ellipse: (
    <svg {...S}>
      <ellipse cx="12" cy="12" rx="8" ry="6" />
    </svg>
  ),
  line: (
    <svg {...S}>
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  ),
  arrow: (
    <svg {...S}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <path d="M12 5h7v7" />
    </svg>
  ),
  freehand: (
    <svg {...S}>
      <path d="M4 18c3-1 4-9 7-9s2 6 4 6 2-4 4-5" />
    </svg>
  ),
  text: (
    <svg {...S}>
      <path d="M5 6h14M12 6v12M9 18h6" />
    </svg>
  ),
};

const TOOLS: { id: Tool; title: string; num: number }[] = [
  { id: "select", title: "Selecionar", num: 1 },
  { id: "rectangle", title: "Retângulo", num: 2 },
  { id: "diamond", title: "Losango", num: 3 },
  { id: "ellipse", title: "Elipse", num: 4 },
  { id: "line", title: "Linha", num: 5 },
  { id: "arrow", title: "Seta", num: 6 },
  { id: "freehand", title: "Desenho livre", num: 7 },
  { id: "text", title: "Texto", num: 8 },
];

export function Toolbar({
  tool,
  theme,
  canUndo,
  canRedo,
  snap,
  onTool,
  onUndo,
  onRedo,
  onToggleSnap,
  onPickIcon,
}: {
  tool: Tool;
  theme: "dark" | "light";
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSnap: () => void;
  onPickIcon: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [awsOpen, setAwsOpen] = useState(false);
  const iconColor = theme === "light" ? "#1b1e12" : "#e8ecd9";
  const iconBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // close the icon picker when clicking anywhere outside it (except its toggle)
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pickerRef.current?.contains(t) || iconBtnRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [pickerOpen]);
  return (
    <>
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool ${tool === t.id ? "active" : ""}`}
          title={`${t.title} — ${t.num}`}
          onClick={() => onTool(t.id)}
        >
          {ICONS[t.id]}
          <span className="tool-num">{t.num}</span>
        </button>
      ))}
      <button
        ref={iconBtnRef}
        className={`tool ${tool === "icon" ? "active" : ""}`}
        title="Ícones de arquitetura"
        onClick={() => setPickerOpen((o) => !o)}
      >
        <svg {...S}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <path d="M17 13.5v7M13.5 17h7" />
        </svg>
      </button>
      <div className="toolbar-sep" />
      <button
        className="tool"
        title="Desfazer (Ctrl+Z)"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ opacity: canUndo ? 1 : 0.35 }}
      >
        <svg {...S}>
          <path d="M9 7L4 12l5 5" />
          <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
        </svg>
      </button>
      <button
        className="tool"
        title="Refazer (Ctrl+Shift+Z)"
        onClick={onRedo}
        disabled={!canRedo}
        style={{ opacity: canRedo ? 1 : 0.35 }}
      >
        <svg {...S}>
          <path d="M15 7l5 5-5 5" />
          <path d="M20 12H9a5 5 0 0 0 0 10h1" />
        </svg>
      </button>
      <div className="toolbar-sep" />
      <button
        className={`tool ${snap ? "active" : ""}`}
        title={`Grid + snap: ${snap ? "ligado" : "desligado"}`}
        onClick={onToggleSnap}
      >
        <svg {...S}>
          <path d="M4 9h16M4 15h16M9 4v16M15 4v16" strokeWidth={1.5} />
        </svg>
      </button>
    </div>
    {pickerOpen && (
      <IconPicker
        rootRef={pickerRef}
        iconColor={iconColor}
        onPick={(id) => {
          onPickIcon(id);
          setPickerOpen(false);
        }}
        onOpenAws={() => setAwsOpen(true)}
      />
    )}
    {awsOpen && (
      <AwsPicker
        onPick={(id) => {
          onPickIcon(id);
          setAwsOpen(false);
          setPickerOpen(false);
        }}
        onClose={() => setAwsOpen(false)}
      />
    )}
    </>
  );
}
