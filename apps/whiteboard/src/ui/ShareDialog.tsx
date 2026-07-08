import { useState } from "react";
import type { Board } from "../types/model";
import { getSetting } from "../persistence/settingsRepo";
import { putBoard } from "../persistence/boardsRepo";
import { createSecretGist, type GitHubConfig } from "../sync/github";
import { toPortableJSON } from "../sync/portable";

function linkFor(gistId: string): string {
  return new URL(`#/s/${gistId}`, location.href).href;
}

export function ShareDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(
    board.sharedGistId ? linkFor(board.sharedGistId) : null,
  );
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    const pat = await getSetting<string>("github.pat");
    const repo = await getSetting<string>("github.repo");
    if (!pat || !repo) {
      setMsg("Configure o sync (token do GitHub) primeiro — o link usa um gist secreto seu.");
      return;
    }
    const cfg: GitHubConfig = {
      pat,
      repo,
      branch: (await getSetting<string>("github.branch")) || "main",
    };
    setBusy(true);
    setMsg("Gerando link…");
    try {
      const id = await createSecretGist(
        cfg,
        `board-${board.id}.json`,
        toPortableJSON(board),
        `11A3 board: ${board.name}`,
      );
      board.sharedGistId = id;
      await putBoard(board);
      setLink(linkFor(id));
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the user can select the text */
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h3>Compartilhar "{board.name}"</h3>
        <div className="hint">
          Gera um link de <b>somente leitura</b> (um gist secreto). Quem tiver o
          link vê o board sem precisar de conta nem token. Regerar atualiza a
          versão compartilhada.
        </div>

        {link && (
          <div className="field">
            <label>Link</label>
            <input type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
        )}

        {msg && <div style={{ color: "var(--warning)", fontSize: 13 }}>{msg}</div>}

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          {link && (
            <button className="btn" onClick={copy}>
              {copied ? "Copiado ✓" : "Copiar link"}
            </button>
          )}
          <button className="btn btn-primary" onClick={generate} disabled={busy}>
            {link ? "Regerar" : "Gerar link"}
          </button>
        </div>
      </div>
    </div>
  );
}
