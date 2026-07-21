import { useEffect, useMemo, useState } from "react";

export interface LibIcon {
  id: string;
  label: string;
  category: string;
}

// Generic modal to browse & pick an SVG-library icon (AWS services, dev tools).
// The bulky SVG data is loaded on demand (dynamic import) when the modal opens.
export function IconLibraryModal({
  title,
  placeholder,
  icons,
  categories,
  prefix,
  loadData,
  onPick,
  onClose,
}: {
  title: string;
  placeholder: string;
  icons: LibIcon[];
  categories: string[];
  prefix: string; // iconId prefix, e.g. "aws-svc:" or "dev:"
  loadData: () => Promise<Record<string, string>>;
  onPick: (iconId: string) => void;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState<Record<string, string> | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadData().then((m) => {
      if (alive) setSvg(m);
    });
    return () => {
      alive = false;
    };
  }, [loadData]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return icons.filter(
      (i) =>
        (!cat || i.category === cat) &&
        (!q || i.label.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)),
    );
  }, [query, cat, icons]);

  const uri = (id: string) =>
    svg && svg[id] ? "data:image/svg+xml," + encodeURIComponent(svg[id]) : "";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="aws-picker" onClick={(e) => e.stopPropagation()}>
        <div className="aws-picker-head">
          <strong>{title}</strong>
          <span className="aws-picker-count">{list.length}</span>
          <input
            autoFocus
            className="aws-search"
            placeholder={placeholder}
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
          {categories.map((c) => (
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
                onClick={() => onPick(prefix + i.id)}
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
