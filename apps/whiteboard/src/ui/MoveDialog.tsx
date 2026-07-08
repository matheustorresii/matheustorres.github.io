import type { Folder } from "../types/model";

export function MoveDialog({
  title,
  folders,
  disabledIds,
  onPick,
  onClose,
}: {
  title: string;
  folders: Folder[];
  disabledIds: Set<string>;
  onPick: (folderId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          <button className="btn" onClick={() => onPick(null)}>
            📁 Raiz
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              className="btn"
              disabled={disabledIds.has(f.id)}
              style={{ opacity: disabledIds.has(f.id) ? 0.4 : 1, textAlign: "left" }}
              onClick={() => onPick(f.id)}
            >
              📁 {f.name}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
