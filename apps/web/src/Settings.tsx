import { useEffect, useRef, useState } from "react";
import { useSettings, type Lang, type Theme } from "./i18n.js";

export function Settings() {
  const { t, lang, setLang, theme, setTheme } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Language names are always shown as endonyms (each in its own language) so a
  // speaker recognizes their own option regardless of the active language.
  const langs: { id: Lang; label: string }[] = [
    { id: "pt", label: "Português" },
    { id: "es", label: "Español" },
    { id: "en", label: "English" },
  ];
  const themes: { id: Theme; label: string }[] = [
    { id: "dark", label: t("Escuro") },
    { id: "light", label: t("Claro") },
  ];

  return (
    <div className="settings" ref={ref}>
      <button className="settings-btn" onClick={() => setOpen((o) => !o)} title={t("Configurações")}>
        ⚙
      </button>
      {open && (
        <div className="settings-menu fade-in">
          <div className="set-group">
            <div className="set-label">{t("Idioma")}</div>
            <div className="set-options">
              {langs.map((l) => (
                <button key={l.id} className={lang === l.id ? "is-active" : ""} onClick={() => setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="set-group">
            <div className="set-label">{t("Tema")}</div>
            <div className="set-options">
              {themes.map((th) => (
                <button key={th.id} className={theme === th.id ? "is-active" : ""} onClick={() => setTheme(th.id)}>
                  {th.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
