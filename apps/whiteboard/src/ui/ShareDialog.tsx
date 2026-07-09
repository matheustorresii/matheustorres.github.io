import { useEffect, useState } from "react";
import type { Board } from "../types/model";
import { encodeBoardToPayload } from "../sync/shareLink";
import { exportPDF, exportPNG } from "../export/exportBoard";

// Chat apps sometimes truncate very long URLs; warn past this.
const LINK_WARN = 8000;

export function ShareDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [warn, setWarn] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const payload = await encodeBoardToPayload(board);
      const url = new URL(`#/s/${payload}`, location.href).href;
      setLink(url);
      const hasImages = board.elements.some((e) => e.type === "image");
      if (url.length > LINK_WARN) {
        setWarn(
          hasImages
            ? "Link grande (o board tem imagens). Pode ser cortado em alguns apps de mensagem — se quebrar, remova imagens."
            : "Link grande — se ele quebrar ao colar em algum app, avise.",
        );
      }
    })();
  }, [board]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; user can select the text */
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <h3>Compartilhar "{board.name}"</h3>
        <div className="hint">
          O link carrega o board inteiro (uma foto do estado atual) — quem abrir
          vê em <b>somente leitura</b>, <b>sem precisar de conta nem token</b>.
          Não usa GitHub. Gere de novo para compartilhar uma versão atualizada.
        </div>

        <div className="field">
          <label>Link</label>
          <input
            type="text"
            readOnly
            value={link ?? "gerando…"}
            onFocus={(e) => e.target.select()}
          />
        </div>

        {warn && <div style={{ color: "var(--warning)", fontSize: 13 }}>{warn}</div>}

        <div className="field">
          <label>Ou baixar</label>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => exportPNG(board)}>
              🖼 PNG
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => void exportPDF(board)}>
              📄 PDF
            </button>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={copy} disabled={!link}>
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
        </div>
      </div>
    </div>
  );
}
