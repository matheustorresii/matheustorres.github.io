import { useEffect, useMemo, useState } from "react";
import { AWS_ICONS, AWS_CATEGORIES } from "../canvas/awsIcons";
import { AWS_SVC_PREFIX } from "../canvas/icons";

// Modal to browse & pick an official AWS service icon. The bulky SVG data is
// loaded on demand (dynamic import) the first time the modal opens.
export function AwsPicker({
  onPick,
  onClose,
}: {
  onPick: (iconId: string) => void;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState<Record<string, string> | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void import("../canvas/awsIconData").then((m) => {
      if (alive) setSvg(m.AWS_SVG);
    });
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AWS_ICONS.filter(
      (i) =>
        (!cat || i.category === cat) &&
        (!q || i.label.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)),
    );
  }, [query, cat]);

  const uri = (id: string) =>
    svg && svg[id] ? "data:image/svg+xml," + encodeURIComponent(svg[id]) : "";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="aws-picker" onClick={(e) => e.stopPropagation()}>
        <div className="aws-picker-head">
          <strong>Ícones AWS</strong>
          <span className="aws-picker-count">{list.length}</span>
          <input
            autoFocus
            className="aws-search"
            placeholder="Buscar serviço…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="aws-close" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>
        <div className="aws-cats">
          <button
            className={`aws-cat ${cat === null ? "active" : ""}`}
            onClick={() => setCat(null)}
          >
            Todos
          </button>
          {AWS_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`aws-cat ${cat === c ? "active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="aws-grid">
          {!svg && <div className="aws-loading">Carregando ícones…</div>}
          {svg &&
            list.map((i) => (
              <button
                key={i.id}
                className="aws-item"
                title={`${i.label} · ${i.category}`}
                onClick={() => onPick(AWS_SVC_PREFIX + i.id)}
              >
                <img src={uri(i.id)} alt={i.label} width={40} height={40} draggable={false} />
                <span>{i.label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
