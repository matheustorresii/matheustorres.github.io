import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, StyleDefaults, Tool } from "../types/model";
import type { Route } from "../router";
import { goHome, goToBoard } from "../router";
import { CanvasRoot, type TextEditRequest } from "../canvas/CanvasRoot";
import { worldToScreen } from "../canvas/viewport";
import { useUiStore } from "../store/uiStore";
import { useLibraryStore } from "../store/libraryStore";
import { getBoard, putBoard } from "../persistence/boardsRepo";
import { getSetting } from "../persistence/settingsRepo";
import { syncAll } from "../sync/syncEngine";
import { makeThumbnail } from "../persistence/thumbnails";
import { debounce } from "../lib/debounce";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { StylePanel } from "./StylePanel";
import { SyncPanel } from "./SyncPanel";
import { ShareDialog } from "./ShareDialog";

export interface SelInfo {
  type: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  mono: boolean;
  rounded: boolean;
}

interface UiMirror {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  sel: SelInfo | null;
  hasSelection: boolean;
}

export function Workspace({ route }: { route: Route }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<CanvasRoot | null>(null);
  const boardRef = useRef<Board | null>(null);
  const dirtyRef = useRef(false); // unsynced local changes since last GitHub sync
  const syncingRef = useRef(false);

  const [textReq, setTextReq] = useState<TextEditRequest | null>(null);
  const [ui, setUi] = useState<UiMirror>({
    zoom: 1,
    canUndo: false,
    canRedo: false,
    sel: null,
    hasSelection: false,
  });
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false); // mobile: style panel toggle

  const tool = useUiStore((s) => s.tool);
  const style = useUiStore((s) => s.style);
  const snap = useUiStore((s) => s.snap);
  const setToolStore = useUiStore((s) => s.setTool);
  const setStyleStore = useUiStore((s) => s.setStyle);
  const setSnapStore = useUiStore((s) => s.setSnap);
  const library = useLibraryStore();
  const refresh = library.refresh;

  // ---- persistence (debounced autosave) ----
  const persistNow = useCallback(async () => {
    const root = rootRef.current;
    const board = boardRef.current;
    if (!root || !board) return;
    board.elements = root.scene.all();
    board.appState.viewport = root.scene.viewport;
    board.updatedAt = Date.now();
    board.thumbnailDataUrl = makeThumbnail(board.elements);
    if (board.syncState === "synced") board.syncState = "local-only";
    dirtyRef.current = true;
    await putBoard(board);
    await refresh();
  }, [refresh]);

  // Auto-sync when the tab is backgrounded/closed (the web's viewDidDisappear):
  // best-effort push, only when a token is set and there are unsynced changes.
  useEffect(() => {
    const autoSync = async () => {
      if (document.visibilityState !== "hidden") return;
      if (!dirtyRef.current || syncingRef.current) return;
      const pat = await getSetting<string>("github.pat");
      const repo = await getSetting<string>("github.repo");
      if (!pat || !repo) return;
      const branch = (await getSetting<string>("github.branch")) || "main";
      syncingRef.current = true;
      await persistNow(); // flush the current board first
      const res = await syncAll({ pat, repo, branch });
      syncingRef.current = false;
      if (!res.error && res.conflicts.length === 0) dirtyRef.current = false;
    };
    document.addEventListener("visibilitychange", autoSync);
    window.addEventListener("pagehide", autoSync);
    return () => {
      document.removeEventListener("visibilitychange", autoSync);
      window.removeEventListener("pagehide", autoSync);
    };
  }, [persistNow]);

  // Sync once on entering the site (the web's viewDidLoad): pull the latest so
  // you land on an up-to-date workspace. Only reflect it on the open board if
  // you haven't started editing (protects fresh strokes from being overwritten).
  useEffect(() => {
    void (async () => {
      const pat = await getSetting<string>("github.pat");
      const repo = await getSetting<string>("github.repo");
      if (!pat || !repo || syncingRef.current) return;
      const branch = (await getSetting<string>("github.branch")) || "main";
      syncingRef.current = true;
      const res = await syncAll({ pat, repo, branch });
      syncingRef.current = false;
      if (res.error) return;
      await refresh();
      if (!dirtyRef.current) {
        const id = boardRef.current?.id;
        if (id) {
          const b = await getBoard(id);
          if (b) {
            boardRef.current = b;
            rootRef.current?.loadBoard(b.elements, b.appState.viewport);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useMemo(
    () => debounce(persistNow, 700),
    [persistNow],
  );

  // ---- create the imperative canvas once ----
  useEffect(() => {
    if (!hostRef.current) return;
    const root = new CanvasRoot(hostRef.current);
    rootRef.current = root;
    if (import.meta.env.DEV)
      (window as unknown as { __wbRoot?: CanvasRoot }).__wbRoot = root;
    root.setTool(useUiStore.getState().tool);
    root.setStyle(useUiStore.getState().style);
    root.setSnap(useUiStore.getState().snap);

    root.onTextEdit = (req) => setTextReq(req);
    root.onToolChange = (t) => setToolStore(t);
    root.onUiSync = () => {
      const sc = root.scene;
      let sel: SelInfo | null = null;
      const single = sc.singleSelection;
      if (single) {
        const el = sc.get(single);
        if (el) {
          sel = {
            type: el.type,
            strokeColor: el.strokeColor,
            fillColor: el.fillColor,
            strokeWidth: el.strokeWidth,
            opacity: el.opacity,
            fontSize: "fontSize" in el ? el.fontSize : style.fontSize,
            mono: el.type === "text" ? !!el.mono : false,
            rounded: !!el.rounded,
          };
        }
      }
      setUi({
        zoom: sc.viewport.scale,
        canUndo: root.history.canUndo(),
        canRedo: root.history.canRedo(),
        sel,
        hasSelection: sc.selectedIds.size > 0,
      });
    };
    root.onChange = () => {
      dirtyRef.current = true;
      scheduleSave();
    };

    return () => {
      scheduleSave.flush();
      root.destroy();
      rootRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- load library once ----
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---- resolve route → active board ----
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (route.kind === "board") {
        const b = await getBoard(route.id);
        if (cancelled) return;
        if (!b) {
          setActiveBoardId(null);
          boardRef.current = null;
          return;
        }
        boardRef.current = b;
        setActiveBoardId(b.id);
        rootRef.current?.loadBoard(b.elements, b.appState.viewport);
      } else {
        // home: auto-open most recent board if any
        boardRef.current = null;
        setActiveBoardId(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [route]);

  // if the open board gets deleted (here or via sync), drop it so it isn't
  // re-persisted from memory (which used to "resurrect" deletions).
  useEffect(() => {
    if (!library.loaded || !activeBoardId) return;
    if (!library.boards.some((b) => b.id === activeBoardId)) {
      boardRef.current = null;
      setActiveBoardId(null);
      rootRef.current?.loadBoard([], { scale: 1, offsetX: 0, offsetY: 0 });
      if (route.kind === "board") goHome();
    }
  }, [library.boards, library.loaded, activeBoardId, route]);

  // auto-open most recent board when landing on home with boards present
  useEffect(() => {
    if (route.kind === "home" && library.loaded && library.boards.length > 0) {
      goToBoard(library.boards[0].id);
    }
  }, [route, library.loaded, library.boards]);

  // ---- handlers ----
  const handleTool = (t: Tool) => {
    setToolStore(t);
    rootRef.current?.setTool(t);
  };
  const handleStyle = (patch: Partial<StyleDefaults>) => {
    setStyleStore(patch);
    rootRef.current?.setStyle(patch);
  };
  const handleUndo = () => rootRef.current?.undo();
  const handleRedo = () => rootRef.current?.redo();
  const handleToggleSnap = () => {
    const next = !snap;
    setSnapStore(next);
    rootRef.current?.setSnap(next);
  };
  const handleZoom = (factor: number) => rootRef.current?.zoomBy(factor);
  const handleResetView = () => rootRef.current?.resetView();

  const createAndOpen = async (folderId: string | null) => {
    const b = await library.createBoard(folderId);
    setSidebarOpen(false);
    goToBoard(b.id);
  };
  const openBoard = (id: string) => {
    setSidebarOpen(false);
    goToBoard(id);
  };

  const openSync = () => {
    void persistNow(); // flush the current board so sync sees the latest
    setSyncOpen(true);
  };
  const openShare = async () => {
    await persistNow(); // share the current version
    setShareOpen(true);
  };
  const handleSynced = async () => {
    dirtyRef.current = false;
    await refresh();
    const id = activeBoardId;
    if (!id) return;
    const b = await getBoard(id);
    if (b) {
      boardRef.current = b;
      rootRef.current?.loadBoard(b.elements, b.appState.viewport);
    }
  };

  const hasBoard = activeBoardId !== null;

  return (
    <div className="workspace">
      <div className="canvas-area">
        <div className="canvas-host" ref={hostRef} />

        <button
          className="menu-btn"
          title="Boards e pastas"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰
        </button>
        <button
          className="menu-btn"
          style={{ left: "calc(var(--space-3) + 48px)" }}
          title="Sincronizar com o GitHub"
          onClick={openSync}
        >
          ⟳
        </button>
        {hasBoard && (
          <button
            className="menu-btn"
            style={{ left: "calc(var(--space-3) + 96px)" }}
            title="Compartilhar este board (link somente leitura)"
            onClick={openShare}
          >
            ↗
          </button>
        )}

        {hasBoard && (
          <>
            <Toolbar
              tool={tool}
              canUndo={ui.canUndo}
              canRedo={ui.canRedo}
              snap={snap}
              onTool={handleTool}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onToggleSnap={handleToggleSnap}
              onPickIcon={(id) => {
                setToolStore("icon");
                rootRef.current?.setIcon(id);
              }}
            />
            <button
              className="style-toggle"
              title="Estilo"
              onClick={() => setStyleOpen((o) => !o)}
            >
              🎨
            </button>
            <StylePanel
              sel={ui.sel}
              style={style}
              tool={tool}
              open={styleOpen}
              onStyle={handleStyle}
              onMono={(on) => rootRef.current?.setTextMono(on)}
            />
            <div className="zoom-pill">
              <button onClick={() => handleZoom(1 / 1.2)} title="Zoom out">
                −
              </button>
              <button className="val" onClick={handleResetView} title="Resetar">
                {Math.round(ui.zoom * 100)}%
              </button>
              <button onClick={() => handleZoom(1.2)} title="Zoom in">
                +
              </button>
            </div>
            {ui.hasSelection && (
              <button
                className="delete-fab touch-only"
                title="Excluir seleção"
                onClick={() => rootRef.current?.deleteSelection()}
              >
                🗑
              </button>
            )}
          </>
        )}

        {!hasBoard && (
          <div className="empty">
            <div className="big">11A3</div>
            <div>Nenhum board aberto.</div>
            <button
              className="btn btn-primary"
              style={{ pointerEvents: "auto" }}
              onClick={() => createAndOpen(null)}
            >
              + Criar board
            </button>
          </div>
        )}

        {textReq && (
          <TextOverlay
            req={textReq}
            root={rootRef.current}
            liveStyle={style}
            onDone={() => setTextReq(null)}
          />
        )}
      </div>

      {syncOpen && (
        <SyncPanel onClose={() => setSyncOpen(false)} onSynced={handleSynced} />
      )}
      {shareOpen && boardRef.current && (
        <ShareDialog board={boardRef.current} onClose={() => setShareOpen(false)} />
      )}
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <Sidebar
        open={sidebarOpen}
        activeBoardId={activeBoardId}
        onOpenBoard={openBoard}
        onCreateBoard={createAndOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}

function TextOverlay({
  req,
  root,
  liveStyle,
  onDone,
}: {
  req: TextEditRequest;
  root: CanvasRoot | null;
  liveStyle: StyleDefaults;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  // For NEW text, style comes live from the panel (change font/mono while
  // creating). For editing an existing element, use its frozen values.
  const isNew = req.id === null;
  const fontSize = isNew ? liveStyle.fontSize : req.fontSize;
  const color = isNew ? liveStyle.strokeColor : req.color;
  const mono = isNew ? liveStyle.mono : req.mono;

  // Uncontrolled textarea: React never rewrites the value, so the caret is
  // never yanked to the end mid-typing (that broke Tab-then-type). We read the
  // value straight from the DOM on commit.
  const autosize = () => {
    const t = ref.current;
    if (!t) return;
    if (req.autoWidth) {
      t.style.width = "0px";
      t.style.width = t.scrollWidth + 2 + "px";
    }
    t.style.height = "0px";
    t.style.height = t.scrollHeight + "px";
  };

  useEffect(() => {
    // Defer focus past the click's default action (see note): a same-tick
    // focus() is overridden by the browser's focus-fixup to <body>.
    const id = window.setTimeout(() => {
      const t = ref.current;
      if (t) {
        t.focus();
        // place the caret at the end (don't select-all — that made the first
        // keystroke wipe the existing text when editing).
        const len = t.value.length;
        t.setSelectionRange(len, len);
        autosize();
      }
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refit when font/mono change live from the panel
  useEffect(autosize, [fontSize, mono]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!root) return null;
  const v = root.scene.viewport;
  const screen = worldToScreen(v, { x: req.worldX, y: req.worldY });
  const pad = mono ? 10 * v.scale : 0;

  // Escape, Ctrl/Cmd+Enter and clicking away COMMIT — using the live style for
  // new text. Guarded against the unmount-triggered blur committing twice.
  const commit = () => {
    if (done.current) return;
    done.current = true;
    root.commitText({ ...req, fontSize, color, mono }, ref.current?.value ?? req.initial);
    onDone();
  };

  return (
    <textarea
      ref={ref}
      className="text-overlay"
      defaultValue={req.initial}
      onInput={autosize}
      onBlur={(e) => {
        // Clicking the style panel/toolbar must NOT commit — the user is
        // adjusting font/mono for this very text. Keep the overlay open.
        const rt = e.relatedTarget as HTMLElement | null;
        if (rt && rt.closest(".style-panel, .toolbar")) return;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          commit();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          commit();
        } else if (e.key === "Tab") {
          // insert two spaces instead of moving focus (dev-friendly).
          // setRangeText keeps the caret placement native — no React re-render.
          e.preventDefault();
          const t = e.currentTarget;
          t.setRangeText("  ", t.selectionStart, t.selectionEnd, "end");
          autosize();
        }
      }}
      style={{
        left: screen.x,
        top: screen.y,
        fontSize: fontSize * v.scale,
        color: color,
        fontFamily: mono ? "ui-monospace, monospace" : "Inter, sans-serif",
        padding: pad,
        background:
          req.targetKind === "arrowLabel" ? "#0f120b" : mono ? "#12140d" : "transparent",
        boxSizing: "border-box",
        whiteSpace: req.autoWidth ? "pre" : "pre-wrap",
        overflow: "hidden",
        minWidth: 40,
        width: req.autoWidth ? undefined : req.boxWidth * v.scale,
        // arrow labels are centered on the arrow midpoint (match the drawn chip)
        textAlign: req.targetKind === "arrowLabel" ? "center" : undefined,
        transform: req.targetKind === "arrowLabel" ? "translate(-50%, -50%)" : undefined,
      }}
    />
  );
}
