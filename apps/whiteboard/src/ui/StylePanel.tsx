import type { StyleDefaults, Tool } from "../types/model";
import type { SelInfo } from "./Workspace";

const STROKE_COLORS = ["#acd52c", "#e8ecd9", "#ff5c5c", "#4aa3ff", "#f0b429", "#b07cff"];
const FILL_COLORS = ["transparent", "#2a3316", "#3a2020", "#1f3040", "#3d3410"];

export function StylePanel({
  sel,
  style,
  tool,
  open,
  onStyle,
  onMono,
}: {
  sel: SelInfo | null;
  style: StyleDefaults;
  tool: Tool;
  open: boolean;
  onStyle: (patch: Partial<StyleDefaults>) => void;
  onMono: (on: boolean) => void;
}) {
  // reflect the selected element if any, else the active tool's defaults
  const cur = sel ?? style;
  // text mode = a text element is selected, or the text tool is active (creating)
  const isText = sel ? sel.type === "text" : tool === "text";
  const isImage = sel?.type === "image";
  const isCorner = sel
    ? sel.type === "rectangle" || sel.type === "diamond"
    : tool === "rectangle" || tool === "diamond";
  const curFontSize = sel?.type === "text" ? sel.fontSize : style.fontSize;
  const curMono = sel?.type === "text" ? sel.mono : style.mono;
  const curRounded = isCorner && sel ? sel.rounded : style.rounded;

  return (
    <div className={`style-panel ${open ? "is-open" : ""}`}>
      {!isImage && (
        <div className="field">
          <label>Traço</label>
          <div className="swatches">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${cur.strokeColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onStyle({ strokeColor: c })}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {!isText && !isImage && (
        <div className="field">
          <label>Preenchimento</label>
          <div className="swatches">
            {FILL_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${cur.fillColor === c ? "active" : ""}`}
                style={{
                  background:
                    c === "transparent"
                      ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px"
                      : c,
                }}
                onClick={() => onStyle({ fillColor: c })}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {!isText && !isImage && (
        <div className="field">
          <label>Espessura · {cur.strokeWidth}</label>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={cur.strokeWidth}
            onChange={(e) => onStyle({ strokeWidth: Number(e.target.value) })}
          />
        </div>
      )}

      {isCorner && (
        <div className="field">
          <label>Cantos</label>
          <div className="row">
            <button
              className={`btn ${curRounded ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => onStyle({ rounded: true })}
            >
              Arredondado
            </button>
            <button
              className={`btn ${!curRounded ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => onStyle({ rounded: false })}
            >
              Reto
            </button>
          </div>
        </div>
      )}

      {isText && (
        <div className="field">
          <label>Tamanho da fonte · {curFontSize}</label>
          <input
            type="range"
            min={8}
            max={96}
            step={1}
            value={curFontSize}
            onChange={(e) => onStyle({ fontSize: Number(e.target.value) })}
          />
        </div>
      )}

      {isText && (
        <div className="field">
          <label>Estilo do texto</label>
          <button
            className={`btn ${curMono ? "btn-primary" : ""}`}
            onClick={() =>
              sel?.type === "text" ? onMono(!curMono) : onStyle({ mono: !curMono })
            }
            title="Alterna bloco de código monospace"
          >
            {"{ }"} Código {curMono ? "· on" : ""}
          </button>
        </div>
      )}

      <div className="field">
        <label>Opacidade · {Math.round(cur.opacity * 100)}%</label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={cur.opacity}
          onChange={(e) => onStyle({ opacity: Number(e.target.value) })}
        />
      </div>

      <div className="hint">
        {sel ? "Editando o elemento selecionado" : "Padrões da ferramenta"}
      </div>
    </div>
  );
}
