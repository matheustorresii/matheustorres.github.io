import { useState } from "react";
import { ROLE_LABEL_PT, overallClass } from "../labels.js";
import { useT } from "../i18n.js";
import { USER_ID, type Campaign } from "./engine.js";
import { shareUrl } from "./share.js";
import type { Pick } from "./types.js";

const PLACE_EMOJI: Record<string, string> = {
  Campeão: "🏆",
  Vice: "🥈",
  "3º": "🥉",
};

export function FinalCard({
  picks,
  campaign,
  onRestart,
}: {
  picks: Pick[];
  campaign: Campaign;
  onRestart: () => void;
}) {
  const t = useT();
  const isChampion = campaign.finalPlace === "Campeão";
  const avg = Math.round(campaign.userTeam.strength);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = shareUrl(picks, campaign.seed);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t("Copie o link da sua run:"), url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="final-wrap">
      <div className={`final-card ${isChampion ? "is-champion" : ""}`}>
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
        <button className="btn-ghost big" onClick={copyLink}>
          {copied ? `✓ ${t("Link copiado!")}` : `🔗 ${t("Compartilhar run")}`}
        </button>
        <button className="btn-primary big" onClick={onRestart}>
          {t("Nova run")}
        </button>
      </div>
    </div>
  );
}
