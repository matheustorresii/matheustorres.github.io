import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { ROLE_LABEL_PT, overallClass } from "../labels.js";
import { useT } from "../i18n.js";
import { USER_ID, type Campaign } from "./engine.js";
import type { Pick, GameMode } from "./types.js";

type ShareNav = Navigator & {
  canShare?: (data?: { files?: File[] }) => boolean;
  share?: (data?: { files?: File[] }) => Promise<void>;
};

const PLACE_EMOJI: Record<string, string> = {
  Campeão: "🏆",
  Vice: "🥈",
  "3º": "🥉",
};

export function FinalCard({
  picks,
  campaign,
  onRestart,
  mode,
}: {
  picks: Pick[];
  campaign: Campaign;
  onRestart: () => void;
  mode: GameMode;
}) {
  const t = useT();
  const isChampion = campaign.finalPlace === "Campeão";
  const avg = Math.round(campaign.userTeam.strength);
  const cardRef = useRef<HTMLDivElement>(null);
  const [shared, setShared] = useState<"" | "copied" | "saved">("");
  const [busy, setBusy] = useState(false);

  // Export the card as a PNG. Mobile → native share sheet; desktop → clipboard;
  // fallback → download. (No more shareable link — that let people copy runs.)
  const shareImage = async () => {
    const node = cardRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      // Make sure the display fonts are loaded so the capture isn't rendered
      // with a fallback face.
      if (document.fonts?.ready) await document.fonts.ready;
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: bg || "#0e1014", cacheBust: true });
      if (!blob) return;
      const file = new File([blob], "11a3.png", { type: "image/png" });
      const nav = navigator as ShareNav;

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file] });
          return;
        } catch {
          /* user dismissed the sheet → fall through to clipboard/download */
        }
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setShared("copied");
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "11a3.png";
        a.click();
        URL.revokeObjectURL(url);
        setShared("saved");
      }
      setTimeout(() => setShared(""), 2400);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="final-wrap">
      <div ref={cardRef} className={`final-card ${isChampion ? "is-champion" : ""}`}>
        {mode === "almanac" && (
          <div className="hard-seal" title={t("Feito no modo difícil (overall oculto)")}>
            <span className="hs-top">{t("Modo")}</span>
            <span className="hs-main">{t("Difícil")}</span>
          </div>
        )}
        <div className="final-head">
          <div className="final-place">
            {PLACE_EMOJI[campaign.finalPlace] ?? "🎯"} {t(campaign.finalPlace)}
          </div>
          <div className="final-seed">SEED #{campaign.seed}</div>
        </div>

        <div className="final-team-strength">
          {t("Força do time")} <b>{avg}</b>
        </div>

        <div className="final-roster">
          {picks.map((p) => (
            <div className="final-player" key={p.player.playerId + p.squad.key}>
              <span className={overallClass(p.player.overall)}>{p.player.overall}</span>
              <div className="final-player-main">
                <div className="final-player-name">{p.player.displayName}</div>
                <div className="final-player-role muted">{t(ROLE_LABEL_PT[p.role])}</div>
              </div>
              <div className="final-player-src muted">
                {p.squad.teamName}
                <br />
                {p.squad.eventName.replace("Valorant ", "")} · {p.squad.year}
              </div>
            </div>
          ))}
        </div>

        <div className="final-foot muted">11A3</div>
      </div>

      <div className="final-path">
        <div className="path-title muted">{t("Caminho da campanha")}</div>
        {campaign.userMatches.map((m, i) => {
          const us = m.teamA.id === USER_ID ? "a" : "b";
          const opp = us === "a" ? m.teamB : m.teamA;
          const usMaps = us === "a" ? m.series.mapsA : m.series.mapsB;
          const oppMaps = us === "a" ? m.series.mapsB : m.series.mapsA;
          const win = m.winner.id === USER_ID;
          return (
            <div className={`path-row ${win ? "win" : "loss"}`} key={i}>
              <span className="path-stage">{t(m.stage)}</span>
              <span className="path-opp muted">{opp.name}</span>
              <span className="path-score">{usMaps}–{oppMaps}</span>
              <span className={`path-tag ${win ? "win" : "loss"}`}>{win ? "V" : "D"}</span>
            </div>
          );
        })}
      </div>

      <div className="final-actions">
        <button className="btn-ghost big" onClick={shareImage} disabled={busy}>
          {shared === "copied"
            ? `✓ ${t("Imagem copiada!")}`
            : shared === "saved"
              ? `✓ ${t("Imagem salva!")}`
              : `🖼 ${t("Compartilhar imagem")}`}
        </button>
        <button className="btn-primary big" onClick={onRestart}>
          {t("Nova run")}
        </button>
      </div>
    </div>
  );
}
