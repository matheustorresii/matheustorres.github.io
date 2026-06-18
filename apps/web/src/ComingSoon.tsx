import { useT } from "./i18n.js";
import type { GameDef } from "./games.js";

/** Placeholder shown for a game whose data isn't ingested yet. */
export function ComingSoon({ game }: { game: GameDef }) {
  const t = useT();
  return (
    <div className="coming fade-in">
      <div className="coming-mark">{game.mark}</div>
      <h2>{game.name}</h2>
      <p className="coming-tag muted">{t("Base em construção — em breve.")}</p>
    </div>
  );
}
