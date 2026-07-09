import { useState } from "react";
import { useLibraryStore } from "../store/libraryStore";
import { MoveDialog } from "./MoveDialog";
import {
  ConfirmDialog,
  PromptDialog,
  type ConfirmSpec,
  type PromptSpec,
} from "./Dialogs";

type MoveTarget =
  | { kind: "board"; id: string }
  | { kind: "folder"; id: string }
  | null;

export function Sidebar({
  open,
  activeBoardId,
  theme,
  onOpenBoard,
  onCreateBoard,
  onClose,
  onToggleTheme,
}: {
  open: boolean;
  activeBoardId: string | null;
  theme: "dark" | "light";
  onOpenBoard: (id: string) => void;
  onCreateBoard: (folderId: string | null) => void;
  onClose: () => void;
  onToggleTheme: () => void;
}) {
  const lib = useLibraryStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [move, setMove] = useState<MoveTarget>(null);
  const [prompt, setPrompt] = useState<PromptSpec | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const foldersOf = (parentId: string | null) =>
    lib.folders.filter((f) => f.parentId === parentId);
  const boardsOf = (folderId: string | null) =>
    lib.boards.filter((b) => b.folderId === folderId);

  const descendants = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of lib.folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  };

  const renderBoard = (id: string, name: string, thumb: string | undefined, depth: number) => (
    <div
      key={id}
      className={`tree-row ${activeBoardId === id ? "active" : ""}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onOpenBoard(id)}
    >
      <span className="twist" />
      {thumb ? (
        <img className="thumb" src={thumb} alt="" />
      ) : (
        <span className="thumb" />
      )}
      <span className="name">{name}</span>
      <button
        className="rowbtn"
        title="Renomear"
        onClick={(e) => {
          e.stopPropagation();
          setPrompt({
            title: "Renomear board",
            initial: name,
            okLabel: "Renomear",
            onOk: (n) => void lib.renameBoard(id, n),
          });
        }}
      >
        ✏
      </button>
      <button
        className="rowbtn"
        title="Duplicar"
        onClick={(e) => {
          e.stopPropagation();
          void lib.duplicateBoard(id);
        }}
      >
        ⧉
      </button>
      <button
        className="rowbtn"
        title="Mover"
        onClick={(e) => {
          e.stopPropagation();
          setMove({ kind: "board", id });
        }}
      >
        ↪
      </button>
      <button
        className="rowbtn"
        title="Excluir"
        onClick={(e) => {
          e.stopPropagation();
          setConfirm({
            title: `Excluir "${name}"?`,
            message: "Esta ação não pode ser desfeita.",
            okLabel: "Excluir",
            danger: true,
            onOk: () => void lib.removeBoard(id),
          });
        }}
      >
        🗑
      </button>
    </div>
  );

  const renderFolder = (folderId: string, name: string, depth: number) => {
    const isCollapsed = collapsed.has(folderId);
    return (
      <div key={folderId}>
        <div className="tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
          <span className="twist" onClick={() => toggle(folderId)}>
            {isCollapsed ? "▶" : "▼"}
          </span>
          <span className="name" onClick={() => toggle(folderId)}>
            📁 {name}
          </span>
          <button
            className="rowbtn"
            title="Novo board aqui"
            onClick={() => onCreateBoard(folderId)}
          >
            ＋
          </button>
          <button
            className="rowbtn"
            title="Nova subpasta"
            onClick={() =>
              setPrompt({
                title: "Nova subpasta",
                placeholder: "Nome da subpasta",
                okLabel: "Criar",
                onOk: (n) => void lib.createFolder(folderId, n),
              })
            }
          >
            📁
          </button>
          <button
            className="rowbtn"
            title="Renomear"
            onClick={() =>
              setPrompt({
                title: "Renomear pasta",
                initial: name,
                okLabel: "Renomear",
                onOk: (n) => void lib.renameFolder(folderId, n),
              })
            }
          >
            ✏
          </button>
          <button
            className="rowbtn"
            title="Mover"
            onClick={() => setMove({ kind: "folder", id: folderId })}
          >
            ↪
          </button>
          <button
            className="rowbtn"
            title="Excluir (conteúdo vai para a raiz)"
            onClick={() =>
              setConfirm({
                title: `Excluir a pasta "${name}"?`,
                message: "O conteúdo dela será movido para a raiz (nada é apagado).",
                okLabel: "Excluir pasta",
                danger: true,
                onOk: () => void lib.removeFolder(folderId),
              })
            }
          >
            🗑
          </button>
        </div>
        {!isCollapsed && (
          <>
            {foldersOf(folderId).map((f) => renderFolder(f.id, f.name, depth + 1))}
            {boardsOf(folderId).map((b) =>
              renderBoard(b.id, b.name, b.thumbnailDataUrl, depth + 1),
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-head">
        <span className="brand">
          11<span className="a">A</span>3
        </span>
        <div className="sidebar-actions">
          <button
            className="btn btn-icon"
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button
            className="btn btn-icon"
            title="Nova pasta"
            onClick={() =>
              setPrompt({
                title: "Nova pasta",
                placeholder: "Nome da pasta",
                okLabel: "Criar",
                onOk: (n) => void lib.createFolder(null, n),
              })
            }
          >
            📁
          </button>
          <button
            className="btn btn-icon"
            title="Novo board"
            onClick={() => onCreateBoard(null)}
          >
            ＋
          </button>
          <button className="btn btn-icon" title="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="sidebar-tree">
        {!lib.loaded && <div className="section-label">Carregando…</div>}
        {lib.loaded &&
          lib.folders.length === 0 &&
          lib.boards.length === 0 && (
            <div className="section-label">Sem boards ainda. Crie um com ＋</div>
          )}
        {foldersOf(null).map((f) => renderFolder(f.id, f.name, 0))}
        {boardsOf(null).map((b) =>
          renderBoard(b.id, b.name, b.thumbnailDataUrl, 0),
        )}
      </div>

      {move && (
        <MoveDialog
          title={move.kind === "board" ? "Mover board para…" : "Mover pasta para…"}
          folders={lib.folders}
          disabledIds={move.kind === "folder" ? descendants(move.id) : new Set()}
          onPick={(folderId) => {
            if (move.kind === "board") void lib.moveBoard(move.id, folderId);
            else void lib.moveFolder(move.id, folderId);
            setMove(null);
          }}
          onClose={() => setMove(null)}
        />
      )}
      {prompt && <PromptDialog spec={prompt} onClose={() => setPrompt(null)} />}
      {confirm && <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />}
    </aside>
  );
}
