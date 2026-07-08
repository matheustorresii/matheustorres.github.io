import { useEffect, useRef, useState } from "react";
import type { Board } from "../types/model";
import { SCHEMA_VERSION } from "../types/model";
import { goHome, goToBoard } from "../router";
import { CanvasRoot } from "../canvas/CanvasRoot";
import { decodeBoardFromPayload } from "../sync/shareLink";
import { putBoard } from "../persistence/boardsRepo";
import { makeThumbnail } from "../persistence/thumbnails";
import { newId } from "../lib/id";

export function SharedViewer({ payload }: { payload: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<Board | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let root: CanvasRoot | null = null;
    let cancelled = false;
    void (async () => {
      let board: Board;
      try {
        board = await decodeBoardFromPayload(payload);
      } catch {
        if (!cancelled) setState("error");
        return;
      }
      if (cancelled) return;
      boardRef.current = board;
      setState("ready");
      // mount read-only canvas after the host is in the DOM
      requestAnimationFrame(() => {
        if (cancelled || !hostRef.current) return;
        root = new CanvasRoot(hostRef.current);
        root.readonly = true;
        root.setTool("select");
        root.loadBoard(
          board.elements,
          board.appState?.viewport ?? { scale: 1, offsetX: 0, offsetY: 0 },
        );
      });
    })();
    return () => {
      cancelled = true;
      root?.destroy();
    };
  }, [payload]);

  const importMine = async () => {
    const src = boardRef.current;
    if (!src) return;
    const now = Date.now();
    const copy: Board = {
      ...structuredClone(src),
      id: newId(),
      name: `${src.name} (importado)`,
      folderId: null,
      thumbnailDataUrl: makeThumbnail(src.elements),
      sharedGistId: undefined,
      remoteSha: undefined,
      baseRemoteUpdatedAt: undefined,
      syncState: "local-only",
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    await putBoard(copy);
    goToBoard(copy.id);
  };

  if (state === "error") {
    return (
      <div className="empty" style={{ pointerEvents: "auto" }}>
        <div className="big">11A3</div>
        <div>Não foi possível abrir este board compartilhado.</div>
        <div className="hint">O link parece inválido ou incompleto (foi cortado ao copiar?).</div>
        <button className="btn btn-primary" onClick={goHome}>
          Ir para o 11A3
        </button>
      </div>
    );
  }

  return (
    <div className="workspace">
      <div className="canvas-area">
        <div className="canvas-host" ref={hostRef} />
        <div className="shared-bar">
          <span className="brand">
            11<span className="a">A</span>3
          </span>
          <span className="hint">
            {state === "loading" ? "Carregando…" : "Board compartilhado · somente leitura"}
          </span>
          <div className="row">
            <button className="btn" onClick={importMine} disabled={state !== "ready"}>
              Importar para mim
            </button>
            <button className="btn btn-primary" onClick={goHome}>
              Abrir meu 11A3
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
