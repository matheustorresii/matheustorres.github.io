import { useCallback, useEffect, useState } from "react";
import { Game } from "./game/Game.js";
import { Settings } from "./Settings.js";
import { ComingSoon } from "./ComingSoon.js";
import { GAMES, gameById, isGameId, type GameId } from "./games.js";
import { usePersisted } from "./usePersisted.js";
import { SettingsCtx, tr, isLang, isTheme, type Lang, type Theme } from "./i18n.js";

export function App() {
  const [lang, setLang] = usePersisted<Lang>("11a3.lang", "pt", isLang);
  const [theme, setTheme] = usePersisted<Theme>("11a3.theme", "dark", isTheme);
  const [game, setGame] = usePersisted<GameId>("11a3.game", "valorant", isGameId);
  const [gameKey, setGameKey] = useState(0);

  // Only games with data are selectable. With a single ready game the tab bar
  // collapses (v0 = Valorant-only); flip a game's `ready` flag in games.ts to
  // bring its tab back. `current` is coerced to a ready game so a stale
  // persisted id (e.g. "cs") never strands the user on a placeholder.
  const playable = GAMES.filter((g) => g.ready);
  const current = playable.find((g) => g.id === game) ?? gameById(playable[0]!.id);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.game = current.id;
  }, [current.id]);

  const t = useCallback((s: string) => tr(lang, s), [lang]);

  const goHome = () => {
    if (location.hash) history.replaceState(null, "", location.pathname);
    setGameKey((k) => k + 1);
  };

  const switchGame = (id: GameId) => {
    if (id === game) return;
    if (location.hash) history.replaceState(null, "", location.pathname);
    setGame(id);
  };

  return (
    <SettingsCtx.Provider value={{ t, lang, setLang, theme, setTheme }}>
      <div className="app">
        <header className="appbar">
          <button className="brand" onClick={goHome} title={t("Início")}>
            <span className="logo">11<span className="logo-a">A</span>3</span>
          </button>

          {playable.length > 1 && (
            <nav className="tabs game-tabs">
              {playable.map((g) => (
                <button
                  key={g.id}
                  className={current.id === g.id ? "is-active" : ""}
                  onClick={() => switchGame(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </nav>
          )}

          <div className="appbar-actions">
            <a
              className="support-btn"
              href="https://livepix.gg/vava11a3"
              target="_blank"
              rel="noopener noreferrer"
            >
              ♥ {t("Apoie")}
            </a>
            <Settings />
          </div>
        </header>

        {current.ready ? (
          <Game key={`${current.id}-${gameKey}`} dataUrl={current.dataUrl} />
        ) : (
          <ComingSoon game={current} />
        )}
      </div>
    </SettingsCtx.Provider>
  );
}
