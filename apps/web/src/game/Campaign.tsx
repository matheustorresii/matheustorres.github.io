import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { DraftSquad } from "@11a3/domain";
import { strengthOf, attackModFromComp, sideProfile } from "@11a3/sim";
import { ROLE_LABEL_PT, overallClass } from "../labels.js";
import { useT } from "../i18n.js";
import {
  runCampaign,
  randomSeedText,
  USER_ID,
  CAMPAIGN_ROUND,
  type Campaign as CampaignData,
} from "./engine.js";
import { Bracket } from "./Bracket.js";
import { FinalCard } from "./FinalCard.js";
import { usePersisted } from "../usePersisted.js";
import type { Pick } from "./types.js";

type Phase = "config" | "watch" | "final";

const SPEEDS = [
  { label: "Lento", ms: 1000 },
  { label: "Normal", ms: 600 },
  { label: "Rápido", ms: 280 },
  { label: "Turbo", ms: 35 },
];
const isSpeed = (v: unknown): boolean => SPEEDS.some((s) => s.ms === v);

export function Campaign({
  picks,
  pool,
  onRestart,
  initialSeed,
}: {
  picks: Pick[];
  pool: DraftSquad[];
  onRestart: () => void;
  initialSeed?: string;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("config");
  const [seed, setSeed] = useState(initialSeed || randomSeedText());
  const [speed, setSpeed] = usePersisted<number>("11a3.speed", SPEEDS[1]!.ms, isSpeed);
  const [data, setData] = useState<CampaignData | null>(null);

  // Playback cursors.
  const [matchIdx, setMatchIdx] = useState(0);
  const [mapIdx, setMapIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(true);

  const start = (playback: "watch" | "auto") => {
    const c = runCampaign(picks, pool, seed.toUpperCase());
    setData(c);
    setMatchIdx(0);
    setMapIdx(0);
    setRevealed(0);
    setPlaying(true);
    // Auto skips the round animation and goes straight to the final card, which
    // now shows the full campaign path.
    setPhase(c.userMatches.length === 0 || playback === "auto" ? "final" : "watch");
  };

  if (phase === "config") {
    const strength = Math.round(strengthOf(picks.map((p) => p.player.overall)));
    const attackMod = attackModFromComp(
      picks.map((p) => ({ role: p.role, overall: p.player.overall })),
      CAMPAIGN_ROUND.sideRoleWeight,
      CAMPAIGN_ROUND.sideQualityWeight,
    );
    const ordered = [...picks].sort((a, b) => b.player.overall - a.player.overall);
    return (
      <div className="camp-config">
        <h2>{t("Seu time")}</h2>
        <div className="review-strength">
          {t("Força do time")} <b>{strength}</b> · {t(sideProfile(attackMod))}
        </div>
        <div className="review-roster">
          {ordered.map((p) => (
            <div className="review-player fade-in" key={p.player.playerId + p.squad.key}>
              <span className={overallClass(p.player.overall)}>{p.player.overall}</span>
              <div className="review-main">
                <div className="review-name">{p.player.displayName}</div>
                <div className="review-role muted">{t(ROLE_LABEL_PT[p.role])}</div>
              </div>
              <div className="review-src muted">
                {p.squad.teamName} · {p.squad.eventName.replace("Valorant ", "")} {p.squad.year}
              </div>
            </div>
          ))}
        </div>
        <p className="muted">
          {t("Enfrenta 15 elencos históricos: fase de grupos → playoffs (chave dupla) → grande final MD5. Mesmo seed + mesma comp = mesma campanha.")}
        </p>
        <label className="seed-field">
          SEED
          <div className="seed-row">
            <span className="hash">#</span>
            <input
              value={seed}
              maxLength={8}
              onChange={(e) => setSeed(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
            />
            <button onClick={() => setSeed(randomSeedText())} title={t("Gerar outro")}>🎲</button>
          </div>
        </label>
        <div className="camp-start">
          <button className="btn-primary big" onClick={() => start("watch")}>
            ▶ {t("Jogo a jogo (round a round)")}
          </button>
          <button className="btn-ghost big" onClick={() => start("auto")}>
            ⏩ {t("Automático")}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "final" && data) {
    return <FinalCard picks={picks} campaign={data} onRestart={onRestart} />;
  }

  if (phase === "watch" && data) {
    return (
      <WatchView
        data={data}
        matchIdx={matchIdx}
        mapIdx={mapIdx}
        revealed={revealed}
        playing={playing}
        speed={speed}
        setSpeed={setSpeed}
        setRevealed={setRevealed}
        setMapIdx={setMapIdx}
        setPlaying={setPlaying}
        onNextMatch={() => {
          if (matchIdx < data.userMatches.length - 1) {
            setMatchIdx((i) => i + 1);
            setMapIdx(0);
            setRevealed(0);
            setPlaying(true);
          } else {
            setPhase("final");
          }
        }}
        onSkipAll={() => setPhase("final")}
      />
    );
  }

  return null;
}

function sideOf(match: { teamA: { id: string } }): "a" | "b" {
  return match.teamA.id === USER_ID ? "a" : "b";
}

/** Maps-won as dots: `needed` circles, the first `won` filled. */
function MapDots({ won, needed }: { won: number; needed: number }) {
  const t = useT();
  return (
    <div className="map-dots" title={`${won}/${needed} ${t("mapas")}`}>
      {Array.from({ length: needed }, (_, i) => (
        <span key={i} className={`dot ${i < won ? "filled" : ""}`} />
      ))}
    </div>
  );
}

interface WatchProps {
  data: CampaignData;
  matchIdx: number;
  mapIdx: number;
  revealed: number;
  playing: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  setRevealed: Dispatch<SetStateAction<number>>;
  setMapIdx: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  onNextMatch: () => void;
  onSkipAll: () => void;
}

function WatchView(props: WatchProps) {
  const t = useT();
  const { data, matchIdx, mapIdx, revealed, playing, speed } = props;
  const match = data.userMatches[matchIdx]!;
  const us = sideOf(match);
  const opp = us === "a" ? match.teamB : match.teamA;
  const maps = match.series.maps;
  const map = maps[mapIdx]!;
  const rounds = map.rounds;
  const needed = Math.floor(match.series.bestOf / 2) + 1; // maps to win the series
  const matchOver = mapIdx === maps.length - 1 && revealed >= rounds.length;

  // Timer: reveal one round per tick.
  useEffect(() => {
    if (!playing || matchOver) return;
    const timer = setTimeout(() => {
      if (revealed < rounds.length) props.setRevealed((r) => r + 1);
      else if (mapIdx < maps.length - 1) {
        props.setMapIdx((m) => m + 1);
        props.setRevealed(0);
      }
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, matchOver, revealed, mapIdx, matchIdx, speed, rounds.length, maps.length]);

  const lastRound = revealed > 0 ? rounds[revealed - 1]! : null;
  const userScore = lastRound ? (us === "a" ? lastRound.scoreA : lastRound.scoreB) : 0;
  const oppScore = lastRound ? (us === "a" ? lastRound.scoreB : lastRound.scoreA) : 0;
  const userAttacking = (lastRound ? lastRound.attacker : "a") === us;
  const nextMatch = data.userMatches[matchIdx + 1];
  const nextOpp = nextMatch ? (nextMatch.teamA.id === USER_ID ? nextMatch.teamB : nextMatch.teamA) : null;
  // Report reveal: everything up to (but not the result of) the user's next match
  // — so they see all of a finished phase and who they'll face next.
  // No next match (eliminated / champion) → reveal the whole bracket.
  const doneRank = nextMatch ? nextMatch.stageRank - 1 : 99;
  const frontierRank = nextMatch ? nextMatch.stageRank : 99;

  const completedMaps = mapIdx + (revealed >= rounds.length ? 1 : 0);
  const usMaps = maps.slice(0, completedMaps).filter((m) => (us === "a" ? m.winner === "a" : m.winner === "b")).length;
  const oppMaps = completedMaps - usMaps;

  const feed = rounds.slice(0, revealed).slice(-7).reverse();
  const matchWin = match.winner.id === USER_ID;
  return (
    <div className="watch">
      <div className="watch-top">
        <span className="watch-progress">
          {t("Jogo")} {matchIdx + 1} · <b>{t(match.stage)}</b>
        </span>
        {!matchOver && (
          <div className="speeds">
            {SPEEDS.map((s) => (
              <button key={s.ms} className={speed === s.ms ? "is-active" : ""} onClick={() => props.setSpeed(s.ms)}>
                {t(s.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      {matchOver ? (
        <div className="report fade-in">
          <div className={`report-head ${matchWin ? "win" : "loss"}`}>
            <div className="mr-title">{matchWin ? t("Vitória") : t("Derrota")}</div>
            <div className="report-score">
              <span className={matchWin ? "lead" : ""}>{data.userTeam.name}</span>
              <b> {usMaps}–{oppMaps} </b>
              {opp.name}
            </div>
            <div className="report-maps">
              {maps.map((m, i) => {
                const uu = us === "a" ? m.scoreA : m.scoreB;
                const oo = us === "a" ? m.scoreB : m.scoreA;
                const won = us === "a" ? m.winner === "a" : m.winner === "b";
                return (
                  <span key={i} className={`report-map ${won ? "won" : "lost"}`}>
                    <span className="rm-name">{m.name}</span>
                    <span className="rm-sc">{uu}<span className="muted">–</span>{oo}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {nextOpp ? (
            <div className="report-next">{t("Próximo")} · <b>{t(nextMatch!.stage)}</b> vs <b>{nextOpp.name}</b></div>
          ) : (
            <div className="report-next muted">{t("Fim do seu caminho neste torneio.")}</div>
          )}

          <Bracket result={data.result} doneRank={doneRank} frontierRank={frontierRank} />

          <button className="btn-primary big" onClick={props.onNextMatch}>{t("Continuar →")}</button>
        </div>
      ) : (
        <>
          <div className="scoreboard">
            <div className="sb-team is-user">
              <div className="sb-name">{data.userTeam.name}</div>
              <div className={`sb-side ${userAttacking ? "atk" : "def"}`}>
                {userAttacking ? `⚔ ${t("Atacando")}` : `🛡 ${t("Defendendo")}`}
              </div>
              <MapDots won={usMaps} needed={needed} />
            </div>
            <div className="sb-center">
              <div className="sb-map muted">
                {map.name} · {t("mapa")} {mapIdx + 1}/{maps.length} · {match.series.bestOf === 5 ? "MD5" : "MD3"}
              </div>
              <div className="sb-score" key={`${userScore}-${oppScore}`}>
                <span className={userScore > oppScore ? "lead" : ""}>{userScore}</span>
                <span className="sep">:</span>
                <span className={oppScore > userScore ? "lead" : ""}>{oppScore}</span>
              </div>
            </div>
            <div className="sb-team sb-opp">
              <div className="sb-name">{opp.name}</div>
              <div className={`sb-side ${userAttacking ? "def" : "atk"}`}>
                {userAttacking ? `🛡 ${t("Defendendo")}` : `⚔ ${t("Atacando")}`}
              </div>
              <MapDots won={oppMaps} needed={needed} />
            </div>
          </div>

          <div className="round-feed">
            {feed.map((r) => {
              const won = r.winner === us;
              const u = us === "a" ? r.scoreA : r.scoreB;
              const o = us === "a" ? r.scoreB : r.scoreA;
              return (
                <div key={r.number} className={`feed-row ${won ? "won" : "lost"}`}>
                  <span className="feed-rn">R{r.number}{r.isPistol ? ` ·${t("pistol")}` : ""}</span>
                  <span className="feed-who">{won ? data.userTeam.name : opp.name} {t("levou")}</span>
                  <span className="feed-sc">{u}-{o}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
